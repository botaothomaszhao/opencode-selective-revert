import { Plugin } from "@opencode/plugin/tui"
import { i18n, type Language } from "./i18n"
import { SelectiveRevert } from "./rpc"

type Boundary = { from: string; to?: string }
type ApplyResult = { ok: boolean; files?: string[]; message?: string }
type UserMessage = { id: string; type: "user"; text: string; time: { created: number } }

const text = (error: unknown) => (error instanceof Error ? error.message : String(error))

function timeLabel(input: number, language: Language) {
  return new Date(input).toLocaleTimeString(language === "zh" ? "zh-CN" : "en-US", { timeStyle: "short" })
}

export default Plugin.define({
  id: "selective-revert.tui",
  async setup(context) {
    const { language, t } = i18n(context.options.language)
    // 只记录“回滚暂存”对应的边界，用于 /redo 时把文件一起恢复
    const [boundaries, updateBoundaries] = context.storage.store<Record<string, Boundary>>(
      "selective-revert.boundaries",
      { initial: {} },
    )

    const forget = (sessionID: string) =>
      updateBoundaries((draft) => {
        delete draft[sessionID]
      })

    const save = (sessionID: string, boundary: Boundary) =>
      updateBoundaries((draft) => {
        draft[sessionID] = boundary
      })

    const copy = async (value: string) => {
      if (!value.trim()) return false
      try {
        const result = (await context.client.rpc(SelectiveRevert).copy({ text: value })) as { ok: boolean }
        return result.ok
      } catch {
        return false
      }
    }

    const redo = async (sessionID: string) => {
      const boundary = boundaries[sessionID]
      if (!boundary) return
      const session = context.data.session.get(sessionID)
      if (!session) {
        await forget(sessionID)
        return
      }
      try {
        const diffs = await context.client.session.diff({
          sessionID,
          from: boundary.from,
          to: boundary.to,
          context: 1,
        })
        if (diffs.length > 0) {
          const result = (await context.client.rpc(SelectiveRevert).apply({
            directory: session.location.directory,
            reverse: false,
            patches: diffs.map((diff) => ({ file: diff.file, patch: diff.patch })),
          })) as ApplyResult
          if (!result.ok) {
            context.ui.toast.show({
              message: t.redoFileFailed(result.message ?? t.redoUnknown),
              variant: "error",
              duration: 8000,
            })
            return
          }
        }
        await forget(sessionID)
        context.ui.toast.show({ message: t.redoSuccess, variant: "success" })
      } catch (error) {
        context.ui.toast.show({ message: t.redoFailed(text(error)), variant: "error", duration: 8000 })
      }
    }

    const offCleared = context.data.on("session.revert.cleared", (event) => {
      void redo(event.data.sessionID)
    })
    const offCommitted = context.data.on("session.revert.committed", (event) => {
      void forget(event.data.sessionID)
    })
    const offStaged = context.data.on("session.revert.staged", (event) => {
      const boundary = boundaries[event.data.sessionID]
      if (!boundary) return
      if (event.data.revert.messageID !== boundary.from || (event.data.revert.files?.length ?? 0) > 0) {
        void forget(event.data.sessionID)
      }
    })
    const offDeleted = context.data.on("session.deleted", (event) => {
      void forget(event.data.sessionID)
    })

    context.keymap.layer(() => ({
      mode: "global",
      commands: [
        {
          id: "selective-revert.run",
          title: t.commandTitle,
          description: t.commandDescription,
          group: t.commandGroup,
          palette: true,
          slash: { name: "revert-session" },
          enabled: () => context.ui.router.current().type === "session",
          run: async () => {
            const route = context.ui.router.current()
            if (route.type !== "session") {
              context.ui.toast.show({ message: t.noSession, variant: "error" })
              return
            }
            const sessionID = route.sessionID
            const session = context.data.session.get(sessionID)
            if (!session) {
              context.ui.toast.show({ message: t.sessionMissing, variant: "error" })
              return
            }
            if (context.data.session.status(sessionID) !== "idle") {
              context.ui.toast.show({ message: t.sessionRunning, variant: "error" })
              return
            }
            if (session.revert) {
              context.ui.toast.show({ message: t.revertStaged, variant: "error" })
              return
            }
            const directory = session.location.directory
            const running = context.data.session
              .list()
              .some(
                (item) =>
                  item.id !== sessionID &&
                  item.location?.directory === directory &&
                  context.data.session.status(item.id) === "running",
              )
            if (running) {
              context.ui.toast.show({ message: t.workspaceRunning, variant: "error", duration: 6000 })
              return
            }

            let users: UserMessage[]
            try {
              const messages = await context.client.session.context({ sessionID })
              users = messages.filter((message): message is UserMessage => message.type === "user")
            } catch (error) {
              context.ui.toast.show({ message: t.readMessagesFailed(text(error)), variant: "error", duration: 8000 })
              return
            }
            if (users.length === 0) {
              context.ui.toast.show({ message: t.noUserMessages, variant: "error" })
              return
            }

            const ordered = [...users].reverse()
            const pendingSelection = context.ui.dialog.select<string>({
              title: t.selectTitle,
              current: ordered[0]!.id,
              options: ordered.map((message) => ({
                title: message.text.replace(/\n/g, " ") || t.attachment,
                value: message.id,
                footer: timeLabel(message.time.created, language),
              })),
            })
            context.ui.dialog.set({ size: "large" })
            const selected = await pendingSelection
            if (!selected) return

            const index = users.findIndex((message) => message.id === selected)
            if (index < 0) return
            const from = users[index]!
            const to = index < users.length - 1 ? users[users.length - 1]!.id : undefined

            let diffs
            try {
              diffs = await context.client.session.diff({ sessionID, from: from.id, to, context: 1 })
            } catch (error) {
              context.ui.toast.show({ message: t.diffFailed(text(error)), variant: "error", duration: 8000 })
              return
            }
            if (diffs.some((diff) => diff.more || !diff.patch.trim())) {
              await context.ui.dialog.alert({
                title: t.cannotRevert,
                message: t.cannotRevertMessage,
              })
              return
            }

            const files = diffs.map((diff) => diff.file)
            const additions = diffs.reduce((sum, diff) => sum + diff.additions, 0)
            const deletions = diffs.reduce((sum, diff) => sum + diff.deletions, 0)
            let isGit = false
            try {
              await context.data.location.vcs.sync(session.location)
              isGit = context.data.location.vcs.info(session.location)?.provider === "git"
            } catch {}
            const summary = [
              t.summaryTarget,
              from.text.trim() || t.attachment,
              "",
              ...(files.length > 0
                ? [
                    t.summaryFiles(files.length, additions, deletions),
                    ...files.slice(0, 12).map((file) => `  ${file}`),
                    ...(files.length > 12 ? [t.summaryMore(files.length - 12)] : []),
                    "",
                    t.summaryOverlap,
                  ]
                : [isGit ? t.summaryEmptyGit : t.summaryEmptyNoGit]),
              t.summaryCopy,
            ].join("\n")
            const pendingConfirm = context.ui.dialog.confirm({
              title: t.confirmTitle,
              message: summary,
              label: { confirm: t.confirm, cancel: t.cancel },
            })
            context.ui.dialog.set({ size: "large" })
            const confirmed = await pendingConfirm
            if (!confirmed) return

            const copied = await copy(from.text)
            if (!copied && from.text.trim()) {
              await context.ui.dialog.alert({
                title: t.copyFailedTitle,
                message: t.copyFailedMessage(from.text),
              })
              return
            }

            try {
              await context.client.session.revert.stage({ sessionID, messageID: from.id, files: false })
            } catch (error) {
              context.ui.toast.show({ message: t.stageFailed(text(error)), variant: "error", duration: 8000 })
              return
            }

            if (diffs.length > 0) {
              let result: ApplyResult
              try {
                result = (await context.client.rpc(SelectiveRevert).apply({
                  directory,
                  reverse: true,
                  patches: diffs.map((diff) => ({ file: diff.file, patch: diff.patch })),
                })) as ApplyResult
              } catch (error) {
                result = { ok: false, message: text(error) }
              }
              if (!result.ok) {
                await context.client.session.revert.clear({ sessionID }).catch(() => {})
                await context.ui.dialog.alert({
                  title: t.abortTitle,
                  message: t.abortMessage(result.message ?? t.patchFailed),
                })
                return
              }
              try {
                const current = await context.client.session.get({ sessionID })
                if (current.revert?.messageID !== from.id) {
                  await context.client.rpc(SelectiveRevert).apply({
                    directory,
                    reverse: false,
                    patches: diffs.map((diff) => ({ file: diff.file, patch: diff.patch })),
                  })
                  context.ui.toast.show({ message: t.cancelled, variant: "info" })
                  return
                }
              } catch {
                // 状态查询失败时保留回滚结果，不影响 /redo
              }
              await save(sessionID, { from: from.id, to })
            }

            context.ui.toast.show({
              message: copied ? t.copied : t.reverted,
              variant: "success",
              duration: 4000,
            })
          },
        },
      ],
    }))

    return () => {
      offCleared()
      offCommitted()
      offStaged()
      offDeleted()
    }
  },
})

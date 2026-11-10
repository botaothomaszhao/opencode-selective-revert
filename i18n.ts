export type Language = "zh" | "en"

const zh = {
  commandTitle: "选择性回滚会话",
  commandDescription: "回滚到指定用户消息，保留其他会话对同一文件的改动",
  commandGroup: "会话",

  redoFileFailed: (message: string) => `对话已恢复，文件未能自动恢复：${message}`,
  redoUnknown: "未知错误",
  redoSuccess: "文件已随 /redo 恢复",
  redoFailed: (message: string) => `恢复文件失败：${message}`,

  noSession: "请先打开一个会话",
  sessionMissing: "会话不存在",
  sessionRunning: "会话正在运行，先停止再回滚",
  revertStaged: "已有暂存的回滚，请先 /redo 取消",
  workspaceRunning: "同一工作区还有其他会话在运行",
  readMessagesFailed: (message: string) => `读取会话消息失败：${message}`,
  noUserMessages: "当前会话没有可回滚的用户消息",

  selectTitle: "回滚到哪条消息之前",
  attachment: "[附件消息]",
  diffFailed: (message: string) => `读取 diff 失败：${message}`,

  cannotRevert: "无法回滚",
  cannotRevertMessage: "这次改动包含被截断的 patch 或二进制文件，无法安全应用。",

  summaryTarget: "回滚到：",
  summaryFiles: (count: number, additions: number, deletions: number) =>
    `文件 ${count} 个，+${additions} / -${deletions}`,
  summaryMore: (count: number) => `  …还有 ${count} 个`,
  summaryOverlap: "与其他会话重叠的修改会整体中止，不会留下半成品。",
  summaryEmptyGit: "这段对话没有可回滚的文件改动，只会回滚对话。",
  summaryEmptyNoGit: "当前目录不是 Git 仓库，OpenCode 没有文件快照；这次只会回滚对话，不会改文件。",
  summaryCopy: "确认后会尝试把这条消息复制到剪贴板。",

  confirmTitle: "选择性回滚",
  confirm: "回滚",
  cancel: "取消",

  copyFailedTitle: "复制失败，已取消回滚",
  copyFailedMessage: (message: string) => `未能把消息复制到剪贴板，请先从下面手动复制，再重新执行。\n\n${message}`,

  stageFailed: (message: string) => `暂存对话回滚失败：${message}`,

  abortTitle: "回滚中止",
  abortMessage: (message: string) => `${message}\n对话回滚已取消，文件未改动。`,
  patchFailed: "补丁无法应用",

  cancelled: "回滚已取消，文件已恢复",
  copied: "已复制到剪贴板",
  reverted: "已回滚对话",

  exitCode: (code: number) => `命令退出码 ${code}`,
  noGitRoot: "无法定位 git 仓库根目录",
  applyFailed: "应用补丁失败",
}

const en: typeof zh = {
  commandTitle: "Selective session revert",
  commandDescription: "Revert to a user message and keep other sessions' changes to the same files",
  commandGroup: "Session",

  redoFileFailed: (message) => `Conversation restored, but files could not be restored automatically: ${message}`,
  redoUnknown: "unknown error",
  redoSuccess: "Files restored with /redo",
  redoFailed: (message) => `Failed to restore files: ${message}`,

  noSession: "Open a session first",
  sessionMissing: "Session not found",
  sessionRunning: "The session is running. Stop it before reverting.",
  revertStaged: "A revert is already staged. Run /redo to cancel it first.",
  workspaceRunning: "Another session in the same workspace is running",
  readMessagesFailed: (message) => `Failed to read session messages: ${message}`,
  noUserMessages: "This session has no user messages to revert to",

  selectTitle: "Revert to before which message?",
  attachment: "[attachment message]",
  diffFailed: (message) => `Failed to read diff: ${message}`,

  cannotRevert: "Cannot revert",
  cannotRevertMessage: "This change contains a truncated patch or a binary file and cannot be applied safely.",

  summaryTarget: "Revert to:",
  summaryFiles: (count, additions, deletions) =>
    `${count} file${count === 1 ? "" : "s"}, +${additions} / -${deletions}`,
  summaryMore: (count) => `  …and ${count} more`,
  summaryOverlap:
    "If changes overlap with another session, the whole revert is aborted without leaving a partial result.",
  summaryEmptyGit: "This conversation has no file changes to revert; only the conversation will be reverted.",
  summaryEmptyNoGit:
    "The current directory is not a Git repository, so OpenCode has no file snapshots. Only the conversation will be reverted; files are left untouched.",
  summaryCopy: "After you confirm, the message will be copied to the clipboard.",

  confirmTitle: "Selective revert",
  confirm: "Revert",
  cancel: "Cancel",

  copyFailedTitle: "Copy failed; revert cancelled",
  copyFailedMessage: (message) =>
    `Could not copy the message to the clipboard. Copy it manually below, then run the command again.\n\n${message}`,

  stageFailed: (message) => `Failed to stage the conversation revert: ${message}`,

  abortTitle: "Revert aborted",
  abortMessage: (message) => `${message}\nThe conversation revert was cancelled; files were not changed.`,
  patchFailed: "The patch could not be applied",

  cancelled: "Revert cancelled; files restored",
  copied: "Copied to clipboard",
  reverted: "Conversation reverted",

  exitCode: (code) => `Command exited with code ${code}`,
  noGitRoot: "Could not locate the Git repository root",
  applyFailed: "Failed to apply the patch",
}

export type Messages = typeof zh

export function resolveLanguage(value: unknown): Language {
  if (value === "zh" || value === "en") return value
  return Intl.DateTimeFormat().resolvedOptions().locale.toLowerCase().startsWith("zh") ? "zh" : "en"
}

export function i18n(value: unknown) {
  const language = resolveLanguage(value)
  return { language, t: (language === "zh" ? zh : en) as Messages }
}

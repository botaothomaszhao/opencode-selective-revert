import { spawn } from "node:child_process"
import { randomUUID } from "node:crypto"
import { promises as fs } from "node:fs"
import os from "node:os"
import path from "node:path"
import { Plugin } from "@opencode/plugin"
import { i18n, type Messages } from "./i18n"
import { SelectiveRevert } from "./rpc"

type Patch = { file: string; patch: string }
type Input = { directory: string; reverse?: boolean; patches: Patch[] }

function run(command: string, args: string[], options?: { input?: string; cwd?: string }) {
  return new Promise<{ code: number; stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options?.cwd,
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    })
    let stdout = ""
    let stderr = ""
    child.stdout.setEncoding("utf8").on("data", (chunk: string) => (stdout += chunk))
    child.stderr.setEncoding("utf8").on("data", (chunk: string) => (stderr += chunk))
    child.on("error", reject)
    child.on("close", (code) => resolve({ code: code ?? -1, stdout, stderr }))
    child.stdin.on("error", () => {})
    child.stdin.end(options?.input ?? "")
  })
}

function runGit(cwd: string, args: string[], input?: string) {
  return run("git", ["-C", cwd, "-c", "core.autocrlf=false", "-c", "core.safecrlf=false", ...args], { input })
}

function toResult(outcome: { code: number; stdout: string; stderr: string }, t: Messages) {
  return outcome.code === 0
    ? { ok: true }
    : { ok: false, message: outcome.stderr.trim() || outcome.stdout.trim() || t.exitCode(outcome.code) }
}

function output(patches: Patch[]) {
  return patches.map((item) => (item.patch.endsWith("\n") ? item.patch : item.patch + "\n")).join("")
}

async function copyWindows(text: string) {
  const file = path.join(os.tmpdir(), `opencode-clipboard-${randomUUID()}.txt`)
  await fs.writeFile(file, text, "utf8")
  try {
    const quoted = file.replaceAll("'", "''")
    return await run("powershell.exe", [
      "-NoProfile",
      "-WindowStyle",
      "Hidden",
      "-Command",
      `Set-Clipboard -Value (Get-Content -Raw -Encoding UTF8 '${quoted}')`,
    ])
  } finally {
    await fs.rm(file, { force: true })
  }
}

function copy(text: string) {
  if (process.platform === "win32") return copyWindows(text)
  if (process.platform === "darwin") return run("pbcopy", [], { input: text })
  return run("wl-copy", [], { input: text })
}

export default Plugin.define({
  id: "selective-revert",
  async setup(ctx) {
    const { t } = i18n(ctx.options.language)
    await ctx.rpc.register(SelectiveRevert, {
      copy: async (raw) => {
        try {
          return toResult(await copy((raw as { text: string }).text), t)
        } catch (error) {
          return { ok: false, message: error instanceof Error ? error.message : String(error) }
        }
      },
      apply: async (raw) => {
        const input = raw as Input
        if (input.patches.length === 0) return { ok: true, files: [] }
        try {
          const root = await runGit(input.directory, ["rev-parse", "--show-toplevel"])
          if (root.code !== 0) {
            return { ok: false, message: root.stderr.trim() || t.noGitRoot }
          }
          const worktree = root.stdout.trim()
          const flags = input.reverse === false ? [] : ["-R"]
          const patch = output(input.patches)
          const check = await runGit(worktree, ["apply", ...flags, "--check", "--whitespace=nowarn"], patch)
          if (check.code !== 0) {
            return { ok: false, message: check.stderr.trim() || check.stdout.trim() || t.patchFailed }
          }
          const applied = await runGit(worktree, ["apply", ...flags, "--whitespace=nowarn"], patch)
          if (applied.code !== 0) {
            return { ok: false, message: applied.stderr.trim() || applied.stdout.trim() || t.applyFailed }
          }
          return { ok: true, files: input.patches.map((item) => item.file) }
        } catch (error) {
          return { ok: false, message: error instanceof Error ? error.message : String(error) }
        }
      },
    })
  },
})

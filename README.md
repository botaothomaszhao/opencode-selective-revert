# selective-revert

English | [简体中文](README.zh-CN.md)

Per-session, per-message file revert for OpenCode.

The built-in `/undo` restores whole files to their state before the session. When two sessions touched the same file, it also discards the later session's changes. This plugin reverse-applies only the hunks that belong to the selected session, leaving other sessions' edits in place.

## Requirements

- OpenCode v2 (tested with 2.2.7)
- Git
- The session directory must be inside a Git worktree for file revert; conversation-only revert works elsewhere
- On Linux, `wl-copy` from `wl-clipboard` (`apt install wl-clipboard` / `pacman -S wl-clipboard`). The message is copied to the clipboard on confirm; without it the revert is cancelled

## Install

```sh
opencode plugin add github:botaothomaszhao/opencode-selective-revert
```

Or clone the repository into the global plugin directory:

```sh
git clone https://github.com/botaothomaszhao/opencode-selective-revert.git ~/.config/opencode/plugins/selective-revert
```

On Windows the global plugin directory is `%USERPROFILE%\.config\opencode\plugins`.

Use only one install method at a time, otherwise the plugin loads twice.

### Language

`auto` follows the system locale. Set `language` to `zh` or `en` to override it:

```jsonc
{
  "plugins": [
    {
      "package": "github:botaothomaszhao/opencode-selective-revert",
      "options": { "language": "en" }
    }
  ]
}
```

## Usage

```text
/revert-session
```

1. Choose the message boundary. That message and everything after it are reverted.
2. Review the file list and line changes. On confirm, the message text is copied to the clipboard.
3. The conversation is staged through the built-in revert path; files are reverse-applied with `git apply -R`.
4. A toast confirms the copy so you can paste the message back.
5. `/redo` restores both the conversation and the files.

The command is also available in the command palette as "Selective session revert".

## Behavior

- Diffs come from `GET /api/session/{id}/diff` with `context=1`, the same source as the built-in "this conversation only" diff. One line of context reduces false conflicts when another session edited adjacent lines.
- File operations only touch the working tree; `index`, `HEAD`, branches, and commits are untouched. No new commit is needed.
- The reverse patch runs `git apply -R --check` first. It is applied only when every hunk fits; conflicts abort the whole operation without leaving a partial result.
- Conversation revert uses `revert/stage` with `files: false`, and the plugin handles files. `/redo` applies the same diff forward.

## Limitations

- Changes that touch the same code as another session cannot be resolved automatically; the revert aborts.
- Foreground subagent changes live inside the parent turn snapshot and are reverted with it. A `background: true` subagent that writes files after the parent session ends is outside this diff.
- Steered messages in the same turn may produce a diff that starts at the beginning of that turn.
- The message list comes from the session context after the latest compaction; earlier messages cannot be selected.
- The plugin API cannot put old message text back into the prompt. The confirmation dialog shows the message and copies it to the clipboard. If copying fails, the revert is cancelled and the message is shown instead.
- Clipboard access uses the machine that runs the OpenCode server. With a remote server, the remote clipboard is used. On Linux the copy needs a Wayland session; on X11 or a headless host it fails, so copy the message from the confirmation dialog and run the command again.
- The session directory must be inside a Git worktree. Outside Git, only the conversation can be reverted, and the confirmation dialog says so. Binary files, oversized files, and truncated patches are rejected.

## Development

The repository is the plugin directory. Place or clone it under `.opencode/plugins/` in a project, or under `~/.config/opencode/plugins/` globally, and OpenCode loads the TypeScript sources directly. There is no build step. Run `opencode service restart` if a change is not picked up.

## License

MIT

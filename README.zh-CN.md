# selective-revert

[English](README.md) | 简体中文

给 OpenCode 增加按会话、按消息回滚文件改动的能力。

内置 `/undo` 按文件路径把整个文件恢复到会话之前；当两个会话改过同一个文件时，后面的会话改动也会一起丢失。本插件反向应用该会话的 diff，只撤掉属于它的 hunk。

## 环境要求

- OpenCode v2（已在 2.2.7 测试）
- Git
- 会话目录位于 Git worktree 内才能回滚文件；否则只能回滚对话
- Linux 需要 `wl-clipboard` 提供的 `wl-copy`（`apt install wl-clipboard` / `pacman -S wl-clipboard`）。确认后要把消息复制到剪贴板，缺少该命令时回滚会被取消

## 安装

```sh
opencode plugin add github:botaothomaszhao/opencode-selective-revert
```

或克隆到全局插件目录：

```sh
git clone https://github.com/botaothomaszhao/opencode-selective-revert.git ~/.config/opencode/plugins/selective-revert
```

Windows 的全局插件目录是 `%USERPROFILE%\.config\opencode\plugins`。

同一时间只用一种安装方式，否则插件会加载两次。

### 语言

`auto` 跟随系统语言。需要固定语言时传 `language`：

```jsonc
{
  "plugins": [
    {
      "package": "github:botaothomaszhao/opencode-selective-revert",
      "options": { "language": "zh" }
    }
  ]
}
```

## 使用

```text
/revert-session
```

1. 选择回滚边界，这条消息及之后的改动会被撤销。
2. 确认文件列表和增删行数；确认后会把这条消息复制到系统剪贴板。
3. 对话按内置 revert 的方式暂存回滚，文件通过 `git apply -R` 反向应用。
4. 回滚完成后右上角短暂提示已复制到剪贴板，可以直接粘贴。
5. 按内置 `/redo` 可以同时恢复对话和文件。

也可以在命令面板中执行“选择性回滚会话”。

## 行为

- diff 来自 `GET /api/session/{id}/diff`（`context=1`），和内置“只看这个对话”的 diff 同源；只带 1 行上下文，减少另一个会话改了相邻行时误判冲突。
- 文件操作只改工作区，不动 `index`、`HEAD`、分支和 commit；没有新 commit 也能用。
- 反向补丁先 `git apply -R --check`，全部可应用才真正执行；冲突时整体中止，不留下半成品。
- 使用 `revert/stage` 的 `files: false` 只回滚对话，文件由插件处理；`/redo` 时插件再正向应用同一 diff。

## 限制

- 两个会话改到同一段代码时无法自动判断，回滚会中止。
- foreground 子代理的改动在父会话的 turn 快照内，会被一起回滚；`background: true` 的子代理如果父会话结束后才写文件，不在本次 diff 内。
- 同一 turn 内被 steer 的消息，diff 可能从该 turn 开头算起。
- 消息列表来自最近一次 compaction 之后的会话上下文；更早的消息选不到。
- 插件 API 不能把旧消息文本放回输入框；确认框会显示消息，确认后复制到剪贴板。复制失败时会取消回滚并显示消息，避免丢失。
- 剪贴板是 OpenCode 服务所在机器的；连接远程服务器时复制的是远端剪贴板。Linux 上复制依赖 Wayland 会话，X11 或无显示环境会失败，此时从确认框手动复制消息再重跑命令。
- 需要会话目录位于 Git worktree 内；非 Git 目录只能回滚对话，确认框会明确提示。二进制文件、超大文件、被截断的 patch 会被拒绝。

## 开发

仓库本身就是插件目录。放在项目的 `.opencode/plugins/` 下，或全局的 `~/.config/opencode/plugins/` 下，OpenCode 会直接加载 TypeScript 源码，没有构建步骤。改动没有生效时执行 `opencode service restart`。

## 许可证

MIT

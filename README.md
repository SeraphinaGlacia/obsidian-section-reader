# Focus Cards

Focus Cards 是一款面向 Obsidian 长笔记复习的卡片浏览插件。它把当前 Markdown 笔记中独立成行的 `---` 视为卡片边界，一次只展示一个知识点。原文不会被修改。

Focus Cards is an Obsidian card-reading mode for reviewing long notes one section at a time. A root-level standalone `---` separates cards, while the Markdown file remains unchanged.

## 使用 / Usage

```markdown
# 第一个知识点

内容……

---

# 第二个知识点

内容……
```

- 点击左侧 Ribbon 中的“切换专注卡片”图标，或运行命令“切换卡片浏览模式”。再次触发该动作或按 `Esc` 返回原 Markdown 视图。
- 桌面端使用左右方向键翻卡；移动端双击屏幕左侧边缘返回上一张，双击右侧边缘进入下一张。横向滑动仍由 Obsidian 用于打开左右侧边栏。
- 插件不设默认全局快捷键，可在“设置 → 快捷键”中为 Focus Cards 命令绑定。
- 手机端可在 Obsidian 的移动工具栏或 Quick Action 中固定切换命令。

- Click **Toggle Focus Cards** in the ribbon or run **Toggle card browsing mode**. Trigger it again, or press `Esc`, to restore the original Markdown view.
- Use the left/right arrow keys on desktop. On mobile, double-tap the left edge for the previous card or the right edge for the next card; horizontal swipes remain available to Obsidian's sidebars.
- No global hotkey is assigned by default. Bind any Focus Cards command under **Settings → Hotkeys**.
- On mobile, pin the toggle command to the mobile toolbar or Quick Action.

## 命令 / Commands

| 命令 / Command | ID |
| --- | --- |
| 切换卡片浏览模式 / Toggle card browsing mode | `toggle-card-view` |
| 下一张卡片 / Next card | `next-card` |
| 上一张卡片 / Previous card | `previous-card` |

三个命令均不设置默认快捷键。

All three commands ship without default hotkeys.

## 界面语言 / UI language

插件加载时读取 Obsidian 当前的界面语言：中文语言代码（`zh`、`zh-CN`、`zh-TW` 等）显示中文；英语以及其他所有语言统一显示英文。修改 Obsidian 的界面语言后，请重新加载插件或重启 Obsidian，使全部命令名称同步刷新。

At plugin load, Focus Cards reads Obsidian's current UI language. Chinese locales use Chinese; English and every other locale use English. Reload the plugin or restart Obsidian after changing the application language.

## 分隔规则 / Separator rules

只有满足以下条件的行才会分割卡片：

1. 该行源文字符恰好是 `---`，不含空格或其他字符。
2. 它是 Markdown 根层级的水平分隔线。

因此，YAML frontmatter、代码块、引用、列表、HTML 块、Setext 标题中的同形文本，以及 `***` / `___` 都不会分卡。连续、开头或结尾的分隔线产生的空卡片会被忽略。

Only a root-level line whose exact source is `---` splits cards. Lookalikes inside YAML, fenced code, blockquotes, lists, HTML blocks, or Setext headings do not split. Neither do `***` or `___`. Empty cards created by adjacent, leading, or trailing separators are ignored.

## 功能边界 / Scope

- 整篇笔记由 Obsidian 原生 Markdown 渲染器一次渲染，以保留跨卡片脚注、引用定义、链接、嵌入和任务交互的完整语境。
- 卡片内容沿用普通 Markdown 视图的可读行宽和页边距设置，不会贴住桌面窗口两侧。
- 每张卡片可独立纵向滚动；同一次浏览中返回时保留滚动位置。
- 内部链接总是在新标签的普通 Markdown 视图打开。
- 浏览不会修改 Markdown；只有主动勾选任务复选框时，插件才按 Obsidian 的正常任务行为更新对应标记。
- v0.1 不包含编辑、全屏演示、自动播放、导出、主题系统、自定义分隔符或可见翻页按钮。

## 安装 / Installation

社区插件目录上架后，可在 Obsidian 中直接搜索 **Focus Cards**。手动安装时，将 Release 中的 `main.js`、`manifest.json` 和 `styles.css` 放入：

```text
<vault>/.obsidian/plugins/focus-cards/
```

Requires Obsidian 1.8.7 or later. Desktop, iOS, and Android are supported.

## 开发 / Development

```bash
npm install
npm run dev
```

完整验证：

```bash
npm run check
```

`npm run check` 依次针对当前 API 与最低支持的 Obsidian 1.8.7 API 运行 TypeScript 类型检查，再运行 ESLint、Vitest 和生产构建。

## License

[MIT](LICENSE)

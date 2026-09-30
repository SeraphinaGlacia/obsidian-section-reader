<h1 align="center">Section Reader</h1>

<p align="center">
  <a href="README.md">English</a> ·
  <a href="#31-安装">安装</a> ·
  <a href="#32-使用">开始使用</a>
</p>

> Read long Markdown notes one section at a time, with native links, embeds, task interactions, and reading progress preserved.

Section Reader 是一款 Obsidian 长笔记阅读插件：把根层级 `---` 分隔的段落变成一次只显示一段的阅读视图，仍保留原生链接、嵌入、任务交互与阅读进度，笔记始终保存在同一个文件中。浏览本身不会修改 Markdown；主动勾选或取消任务复选框时，会更新对应的 Markdown 标记。

需要 **Obsidian 1.8.7 或更新版本**，面向桌面端与移动端。

## 一、实际效果

![连续屏幕录制：浏览整篇笔记、按演示快捷键进入单段视图，再用左右方向键翻页](docs/media/section-reader-demo.gif)

按 **Ctrl + Alt + U** → 切换为逐段阅读 → 使用 **→ / ←** 前后翻页。按键标识对应录制时实际按下的键。

> [!NOTE]
> **Ctrl + Alt + U 仅为本演示设置的自定义快捷键。** Section Reader 默认不分配切换快捷键，可在“设置 → 快捷键”中自行绑定。

<details>
<summary>对比原笔记与单段视图</summary>

**原笔记：** 多个段落连续显示在普通阅读视图中。

![Obsidian 普通阅读视图中的原笔记，显示多个段落和大纲](docs/media/original-note.png)

**Section Reader：** 一次只显示一段，右侧大纲仍然可用。

![同一篇笔记的 Section Reader 视图，显示当前段落并保留大纲](docs/media/section-view.png)

</details>

## 二、为什么使用它？

- **专注当前段落。** 把长篇阅读笔记或复习资料变成逐段浏览的卡片，不必拆分成多个文件
- **记住阅读位置。** 用键盘或移动端边缘双击在卡片间移动，并从笔记保存的阅读进度继续
- **保留内容之间的联系。** 通过大纲和同笔记标题、块链接跳转，继续使用 Obsidian 原生 Markdown 渲染、脚注、嵌入和任务交互

## 三、安装与使用

### 3.1 安装

#### 3.1.1 从插件商店安装

1. 打开 Obsidian 的“设置 → 第三方插件”，启用第三方插件。
2. “社区插件市场 → 浏览”，搜索 **Section Reader** 并打开插件详情。
3. 点击“安装”，安装完成后点击“启用”。

#### 3.1.2 手动安装

先选择一种方式获取安装文件：

- **下载 Release：** 前往 [Releases](https://github.com/SeraphinaGlacia/obsidian-section-reader/releases)，下载同一个 Section Reader 版本的 `main.js`、`manifest.json` 和 `styles.css`。
- **从源码构建：** 下载或克隆本仓库，使用 Node.js 20 或更新版本，运行 `npm ci` 和 `npm run build`，生成上述三个文件。

获取文件后，完成以下步骤：

1. 将三个文件一起放入 `<vault>/.obsidian/plugins/section-reader/`，文件夹不存在时先创建；如果库使用自定义配置文件夹，请使用相应目录。
2. 重新加载 Obsidian，在“设置 → 第三方插件”中启用 **Section Reader**。

### 3.2 使用

可将[示例笔记](docs/demo-note.md)复制到库中体验，或直接打开自己的笔记。示例内容包括三个段落、同笔记标题链接、脚注和可选任务复选框。

多个知识点写在同一篇 Markdown 笔记里，内容从上到下连续堆叠，笔记一长，阅读和回顾就容易失去重点。

如果想一次只看一个知识点，又不想手动拆成多个文件，只需在知识点之间单独写一行 `---`，前后各留一个空行。进入 Section Reader 后，各段就会以卡片形式逐一展示，原笔记仍保存在同一个文件中。例如，下面两个知识点会显示为两张卡片：

```markdown
### The Accounting Equation

**Assets = Liabilities + Equity**

A company has USD 50,000 in assets and USD 20,000 in liabilities.
Its equity is USD 30,000: the owners' remaining interest in the assets
after deducting liabilities.

---

### Double-Entry Bookkeeping

Every transaction records equal total debits and total credits.

Buying equipment for USD 5,000 in cash:

- Debit Equipment: USD 5,000
- Credit Cash: USD 5,000

Total assets stay the same: equipment increases while cash decreases.
```

- **进入与退出：** 点击左侧“切换 Section Reader”图标，或运行“切换卡片浏览模式”命令；再次触发或按 `Esc` 退出。
- **前后翻页：** 桌面端点击卡片后，按 `←` / `→`；移动端双击屏幕左侧 / 右侧边缘，分别返回上一张 / 进入下一张。
- **卡片跳转：** 通过大纲、同笔记标题或块链接，直接跳到对应卡片。
- **阅读进度：** 从编辑视图进入时定位到光标；从阅读视图进入时接着上次的位置。关闭标签页会退出卡片模式，但保留阅读进度。
- **快捷入口：** 在“设置 → 快捷键”中自行绑定切换命令；手机端可将命令加入移动工具栏或 Quick Action。

## 3.3 命令

| 命令 | ID |
| --- | --- |
| 切换卡片浏览模式 | `toggle-card-view` |
| 下一张卡片 | `next-card` |
| 上一张卡片 | `previous-card` |

## 四、开发

需要 Node.js 20 或更新版本。

```bash
npm ci
npm run dev
```

完整验证：

```bash
npm run check
```

`npm run check` 依次针对当前 API 与最低支持的 Obsidian 1.8.7 API 运行 TypeScript 类型检查，再运行 ESLint（包括 Obsidian 插件规则）、Vitest、发布检查测试、生产构建和打包检查。PR 的 CI 运行相同命令；发布构建还会检查版本标签。检查范围和限制见[发布检查说明](docs/release-checks.md)。

## 五、其他相关信息

<details>
<summary>其他相关信息（界面语言、分隔规则、功能边界）</summary>

## 一、界面语言

插件加载时读取 Obsidian 当前的界面语言：中文语言代码（`zh`、`zh-CN`、`zh-TW` 等）显示中文；英语以及其他所有语言统一显示英文。修改 Obsidian 的界面语言后，请重新加载插件或重启 Obsidian，使全部命令名称同步刷新。

## 二、分隔规则

只有满足以下条件的行才会分割卡片：

1. 该行源文字符恰好是 `---`，不含空格或其他字符。
2. 它是 Markdown 根层级的水平分隔线。

因此，YAML frontmatter、代码块、引用、列表、HTML 块、Setext 标题中的同形文本，以及 `***` / `___` 都不会分卡。连续、开头或结尾的分隔线产生的空卡片会被忽略。

## 三、功能边界

- 整篇笔记由 Obsidian 原生 Markdown 渲染器一次渲染，以保留跨卡片脚注、引用定义、链接、嵌入和任务交互的完整语境。
- 卡片内容沿用普通 Markdown 视图的可读行宽和页边距设置，不会贴住桌面窗口两侧。
- 每张卡片可独立纵向滚动；同一次浏览中返回时保留滚动位置。
- 指向其他笔记的内部链接在新标签的普通 Markdown 视图打开，原标签保持专注状态。同一笔记的标题、块链接在当前卡片视图中跳转；按住修饰键点击仍可在新标签打开。
- 桌面端双链悬停通过 Obsidian 原生 Page Preview 事件处理；启用 Hover Editor 时，可在卡片模式中弹出同样的可交互预览浮窗。
- 浏览不会修改 Markdown；只有主动勾选任务复选框时，插件才按 Obsidian 的正常任务行为更新对应标记。
- 当前版本不包含编辑、全屏演示、自动播放、导出、主题系统、自定义分隔符或可见翻页按钮。

</details>

## License

[MIT](LICENSE) © 2026 Xinlei Zhou

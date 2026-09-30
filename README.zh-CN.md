# Section Reader

[English](README.md) · [安装](#安装) · [开始使用](#使用)

Read long Markdown notes one section at a time, with native links, embeds, task interactions, and reading progress preserved.

Section Reader 是一款 Obsidian 长笔记阅读插件：把根层级 `---` 分隔的段落变成一次只显示一段的阅读视图，仍保留原生链接、嵌入、任务交互与阅读进度，笔记始终保存在同一个文件中。浏览本身不会修改 Markdown；主动勾选或取消任务复选框时，会更新对应的 Markdown 标记。

需要 **Obsidian 1.8.7 或更新版本**，面向桌面端与移动端。移动交互已在模拟器中检查，尚未完成实体 iOS 和 Android 设备验证。

## 实际效果

![Section Reader 操作演示：普通笔记、单段视图、下一段、大纲跳转、同笔记链接，以及返回原笔记](docs/media/section-reader-demo.gif)

以上逐步演示由真实 Obsidian 截图组成：切换 Section Reader → 向右翻到下一段 → 点击大纲跳转 → 点击同笔记链接 → 按 `Esc` 返回。

截图使用 Linux 版 Obsidian 1.13.7、本仓库的 Section Reader 构建版本，以及内容完全虚构的[示例笔记](docs/demo-note.md)。

<details>
<summary>对比原笔记与单段视图</summary>

**原笔记：** 多个段落连续显示在普通阅读视图中。

![Obsidian 普通阅读视图中的原笔记，显示多个段落和大纲](docs/media/original-note.png)

**Section Reader：** 一次只显示一段，右侧大纲仍然可用。

![同一篇笔记的 Section Reader 视图，显示当前段落并保留大纲](docs/media/section-view.png)

</details>

## 为什么使用它？

- **专注当前段落。** 把长篇阅读笔记或复习资料变成逐段浏览的卡片，不必拆分成多个文件
- **记住阅读位置。** 用键盘或移动端边缘双击在卡片间移动，并从笔记保存的阅读进度继续
- **保留内容之间的联系。** 通过大纲和同笔记标题、块链接跳转，继续使用 Obsidian 原生 Markdown 渲染、脚注、嵌入和任务交互

## 使用

可将[示例笔记](docs/demo-note.md)复制到库中体验。示例内容均为虚构，包括三个段落、同笔记标题链接、脚注和可选任务复选框。

```markdown
### 第一个知识点

内容……

---

### 第二个知识点

内容……
```

- 点击左侧 Ribbon 中的“切换 Section Reader”图标，或运行命令“切换卡片浏览模式”。再次触发该动作或按 `Esc` 返回原 Markdown 视图。
- 从编辑视图进入时，打开光标所在的卡片；从阅读视图进入时，使用该笔记已保存的卡片位置。
- 专注模式跟随当前标签页保持：点击大纲、在标题间跳转、切换标签页，或打开其他笔记链接再返回，都不会自动退出。关闭该标签页后，再次打开笔记会使用普通 Markdown 视图；阅读进度仍会保留。
- 大纲与当前笔记的标题、块链接直接定位到目标卡片，跨卡片跳转使用约 120 毫秒的快速翻页过渡；开启系统“减少动态效果”时不播放动画。
- 桌面端先点击卡片内容区域，再使用左右方向键翻卡；移动端双击屏幕左侧边缘返回上一张，双击右侧边缘进入下一张。横向滑动仍由 Obsidian 用于打开左右侧边栏。
- 插件不设默认全局快捷键，可在“设置 → 快捷键”中为 Section Reader 命令绑定。
- 手机端可在 Obsidian 的移动工具栏或 Quick Action 中固定切换命令。

## 命令

| 命令 | ID |
| --- | --- |
| 切换卡片浏览模式 | `toggle-card-view` |
| 下一张卡片 | `next-card` |
| 上一张卡片 | `previous-card` |

三个命令均不设置默认快捷键。插件 ID 和安装文件夹均为 `section-reader`。从 Focus Cards 升级时，请参考[迁移指南](docs/migration.md)。

## 界面语言

插件加载时读取 Obsidian 当前的界面语言：中文语言代码（`zh`、`zh-CN`、`zh-TW` 等）显示中文；英语以及其他所有语言统一显示英文。修改 Obsidian 的界面语言后，请重新加载插件或重启 Obsidian，使全部命令名称同步刷新。

## 分隔规则

只有满足以下条件的行才会分割卡片：

1. 该行源文字符恰好是 `---`，不含空格或其他字符。
2. 它是 Markdown 根层级的水平分隔线。

因此，YAML frontmatter、代码块、引用、列表、HTML 块、Setext 标题中的同形文本，以及 `***` / `___` 都不会分卡。连续、开头或结尾的分隔线产生的空卡片会被忽略。

## 功能边界

- 整篇笔记由 Obsidian 原生 Markdown 渲染器一次渲染，以保留跨卡片脚注、引用定义、链接、嵌入和任务交互的完整语境。
- 卡片内容沿用普通 Markdown 视图的可读行宽和页边距设置，不会贴住桌面窗口两侧。
- 每张卡片可独立纵向滚动；同一次浏览中返回时保留滚动位置。
- 指向其他笔记的内部链接在新标签的普通 Markdown 视图打开，原标签保持专注状态。同一笔记的标题、块链接在当前卡片视图中跳转；按住修饰键点击仍可在新标签打开。
- 桌面端双链悬停通过 Obsidian 原生 Page Preview 事件处理；启用 Hover Editor 时，可在卡片模式中弹出同样的可交互预览浮窗。
- 浏览不会修改 Markdown；只有主动勾选任务复选框时，插件才按 Obsidian 的正常任务行为更新对应标记。
- 当前版本不包含编辑、全屏演示、自动播放、导出、主题系统、自定义分隔符或可见翻页按钮。

## 安装

### 当前 Section Reader 构建版本

Section Reader 名称与 `section-reader` ID 尚未进入已发布版本。要体验上图所示的版本：

1. 下载或克隆本仓库，使用 Node.js 20 或更新版本，在仓库目录运行 `npm ci` 和 `npm run build`。
2. 将生成的 `main.js`、`manifest.json` 和 `styles.css` 复制到 `<vault>/.obsidian/plugins/section-reader/`；如果库使用自定义配置文件夹，请使用相应目录。
3. 重新加载 Obsidian，按需启用第三方插件，然后在“设置 → 第三方插件”中启用 **Section Reader**。
4. 打开[示例笔记](docs/demo-note.md)，按[使用](#使用)部分的步骤体验。

如果以前使用过 Focus Cards，请按照[迁移指南](docs/migration.md)保留阅读进度并重新绑定快捷键。不要同时启用新旧两个安装。

### 已发布的旧版本

最新[已发布版本 0.1.2](https://github.com/SeraphinaGlacia/obsidian-section-reader/releases) 仍使用 **Focus Cards** 名称和 `focus-cards` ID。它的三个发布文件应放在 `<vault>/.obsidian/plugins/focus-cards/`，在设置中显示为 **Focus Cards**。不要把这些旧版文件放到新的 `section-reader` 文件夹。

社区插件目录安装方式仅在正式上架后可用。

## 阅读进度数据

阅读进度通过 Obsidian 的插件数据存储单独保存，不写入 Markdown 笔记。记录包含笔记路径、卡片索引、卡片键值与最后更新时间；每张卡片的滚动位置在当前浏览会话中保留。

## 开发

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

## License

[MIT](LICENSE) © 2026 Xinlei Zhou

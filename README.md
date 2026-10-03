<h1 align="center">Section Reader</h1>

<p align="center">
  <a href="README.zh-CN.md">简体中文</a> ·
  <a href="#31-installation">Installation</a> ·
  <a href="#32-usage">Get started</a>
</p>

> Read long notes one section at a time, without splitting files.

Section Reader is an Obsidian plugin for reading long notes: it turns sections separated by root-level `---` lines into a view that displays one section at a time, while preserving native links, embeds, task interactions, and reading progress. Your note stays in a single file. Browsing does not modify the Markdown; checking or unchecking a task checkbox updates the corresponding Markdown marker.

Requires **Obsidian 1.8.7 or later**, for desktop and mobile.

## 1. See it in action

![Continuous screen recording: browse the full note, press the demo shortcut to enter the section view, then use the left and right arrow keys to turn pages](docs/media/section-reader-demo.gif)

Press **Ctrl + Alt + U** → switch to reading one section at a time → use **→ / ←** to move forward and back. The key labels show the keys actually pressed during the recording.

> [!NOTE]
> **Ctrl + Alt + U is a custom shortcut configured only for this demo.** Section Reader does not assign a toggle hotkey by default; you can set one under “Settings → Hotkeys”.

<details>
<summary>Compare the original note and the section view</summary>

**Original note:** Multiple sections appear continuously in the normal Reading view.

![The original note in Obsidian's normal Reading view, showing multiple sections and the Outline](docs/media/original-note.png)

**Section Reader:** One section is shown at a time, with the Outline still available on the right.

![The same note in Section Reader, showing the current section and retaining the Outline](docs/media/section-view.png)

</details>

## 2. Why use it?

- **Focus on the current section.** Turn long reading notes or study materials into cards you can browse one section at a time, without splitting them into multiple files
- **Remember your reading position.** Move between cards with the keyboard or by double-tapping the screen edges on mobile, and resume from the note's saved reading progress
- **Keep the connections between content.** Navigate through the Outline and heading or block links within the same note, while retaining Obsidian's native Markdown rendering, footnotes, embeds, and task interactions

## 3. Installation and usage

### 3.1 Installation

#### 3.1.1 Install from the community plugin directory

1. Open “Settings → Community plugins” in Obsidian and turn on community plugins.
2. Go to “Community plugins → Browse”, search for **Section Reader**, and open its details.
3. Click “Install”, then click “Enable” once installation is complete.

#### 3.1.2 Manual installation

First, choose one way to obtain the installation files:

- **Download a release:** Go to [Releases](https://github.com/SeraphinaGlacia/obsidian-section-reader/releases) and download `main.js`, `manifest.json`, and `styles.css` from the same Section Reader version.
- **Build from source:** Download or clone this repository. With Node.js 24 LTS and pnpm 11.7.0, run `pnpm install --frozen-lockfile` and `pnpm run build` to generate those three files.

Once you have the files, complete these steps:

1. Place all three files together in `<vault>/.obsidian/plugins/section-reader/`, creating the folder if it does not exist. If your vault uses a custom configuration folder, use the corresponding directory.
2. Reload Obsidian and enable **Section Reader** under “Settings → Community plugins”.

### 3.2 Usage

Open any Markdown note in your vault to try Section Reader.

When several concepts are written in the same Markdown note, the content stacks up from top to bottom. As the note gets longer, it becomes easier to lose focus while reading and reviewing.

If you want to read one concept at a time without manually splitting the note into multiple files, simply place `---` on its own line between concepts, with a blank line before and after it. In Section Reader, each section is displayed as a separate card, while the original note stays in a single file. For example, the two concepts below will appear as two cards:

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

- **Enter and exit:** Click the “Toggle Section Reader” icon on the left, or run the “Toggle card browsing mode” command. Trigger it again or press `Esc` to exit.
- **Turn pages:** On desktop, click inside a card, then press `←` / `→`. On mobile, double-tap the left / right edge of the screen to go to the previous / next card, respectively.
- **Jump between cards:** Use the Outline, heading links, or block links within the same note to jump directly to the corresponding card.
- **Reading progress:** Entering from Editing view opens the card at your cursor; entering from Reading view resumes your last position. Closing the tab exits card mode but preserves your reading progress.
- **Quick access:** Assign a toggle hotkey under “Settings → Hotkeys”. On mobile, add the command to the mobile toolbar or Quick Action.

## 3.3 Commands

| Command | ID |
| --- | --- |
| Toggle card browsing mode | `toggle-card-view` |
| Next card | `next-card` |
| Previous card | `previous-card` |

## 4. Development

Use Node.js 24 LTS and pnpm 11.7.0, as declared in `.node-version` and `package.json`. Source builds also support Node.js 22.13+ in the 22.x line and Node.js 24 or newer. The pnpm version is fixed by `packageManager`; another pnpm launcher downloads and runs that pinned version. Dependency overrides and reviewed installation scripts are configured in `pnpm-workspace.yaml`.

```bash
pnpm install --frozen-lockfile
pnpm run dev
```

Full validation:

```bash
pnpm run check
```

`pnpm run check` runs TypeScript checks against the current API and the minimum supported Obsidian 1.8.7 API, followed by ESLint (including Obsidian plugin rules), Vitest, release-check tests, a production build, and packaging checks. CI runs the same command for pull requests; release builds also check the version tag. See [release checks](docs/release-checks.md) for coverage and limitations.

## 5. Additional information

<details>
<summary>Additional information (interface language, splitting rules, feature scope)</summary>

## 1. Interface language

The plugin reads Obsidian's current interface language when it loads: Chinese language codes (`zh`, `zh-CN`, `zh-TW`, etc.) use Chinese; English and all other languages use English. After changing Obsidian's interface language, reload the plugin or restart Obsidian to refresh all command names.

## 2. Splitting rules

A line splits cards only when it meets both of these conditions:

1. Its source text is exactly `---`, with no spaces or other characters.
2. It is a horizontal rule at the root level of the Markdown document.

Therefore, identical-looking text in YAML frontmatter, code blocks, blockquotes, lists, HTML blocks, or Setext headings does not split cards, nor do `***` / `___`. Empty cards created by consecutive, leading, or trailing separators are ignored.

## 3. Feature scope

- The entire note is rendered in one pass by Obsidian's native Markdown renderer to preserve the full context of footnotes, reference definitions, links, embeds, and task interactions across cards.
- Cards follow the normal Markdown view's readable line length and margin settings, and do not extend to either edge of the desktop window.
- Each card can scroll vertically on its own; its scroll position is retained when you return during the same browsing session.
- Internal links to other notes open in a new tab in the normal Markdown view, while the original tab stays in focus mode. Heading and block links within the same note navigate in the current card view; clicking with a modifier key can still open them in a new tab.
- On desktop, internal-link hover previews are handled through Obsidian's native Page preview events. With Hover Editor enabled, the same interactive preview popovers are available in card mode.
- Browsing does not modify the Markdown; only actively checking or unchecking task checkboxes updates the corresponding markers through Obsidian's normal task behavior.
- The current version does not include editing, fullscreen presentations, autoplay, export, a theme system, custom separators, or visible page navigation buttons.

</details>

## License

[MIT](LICENSE) © 2026 Xinlei Zhou

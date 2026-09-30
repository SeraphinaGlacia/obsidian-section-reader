# Section Reader

Read long Markdown notes one section at a time, with native links, embeds, task interactions, and reading progress preserved.

An Obsidian plugin that turns sections separated by root-level `---` lines into a focused reading view. Your note stays in one file.

[简体中文](README.zh-CN.md) · [Install](#installation) · [Try it](#quick-start)

## See it in action

![Section Reader walkthrough: ordinary note, focused section, next section, Outline jump, same-note link, and return to the note](docs/media/section-reader-demo.gif)

A step-by-step walkthrough assembled from real Obsidian screenshots: toggle Section Reader → move right to the next section → jump using the Outline → follow a same-note link → press `Esc` to return.

Captured on Obsidian 1.13.7 for Linux using this repository's Section Reader build and the [synthetic demo note](docs/demo-note.md).

<details>
<summary>Compare the original note and section view</summary>

**Original note:** several sections in one continuous reading view.

![Original note in Obsidian reading view with multiple sections and the Outline](docs/media/original-note.png)

**Section Reader:** one section at a time, with the same Outline still available.

![The same note in Section Reader, showing one section and retaining the Outline](docs/media/section-view.png)

</details>

## Why use it?

- **Focus on one section.** Turn a long reading or study note into manageable cards, without splitting it into separate files
- **Keep your place.** Move between cards with the keyboard or mobile edge double-taps, and resume from the note's saved reading position
- **Keep the connections.** Use the outline and same-note heading or block links to jump between sections, with Obsidian's native Markdown rendering, footnotes, embeds, and task interactions

Reading in card view does not rewrite your Markdown. Checking or unchecking a task does update its Markdown checkbox, just as it does in Obsidian's normal reading view.

Requires **Obsidian 1.8.7 or later**. Designed for desktop and mobile. Mobile interaction has been checked in a simulator; physical iOS and Android devices have not yet been verified.

## Quick start

1. Open a Markdown note with a standalone `---` line between sections. Leave a blank line on either side so it is parsed as a horizontal rule.
2. Click **Toggle Section Reader** in the ribbon, or run **Section Reader: Toggle card browsing mode** from the command palette.
3. Click inside the section view, then use the left and right arrow keys on desktop. On mobile, double-tap the left edge for the previous card or the right edge for the next card.
4. Run the toggle command again, or press `Esc`, to return to the original Markdown view.

```markdown
## One idea

Read this section at your own pace.

---

## The next idea

Move on when you are ready.
```

For a self-contained example, copy [the demo note](docs/demo-note.md) into your vault. It includes three sections, a same-note heading link, a footnote, and an optional task checkbox. All of its content is synthetic.

## Navigation and reading progress

Focus mode stays with the current tab while you use the outline, jump between headings, switch tabs, or follow another note and return. Closing that tab ends its focus mode; reopening the note uses the normal Markdown view, while saved reading progress is retained.

When you enter focus mode from the editor, the card containing your cursor opens. When you enter from reading view, the plugin uses the note's saved card position.

- **Within the note:** Outline entries and heading or block links jump directly to the corresponding card. Cross-card jumps use a short transition of approximately 120 ms.
- **Other notes:** Internal links open in a new tab in normal Markdown view, leaving the original tab in focus mode. Modifier-clicking same-note links can also open a new tab.
- **Scrolling:** Each card scrolls vertically on its own. Its scroll position is retained when you return during the same browsing session.
- **Layout:** Cards follow the normal Markdown view's readable line width and margins.
- **Reduced motion:** Transitions are disabled when the system's reduced-motion preference is enabled.
- **Mobile:** Horizontal swipes remain available to Obsidian for opening the sidebars. You can pin the toggle command to the mobile toolbar or Quick Action.
- **Link previews:** On desktop, internal-link hover previews use Obsidian's native Page Preview events. With Hover Editor enabled, its interactive preview windows are also available in card view.

### Commands

| Command | ID |
| --- | --- |
| Toggle card browsing mode | `toggle-card-view` |
| Next card | `next-card` |
| Previous card | `previous-card` |

The plugin ID and installation folder are `section-reader`. Upgrading from Focus Cards? Follow the [migration guide](docs/migration.md).

No global hotkeys are assigned by default. Assign your own under **Settings → Hotkeys**.

## How sections are split

A line is a card boundary only when both conditions are met:

1. Its source text is exactly `---`, with no spaces or other characters.
2. Markdown parses it as a horizontal rule at the root level.

YAML frontmatter, fenced code, blockquotes, lists, HTML blocks, and Setext headings do not create card boundaries. Neither do `***` or `___`. Empty cards from consecutive, leading, or trailing separators are ignored.

## Language

The plugin reads Obsidian's interface language when it loads. Chinese language codes such as `zh`, `zh-CN`, and `zh-TW` use Chinese labels; all other languages use English labels. Reload the plugin or restart Obsidian after changing the interface language to refresh all command names.

## Data and scope

Reading progress is saved through Obsidian's plugin data storage, separately from the Markdown note. The stored entries contain the note path, card index, card key, and last-updated timestamp. Per-card scroll positions are retained for the current browsing session.

The current version does not include note editing beyond task-checkbox interactions, fullscreen presentations, autoplay, export, a theme system, custom separators, or visible next/previous buttons.

## Installation

### Current Section Reader build

The Section Reader rename and `section-reader` ID are not yet in a published release. To try the version shown above:

1. Download or clone this repository. With Node.js 20 or later, run `npm ci` and `npm run build` in its folder.
2. Copy the resulting `main.js`, `manifest.json`, and `styles.css` into `<vault>/.obsidian/plugins/section-reader/` (use your vault's equivalent directory if it has a custom configuration folder).
3. Reload Obsidian, enable community plugins if needed, then enable **Section Reader** under **Settings → Community plugins**.
4. Open [the demo note](docs/demo-note.md) and follow [Quick start](#quick-start).

If you used Focus Cards before, follow the [migration guide](docs/migration.md) to preserve reading progress and reassign hotkeys. Do not enable both installations at once.

### Published legacy release

The latest [published release, 0.1.2](https://github.com/SeraphinaGlacia/obsidian-section-reader/releases), still uses the **Focus Cards** name and `focus-cards` ID. Its three release files belong in `<vault>/.obsidian/plugins/focus-cards/`, and it appears as **Focus Cards** in settings. Do not put those legacy files in the new `section-reader` folder.

Installation through Obsidian's community plugin directory becomes available only after the plugin is listed.

## Development

Use Node.js 20 or later.

```bash
npm ci
npm run dev
```

Run the full validation suite:

```bash
npm run check
```

This runs TypeScript checks against the current API and the minimum supported Obsidian 1.8.7 API, ESLint (including Obsidian plugin rules), Vitest, release-check tests, a production build, and packaging checks. CI runs the same command for pull requests. Release builds also verify the version tag. See [release checks](docs/release-checks.md) for coverage and limitations.

## License

[MIT](LICENSE) © 2026 Xinlei Zhou

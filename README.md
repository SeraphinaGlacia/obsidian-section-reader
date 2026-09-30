# Section Reader

Read long Obsidian notes one section at a time. Section Reader turns sections separated by root-level `---` lines into a focused card view, while keeping Obsidian's native Markdown rendering, links, and task interactions.

[简体中文](README.zh-CN.md)

## What it does

- Show one section at a time without splitting your note into separate files
- Navigate with keyboard commands on desktop or edge double-taps on mobile
- Jump to a card from the outline or a heading or block link within the same note
- Keep reading progress for each note and remember each card's scroll position during the current browsing session
- Preserve footnotes, reference links, embeds, and task interactions by rendering the whole note with Obsidian's native Markdown renderer

Reading in card view does not rewrite your Markdown. Checking or unchecking a task does update its Markdown checkbox, just as it does in Obsidian's normal reading view.

Requires **Obsidian 1.8.7 or later**. Supports desktop and mobile.

## Quick start

1. Open a Markdown note with a standalone `---` line between sections. Leave a blank line on either side so it is parsed as a horizontal rule.
2. Click **Toggle Section Reader** in the ribbon, or run **Section Reader: Toggle card browsing mode** from the command palette.
3. Use the left and right arrow keys on desktop. On mobile, double-tap the left edge for the previous card or the right edge for the next card.
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

The internal plugin ID remains `focus-cards`, so the installation folder is unchanged.

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

The 0.1 series does not include note editing beyond task-checkbox interactions, fullscreen presentations, autoplay, export, a theme system, custom separators, or visible next/previous buttons.

## Installation

### Manual installation

1. From a [GitHub release](https://github.com/SeraphinaGlacia/obsidian-focus-cards/releases), download `main.js`, `manifest.json`, and `styles.css`.
2. Put all three files in `<vault>/.obsidian/plugins/focus-cards/` (or the equivalent directory if your vault uses a custom configuration folder).
3. Reload Obsidian and enable **Section Reader** under **Settings → Community plugins**.

The community-directory installation route becomes available only after the plugin is listed. These instructions do not imply that a listing or release is currently available.

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

This runs TypeScript checks against the current API and the minimum supported Obsidian 1.8.7 API, followed by ESLint, Vitest, and a production build. The existing CI workflow runs the same check for pull requests. For release builds, the existing release workflow also verifies that the version tag matches `manifest.json`.

## License

[MIT](LICENSE) © 2026 Xinlei Zhou

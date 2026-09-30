# Section Reader 0.2.0 acceptance

Validated on 2026-09-30 in Obsidian 1.13.7 on macOS, using a new vault under `tmp/section-reader-release-test`. Only the built Section Reader plugin was enabled in that vault. Test notes and local screenshots are ignored by Git.

## Desktop behavior

| Check | Result |
| --- | --- |
| Install the three release files and enable the plugin | Passed; all three commands registered, no captured runtime errors |
| Split a note containing frontmatter, links, an embed, tasks, code, and a quote | Passed; exactly four cards |
| Navigate with the left and right arrow keys | Passed |
| Follow same-note heading and block links and jump from the outline | Passed; the card view stays open |
| Follow a footnote to another card and return to its reference | Passed after fixing rendered footnote navigation |
| Open another note through an internal link | Passed; a new Markdown tab opens and the original card tab keeps its state |
| Toggle a task checkbox | Passed; only the expected Markdown task marker changes |
| Scroll a long card, leave it, and return | Passed; the recorded scroll position of 1,632 pixels is restored |
| Exit with Escape and enter again from reading view | Passed; the previous card is restored |
| Close the card tab and reopen the note | Passed; it opens as a normal Markdown view |
| Open a note without separators | Passed; one card |
| Use leading, trailing, repeated, fenced-code, and quoted separators | Passed; empty cards are omitted and nested separators do not split cards |

After restoring the task checkbox, the acceptance note was byte-for-byte identical to the original test fixture.

## Mobile UI emulation

Obsidian's mobile UI was tested at a 390 × 844 viewport with touch events. A single edge tap does not change cards; a right-edge double tap advances and a left-edge double tap returns. The settled card fills the viewport without horizontal drift. With reduced motion enabled, the computed transition duration is zero. Emulation and debugger overrides were removed after testing.

The touch handler now uses `Platform.isMobile` (mobile UI) rather than `Platform.isMobileApp` (native mobile runtime), allowing the same behavior to be exercised with Obsidian's official mobile emulation. Mouse pointers remain excluded.

## Automated checks and asset identity

`npm run check` passed: current and minimum Obsidian API type checks, ESLint, 58 Vitest tests, 12 release-gate tests, production build, and packaging checks.

The tested build has these SHA-256 hashes:

```text
f7ad963bb103fb0ca9b0a4d6ec87c5817eea743e9f99793c24c43126dc42b0ac  main.js
fb57c73c01193ef182169c8c5337d45162a849d5b6c1c5eed6e776eb7c5441e9  manifest.json
e6d358e7d058bf6f33b96851525742edf5e3e5d76df29ff824271a9af6b202ed  styles.css
```

## Coverage limits

Physical iOS/Android devices, Windows/Linux desktops, older Obsidian runtimes, third-party themes/plugins, and migration of reading progress from the old Focus Cards plugin ID were not tested in this acceptance run. Minimum-version compatibility was checked through TypeScript declarations. Mobile emulation is not physical-device acceptance. Community-directory review is a separate publishing step.

# Native section focus

Tracking: [issue #8](https://github.com/SeraphinaGlacia/obsidian-section-reader/issues/8).

## Behavior and implementation

Section focus is a state attached to each native `MarkdownView`. The toggle no longer replaces the Markdown view with a custom read-only `FileView`. Obsidian owns the file, editor, native reading/editing controls, saving, undo history, and plugin editor context.

The CodeMirror extension retains the full document. Replacement and line decorations hide content outside the selected section, while a transaction filter confines user input and selection to its visible range. Each section masks its delimiter and surrounding blank lines; the first section also masks YAML properties and their trailing spacing. The preceding source line remains available to native Live Preview layout, but its marked line is hidden. A marker before a protected separator also hides Live Preview's rule widget, which does not retain line decorations. Ordinary horizontal rules in the body stay visible. Source whitespace and body indentation are preserved.

User input inside the current section keeps a continuous editing range. Newly typed separators are saved but deferred until a native mode switch or explicit section navigation; completing that edit reparses the full buffer and follows the caret's section. This leaves room to type the first paragraph after a new separator without an automatic page turn. The original delimiter's preceding whitespace is protected so appending text cannot silently turn it into a Setext heading underline. Programmatic document updates remain possible, and undo/redo reveal the affected section. The bundled Lezer Markdown parser handles Markdown block structure, with additional handling for Obsidian frontmatter, display math, and comments; CodeMirror itself stays external and is supplied by Obsidian.

Native mode switching is opt-in through a persisted setting that defaults to false for new installations and older saved data. Each focus session captures that preference on entry, matching the UI description that changes take effect on re-entry. A read-only session enters native preview, guards the public view-state method against native editing requests, and restores the entry mode when focus ends. The settings tab supports current declarative settings/search and an imperative fallback for older Obsidian versions.

Reading mode filters native blocks using `MarkdownPostProcessorContext.getSectionInfo`. A preview's public postprocessor `docId` identifies detached blocks before the native renderer measures them. This matters for long notes: filtering only attached DOM nodes leaves stale virtualization heights and can produce an empty viewport. Embedded renderers and other tabs retain their own context. The public `setEphemeralState` navigation hook reveals sections requested by Outline and same-note links; the original method and all decorations, event handlers, and CSS state are restored when focus ends. Previously saved `focus-cards-view` tabs migrate to native focused Markdown views.

Existing command IDs remain unchanged (`toggle-card-view`, `next-card`, `previous-card`), preserving user hotkey mappings. Command labels now refer to section focus. No default hotkeys or pagination controls are added. Previous/next navigation retains a 220 ms horizontal transition in both modes. A temporary inert outgoing snapshot is animated alongside the original incoming native view, then removed. Reduced motion skips the snapshot and animation. Mode changes, repeated navigation, and plugin cleanup cancel outstanding frames and animations. Desktop editing leaves bare arrow keys and Escape to the editor. Mobile retains edge double-taps in both modes, guarded against selection, dragging, composition, and interactive targets.

## Checks performed

Native checks were performed on 2026-10-08 in a separate temporary vault on macOS, using Obsidian 1.14.4 and Templater 2.25.1. No personal note or plugin configuration was changed. The fixtures included frontmatter, three sections, reference links, footnotes, tasks, and a 100-section note.

| Area | Observed result |
| --- | --- |
| Native context | The same `MarkdownView` and `workspace.activeEditor` remain available with focus enabled. The editor retains the complete original document. |
| Mode preference | The localized settings toggle persists across reload. A read-only session blocks native editing and restores its entry mode on exit. Changing the preference leaves the active session unchanged; re-entry applies the new value. |
| Independent toggles | With native mode switching enabled, reading/editing switches retain the section; disabling focus retains the current native mode. |
| Templater | Selecting a word in the second section and applying `【<% tp.file.selection() %>】` through Templater replaces only that selection without leaving focus. |
| Keyboard and history | A native right-arrow key event moves the editor cursor without pagination. Explicit navigation commands work. Undo/redo follow an edit after navigating to another section. |
| Section boundary layout | With zero, one, or three blank lines after YAML or section delimiters, every section starts at a correctly styled heading in Live Preview and Source mode. Boundary rules are hidden, body rules remain visible, and the source is unchanged. |
| New separators | Character-by-character input and pasted separators retain the editing region. Reading or explicit navigation applies the new split from the caret's section. Original delimiter spacing survives, and undo/redo restore the full source. |
| Native rendering | Cross-section footnote and backreference navigation work; reference definitions resolve; checking a task changes its original source marker. A 100-section note reveals sections 51 and 100 in reading and editing. |
| View lifecycle | Two tabs can focus different sections. External reading updates retain the focused content and allow subsequent navigation/editing. Renaming moves stored progress; deleting a focused note removes it. Disabling the plugin restores the native view. Legacy custom-view state restores as native Markdown focus. |
| Card entry scroll | Entering, returning, native navigation, and reading/editing switches start at the card top. Manual scrolling after entry remains available. Saved progress retains the section only. |
| Page transitions | Native reading and editing navigation produce horizontal outgoing/incoming animations without replacing the active editor or modifying source. Snapshot cleanup and reduced motion have automated coverage. |
| Mobile emulation | Edge double-taps advance sections in both reading and editing. No pagination buttons are added. |

Automated tests exercise live separator parsing, full-document coordinates, hidden-boundary deletion protection, selection confinement, external replacement, history navigation, session cleanup, card entry scrolling, detached preview filtering, embedded view isolation, keyboard precedence, and mobile gesture guards. `pnpm run check` also checks both the current and minimum Obsidian API, lint, release guards, production build, and package consistency.

## Post-merge review follow-up

The automated review of PR #9 completed at 12:47:13 UTC on 2026-10-08, after the merge at 12:46:04 UTC. Publication was paused to address all three findings. Each finding was reproduced before its fix; the follow-up adds 14 unit regressions and passed 34 targeted native checks in the same isolated Obsidian 1.14.4 vault.

| Finding | Fix and native verification |
| --- | --- |
| [Escape blocked after reading interactions](https://github.com/SeraphinaGlacia/obsidian-section-reader/pull/9#discussion_r4219095075) | Selection and interactive-target guards apply only to arrow pagination. Escape exits with selected text or a focused native link, task checkbox, code block, or table. Arrows preserve those interactions, including native tables without a wrapper. Editing Escape remains with the native editor. |
| [Prematurely closed comment state](https://github.com/SeraphinaGlacia/obsidian-section-reader/pull/9#discussion_r4219095083) | Scan all comment delimiters on each line, including closing and reopening a comment on a continuation line. Six cases cover reopened comments, closed comments, inline code, and escaped delimiters. The three multiline cases match the native editor's `comment_hr` syntax nodes; commented rules stay inside the section while the next real rule splits it. |
| [Lost section key during legacy migration](https://github.com/SeraphinaGlacia/obsidian-section-reader/pull/9#discussion_r4219095089) | Carry the saved `cardKey` into the native focus session and resolve it against the current document. Inserting a preceding section restores the original content at its new index. Key-only states also restore correctly; removed keys and index-only states fall back to the saved index. |

The native checks verify full-source preservation for all three areas. They use the actual plugin and native views; keyboard events are dispatched programmatically. These checks do not extend the physical-device or minimum-runtime coverage described below.

## Scroll reset follow-up

The 0.3.0 release could clip the first heading when entering a later section: its source-line scroll target included an offset left over from the full document. It also deliberately restored each card's previous scroll position. The updated behavior starts every entry at the top while preserving which section was selected.

The session requests native scroll position zero once, after pending section filtering, native navigation, and mode changes. This lets the native renderer finish its layout before scrolling and prevents the original Outline/link target from overwriting the reset. Reading and editing use the same entry policy. Later layout refreshes and ordinary scrolling do not repeatedly reset the viewport, and exiting cancels the pending frame.

The maintainer's report was reproduced with the installed 0.3.0 plugin: entering the ninth section scrolled 49 pixels and clipped its heading. A local copy in an isolated vault reproduced the issue with default styling. The copy and original note retained their original bytes; no private note contents are included in the repository. The isolated regression run passed 22 checks after the fix, compared with 6 before it, covering reading and editing entry, previous/next and repeated selection, native line navigation, mode switching, read-only entry, manual scrolling, cursor preservation, and the reported note layout.

Another 23 native checks passed for toggle and navigation commands, heading links, rapid navigation, undo/redo across sections, both modes' horizontal animations and snapshot cleanup, and the first, middle, and last sections of a 100-section note. The configured `Ctrl+E` shortcut was also exercised in the test vault; the reported ninth section opened with its first heading fully visible.

Eight mobile-emulation checks passed, including entry and left/right edge double-taps in both native modes, with the original source preserved. Physical-device coverage remains as described below. The complete local gate passed 102 unit tests, 70 release/package checks, both API typechecks, lint, and the production build.

## Maintainer acceptance before merge

1. In a test vault, first check read-only browsing and the requirement to exit before editing. Enable native mode switching in settings, exit and re-enter Section Reader, and verify independent native mode switching while retaining the section. Changing the preference during a session should take effect only on re-entry.
2. In focused editing, select a word and run your normal Templater template. Type a new separator and its body without leaving the editing area, then switch to reading or navigate to apply the split. Check the saved file, undo/redo, and custom shortcuts. Bare arrows must move the cursor without turning sections.
3. On a physical mobile device, verify edge double-taps in both modes, scrolling, text selection, and composition with the software keyboard open. Check landscape layout and the native reading/editing control.
4. Try the issue reporter's actual template and Anki configuration when available. A passing selection-replacement test does not verify an unspecified integration.

Physical iOS/Android devices and an actual Obsidian 1.8.7 runtime were not available for this run. Minimum-version compatibility has API type coverage, not a native runtime certification. Other editor extensions, themes, and custom templates can require their own acceptance checks. Templater has its own Obsidian version requirements. Reading-view DOM selection is not converted into editor selection.

Validation and release verification are separate steps. Passing these checks does not create a version tag or publish a release.

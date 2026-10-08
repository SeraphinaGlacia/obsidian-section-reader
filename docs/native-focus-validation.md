# Native section focus in 0.3.0

Tracking: [issue #8](https://github.com/SeraphinaGlacia/obsidian-section-reader/issues/8).

## Behavior and implementation

Section focus is a state attached to each native `MarkdownView`. The toggle no longer replaces the Markdown view with a custom read-only `FileView`. Obsidian owns the file, editor, native reading/editing controls, saving, undo history, and plugin editor context.

The CodeMirror extension retains the full document. Replacement and line decorations hide content outside the selected section, while a transaction filter confines user input and selection to its visible range. The first section also masks complete blank lines after YAML properties without rewriting source or trimming body indentation. The preceding source line remains available to native Live Preview layout, but its marked line is hidden; this prevents both a phantom blank line and lost heading styling at the mask boundary. Programmatic document updates remain possible. Undo and redo reveal the affected section. Source parsing recognizes separators before metadata-cache updates arrive. The bundled Lezer Markdown parser handles Markdown block structure, with additional handling for Obsidian frontmatter, display math, and comments; CodeMirror itself stays external and is supplied by Obsidian.

Reading mode filters native blocks using `MarkdownPostProcessorContext.getSectionInfo`. A preview's public postprocessor `docId` identifies detached blocks before the native renderer measures them. This matters for long notes: filtering only attached DOM nodes leaves stale virtualization heights and can produce an empty viewport. Embedded renderers and other tabs retain their own context. The public `setEphemeralState` navigation hook reveals sections requested by Outline and same-note links; the original method and all decorations, event handlers, and CSS state are restored when focus ends. Previously saved `focus-cards-view` tabs migrate to native focused Markdown views.

Existing command IDs remain unchanged (`toggle-card-view`, `next-card`, `previous-card`), preserving user hotkey mappings. Command labels now refer to section focus. No default hotkeys or pagination controls are added. Previous/next navigation retains a 220 ms horizontal transition in both modes. A temporary inert outgoing snapshot is animated alongside the original incoming native view, then removed. Reduced motion skips the snapshot and animation. Mode changes, repeated navigation, and plugin cleanup cancel outstanding frames and animations. Desktop editing leaves bare arrow keys and Escape to the editor. Mobile retains edge double-taps in both modes, guarded against selection, dragging, composition, and interactive targets.

## Checks performed

Native checks were performed on 2026-10-08 in a separate temporary vault on macOS, using Obsidian 1.14.4 and Templater 2.25.1. No personal note or plugin configuration was changed. The fixtures included frontmatter, three sections, reference links, footnotes, tasks, and a 100-section note.

| Area | Observed result |
| --- | --- |
| Native context | The same `MarkdownView` and `workspace.activeEditor` remain available with focus enabled. The editor retains the complete original document. |
| Independent toggles | Reading/editing switches retain the section; disabling focus retains the current native mode. |
| Templater | Selecting a word in the second section and applying `【<% tp.file.selection() %>】` through Templater replaces only that selection without leaving focus. |
| Keyboard and history | A native right-arrow key event moves the editor cursor without pagination. Explicit navigation commands work. Undo/redo follow an edit after navigating to another section. |
| First-section layout | With zero, one, or three blank lines after YAML, the first content line remains a correctly styled heading at the top in both Live Preview and Source mode. Source bytes are unchanged, typing at the boundary works, and disabling focus restores the normal editor. |
| Native rendering | Cross-section footnote and backreference navigation work; reference definitions resolve; checking a task changes its original source marker. A 100-section note reveals sections 51 and 100 in reading and editing. |
| View lifecycle | Two tabs can focus different sections. External reading updates retain the focused content and allow subsequent navigation/editing. Renaming moves stored progress; deleting a focused note removes it. Disabling the plugin restores the native view. Legacy custom-view state restores as native Markdown focus. |
| Reading scroll | Navigating away from a scrolled section and back restores its position through the native delayed scroll API. |
| Page transitions | Native reading and editing navigation produce horizontal outgoing/incoming animations without replacing the active editor or modifying source. Snapshot cleanup and reduced motion have automated coverage. |
| Mobile emulation | Edge double-taps advance sections in both reading and editing. No pagination buttons are added. |

Automated tests exercise live separator parsing, full-document coordinates, hidden-boundary deletion protection, selection confinement, external replacement, history navigation, session cleanup, reading scroll state, detached preview filtering, embedded view isolation, keyboard precedence, and mobile gesture guards. `pnpm run check` also checks both the current and minimum Obsidian API, lint, release guards, production build, and package consistency.

## Maintainer acceptance before merge

1. In a test vault, configure separate shortcuts for section focus and Obsidian's native reading/editing toggle. Enable focus, move to the second section, switch native modes, and confirm the section is retained.
2. In focused editing, select a word and run your normal Templater template. Check the saved file, undo/redo, and custom navigation shortcuts. Bare arrow keys must move the cursor without turning sections.
3. On a physical mobile device, verify edge double-taps in both modes, scrolling, text selection, and composition with the software keyboard open. Check landscape layout and the native reading/editing control.
4. Try the issue reporter's actual template and Anki configuration when available. A passing selection-replacement test does not verify an unspecified integration.

Physical iOS/Android devices and an actual Obsidian 1.8.7 runtime were not available for this run. Minimum-version compatibility has API type coverage, not a native runtime certification. Other editor extensions, themes, and custom templates can require their own acceptance checks. Templater has its own Obsidian version requirements. Reading-view DOM selection is not converted into editor selection.

This work prepares a pull request and the 0.3.0 version files. It does not merge the pull request, create a version tag, or publish a release.

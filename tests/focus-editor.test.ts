import { describe, expect, it } from "vitest";
import { EditorState, Transaction } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { editorFocusField, focusTransactionFilter, setEditorFocus } from "../src/focus-editor";

const source = "# One\n\nFirst apple\n\n---\n\n# Two\n\nSecond apple\n\n---\n\n# Three\n\nLast apple";
function editor(index = 1): EditorState {
  const state = EditorState.create({ doc: source, extensions: [editorFocusField, focusTransactionFilter] });
  return state.update({ effects: setEditorFocus.of(index) }).state;
}

describe("native editor section focus", () => {
  it.each(["", "\n", "\n\n\n"])("keeps the first content line visible without a placeholder above it (gap %j)", (gap) => {
    const text = "---\ntitle: Demo\n---\n" + gap + "# One\n\nBody";
    const state = EditorState.create({ doc: text, extensions: [editorFocusField, focusTransactionFilter] });
    const view = new EditorView({ state: state.update({ effects: setEditorFocus.of(0) }).state });
    try {
      const lines = [...view.contentDOM.querySelectorAll(".cm-line")];
      const visible = lines.filter(line => !line.classList.contains("section-reader-hidden-boundary"));
      expect(visible[0]?.textContent).toBe("# One");
      expect(visible.some(line => line.textContent?.includes("title: Demo"))).toBe(false);
      expect(view.state.doc.toString()).toBe(text);
    } finally { view.destroy(); }
  });

  it("masks the frontmatter gap without changing source or the normal editor", () => {
    const text = "---\ntitle: Demo\n---\n\n# One\n\nBody";
    let state = EditorState.create({ doc: text, extensions: [editorFocusField, focusTransactionFilter] });
    state = state.update({ effects: setEditorFocus.of(0) }).state;
    const start = text.indexOf("# One");
    expect(state.field(editorFocusField)!.range.from).toBe(start);
    expect(state.selection.main.head).toBe(start);
    const backspace = state.update({ changes: { from: start - 1, to: start }, userEvent: "delete.backward" });
    expect(backspace.state.doc.toString()).toBe(text);
    state = state.update({ effects: setEditorFocus.of(null), selection: { anchor: start - 1 } }).state;
    expect(state.selection.main.head).toBe(start - 1);
    expect(state.doc.toString()).toBe(text);
  });

  it("keeps the complete document and clamps the cursor to the focused section", () => {
    const state = editor();
    const focus = state.field(editorFocusField)!;
    expect(state.doc.toString()).toBe(source);
    expect(state.selection.main.head).toBe(focus.range.from);
    const moved = state.update({ selection: { anchor: source.length }, userEvent: "select.keyboard" }).state;
    expect(moved.selection.main.head).toBe(focus.range.to);
    expect(moved.field(editorFocusField)!.index).toBe(1);
  });

  it("lets native template APIs replace a selection at full-document coordinates", () => {
    let state = editor();
    const start = source.indexOf("apple", source.indexOf("Second"));
    state = state.update({ selection: { anchor: start, head: start + 5 } }).state;
    state = state.update({ changes: { from: start, to: start + 5, insert: "【apple】" } }).state;
    expect(state.doc.toString()).toBe(source.replace("Second apple", "Second 【apple】"));
    expect(state.field(editorFocusField)!.index).toBe(1);
  });

  it("blocks backspace across the preceding separator and deletion into hidden text", () => {
    const state = editor();
    const { from, to } = state.field(editorFocusField)!.range;
    for (const changes of [{ from: from - 1, to: from }, { from: to, to: to + 1 }]) {
      expect(state.update({ changes, userEvent: "delete.backward" }).state.doc.toString()).toBe(source);
    }
  });

  it("lets whole-document updates move the same section without blocking synchronization", () => {
    const state = editor();
    const changed = state.update({ changes: { from: 0, insert: "# New\n\nText\n\n---\n\n" } }).state;
    expect(changed.field(editorFocusField)!.index).toBe(2);
    expect(changed.field(editorFocusField)!.document.cards[2]!.source).toContain("Second");
  });

  it("recomputes boundaries immediately when typing a new separator", () => {
    const state = editor();
    const position = source.indexOf("Second");
    const changed = state.update({ changes: { from: position, insert: "Extra\n\n---\n\n" }, userEvent: "input.type" }).state;
    expect(changed.field(editorFocusField)!.document.cards).toHaveLength(4);
  });

  it("retains the focused section when a sync update replaces the entire document", () => {
    const state = editor();
    const changed = state.update({ changes: { from: 0, to: source.length, insert: "New section\n\n---\n\n" + source } }).state;
    expect(changed.field(editorFocusField)!.index).toBe(2);
  });

  it("follows undo and redo to the section they change", () => {
    const state = editor();
    for (const userEvent of ["undo", "redo"]) {
      const changed = state.update({ changes: { from: 6, insert: "Recovered " }, selection: { anchor: 16 }, userEvent }).state;
      expect(changed.field(editorFocusField)!.index).toBe(0);
    }
  });

  it("supports explicit navigation and removes all restrictions when focus is disabled", () => {
    let state = editor();
    state = state.update({ effects: setEditorFocus.of(2), selection: { anchor: source.length }, annotations: Transaction.addToHistory.of(false) }).state;
    expect(state.field(editorFocusField)!.index).toBe(2);
    state = state.update({ effects: setEditorFocus.of(null) }).state;
    const moved = state.update({ selection: { anchor: 0 } }).state;
    expect(moved.selection.main.head).toBe(0);
    expect(moved.field(editorFocusField)).toBeNull();
    expect(moved.doc.toString()).toBe(source);
  });
});

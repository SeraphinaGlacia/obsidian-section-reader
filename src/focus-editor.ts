import { EditorSelection, EditorState, StateEffect, StateField, Transaction } from "@codemirror/state";
import type { Extension, TransactionSpec } from "@codemirror/state";
import { Decoration, EditorView, ViewPlugin, WidgetType } from "@codemirror/view";
import type { DecorationSet } from "@codemirror/view";
import { editorInfoField } from "obsidian";
import type { MarkdownFileInfo } from "obsidian";
import type { CardDocument } from "./cards";
import { resolveCardIndex } from "./cards";
import { parseSectionDocument, sectionIndexAt, sectionRange } from "./section-document";
import type { SectionRange } from "./section-document";

export interface EditorFocus {
  document: CardDocument;
  index: number;
  range: SectionRange;
  decorations: DecorationSet;
}

export const setEditorFocus = StateEffect.define<number | null>();

class PrefixMask extends WidgetType {
  toDOM(): HTMLElement {
    const element = createDiv();
    element.className = "section-reader-prefix-mask";
    return element;
  }
}
const separatorPrefixMask = new PrefixMask();

function focusFor(document: CardDocument, index: number, editingRange?: SectionRange): EditorFocus {
  index = Math.max(0, Math.min(index, document.cards.length - 1));
  const range = editingRange ?? sectionRange(document, index);
  const hidden = [];
  if (range.from > 0) {
    // Keep the preceding source line in the rendered range so native Live
    // Preview still decorates the first content line. Hide that boundary line.
    const boundary = document.source.lastIndexOf("\n", range.from - 2) + 1;
    // Live Preview replaces a rule with a widget that drops line attributes.
    // Mark its protected predecessor so CSS can hide that one rule widget too.
    const widget = document.breaks.some(separator => separator.start === boundary) ? separatorPrefixMask : undefined;
    if (boundary > 0) hidden.push(Decoration.replace({ block: true, inclusiveStart: true, inclusiveEnd: false, ...(widget === undefined ? {} : { widget }) }).range(0, boundary));
    else if (widget !== undefined) hidden.push(Decoration.widget({ block: true, side: -1, widget }).range(0));
    hidden.push(Decoration.line({ class: "section-reader-hidden-boundary" }).range(boundary));
  }
  if (range.to < document.source.length) {
    hidden.push(Decoration.replace({ block: true, inclusiveStart: false, inclusiveEnd: true }).range(range.to, document.source.length));
  }
  return { document, index, range, decorations: Decoration.set(hidden) };
}

export const editorFocusField = StateField.define<EditorFocus | null>({
  create: () => null,
  update(value, transaction) {
    for (const effect of transaction.effects) {
      if (effect.is(setEditorFocus)) {
        return effect.value === null ? null : focusFor(parseSectionDocument(transaction.newDoc.toString()), effect.value);
      }
    }
    if (value === null || !transaction.docChanged) return value;
    let confined = true;
    transaction.changes.iterChangedRanges((from, to) => {
      if (from < value.range.from || to > value.range.to) confined = false;
    });
    if (confined && ["input", "delete", "undo", "redo"].some(event => transaction.isUserEvent(event))) {
      // Keep newly typed separators inside the current editing area until an
      // explicit navigation or mode switch. This also leaves room to type an
      // empty section's first paragraph without an automatic page turn.
      const range = {
        from: transaction.changes.mapPos(value.range.from, -1),
        to: transaction.changes.mapPos(value.range.to, 1),
      };
      const document = parseSectionDocument(transaction.newDoc.toString(), range);
      return focusFor(document, sectionIndexAt(document, transaction.newSelection.main.head), range);
    }
    const document = parseSectionDocument(transaction.newDoc.toString());
    if (transaction.isUserEvent("undo") || transaction.isUserEvent("redo")) {
      return focusFor(document, sectionIndexAt(document, transaction.newSelection.main.head));
    }
    let replacedDocument = false;
    transaction.changes.iterChangedRanges((from, to) => {
      if (from === 0 && to === transaction.startState.doc.length) replacedDocument = true;
    });
    if (replacedDocument) {
      return focusFor(document, resolveCardIndex(document, value.index, value.document.cards[value.index]?.key));
    }
    const anchor = transaction.changes.mapPos(value.range.from, 1);
    return focusFor(document, sectionIndexAt(document, anchor));
  },
  provide: (field) => [
    EditorView.decorations.from(field, (value) => value?.decorations ?? Decoration.none),
    EditorView.atomicRanges.of((view) => view.state.field(field)?.decorations ?? Decoration.none),
  ],
});

function clampSelection(selection: EditorSelection, range: SectionRange): EditorSelection {
  const clamp = (position: number): number => Math.min(range.to, Math.max(range.from, position));
  return EditorSelection.create(selection.ranges.map((selected) =>
    EditorSelection.range(clamp(selected.anchor), clamp(selected.head)),
  ), selection.mainIndex);
}

/** Keep user edits inside the visible section without rewriting the full editor document. */
export const focusTransactionFilter = EditorState.transactionFilter.of((transaction) => {
  const previous = transaction.startState.field(editorFocusField, false);
  if (previous !== null && previous !== undefined && transaction.docChanged &&
    (transaction.isUserEvent("input") || transaction.isUserEvent("delete"))) {
    let outside = false;
    transaction.changes.iterChangedRanges((from, to) => {
      if (from < previous.range.from || to > previous.range.to) outside = true;
    });
    if (outside) return [];
  }
  const next = transaction.state.field(editorFocusField, false);
  if (next === undefined || next === null) return transaction;
  const selection = clampSelection(transaction.newSelection, next.range);
  if (selection.eq(transaction.newSelection)) return transaction;
  return [transaction, { selection, sequential: true } satisfies TransactionSpec];
});

export interface EditorBridge {
  attach(info: MarkdownFileInfo, editor: EditorView): void;
  detach(info: MarkdownFileInfo, editor: EditorView): void;
  changed(info: MarkdownFileInfo, focus: EditorFocus): void;
}

export function focusEditorExtension(bridge: EditorBridge): Extension {
  return [editorFocusField, focusTransactionFilter, ViewPlugin.fromClass(class {
    readonly info: MarkdownFileInfo | undefined;
    constructor(readonly view: EditorView) {
      this.info = view.state.field(editorInfoField, false);
      if (this.info !== undefined) bridge.attach(this.info, view);
    }
    update(): void {
      const focus = this.view.state.field(editorFocusField);
      if (this.info !== undefined && focus !== null) bridge.changed(this.info, focus);
    }
    destroy(): void {
      if (this.info !== undefined) bridge.detach(this.info, this.view);
    }
  })];
}

export function focusEditor(editor: EditorView, index: number | null, anchor?: number): void {
  const spec: TransactionSpec = {
    effects: setEditorFocus.of(index),
    annotations: Transaction.addToHistory.of(false),
  };
  if (anchor !== undefined) {
    spec.selection = { anchor };
    spec.scrollIntoView = true;
  }
  editor.dispatch(spec);
}

/** Apply edited separators at an explicit navigation boundary, keeping the caret's section. */
export function finishFocusedEditing(editor: EditorView): void {
  if (editor.state.field(editorFocusField, false) == null) return;
  const document = parseSectionDocument(editor.state.doc.toString());
  const anchor = editor.state.selection.main.head;
  focusEditor(editor, sectionIndexAt(document, anchor), anchor);
}

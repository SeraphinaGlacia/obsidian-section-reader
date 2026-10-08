import { Component, Platform, parseLinktext, resolveSubpath } from "obsidian";
import type { MarkdownPostProcessorContext, MarkdownView, TFile } from "obsidian";
import type { EditorView } from "@codemirror/view";
import { resolveCardIndex } from "./cards";
import type { CardDocument } from "./cards";
import { EdgeDoubleTapGesture, edgeTapSideForPosition } from "./edge-tap";
import { editorFocusField, focusEditor } from "./focus-editor";
import type { EditorFocus } from "./focus-editor";
import type { Translations } from "./i18n";
import { lineAtOffset, offsetAtLine, parseSectionDocument, sectionIndexAt, sectionRange } from "./section-document";
import type { ProgressStore } from "./progress-store";
import { SectionTransition } from "./section-transition";
import { eventElement, hasActiveTextSelection, internalLinkFromEvent, isInteractiveTarget } from "./ui";

export interface SessionHost {
  text: Translations;
  progress: ProgressStore;
  blocks: WeakMap<HTMLElement, MarkdownPostProcessorContext>;
  editorFor(view: MarkdownView): EditorView | undefined;
  stop(view: MarkdownView): void;
}

export class FocusSession extends Component {
  readonly file: TFile;
  document: CardDocument;
  index: number;
  private mode: string;
  private readonly counter: HTMLElement;
  private readonly gesture = new EdgeDoubleTapGesture();
  private readonly scrollPositions = new Map<number, number>();
  private frame: number | null = null;
  private stopped = false;
  private lastSavedKey = "";
  private restoreScroll = true;
  private composing = false;
  private previewBounds: { source: string; index: number; first: number; last: number } | undefined;
  private previewDocumentId: string | undefined;
  private previewNeedsRerender = false;
  private readonly transition: SectionTransition;

  constructor(readonly view: MarkdownView, private readonly host: SessionHost, initialIndex?: number) {
    super();
    this.file = view.file!;
    this.transition = new SectionTransition(view.contentEl);
    this.document = parseSectionDocument(view.getViewData());
    const saved = host.progress.get(this.file.path);
    this.index = initialIndex ?? (view.getMode() === "source"
      ? sectionIndexAt(this.document, view.editor.posToOffset(view.editor.getCursor()))
      : resolveCardIndex(this.document, saved?.index ?? 0, saved?.cardKey));
    this.index = Math.max(0, Math.min(this.index, this.document.cards.length - 1));
    this.mode = view.getMode();
    this.counter = createDiv();
    this.counter.className = "section-reader-counter";
    this.counter.setAttribute("role", "status");
    this.counter.setAttribute("aria-live", "polite");
    this.counter.setAttribute("aria-atomic", "true");
  }

  onload(): void {
    const { view } = this;
    view.contentEl.classList.add("section-reader-focus");
    view.contentEl.append(this.counter);
    const Observer = view.containerEl.ownerDocument.defaultView!.MutationObserver;
    const observer = new Observer(() => this.schedule());
    observer.observe(view.containerEl, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-mode"] });
    this.register(() => observer.disconnect());
    this.registerDomEvent(view.contentEl, "keydown", (event) => this.handleKey(event), true);
    this.registerDomEvent(view.contentEl, "click", (event) => this.handleLink(event), true);
    this.registerDomEvent(view.contentEl, "compositionstart", () => { this.composing = true; this.gesture.reset(); });
    this.registerDomEvent(view.contentEl, "compositionend", () => { this.composing = false; });
    this.registerGestures();

    // Observe the public navigation hook without replacing the MarkdownView or its editor.
    // eslint-disable-next-line @typescript-eslint/unbound-method -- Preserve identity for cleanup and call with the view below.
    const original = view.setEphemeralState;
    const navigate = (state: unknown): void => {
      this.handleNavigation(state);
      original.call(view, state);
    };
    view.setEphemeralState = navigate;
    this.register(() => { if (view.setEphemeralState === navigate) view.setEphemeralState = original; });
    this.syncEditor();
    this.previewRoot()?.classList.add("section-reader-preview");
    view.previewMode.rerender(true);
    this.applyPreview();
    this.schedule();
    this.updateCounter();
  }

  onunload(): void {
    this.stopped = true;
    this.transition.cancel();
    const win = this.view.containerEl.ownerDocument.defaultView!;
    if (this.frame !== null) win.cancelAnimationFrame(this.frame);
    if (this.view.app.vault.getFileByPath(this.file.path) === this.file) this.persist();
    const editor = this.host.editorFor(this.view);
    if (editor !== undefined && editor.state.field(editorFocusField, false)) focusEditor(editor, null);
    this.view.contentEl.classList.remove("section-reader-focus");
    this.counter.remove();
    const preview = this.previewRoot();
    preview?.classList.remove("section-reader-preview");
    preview?.querySelectorAll(".section-reader-hidden").forEach((element) => element.classList.remove("section-reader-hidden"));
    this.view.previewMode.rerender(true);
  }

  navigate(direction: -1 | 1): boolean {
    const next = this.index + direction;
    if (next < 0 || next >= this.document.cards.length) return false;
    this.select(next, undefined, direction);
    return true;
  }

  select(index: number, offset?: number, direction?: -1 | 1): void {
    this.transition.cancel();
    if (direction !== undefined) {
      const source = this.view.getMode() === "preview" ? this.view.previewMode.containerEl
        : this.view.contentEl.querySelector<HTMLElement>(":scope > .markdown-source-view");
      if (source !== null) this.transition.prepare(source, direction, () =>
        this.view.getMode() === "source" || this.previewRoot()?.querySelector("[data-section-reader-block]:not(.section-reader-hidden)") != null,
      );
    }
    this.rememberScroll();
    this.index = Math.max(0, Math.min(index, this.document.cards.length - 1));
    this.restoreScroll = true;
    this.syncEditor(offset ?? sectionRange(this.document, this.index).from);
    this.view.previewMode.rerender(true);
    this.applyPreview();
    this.updateCounter();
    this.schedule();
  }

  editorChanged(focus: EditorFocus): void {
    const changed = this.document.source !== focus.document.source || this.index !== focus.index;
    this.document = focus.document;
    this.index = focus.index;
    if (changed) { this.updateCounter(); this.schedule(); }
  }

  sourceChanged(source: string): void {
    if (this.view.getMode() === "source" || source === this.document.source) return;
    const key = this.document.cards[this.index]?.key;
    this.document = parseSectionDocument(source);
    this.index = resolveCardIndex(this.document, this.index, key);
    this.updateCounter();
    this.schedule();
  }

  syncEditor(anchor?: number): void {
    const editor = this.host.editorFor(this.view);
    if (editor === undefined) return;
    const current = editor.state.field(editorFocusField, false);
    if (anchor === undefined && current?.index === this.index && current.document.source === this.document.source) return;
    focusEditor(editor, this.index, anchor);
  }

  schedule(): void {
    if (this.stopped || this.frame !== null) return;
    this.frame = this.view.containerEl.ownerDocument.defaultView!.requestAnimationFrame(() => {
      this.frame = null;
      if (this.view.file !== this.file) return;
      const mode = this.view.getMode();
      if (mode !== this.mode) {
        this.transition.cancel();
        this.mode = mode;
        this.restoreScroll = true;
        if (mode === "source") this.syncEditor();
        else this.view.previewMode.rerender(true);
      }
      this.applyPreview();
      if (this.previewNeedsRerender && mode === "preview") {
        this.previewNeedsRerender = false;
        this.view.previewMode.rerender(true);
      }
    });
  }

  persist(): void {
    const card = this.document.cards[this.index];
    if (card === undefined) return;
    const key = `${this.file.path}:${this.index}:${card.key}`;
    if (key === this.lastSavedKey) return;
    this.lastSavedKey = key;
    this.host.progress.set(this.file.path, this.index, card.key);
  }

  private previewRoot(): HTMLElement | null {
    return this.view.previewMode.containerEl.querySelector<HTMLElement>(".markdown-preview-view");
  }

  private applyPreview(): void {
    const preview = this.previewRoot();
    if (preview === null) return;
    preview.classList.add("section-reader-preview");
    for (const element of preview.querySelectorAll<HTMLElement>("[data-section-reader-block]")) {
      const context = this.host.blocks.get(element);
      if (context !== undefined) this.filterPreviewBlock(element, context);
    }
    if (this.restoreScroll && this.view.getMode() === "preview") {
      this.restoreScroll = false;
      // Native ephemeral scroll waits for rendering; assigning scrollTop here is
      // clamped back to zero while the incoming section is being rebuilt.
      const scroll = this.scrollPositions.get(this.index) ??
        lineAtOffset(this.document.source, sectionRange(this.document, this.index).from);
      this.view.setEphemeralState({ scroll });
    }
  }

  /** Filter during postprocessing so native virtualization measures the focused layout. */
  filterPreviewBlock(element: HTMLElement, context: MarkdownPostProcessorContext): void {
    const preview = this.previewRoot();
    if (preview === null || context.sourcePath !== this.file.path) return;
    const root = element.closest(".markdown-preview-view");
    if (root === preview) {
      if (this.previewDocumentId !== context.docId) {
        this.previewDocumentId = context.docId;
        this.previewNeedsRerender = true;
        this.schedule();
      }
    } else if (root !== null || this.previewDocumentId === undefined || context.docId !== this.previewDocumentId) return;
    const info = context.getSectionInfo(element);
    if (info === null) return;
    this.sourceChanged(this.view.getViewData());
    if (this.previewBounds?.source !== this.document.source || this.previewBounds.index !== this.index) {
      const range = sectionRange(this.document, this.index);
      this.previewBounds = {
        source: this.document.source, index: this.index,
        first: lineAtOffset(this.document.source, range.from), last: lineAtOffset(this.document.source, range.to),
      };
    }
    const visible = info.lineEnd >= this.previewBounds.first && info.lineStart <= this.previewBounds.last;
    element.classList.toggle("section-reader-hidden", !visible);
  }

  private rememberScroll(): void {
    const preview = this.previewRoot();
    if (preview !== null && this.view.getMode() === "preview") this.scrollPositions.set(this.index, this.view.previewMode.getScroll());
  }

  private updateCounter(): void {
    const text = `${this.index + 1}/${this.document.cards.length}`;
    if (this.counter.textContent !== text) this.counter.textContent = text;
    this.counter.setAttribute("aria-label", this.host.text.cardLabel(this.index + 1, this.document.cards.length));
    this.persist();
  }

  private handleKey(event: KeyboardEvent): void {
    if (this.view.getMode() !== "preview" || event.defaultPrevented || event.isComposing ||
      event.ctrlKey || event.metaKey || event.altKey || event.shiftKey || isInteractiveTarget(event.target) ||
      hasActiveTextSelection(this.view.containerEl.ownerDocument.defaultView!.getSelection())) return;
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      this.navigate(event.key === "ArrowLeft" ? -1 : 1);
    } else if (event.key === "Escape") this.host.stop(this.view);
    else return;
    event.preventDefault();
    event.stopPropagation();
  }

  private handleNavigation(value: unknown): void {
    if (typeof value !== "object" || value === null) return;
    const state = value as { line?: unknown; subpath?: unknown };
    let line = typeof state.line === "number" ? state.line : undefined;
    if (typeof state.subpath === "string") {
      const cache = this.view.app.metadataCache.getFileCache(this.file);
      if (cache !== null) line = resolveSubpath(cache, state.subpath)?.start.line ?? line;
    }
    if (line === undefined) return;
    const offset = offsetAtLine(this.document.source, line);
    this.select(sectionIndexAt(this.document, offset), offset);
  }

  private handleLink(event: MouseEvent): void {
    if (this.view.getMode() !== "preview" || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
    const preview = this.previewRoot();
    const element = eventElement(event.target);
    const footnote = element?.closest<HTMLAnchorElement>("a.footnote-link");
    if (event.button === 0 && preview !== null && footnote !== null && footnote !== undefined) {
      const href = footnote.getAttribute("href");
      const target = href?.startsWith("#") ? preview.querySelector<HTMLElement>(`[id="${CSS.escape(href.slice(1))}"]`) : null;
      const block = target?.closest<HTMLElement>("[data-section-reader-block]");
      const info = block ? this.host.blocks.get(block)?.getSectionInfo(block) : null;
      if (info !== null && info !== undefined) this.handleNavigation({ line: info.lineStart });
    }
    const anchor = internalLinkFromEvent(event);
    if (anchor === null) return;
    const link = anchor.dataset.href ?? anchor.getAttribute("href");
    if (link === null || link === undefined) return;
    const { path, subpath } = parseLinktext(link);
    const target = path === "" ? this.file : this.view.app.metadataCache.getFirstLinkpathDest(path, this.file.path);
    if (target === this.file) this.handleNavigation({ subpath });
    else if (target !== null) {
      event.preventDefault();
      event.stopPropagation();
      void this.view.app.workspace.openLinkText(link, this.file.path, "tab");
    }
  }

  private registerGestures(): void {
    const el = this.view.contentEl;
    this.registerDomEvent(el, "pointerdown", (event) => {
      const target = event.target;
      const element = eventElement(target);
      const inEditor = element?.closest(".cm-content") !== null && element !== null;
      const interactive = inEditor
        ? element.closest("a, button, input, textarea, select, [contenteditable='false']") !== null
        : isInteractiveTarget(target);
      if (!Platform.isMobile || this.composing || !event.isPrimary ||
        event.pointerType === "mouse" || interactive ||
        hasActiveTextSelection(el.ownerDocument.defaultView!.getSelection())) {
        this.gesture.reset();
        return;
      }
      const rect = el.getBoundingClientRect();
      this.gesture.begin(event.pointerId, event.clientX, event.clientY, event.timeStamp,
        edgeTapSideForPosition(event.clientX, rect.left, rect.width));
    });
    this.registerDomEvent(el, "pointermove", (event) => this.gesture.move(event.pointerId, event.clientX, event.clientY));
    this.registerDomEvent(el, "pointercancel", () => this.gesture.reset());
    this.registerDomEvent(el, "pointerup", (event) => {
      if (this.composing) { this.gesture.reset(); return; }
      const rect = el.getBoundingClientRect();
      const direction = this.gesture.end(event.pointerId, event.clientX, event.clientY, event.timeStamp,
        edgeTapSideForPosition(event.clientX, rect.left, rect.width));
      if (direction !== 0 && !hasActiveTextSelection(el.ownerDocument.defaultView!.getSelection())) this.navigate(direction);
    });
  }
}

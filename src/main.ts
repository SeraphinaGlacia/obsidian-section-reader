import { FileView, MarkdownView, Plugin, TFile, getLanguage } from "obsidian";
import type { MarkdownFileInfo, MarkdownPostProcessorContext, ViewStateResult, WorkspaceLeaf } from "obsidian";
import type { EditorView } from "@codemirror/view";
import { VIEW_TYPE_FOCUS_CARDS } from "./constants";
import { focusEditorExtension } from "./focus-editor";
import { FocusSession } from "./focus-session";
import { translationsForLanguage } from "./i18n";
import { ProgressStore } from "./progress-store";

/** Loads saved pre-0.3 tabs and hands them back to the native Markdown view. */
class LegacyFocusView extends FileView {
  constructor(leaf: WorkspaceLeaf, private readonly plugin: FocusCardsPlugin) { super(leaf); }
  getViewType(): string { return VIEW_TYPE_FOCUS_CARDS; }
  getDisplayText(): string { return this.file?.basename ?? this.plugin.text.viewName; }
  async setState(state: Record<string, unknown>, result: ViewStateResult): Promise<void> {
    await super.setState(state, result);
    if (this.file === null) return;
    const file = this.file.path;
    const index = typeof state.cardIndex === "number" && Number.isInteger(state.cardIndex) && state.cardIndex >= 0
      ? state.cardIndex : undefined;
    this.app.workspace.onLayoutReady(() => {
      window.setTimeout(() => {
        if (this.leaf.view !== this) return;
        void this.leaf.setViewState({ type: "markdown", state: { file, mode: "preview" } }).then(() => {
          if (this.leaf.view instanceof MarkdownView) this.plugin.start(this.leaf.view, index);
        });
      }, 0);
    });
  }
}

export default class FocusCardsPlugin extends Plugin {
  readonly progress = new ProgressStore(this);
  readonly text = translationsForLanguage(getLanguage());
  readonly blocks = new WeakMap<HTMLElement, MarkdownPostProcessorContext>();
  private readonly sessions = new Map<MarkdownView, FocusSession>();
  private readonly editors = new Map<MarkdownFileInfo, EditorView>();
  private stopping = false;

  async onload(): Promise<void> {
    await this.progress.load();
    this.registerView(VIEW_TYPE_FOCUS_CARDS, (leaf) => new LegacyFocusView(leaf, this));
    this.registerEditorExtension(focusEditorExtension({
      attach: (info, editor) => {
        this.editors.set(info, editor);
        window.setTimeout(() => { if (info instanceof MarkdownView) this.sessions.get(info)?.syncEditor(); }, 0);
      },
      detach: (info, editor) => { if (this.editors.get(info) === editor) this.editors.delete(info); },
      changed: (info, focus) => { if (info instanceof MarkdownView) this.sessions.get(info)?.editorChanged(focus); },
    }));
    this.registerMarkdownPostProcessor((element, context) => {
      if (context.getSectionInfo(element) === null) return;
      element.dataset.sectionReaderBlock = "";
      this.blocks.set(element, context);
      for (const session of this.sessions.values()) session.filterPreviewBlock(element, context);
    });
    this.addRibbonIcon("gallery-horizontal", this.text.ribbon, () => this.toggle());
    this.addCommand({ id: "toggle-card-view", name: this.text.toggle, checkCallback: (checking) => {
      const view = this.activeView();
      if (view === null || view.file === null) return false;
      if (!checking) this.toggle();
      return true;
    } });
    for (const [id, name, direction] of [
      ["next-card", this.text.next, 1], ["previous-card", this.text.previous, -1],
    ] as const) {
      this.addCommand({ id, name, checkCallback: (checking) => {
        const view = this.activeView();
        const session = view === null ? undefined : this.sessions.get(view);
        if (session === undefined) return false;
        if (!checking) session.navigate(direction);
        return true;
      } });
    }
    this.registerEvent(this.app.workspace.on("layout-change", () => this.syncViews()));
    this.registerEvent(this.app.workspace.on("file-open", () => this.syncViews()));
    this.registerEvent(this.app.metadataCache.on("changed", (file, data) => {
      for (const session of this.sessions.values()) if (session.file === file) session.sourceChanged(data);
    }));
    this.registerEvent(this.app.vault.on("rename", (file, oldPath) => {
      if (file instanceof TFile) this.progress.rename(oldPath, file.path);
    }));
    this.registerEvent(this.app.vault.on("delete", (file) => {
      if (!(file instanceof TFile)) return;
      for (const [view, session] of [...this.sessions]) if (session.file === file) this.stop(view);
      this.progress.delete(file.path);
    }));
  }

  onunload(): void {
    this.stopping = true;
    for (const view of [...this.sessions.keys()]) this.stop(view);
    this.editors.clear();
    void this.progress.flush();
  }

  editorFor(view: MarkdownView): EditorView | undefined { return this.editors.get(view); }

  start(view: MarkdownView, index?: number): void {
    if (this.stopping || this.sessions.has(view) || view.file === null) return;
    const session = new FocusSession(view, this, index);
    this.sessions.set(view, session);
    this.addChild(session);
  }

  stop(view: MarkdownView): void {
    const session = this.sessions.get(view);
    if (session === undefined) return;
    this.sessions.delete(view);
    this.removeChild(session);
  }

  private activeView(): MarkdownView | null {
    const view = this.app.workspace.getMostRecentLeaf()?.view;
    return view instanceof MarkdownView ? view : null;
  }

  private toggle(): void {
    const view = this.activeView();
    if (view === null) return;
    if (this.sessions.has(view)) this.stop(view);
    else this.start(view);
  }

  private syncViews(): void {
    const open = new Set(this.app.workspace.getLeavesOfType("markdown").map((leaf) => leaf.view));
    for (const [view, session] of [...this.sessions]) {
      if (!open.has(view)) this.stop(view);
      else if (view.file !== session.file) {
        this.stop(view);
        if (view.file !== null) this.start(view);
      } else session.schedule();
    }
  }
}

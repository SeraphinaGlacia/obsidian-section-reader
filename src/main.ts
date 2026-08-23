import {
  MarkdownView,
  Plugin,
  TFile,
  getFrontMatterInfo,
  getLanguage,
} from "obsidian";
import type { ViewState, WorkspaceLeaf } from "obsidian";
import { cardIndexForLine, createCardDocument } from "./cards";
import { VIEW_TYPE_FOCUS_CARDS } from "./constants";
import { FocusCardsView } from "./focus-cards-view";
import { translationsForLanguage } from "./i18n";
import { ProgressStore } from "./progress-store";
import type { FocusCardsState, ReturnViewSnapshot } from "./types";
import { detectReadableLineWidth } from "./ui";

function cloneRecord(value: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (value === undefined) return undefined;
  try {
    return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
  } catch {
    return { ...value };
  }
}

function serializableViewState(state: ViewState): ViewState {
  const copy: ViewState = { type: state.type };
  const copiedState = cloneRecord(state.state);
  if (copiedState !== undefined) copy.state = copiedState;
  if (state.active !== undefined) copy.active = state.active;
  if (state.pinned !== undefined) copy.pinned = state.pinned;
  return copy;
}

function captureReturnView(leaf: WorkspaceLeaf, view: MarkdownView): ReturnViewSnapshot {
  const snapshot: ReturnViewSnapshot = {
    viewState: serializableViewState(leaf.getViewState()),
  };
  if (view.getMode() === "source") {
    snapshot.cursor = view.editor.getCursor();
    snapshot.editorScroll = view.editor.getScrollInfo();
  } else {
    snapshot.previewScrollTop = view.previewMode.getScroll();
  }
  return snapshot;
}

function nextAnimationFrame(): Promise<void> {
  return new Promise((resolve) => window.requestAnimationFrame(() => resolve()));
}

export default class FocusCardsPlugin extends Plugin {
  readonly progress = new ProgressStore(this);
  readonly text = translationsForLanguage(getLanguage());
  private readonly trackedViews = new Map<
    WorkspaceLeaf,
    { filePath: string; snapshot?: ReturnViewSnapshot }
  >();
  private unloading = false;
  private unloadRestoreScheduled = false;

  async onload(): Promise<void> {
    // Bracket registerView's cleanup so this runs first regardless of cleanup ordering.
    this.register(() => this.beginUnloadRestore());
    await this.progress.load();
    this.registerView(
      VIEW_TYPE_FOCUS_CARDS,
      (leaf) => new FocusCardsView(leaf, this),
    );

    this.addRibbonIcon("gallery-horizontal", this.text.ribbon, () => {
      void this.toggleActiveLeaf();
    });

    this.addCommand({
      id: "toggle-card-view",
      name: this.text.toggle,
      checkCallback: (checking) => {
        const leaf = this.app.workspace.getMostRecentLeaf();
        const available =
          leaf !== null &&
          (leaf.view instanceof MarkdownView || leaf.view instanceof FocusCardsView);
        if (available && !checking) void this.toggleLeaf(leaf);
        return available;
      },
    });
    this.addCommand({
      id: "next-card",
      name: this.text.next,
      checkCallback: (checking) => {
        const view = this.app.workspace.getMostRecentLeaf()?.view;
        if (!(view instanceof FocusCardsView)) return false;
        if (!checking) view.nextCard();
        return true;
      },
    });
    this.addCommand({
      id: "previous-card",
      name: this.text.previous,
      checkCallback: (checking) => {
        const view = this.app.workspace.getMostRecentLeaf()?.view;
        if (!(view instanceof FocusCardsView)) return false;
        if (!checking) view.previousCard();
        return true;
      },
    });

    this.registerEvent(
      this.app.metadataCache.on("changed", (file, data, cache) => {
        for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_FOCUS_CARDS)) {
          const view = leaf.view;
          if (view instanceof FocusCardsView && view.file?.path === file.path) {
            view.handleMetadataChanged(data, cache);
          }
        }
      }),
    );
    this.registerEvent(
      this.app.vault.on("rename", (file, oldPath) => {
        if (file instanceof TFile) this.progress.rename(oldPath, file.path);
      }),
    );
    this.registerEvent(
      this.app.vault.on("delete", (file) => {
        if (file instanceof TFile) this.progress.delete(file.path);
      }),
    );
    this.register(() => this.beginUnloadRestore());
  }

  onunload(): void {
    this.beginUnloadRestore();
    void this.progress.flush().catch(() => undefined);
  }

  trackView(
    leaf: WorkspaceLeaf,
    filePath: string | undefined,
    snapshot: ReturnViewSnapshot | undefined,
  ): void {
    const current = this.trackedViews.get(leaf);
    const resolvedPath = filePath ?? current?.filePath;
    if (resolvedPath === undefined) return;
    const tracked: { filePath: string; snapshot?: ReturnViewSnapshot } = {
      filePath: resolvedPath,
    };
    const resolvedSnapshot = snapshot ?? current?.snapshot;
    if (resolvedSnapshot !== undefined) tracked.snapshot = resolvedSnapshot;
    this.trackedViews.set(leaf, tracked);
  }

  scheduleClosedViewRestore(
    leaf: WorkspaceLeaf,
    filePath: string | undefined,
    snapshot: ReturnViewSnapshot | undefined,
  ): void {
    this.trackView(leaf, filePath, snapshot);
    const target = this.trackedViews.get(leaf);
    if (target === undefined) return;

    // View unregistration can finish after the plugin cleanup callbacks. Waiting for the
    // next UI turn avoids restoring a view that Obsidian is still replacing with `empty`.
    window.setTimeout(() => {
      if (!this.unloading) {
        this.trackedViews.delete(leaf);
        return;
      }
      this.restoreTrackedLeaf(leaf, target);
    }, 250);
  }

  async restoreLeaf(leaf: WorkspaceLeaf, snapshot?: ReturnViewSnapshot): Promise<void> {
    const focusView = leaf.view instanceof FocusCardsView ? leaf.view : null;
    focusView?.persistProgress();
    const filePath = focusView?.file?.path;
    if (filePath === undefined) return;

    await this.restoreSnapshot(leaf, filePath, snapshot);
  }

  private async restoreSnapshot(
    leaf: WorkspaceLeaf,
    filePath: string,
    snapshot?: ReturnViewSnapshot,
  ): Promise<void> {

    const storedState = snapshot?.viewState;
    const targetState: ViewState =
      storedState !== undefined && storedState.type !== VIEW_TYPE_FOCUS_CARDS
        ? serializableViewState(storedState)
        : { type: "markdown", state: { file: filePath } };
    targetState.state = { ...(targetState.state ?? {}), file: filePath };
    await leaf.setViewState(targetState);
    await nextAnimationFrame();
    await nextAnimationFrame();

    const markdownView = leaf.view;
    if (!(markdownView instanceof MarkdownView) || snapshot === undefined) return;
    if (markdownView.getMode() === "source") {
      if (snapshot.cursor !== undefined) markdownView.editor.setCursor(snapshot.cursor);
      if (snapshot.editorScroll !== undefined) {
        markdownView.editor.scrollTo(snapshot.editorScroll.left, snapshot.editorScroll.top);
      }
    } else if (snapshot.previewScrollTop !== undefined) {
      markdownView.previewMode.applyScroll(snapshot.previewScrollTop);
    }
  }

  private scheduleUnloadRestore(): void {
    if (this.unloadRestoreScheduled) return;
    const targets = [...this.trackedViews.entries()].map(
      ([leaf, tracked]) => ({ leaf, ...tracked }),
    );
    if (targets.length === 0) return;

    this.unloadRestoreScheduled = true;
    // Registered view types are removed during the same unload pass. Restore after that pass.
    window.setTimeout(() => {
      for (const { leaf, filePath, snapshot } of targets) {
        this.restoreTrackedLeaf(
          leaf,
          snapshot === undefined ? { filePath } : { filePath, snapshot },
        );
      }
    }, 0);
  }

  private beginUnloadRestore(): void {
    this.unloading = true;
    this.scheduleUnloadRestore();
  }

  private restoreTrackedLeaf(
    leaf: WorkspaceLeaf,
    tracked: { filePath: string; snapshot?: ReturnViewSnapshot },
  ): void {
    try {
      const currentType = leaf.view.getViewType();
      if (currentType !== VIEW_TYPE_FOCUS_CARDS && currentType !== "empty") return;
      void this.restoreSnapshot(leaf, tracked.filePath, tracked.snapshot).catch(() => undefined);
    } catch {
      // A leaf that was closed by the user no longer needs restoration.
    }
  }

  private async toggleActiveLeaf(): Promise<void> {
    const leaf = this.app.workspace.getMostRecentLeaf();
    if (leaf !== null) await this.toggleLeaf(leaf);
  }

  private async toggleLeaf(leaf: WorkspaceLeaf): Promise<void> {
    const currentView = leaf.view;
    if (currentView instanceof FocusCardsView) {
      await this.restoreLeaf(leaf, currentView.getReturnView());
      return;
    }
    if (!(currentView instanceof MarkdownView)) return;

    const markdownView = currentView;
    const file = markdownView.file;
    if (file === null) return;
    await markdownView.save();
    const source = markdownView.getViewData();
    const cache = this.app.metadataCache.getFileCache(file);
    const frontmatter = getFrontMatterInfo(source);
    const cardDocument = createCardDocument(source, {
      sections: cache?.sections,
      frontmatterEndOffset: frontmatter.exists ? frontmatter.contentStart : undefined,
    });
    const returnView = captureReturnView(leaf, markdownView);
    const focusState: FocusCardsState = {
      file: file.path,
      readableLineWidth: detectReadableLineWidth(markdownView.containerEl),
      returnView,
    };

    if (markdownView.getMode() === "source") {
      const cursorLine = markdownView.editor.getCursor().line;
      const index = cardIndexForLine(cardDocument, cursorLine);
      focusState.cursorLine = cursorLine;
      focusState.cardIndex = index;
      const cardKey = cardDocument.cards[index]?.key;
      if (cardKey !== undefined) focusState.cardKey = cardKey;
    } else {
      const saved = this.progress.get(file.path);
      focusState.cardIndex = saved?.index ?? 0;
      if (saved !== undefined) focusState.cardKey = saved.cardKey;
    }

    const nextState: ViewState = {
      type: VIEW_TYPE_FOCUS_CARDS,
      state: focusState as Record<string, unknown>,
    };
    if (returnView.viewState.pinned !== undefined) {
      nextState.pinned = returnView.viewState.pinned;
    }
    await leaf.setViewState(nextState);
  }
}

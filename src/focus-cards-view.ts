import {
  Component,
  FileView,
  MarkdownRenderer,
  Platform,
  Scope,
  getFrontMatterInfo,
} from "obsidian";
import type {
  CachedMetadata,
  HoverParent,
  HoverPopover,
  IconName,
  TFile,
  ViewState,
  ViewStateResult,
  WorkspaceLeaf,
} from "obsidian";
import {
  cardIndexForLine,
  createCardDocument,
  resolveCardIndex,
  sourceWithMarkers,
} from "./cards";
import type { CardDocument } from "./cards";
import { ComponentSlot } from "./component-slot";
import {
  CARD_ANIMATION_MS,
  HOVER_LINK_SOURCE_FOCUS_CARDS,
  VIEW_TYPE_FOCUS_CARDS,
} from "./constants";
import { EdgeDoubleTapGesture, edgeTapSideForPosition } from "./edge-tap";
import { splitRenderedDocument } from "./render-dom";
import { findTaskLocations, updateTaskSource } from "./tasks";
import type { TaskLocation } from "./tasks";
import type { ReturnViewSnapshot } from "./types";
import {
  formatCounter,
  formatViewTitle,
  hasActiveTextSelection,
  internalLinkFromEvent,
  internalLinkFromHoverEvent,
  internalLinkText,
  isInteractiveTarget,
  setCardAccessibility,
  setReadableLineWidth,
} from "./ui";
import type FocusCardsPlugin from "./main";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readNonNegativeInteger(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : undefined;
}

function readViewState(value: unknown): ViewState | undefined {
  if (!isRecord(value) || typeof value.type !== "string") return undefined;
  const viewState: ViewState = { type: value.type };
  if (isRecord(value.state)) viewState.state = value.state;
  if (typeof value.active === "boolean") viewState.active = value.active;
  if (typeof value.pinned === "boolean") viewState.pinned = value.pinned;
  return viewState;
}

export function readReturnView(value: unknown): ReturnViewSnapshot | undefined {
  if (!isRecord(value)) return undefined;
  const viewState = readViewState(value.viewState);
  if (viewState === undefined || viewState.type === VIEW_TYPE_FOCUS_CARDS) return undefined;

  const snapshot: ReturnViewSnapshot = { viewState };
  if (
    isRecord(value.cursor) &&
    typeof value.cursor.line === "number" &&
    typeof value.cursor.ch === "number"
  ) {
    snapshot.cursor = { line: value.cursor.line, ch: value.cursor.ch };
  }
  if (
    isRecord(value.editorScroll) &&
    typeof value.editorScroll.left === "number" &&
    typeof value.editorScroll.top === "number"
  ) {
    snapshot.editorScroll = { left: value.editorScroll.left, top: value.editorScroll.top };
  }
  if (typeof value.previewScrollTop === "number") {
    snapshot.previewScrollTop = value.previewScrollTop;
  }
  return snapshot;
}

function cardScrollKey(cardDocument: CardDocument, cardIndex: number): string {
  const card = cardDocument.cards[cardIndex]!;
  let occurrence = 0;
  for (let index = 0; index < cardIndex; index += 1) {
    if (cardDocument.cards[index]?.key === card.key) occurrence += 1;
  }
  return `${card.key}:${occurrence}`;
}

export class FocusCardsView extends FileView implements HoverParent {
  hoverPopover: HoverPopover | null = null;

  private readonly plugin: FocusCardsPlugin;
  private readonly edgeDoubleTap = new EdgeDoubleTapGesture();
  private readonly scrollPositions = new Map<string, number>();
  private readonly renderComponents: ComponentSlot<Component>;

  private shellEl: HTMLElement | null = null;
  private viewportEl: HTMLElement | null = null;
  private trackEl: HTMLElement | null = null;
  private counterEl: HTMLElement | null = null;
  private cardElements: HTMLElement[] = [];
  private cardDocument: CardDocument = createCardDocument("");
  private currentIndex = 0;
  private preferredIndex = 0;
  private preferredKey: string | undefined;
  private preferredCursorLine: number | undefined;
  private returnView: ReturnViewSnapshot | undefined;
  private readableLineWidth = true;
  private renderVersion = 0;
  private markerSerial = 0;
  private metadataResolved = false;

  constructor(leaf: WorkspaceLeaf, plugin: FocusCardsPlugin) {
    super(leaf);
    this.plugin = plugin;
    this.scope = new Scope(this.app.scope);
    this.renderComponents = new ComponentSlot((component) => this.removeChild(component));

    this.scope.register([], "ArrowLeft", (event) => {
      if (!this.shouldHandleKey(event)) return;
      this.previousCard();
      return false;
    });
    this.scope.register([], "ArrowRight", (event) => {
      if (!this.shouldHandleKey(event)) return;
      this.nextCard();
      return false;
    });
    this.scope.register([], "Escape", () => {
      void this.plugin.restoreLeaf(this.leaf, this.returnView);
      return false;
    });
  }

  getViewType(): string {
    return VIEW_TYPE_FOCUS_CARDS;
  }

  getDisplayText(): string {
    return formatViewTitle(this.file, this.plugin.text.viewName);
  }

  getIcon(): IconName {
    return "gallery-horizontal";
  }

  getState(): Record<string, unknown> {
    const state = super.getState();
    const persistedIndex = this.metadataResolved ? this.currentIndex : this.preferredIndex;
    const persistedKey = this.metadataResolved
      ? this.cardDocument.cards[this.currentIndex]?.key
      : this.preferredKey;
    state.cardIndex = persistedIndex;
    if (persistedKey !== undefined) state.cardKey = persistedKey;
    if (!this.metadataResolved && this.preferredCursorLine !== undefined) {
      state.cursorLine = this.preferredCursorLine;
    }
    state.readableLineWidth = this.readableLineWidth;
    if (this.returnView !== undefined) state.returnView = this.returnView;
    return state;
  }

  async setState(state: unknown, result: ViewStateResult): Promise<void> {
    if (isRecord(state)) {
      this.preferredIndex = readNonNegativeInteger(state.cardIndex) ?? 0;
      this.preferredKey = typeof state.cardKey === "string" ? state.cardKey : undefined;
      this.preferredCursorLine = readNonNegativeInteger(state.cursorLine);
      this.readableLineWidth =
        typeof state.readableLineWidth === "boolean" ? state.readableLineWidth : true;
      this.returnView = readReturnView(state.returnView);
      this.plugin.trackView(
        this.leaf,
        typeof state.file === "string" ? state.file : undefined,
        this.returnView,
      );
    }
    await super.setState(state, result);
    if (this.file && this.shellEl !== null) await this.renderFile(this.file);
  }

  getReturnView(): ReturnViewSnapshot | undefined {
    return this.returnView;
  }

  nextCard(): boolean {
    return this.navigate(1);
  }

  previousCard(): boolean {
    return this.navigate(-1);
  }

  persistProgress(): void {
    if (!this.metadataResolved || !this.file) return;
    const card = this.cardDocument.cards[this.currentIndex];
    if (card !== undefined) this.plugin.progress.set(this.file.path, this.currentIndex, card.key);
  }

  handleMetadataChanged(data: string, cache: CachedMetadata): void {
    if (!this.file) return;
    const version = ++this.renderVersion;
    void this.renderSource(this.file, data, cache, version);
  }

  protected async onOpen(): Promise<void> {
    this.contentEl.classList.add("focus-cards-view");
    this.contentEl.replaceChildren();

    this.shellEl = document.createElement("div");
    this.shellEl.className = "focus-cards-shell";
    this.viewportEl = document.createElement("div");
    this.viewportEl.className = "focus-cards-viewport";
    this.viewportEl.tabIndex = 0;
    this.trackEl = document.createElement("div");
    this.trackEl.className = "focus-cards-track";
    this.counterEl = document.createElement("div");
    this.counterEl.className = "focus-cards-counter";
    this.counterEl.setAttribute("role", "status");
    this.counterEl.setAttribute("aria-live", "polite");
    this.counterEl.setAttribute("aria-atomic", "true");

    this.viewportEl.append(this.trackEl);
    this.shellEl.append(this.viewportEl, this.counterEl);
    this.contentEl.append(this.shellEl);
    this.registerMobileEdgeDoubleTap(this.viewportEl);
    this.registerDomEvent(this.trackEl, "click", (event) => this.handleTrackClick(event));
    this.registerDomEvent(this.trackEl, "mouseover", (event) => this.handleTrackHover(event));

    if (this.file) await this.renderFile(this.file);
  }

  protected async onClose(): Promise<void> {
    this.plugin.scheduleClosedViewRestore(this.leaf, this.file?.path, this.returnView);
    this.renderVersion += 1;
    this.edgeDoubleTap.reset();
    this.persistProgress();
    this.renderComponents.clear();
    this.cardElements = [];
    this.contentEl.classList.remove("focus-cards-view");
    this.contentEl.replaceChildren();
  }

  async onLoadFile(file: TFile): Promise<void> {
    await super.onLoadFile(file);
    this.plugin.trackView(this.leaf, file.path, this.returnView);
    if (this.shellEl !== null) await this.renderFile(file);
  }

  async onUnloadFile(file: TFile): Promise<void> {
    this.plugin.trackView(this.leaf, file.path, this.returnView);
    this.persistProgress();
    this.renderVersion += 1;
    this.renderComponents.clear();
    this.cardElements = [];
    this.trackEl?.replaceChildren();
    await super.onUnloadFile(file);
  }

  async onRename(file: TFile): Promise<void> {
    await super.onRename(file);
    this.plugin.trackView(this.leaf, file.path, this.returnView);
    if (this.shellEl !== null) await this.renderFile(file);
  }

  onResize(): void {
    this.applyTransform(0, false);
  }

  private shouldHandleKey(event: KeyboardEvent): boolean {
    return !event.isComposing && !isInteractiveTarget(event.target) && !hasActiveTextSelection();
  }

  private navigate(direction: -1 | 1): boolean {
    const nextIndex = this.currentIndex + direction;
    if (nextIndex < 0 || nextIndex >= this.cardDocument.cards.length) {
      this.applyTransform(0, true);
      return false;
    }

    this.currentIndex = nextIndex;
    this.preferredIndex = nextIndex;
    this.preferredKey = this.cardDocument.cards[nextIndex]?.key;
    this.updateActiveCard();
    this.applyTransform(0, true);
    this.persistProgress();
    return true;
  }

  private async renderFile(file: TFile): Promise<void> {
    const version = ++this.renderVersion;
    const source = await this.app.vault.cachedRead(file);
    if (version !== this.renderVersion || this.file?.path !== file.path) return;
    const cache = this.app.metadataCache.getFileCache(file);
    await this.renderSource(file, source, cache, version);
  }

  private async renderSource(
    file: TFile,
    source: string,
    cache: CachedMetadata | null,
    version: number,
  ): Promise<void> {
    if (this.trackEl === null) return;
    const frontmatter = getFrontMatterInfo(source);
    const frontmatterEndOffset = frontmatter.exists ? frontmatter.contentStart : undefined;
    let nextDocument = createCardDocument(source, {
      sections: cache?.sections,
      frontmatterEndOffset,
    });
    const metadataAvailable = cache?.sections !== undefined;
    const previousCard = this.cardDocument.cards[this.currentIndex];
    const desiredIndex =
      !this.metadataResolved && metadataAvailable && this.preferredCursorLine !== undefined
        ? cardIndexForLine(nextDocument, this.preferredCursorLine)
        : this.metadataResolved
          ? this.currentIndex
          : this.preferredIndex;
    const desiredKey = this.metadataResolved ? previousCard?.key : this.preferredKey;
    const markerPrefix = `fc-${version}-${this.markerSerial++}`;
    let renderComponent = this.addChild(new Component());
    let staging = document.createElement("div");
    staging.className = "markdown-rendered";

    try {
      await MarkdownRenderer.render(
        this.app,
        sourceWithMarkers(nextDocument, markerPrefix),
        staging,
        file.path,
        renderComponent,
      );
      if (version !== this.renderVersion || this.file?.path !== file.path) {
        this.removeChild(renderComponent);
        return;
      }

      let fragments = splitRenderedDocument(staging, nextDocument, markerPrefix);
      if (fragments === null) {
        this.removeChild(renderComponent);
        renderComponent = this.addChild(new Component());
        staging = document.createElement("div");
        staging.className = "markdown-rendered";
        await MarkdownRenderer.render(this.app, source, staging, file.path, renderComponent);
        if (version !== this.renderVersion || this.file?.path !== file.path) {
          this.removeChild(renderComponent);
          return;
        }
        nextDocument = createCardDocument(source, { frontmatterEndOffset });
        const fragment = document.createDocumentFragment();
        fragment.append(...staging.childNodes);
        fragments = [fragment];
      }

      const taskLocations = findTaskLocations(source, cache?.listItems);
      const elements = this.createCardElements(
        nextDocument,
        fragments,
        renderComponent,
        taskLocations,
        file,
      );
      const nextIndex = resolveCardIndex(nextDocument, desiredIndex, desiredKey);
      this.renderComponents.replace(renderComponent);
      this.trackEl.replaceChildren(...elements);
      this.cardDocument = nextDocument;
      this.cardElements = elements;
      this.currentIndex = nextIndex;
      if (metadataAvailable) this.metadataResolved = true;
      this.updateActiveCard();
      this.applyTransform(0, false);
      this.persistProgress();
    } catch (error) {
      this.removeChild(renderComponent);
      if (version === this.renderVersion) this.showRenderError(error);
    }
  }

  private createCardElements(
    cardDocument: CardDocument,
    fragments: DocumentFragment[],
    component: Component,
    taskLocations: TaskLocation[],
    file: TFile,
  ): HTMLElement[] {
    return cardDocument.cards.map((card, index) => {
      const panel = document.createElement("section");
      panel.className = "focus-cards-card markdown-preview-view reader-mode-content";
      setReadableLineWidth(panel, this.readableLineWidth);
      panel.setAttribute("role", "region");
      panel.dataset.cardKey = card.key;

      const sizer = document.createElement("div");
      sizer.className = "focus-cards-card-sizer markdown-preview-sizer";
      const content = document.createElement("div");
      content.className = "focus-cards-card-content markdown-preview-section markdown-rendered";
      const fragment = fragments[index];
      if (fragment !== undefined) content.append(fragment);
      sizer.append(content);
      panel.append(sizer);

      const scrollKey = cardScrollKey(cardDocument, index);
      panel.scrollTop = this.scrollPositions.get(scrollKey) ?? 0;
      const rememberScroll = (): void => {
        this.scrollPositions.set(scrollKey, panel.scrollTop);
      };
      panel.addEventListener("scroll", rememberScroll, { passive: true });
      component.register(() => panel.removeEventListener("scroll", rememberScroll));
      this.registerTaskInteractions(panel, card.start, card.end, taskLocations, file, component);
      return panel;
    });
  }

  private registerTaskInteractions(
    panel: HTMLElement,
    cardStart: number,
    cardEnd: number,
    taskLocations: TaskLocation[],
    file: TFile,
    component: Component,
  ): void {
    const tasks = taskLocations.filter(
      (task) => task.markerOffset >= cardStart && task.markerOffset < cardEnd,
    );
    const checkboxes = [
      ...panel.querySelectorAll<HTMLInputElement>("input.task-list-item-checkbox"),
    ];
    if (tasks.length !== checkboxes.length) return;

    checkboxes.forEach((checkbox, index) => {
      const task = tasks[index]!;
      const onChange = (): void => {
        void this.writeTaskStatus(file, task, checkbox);
      };
      checkbox.addEventListener("change", onChange);
      component.register(() => checkbox.removeEventListener("change", onChange));
    });
  }

  private async writeTaskStatus(
    file: TFile,
    task: TaskLocation,
    checkbox: HTMLInputElement,
  ): Promise<void> {
    let matched = false;
    try {
      await this.app.vault.process(file, (source) => {
        const result = updateTaskSource(source, task, checkbox.checked ? "x" : " ");
        matched = result.matched;
        return result.source;
      });
    } catch {
      matched = false;
    }
    if (!matched && checkbox.isConnected) checkbox.checked = task.status !== " ";
  }

  private updateActiveCard(): void {
    setCardAccessibility(this.cardElements, this.currentIndex, this.plugin.text.cardLabel);
    if (this.counterEl !== null) {
      const total = Math.max(1, this.cardDocument.cards.length);
      this.counterEl.textContent = formatCounter(this.currentIndex, total);
      this.counterEl.setAttribute(
        "aria-label",
        this.plugin.text.cardLabel(this.currentIndex + 1, total),
      );
    }
  }

  private applyTransform(offset: number, animate: boolean): void {
    if (this.trackEl === null) return;
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const duration = animate && !reducedMotion ? CARD_ANIMATION_MS : 0;
    this.trackEl.style.transitionDuration = `${duration}ms`;
    this.trackEl.style.transform =
      `translate3d(calc(${-this.currentIndex * 100}% + ${offset}px), 0, 0)`;
  }

  private registerMobileEdgeDoubleTap(viewport: HTMLElement): void {
    this.registerDomEvent(viewport, "pointerdown", (event) => {
      if (
        !Platform.isMobileApp ||
        !event.isPrimary ||
        event.pointerType === "mouse" ||
        isInteractiveTarget(event.target) ||
        hasActiveTextSelection()
      ) {
        this.edgeDoubleTap.reset();
        return;
      }
      const bounds = viewport.getBoundingClientRect();
      this.edgeDoubleTap.begin(
        event.pointerId,
        event.clientX,
        event.clientY,
        event.timeStamp,
        edgeTapSideForPosition(event.clientX, bounds.left, bounds.width),
      );
    });

    this.registerDomEvent(viewport, "pointermove", (event) => {
      if (!Platform.isMobileApp || event.pointerType === "mouse") return;
      if (hasActiveTextSelection()) {
        this.edgeDoubleTap.reset();
        return;
      }
      this.edgeDoubleTap.move(event.pointerId, event.clientX, event.clientY);
    });

    this.registerDomEvent(viewport, "pointerup", (event) => {
      if (!Platform.isMobileApp || event.pointerType === "mouse") return;
      if (hasActiveTextSelection()) {
        this.edgeDoubleTap.reset();
        return;
      }
      const bounds = viewport.getBoundingClientRect();
      const side = this.edgeDoubleTap.end(
        event.pointerId,
        event.clientX,
        event.clientY,
        event.timeStamp,
        edgeTapSideForPosition(event.clientX, bounds.left, bounds.width),
      );
      if (side === 0) return;
      event.preventDefault();
      if (side === -1) this.previousCard();
      else this.nextCard();
    });

    this.registerDomEvent(viewport, "pointercancel", (event) => {
      if (!Platform.isMobileApp || event.pointerType === "mouse") return;
      this.edgeDoubleTap.cancel(event.pointerId);
    });

    this.registerDomEvent(viewport, "dblclick", (event) => {
      if (!Platform.isMobileApp || isInteractiveTarget(event.target)) return;
      const bounds = viewport.getBoundingClientRect();
      if (edgeTapSideForPosition(event.clientX, bounds.left, bounds.width) !== 0) {
        event.preventDefault();
      }
    });
  }

  private handleTrackClick(event: MouseEvent): void {
    const anchor = internalLinkFromEvent(event);
    if (anchor === null || !this.file) return;
    const link = internalLinkText(anchor);
    if (link === null) return;
    event.preventDefault();
    event.stopPropagation();
    void this.app.workspace.openLinkText(link, this.file.path, "tab");
  }

  private handleTrackHover(event: MouseEvent): void {
    const anchor = internalLinkFromHoverEvent(event);
    if (anchor === null || !this.file) return;
    const linktext = internalLinkText(anchor);
    if (linktext === null) return;
    this.app.workspace.trigger("hover-link", {
      event,
      source: HOVER_LINK_SOURCE_FOCUS_CARDS,
      hoverParent: this,
      targetEl: anchor,
      linktext,
      sourcePath: this.file.path,
    });
  }

  private showRenderError(error: unknown): void {
    if (this.trackEl === null) return;
    this.renderComponents.clear();
    const message = error instanceof Error ? error.message : String(error);
    const panel = document.createElement("section");
    panel.className = "focus-cards-card focus-cards-error";
    panel.textContent = `${this.plugin.text.viewName}: ${message}`;
    this.trackEl.replaceChildren(panel);
    this.cardElements = [panel];
    this.currentIndex = 0;
    this.updateActiveCard();
    this.applyTransform(0, false);
  }
}

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Platform, TFile } from "obsidian";
import type { MarkdownPostProcessorContext, MarkdownView } from "obsidian";
import { FocusSession } from "../src/focus-session";
import type { SessionHost } from "../src/focus-session";
import { translationsForLanguage } from "../src/i18n";
import { parseSectionDocument } from "../src/section-document";

const source = "# One\n\nFirst\n\n---\n\n# Two\n\nSecond\n\n---\n\n# Three\n\nThird";
let cleanup: (() => void) | undefined;

function setup(mode = "preview", allowNativeModes = true, initial?: { index?: number; key?: string; scroll?: number }) {
  const file = Object.assign(new TFile(), { path: "Note.md" });
  const contentEl = document.createElement("div");
  document.body.append(contentEl);
  const previewContainer = document.createElement("div");
  const preview = document.createElement("div");
  preview.className = "markdown-preview-view";
  preview.scrollTop = initial?.scroll ?? 0;
  previewContainer.append(preview);
  contentEl.append(previewContainer);
  const blocks = new WeakMap<HTMLElement, MarkdownPostProcessorContext>();
  const elements = [0, 6, 12].map((line) => {
    const el = document.createElement("div");
    el.dataset.sectionReaderBlock = "";
    el.textContent = `Section ${line}`;
    preview.append(el);
    blocks.set(el, { docId: "native-preview", sourcePath: file.path, getSectionInfo: () => ({ lineStart: line, lineEnd: line + 2, text: source }) } as unknown as MarkdownPostProcessorContext);
    return el;
  });
  const originalNavigation = vi.fn((state: { scroll?: number; line?: number }) => {
    if (state.scroll !== undefined) preview.scrollTop = state.scroll;
    if (state.line !== undefined) preview.scrollTop = 200;
  });
  const view = {
    file, contentEl, containerEl: contentEl,
    app: { vault: { getFileByPath: () => file }, metadataCache: { getFileCache: () => ({}) }, workspace: { openLinkText: vi.fn() } },
    getViewData: () => source, getMode: () => mode,
    getState: () => ({ file: file.path, mode }),
    setState: vi.fn(async (state: { mode: string }) => { mode = state.mode; }),
    editor: { getCursor: () => ({ line: 0, ch: 0 }), posToOffset: () => 0 },
    previewMode: { containerEl: previewContainer, rerender: vi.fn(), getScroll: () => preview.scrollTop },
    setEphemeralState: originalNavigation,
  } as unknown as MarkdownView;
  const progress = { get: vi.fn(), set: vi.fn() };
  const host = { text: translationsForLanguage("en"), progress, blocks, allowNativeModes, editorFor: () => undefined, stop: vi.fn() } as unknown as SessionHost;
  const session = new FocusSession(view, host, initial?.index, initial?.key);
  session.onload();
  vi.advanceTimersByTime(32);
  cleanup = () => session.unload();
  return { view, session, host, progress, preview, elements, contentEl, originalNavigation, setMode: (value: string) => { mode = value; session.schedule(); vi.advanceTimersByTime(32); } };
}

function key(target: HTMLElement, key: string, options: KeyboardEventInit = {}) {
  const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...options });
  target.dispatchEvent(event);
  return event;
}

function tap(target: HTMLElement, x = 390) {
  for (const type of ["pointerdown", "pointerup"]) target.dispatchEvent(new PointerEvent(type, {
    pointerType: "touch", pointerId: 1, isPrimary: true, clientX: x, clientY: 150, bubbles: true,
  }));
}

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => {
  cleanup?.(); cleanup = undefined;
  document.body.replaceChildren();
  window.getSelection()?.removeAllRanges();
  vi.useRealTimers(); vi.restoreAllMocks();
  Object.assign(Platform, { isMobile: false });
});

describe("section focus on a native view", () => {
  it("restores the keyed section when its saved index has shifted", () => {
    const key = parseSectionDocument(source).cards[1]!.key;
    const { session } = setup("preview", true, { index: 0, key });
    expect(session.index).toBe(1);
    expect(session.document.cards[session.index]!.source).toContain("Second");
  });

  it("falls back to the saved index if migrated content no longer matches", () => {
    const { session } = setup("preview", true, { index: 2, key: "removed-section" });
    expect(session.index).toBe(2);
  });

  it("locks native editing for the session and applies a setting change only after re-entry", async () => {
    const { view, host } = setup("source", false);
    expect(view.getMode()).toBe("preview");
    await view.setState({ file: "Note.md", mode: "source" }, { history: false });
    expect(view.getMode()).toBe("preview");
    host.allowNativeModes = true;
    await view.setState({ file: "Note.md", mode: "source" }, { history: false });
    expect(view.getMode()).toBe("preview");
    cleanup?.(); cleanup = undefined;
    expect(view.getMode()).toBe("source");
    const next = new FocusSession(view, host);
    next.onload(); cleanup = () => next.unload();
    expect(view.getMode()).toBe("source");
    host.allowNativeModes = false;
    await view.setState({ file: "Note.md", mode: "preview" }, { history: false });
    await view.setState({ file: "Note.md", mode: "source" }, { history: false });
    expect(view.getMode()).toBe("source");
  });

  it("keeps focus independent of the native mode and removes it cleanly", () => {
    const { view, session, elements, setMode, originalNavigation } = setup();
    session.navigate(1);
    expect(elements.map(el => el.classList.contains("section-reader-hidden"))).toEqual([true, false, true]);
    setMode("source");
    expect(session.index).toBe(1);
    setMode("preview");
    expect(session.index).toBe(1);
    cleanup?.(); cleanup = undefined;
    expect(view.contentEl.classList.contains("section-reader-focus")).toBe(false);
    expect(view.contentEl.querySelector(".section-reader-counter")).toBeNull();
    expect(elements.every(el => !el.classList.contains("section-reader-hidden"))).toBe(true);
    // eslint-disable-next-line @typescript-eslint/unbound-method -- Assert restoration without invoking the method.
    expect(view.setEphemeralState).toBe(originalNavigation);
  });

  it("never captures editing arrows or Escape; explicit commands still paginate", () => {
    const { contentEl, session } = setup("source");
    for (const value of ["ArrowLeft", "ArrowRight", "Escape"]) expect(key(contentEl, value).defaultPrevented).toBe(false);
    expect(session.index).toBe(0);
    session.navigate(1);
    expect(session.index).toBe(1);
  });

  it("uses plain reading arrows while preserving modifiers, controls, composition and text selection", () => {
    const { contentEl, session, elements } = setup();
    expect(key(contentEl, "ArrowRight").defaultPrevented).toBe(true);
    expect(session.index).toBe(1);
    for (const options of [{ shiftKey: true }, { ctrlKey: true }, { metaKey: true }, { altKey: true }, { isComposing: true }]) {
      expect(key(contentEl, "ArrowRight", options).defaultPrevented).toBe(false);
    }
    const button = document.createElement("button"); contentEl.append(button);
    expect(key(button, "ArrowRight").defaultPrevented).toBe(false);
    const range = document.createRange(); range.selectNodeContents(elements[1]!);
    window.getSelection()?.addRange(range);
    expect(key(contentEl, "ArrowRight").defaultPrevented).toBe(false);
    expect(session.index).toBe(1);
  });

  it("exits reading focus with Escape while text is selected", () => {
    const { view, host, contentEl, elements } = setup();
    const stop = vi.fn(); host.stop = stop;
    const range = document.createRange(); range.selectNodeContents(elements[0]!);
    window.getSelection()?.addRange(range);
    expect(key(contentEl, "ArrowRight").defaultPrevented).toBe(false);
    expect(key(contentEl, "Escape").defaultPrevented).toBe(true);
    expect(stop).toHaveBeenCalledWith(view);
  });

  it.each(["a", "input", "button", "pre", "table"])("exits reading focus with Escape from %s", (tag) => {
    const { view, host, contentEl } = setup();
    const stop = vi.fn(); host.stop = stop;
    const target = document.createElement(tag); contentEl.append(target);
    expect(key(target, "ArrowRight").defaultPrevented).toBe(false);
    expect(key(target, "Escape").defaultPrevented).toBe(true);
    expect(stop).toHaveBeenCalledWith(view);
  });

  it.each(["source", "preview"])("retains edge double-taps in %s without pagination controls", (mode) => {
    const { contentEl, session, preview } = setup(mode);
    Object.assign(Platform, { isMobile: true });
    vi.spyOn(contentEl, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 0, 400, 800));
    const editor = document.createElement("div"); editor.className = "cm-content"; editor.setAttribute("contenteditable", "true"); contentEl.append(editor);
    const target = mode === "source" ? editor : contentEl;
    preview.scrollTop = 125;
    tap(target); expect(session.index).toBe(0);
    tap(target); expect(session.index).toBe(1);
    vi.advanceTimersByTime(32);
    expect(preview.scrollTop).toBe(0);
    expect(contentEl.querySelector("button")).toBeNull();
    contentEl.dispatchEvent(new CompositionEvent("compositionstart"));
    tap(target); tap(target); expect(session.index).toBe(1);
    contentEl.dispatchEvent(new CompositionEvent("compositionend"));
    const button = document.createElement("button"); target.append(button);
    tap(button); tap(button); expect(session.index).toBe(1);
    tap(target); tap(target); expect(session.index).toBe(2);
  });

  it("reveals the section requested by native Outline navigation", () => {
    const { view, session, originalNavigation } = setup();
    view.setEphemeralState({ line: 14 });
    expect(session.index).toBe(2);
    expect(originalNavigation).toHaveBeenCalledWith({ line: 14 });
  });

  it.each(["preview", "source"])("starts a restored section at the top in %s", (mode) => {
    const { preview, session } = setup(mode, true, { index: 2, scroll: 125 });
    expect(session.index).toBe(2);
    expect(preview.scrollTop).toBe(0);
  });

  it.each(["source", "preview"])("starts every section at the top in %s, including returning and reselecting", (mode) => {
    const { session, preview } = setup(mode);
    for (const index of [1, 0, 1, 1, 2]) {
      preview.scrollTop = 125;
      session.select(index);
      vi.advanceTimersByTime(32);
      expect(preview.scrollTop).toBe(0);
    }
  });

  it("resets after native navigation has applied its target scroll", () => {
    const { view, session, preview } = setup();
    view.setEphemeralState({ line: 14 });
    vi.advanceTimersByTime(32);
    expect(session.index).toBe(2);
    expect(preview.scrollTop).toBe(0);
  });

  it("starts at the top after switching native modes", () => {
    const { preview, setMode } = setup();
    for (const mode of ["source", "preview", "source"]) {
      preview.scrollTop = 125;
      setMode(mode);
      expect(preview.scrollTop).toBe(0);
    }
  });

  it("leaves manual scrolling alone after entry and cancels a pending reset on exit", () => {
    const { preview, session } = setup();
    preview.scrollTop = 125;
    session.schedule();
    vi.advanceTimersByTime(100);
    expect(preview.scrollTop).toBe(125);
    session.select(1);
    cleanup?.(); cleanup = undefined;
    preview.scrollTop = 200;
    vi.advanceTimersByTime(100);
    expect(preview.scrollTop).toBe(200);
  });

  it("does not filter a nested embed as though it belonged to the parent note", () => {
    const { session, host, preview } = setup();
    const embedded = document.createElement("div"); embedded.className = "markdown-preview-view";
    const child = document.createElement("div"); child.dataset.sectionReaderBlock = "";
    embedded.append(child); preview.append(embedded);
    host.blocks.set(child, { sourcePath: "Note.md", getSectionInfo: () => ({ lineStart: 100, lineEnd: 102, text: "Embedded" }) } as unknown as MarkdownPostProcessorContext);
    session.navigate(1);
    expect(child.classList.contains("section-reader-hidden")).toBe(false);
  });

  it("filters detached blocks during native postprocessing without touching another view", () => {
    const { session } = setup();
    const detached = document.createElement("div");
    const context = { docId: "native-preview", sourcePath: "Note.md", getSectionInfo: () => ({ lineStart: 12, lineEnd: 14, text: source }) } as unknown as MarkdownPostProcessorContext;
    session.filterPreviewBlock(detached, context);
    expect(detached.classList.contains("section-reader-hidden")).toBe(true);
    const other = document.createElement("div");
    session.filterPreviewBlock(other, { ...context, docId: "another-native-preview" });
    expect(other.classList.contains("section-reader-hidden")).toBe(false);
  });
});

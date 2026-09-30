import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TFile } from "obsidian";
import type { App, CachedMetadata, WorkspaceLeaf } from "obsidian";
import { FocusCardsView } from "../src/focus-cards-view";
import type FocusCardsPlugin from "../src/main";
import { translationsForLanguage } from "../src/i18n";
import type { ProgressEntry, ReturnViewSnapshot } from "../src/types";
import { section } from "./fixtures";
import { MarkdownRenderer, Platform, renderMarkdown } from "./mocks/obsidian";

const source = "# First\n\n[[Other]]\n[[#Last]]\n[[Note#^target]]\n\n---\n\n# Second\n\n---\n\n# Last\n\n## Repeated\n\nText\n\n## Repeated\n\nTarget ^target";
const otherSource = "# Other\n\n---\n\n# End";
const file = Object.assign(new TFile(), { path: "Note.md", basename: "Note", extension: "md" });
const otherFile = Object.assign(new TFile(), { path: "Other.md", basename: "Other", extension: "md" });

function metadata(text: string): CachedMetadata {
  const sections = text.split("\n").flatMap((line, index) =>
    line === "---" ? [section(text, index)] : [],
  );
  const headings = text.split("\n").flatMap((line, index) => {
    const match = line.match(/^(#{1,6}) (.+)$/);
    return match === null ? [] : [{
      position: section(text, index, "heading").position,
      heading: match[2]!,
      level: match[1]!.length,
    }];
  });
  return { sections, headings, blocks: { target: {
    position: section(text, 20, "paragraph").position, id: "target",
  } } };
}

class TestView extends FocusCardsView {
  async openForTest(): Promise<void> { await this.onOpen(); }
  async closeForTest(): Promise<void> { await this.onClose(); }
}

function setup(cache: CachedMetadata | null = metadata(source)) {
  const caches = new Map([[file.path, cache], [otherFile.path, metadata(otherSource)]]);
  const progress = new Map<string, ProgressEntry>();
  const app = {
    scope: {},
    vault: {
      getFileByPath: (path: string) => path === file.path ? file : otherFile,
      cachedRead: vi.fn((target: TFile) => Promise.resolve(target === file ? source : otherSource)),
    },
    metadataCache: {
      getFileCache: (target: TFile) => caches.get(target.path) ?? null,
      getFirstLinkpathDest: (path: string) => path === "Note" ? file : otherFile,
    },
    workspace: { openLinkText: vi.fn(), trigger: vi.fn() },
  };
  const plugin = {
    text: translationsForLanguage("en"),
    trackView: vi.fn(),
    scheduleClosedViewRestore: vi.fn(),
    restoreLeaf: vi.fn(),
    progress: {
      get: (path: string) => progress.get(path),
      set: vi.fn((path: string, index: number, cardKey: string) => {
        progress.set(path, { index, cardKey, updatedAt: 0 });
      }),
    },
  };
  const leaf = { app: app as unknown as App } as unknown as WorkspaceLeaf;
  const view = new TestView(leaf, plugin as unknown as FocusCardsPlugin);
  document.body.append(view.contentEl);
  return { view, app, caches, progress, plugin };
}

async function open(view: TestView, state: Record<string, unknown> = {}): Promise<void> {
  await view.openForTest();
  await view.setState({ file: file.path, ...state }, { history: false });
}

function index(view: TestView): unknown { return view.getState().cardIndex; }
function track(view: TestView): HTMLElement {
  return view.contentEl.querySelector<HTMLElement>(".focus-cards-track")!;
}

beforeEach(() => {
  MarkdownRenderer.render.mockReset().mockImplementation(renderMarkdown);
  Platform.isMobile = false;
  Platform.isMobileApp = false;
});

afterEach(() => {
  document.body.replaceChildren();
  vi.unstubAllGlobals();
});

describe("FocusCardsView navigation", () => {
  it.each([false, true])("keeps the view and DOM during outline jumps (mobile=%s)", async (mobile) => {
    Platform.isMobileApp = mobile;
    Platform.isMobile = mobile;
    const { view, app } = setup();
    const returnView: ReturnViewSnapshot = {
      viewState: { type: "markdown", state: { file: file.path, mode: "preview" } },
      previewScrollTop: 7,
    };
    await open(view, { returnView, readableLineWidth: false });
    const firstCard = track(view).firstElementChild;
    expect(view.canAcceptExtension("md")).toBe(true);
    expect(view.canAcceptExtension("pdf")).toBe(false);

    // This is the setState + setEphemeralState sequence emitted by native openFile.
    await view.setState({ file: file.path }, { history: false });
    view.setEphemeralState({ line: 18 });
    expect(index(view)).toBe(2);
    expect(track(view).style.getPropertyValue("--focus-cards-transition-duration")).toBe("120ms");
    expect(track(view).firstElementChild).toBe(firstCard);
    expect(app.vault.cachedRead).toHaveBeenCalledTimes(1);
    expect(MarkdownRenderer.render).toHaveBeenCalledTimes(1);
    expect(view.getReturnView()).toEqual(returnView);
    expect(view.getState().readableLineWidth).toBe(false);

    await view.setState({ file: file.path }, { history: false });
    expect(index(view)).toBe(2);
  });

  it("lands on the newest target without queuing intermediate flips", async () => {
    const { view, progress } = setup();
    await open(view);
    for (const line of [18, 8, 12, 0, 18, 8]) view.setEphemeralState({ line });
    expect(index(view)).toBe(1);
    expect(progress.get(file.path)?.index).toBe(1);
    expect(view.contentEl.querySelectorAll('[aria-hidden="false"]')).toHaveLength(1);
    view.nextCard();
    expect(track(view).style.getPropertyValue("--focus-cards-transition-duration")).toBe("220ms");
  });

  it("scrolls to the selected occurrence of a repeated heading within the card", async () => {
    const { view } = setup();
    await open(view);
    const panel = track(view).children[2] as HTMLElement;
    const headings = panel.querySelectorAll("h2");
    vi.spyOn(panel, "getBoundingClientRect").mockReturnValue({ top: 100 } as DOMRect);
    vi.spyOn(headings[0]!, "getBoundingClientRect").mockReturnValue({ top: 250 } as DOMRect);
    vi.spyOn(headings[1]!, "getBoundingClientRect").mockReturnValue({ top: 800 } as DOMRect);
    const embed = document.createElement("div");
    embed.className = "internal-embed";
    embed.append(document.createElement("h1"));
    panel.prepend(embed);

    view.setEphemeralState({ line: 18 });
    expect(panel.scrollTop).toBe(700);
    expect(index(view)).toBe(2);
    expect(view.contentEl.querySelector(".focus-cards-viewport")?.scrollLeft).toBe(0);
  });

  it("resolves heading and block links in the current tab and keeps other-note links in new tabs", async () => {
    const { view, app } = setup();
    await open(view);
    const links = view.contentEl.querySelectorAll<HTMLAnchorElement>("a");
    links[0]!.click();
    expect(app.workspace.openLinkText).toHaveBeenCalledWith("Other", file.path, "tab");
    expect(index(view)).toBe(0);
    links[1]!.click();
    expect(index(view)).toBe(2);
    view.setEphemeralState({ line: 0 });
    links[2]!.click();
    expect(index(view)).toBe(2);
    expect(app.workspace.openLinkText).toHaveBeenCalledTimes(1);

    links[1]!.dispatchEvent(new MouseEvent("click", { bubbles: true, ctrlKey: true }));
    expect(app.workspace.openLinkText).toHaveBeenCalledWith("#Last", file.path, "tab");
  });

  it("leaves the current card alone for malformed or unresolved destinations", async () => {
    const { view } = setup();
    await open(view);
    view.nextCard();
    for (const state of [null, {}, { line: -1 }, { line: NaN }, { subpath: "#Missing" }]) {
      view.setEphemeralState(state);
    }
    expect(index(view)).toBe(1);
  });

  it("follows native footnotes across cards and returns to the reference in the same view", async () => {
    const { view, app } = setup();
    await open(view);
    const first = track(view).children[0] as HTMLElement;
    const last = track(view).children[2] as HTMLElement;
    const reference = document.createElement("a");
    reference.className = "footnote-link";
    reference.id = "fnref-1";
    reference.setAttribute("href", "#fn-1");
    const label = document.createElement("span");
    label.textContent = "[1]";
    reference.append(label);
    first.append(reference);

    const footnote = document.createElement("li");
    footnote.id = "fn-1";
    const back = document.createElement("a");
    back.className = "footnote-backref footnote-link";
    back.setAttribute("href", "#fnref-1");
    footnote.append(back);
    last.append(footnote);
    const otherViewFootnote = document.createElement("li");
    otherViewFootnote.id = footnote.id;
    document.body.prepend(otherViewFootnote);
    vi.spyOn(last, "getBoundingClientRect").mockReturnValue({ top: 100 } as DOMRect);
    vi.spyOn(footnote, "getBoundingClientRect").mockReturnValue({ top: 700 } as DOMRect);

    label.click();
    expect(index(view)).toBe(2);
    expect(last.scrollTop).toBe(600);
    expect(last.getAttribute("aria-hidden")).toBe("false");
    expect(document.activeElement).toBe(last);
    expect(view.contentEl.querySelector(".focus-cards-viewport")?.scrollLeft).toBe(0);
    back.click();
    expect(index(view)).toBe(0);
    expect(document.activeElement).toBe(first);
    expect(app.workspace.openLinkText).not.toHaveBeenCalled();
    expect(MarkdownRenderer.render).toHaveBeenCalledTimes(1);
  });

  it("waits for metadata and uses only the latest pending jump", async () => {
    const { view, caches } = setup(null);
    await open(view);
    view.setEphemeralState({ line: 8 });
    view.setEphemeralState({ subpath: "#Last" });
    caches.set(file.path, metadata(source));
    view.handleMetadataChanged(source, metadata(source));
    await vi.waitFor(() => expect(index(view)).toBe(2));
  });

  it("does not lose a jump arriving during an asynchronous rerender", async () => {
    const { view } = setup();
    await open(view);
    let finish!: () => void;
    const rendering = new Promise<void>((resolve) => { finish = resolve; });
    MarkdownRenderer.render.mockImplementationOnce(async (...args) => {
      await rendering;
      await renderMarkdown(...args);
    });
    view.handleMetadataChanged(source, metadata(source));
    view.setEphemeralState({ line: 18 });
    finish();
    await vi.waitFor(() => expect(index(view)).toBe(2));
  });

  it("respects reduced motion for jumps and ordinary page turns", async () => {
    vi.stubGlobal("matchMedia", () => ({ matches: true }));
    const { view } = setup();
    await open(view);
    view.setEphemeralState({ line: 18 });
    expect(track(view).style.getPropertyValue("--focus-cards-transition-duration")).toBe("0ms");
    view.previousCard();
    expect(track(view).style.getPropertyValue("--focus-cards-transition-duration")).toBe("0ms");
  });

  it.each([false, true])("enables touch edge navigation only in the mobile UI (mobile=%s)", async (mobile) => {
    Platform.isMobile = mobile;
    // Obsidian's mobile UI emulation still runs in the desktop application.
    Platform.isMobileApp = false;
    const { view } = setup();
    await open(view);
    const viewport = view.contentEl.querySelector<HTMLElement>(".focus-cards-viewport")!;
    vi.spyOn(viewport, "getBoundingClientRect").mockReturnValue({ left: 0, width: 390 } as DOMRect);
    const tap = (x: number, pointerType = "touch") => {
      for (const type of ["pointerdown", "pointerup"]) {
        viewport.dispatchEvent(new PointerEvent(type, {
          bubbles: true, pointerId: 1, pointerType, isPrimary: true, clientX: x, clientY: 50,
        }));
      }
    };
    tap(380, "mouse");
    tap(380, "mouse");
    expect(index(view)).toBe(0);
    tap(195);
    tap(195);
    expect(index(view)).toBe(0);
    tap(380);
    expect(index(view)).toBe(0);
    tap(380);
    expect(index(view)).toBe(mobile ? 1 : 0);
    tap(10);
    tap(10);
    expect(index(view)).toBe(0);
  });

  it("keeps note progress separate when the same leaf changes files and returns", async () => {
    const { view, progress } = setup();
    await open(view);
    view.setEphemeralState({ line: 18 });
    await view.setState({ file: otherFile.path }, { history: false });
    expect(index(view)).toBe(0);
    view.nextCard();
    await view.setState({ file: file.path }, { history: false });
    expect(index(view)).toBe(2);
    expect(progress.get(otherFile.path)?.index).toBe(1);
    expect(view.getReturnView()).toBeUndefined();
    expect(view.getState().file).toBe(file.path);
  });

  it("restores an explicit history position without rerendering the same note", async () => {
    const { view } = setup();
    await open(view);
    view.setEphemeralState({ line: 18 });
    await view.setState({ file: file.path, cardIndex: 1 }, { history: false });
    expect(index(view)).toBe(1);
    expect(MarkdownRenderer.render).toHaveBeenCalledTimes(1);
  });
});

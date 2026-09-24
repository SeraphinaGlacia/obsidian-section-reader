import { vi } from "vitest";
import type { App, CachedMetadata, TFile as ObsidianFile, WorkspaceLeaf } from "obsidian";

export class TFile {
  path = "";
  basename = "";
  extension = "md";
}

export class Component {
  private cleanups: (() => void)[] = [];

  register(cleanup: () => void): void {
    this.cleanups.push(cleanup);
  }

  addChild<T extends Component>(child: T): T {
    return child;
  }

  removeChild<T extends Component>(child: T): T {
    child.unload();
    return child;
  }

  unload(): void {
    this.cleanups.splice(0).forEach((cleanup) => cleanup());
  }

  registerDomEvent(element: HTMLElement, type: string, handler: EventListener): void {
    element.addEventListener(type, handler);
    this.register(() => element.removeEventListener(type, handler));
  }
}

export class FileView extends Component {
  app: App;
  contentEl = document.createElement("div");
  file: ObsidianFile | null = null;

  constructor(public leaf: WorkspaceLeaf) {
    super();
    this.app = (leaf as WorkspaceLeaf & { app: App }).app;
  }

  getState(): Record<string, unknown> {
    return this.file === null ? {} : { file: this.file.path };
  }

  async setState(state: Record<string, unknown>): Promise<void> {
    if (typeof state.file !== "string" || state.file === this.file?.path) return;
    if (this.file !== null) await this.onUnloadFile(this.file);
    this.file = this.app.vault.getFileByPath(state.file);
    if (this.file !== null) await this.onLoadFile(this.file);
  }

  setEphemeralState(_state: unknown): void { /* Host API hook. */ }
  async onLoadFile(_file: ObsidianFile): Promise<void> { /* Host API hook. */ }
  async onUnloadFile(_file: ObsidianFile): Promise<void> { /* Host API hook. */ }
  async onRename(_file: ObsidianFile): Promise<void> { /* Host API hook. */ }
}

export class Scope {
  register(): void { /* Key bindings are exercised in the native vault. */ }
}

export const Platform = { isMobileApp: false };
export const getFrontMatterInfo = (): { exists: boolean; contentStart: number } => ({
  exists: false, contentStart: 0,
});

export function parseLinktext(link: string): { path: string; subpath: string } {
  const hash = link.indexOf("#");
  return hash < 0 ? { path: link, subpath: "" } :
    { path: link.slice(0, hash), subpath: link.slice(hash) };
}

export function resolveSubpath(cache: CachedMetadata, subpath: string): { start: { line: number } } | null {
  const position = subpath.startsWith("#^") ? cache.blocks?.[subpath.slice(2)]?.position :
    cache.headings?.find((heading) => heading.heading === subpath.slice(1))?.position;
  return position === undefined ? null : { start: position.start };
}

export async function renderMarkdown(
  _app: App, source: string, element: HTMLElement, _path: string, _component: Component,
): Promise<void> {
  // A small deterministic renderer. Native renderer behavior is checked in the test vault.
  for (const line of source.split("\n").filter((line) => line.trim().length > 0)) {
    const marker = line.match(/^<hr data-focus-cards-marker="([^"]+)">$/);
    const heading = line.match(/^(#{1,6}) (.+)$/);
    const link = line.match(/^\[\[(.+)\]\]$/);
    if (marker !== null) {
      const hr = document.createElement("hr");
      hr.dataset.focusCardsMarker = marker[1];
      element.append(hr);
    } else if (heading !== null) {
      const title = document.createElement(`h${heading[1]!.length}`);
      title.dataset.heading = heading[2];
      title.textContent = heading[2]!;
      element.append(title);
    } else if (link !== null) {
      const anchor = document.createElement("a");
      anchor.className = "internal-link";
      anchor.dataset.href = link[1];
      element.append(anchor);
    } else {
      const paragraph = document.createElement("p");
      paragraph.textContent = line;
      element.append(paragraph);
    }
  }
}

export const MarkdownRenderer = { render: vi.fn(renderMarkdown) };

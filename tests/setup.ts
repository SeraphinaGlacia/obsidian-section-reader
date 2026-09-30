import { beforeEach, vi } from "vitest";

// Obsidian provides these globals in every window; jsdom needs the same host surface.
beforeEach(() => {
  vi.stubGlobal("createEl", (tag: keyof HTMLElementTagNameMap) => document.createElement(tag));
  vi.stubGlobal("createDiv", () => document.createElement("div"));
  vi.stubGlobal("createFragment", () => document.createDocumentFragment());
});

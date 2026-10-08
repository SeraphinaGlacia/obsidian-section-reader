import type { Plugin } from "obsidian";
import { describe, expect, it, vi } from "vitest";
import { MAX_PROGRESS_ENTRIES } from "../src/constants";
import { ProgressStore } from "../src/progress-store";
import type { FocusCardsPluginData } from "../src/types";

function pluginWithData(data: unknown): {
  plugin: Plugin;
  saveData: ReturnType<typeof vi.fn>;
} {
  const saveData = vi.fn(async (_value: unknown): Promise<void> => undefined);
  const plugin = {
    loadData: vi.fn(async (): Promise<unknown> => data),
    saveData,
  } as unknown as Plugin;
  return { plugin, saveData };
}

describe("ProgressStore", () => {
  it("migrates progress when a file is renamed and removes it on deletion", async () => {
    const data: FocusCardsPluginData = {
      version: 1,
      allowNativeModes: false,
      files: { "Old.md": { index: 2, cardKey: "key", updatedAt: 10 } },
    };
    const { plugin, saveData } = pluginWithData(data);
    const store = new ProgressStore(plugin);
    await store.load();

    store.rename("Old.md", "New.md");
    await store.flush();
    expect(store.get("Old.md")).toBeUndefined();
    expect(store.get("New.md")?.index).toBe(2);
    expect(saveData).toHaveBeenCalledTimes(1);

    store.delete("New.md");
    await store.flush();
    expect(store.get("New.md")).toBeUndefined();
    expect(saveData).toHaveBeenCalledTimes(2);
  });

  it("defaults native mode switching off for old data and preserves it through progress writes", async () => {
    const old = { version: 1, files: { "Note.md": { index: 1, cardKey: "old", updatedAt: 1 } } };
    const { plugin, saveData } = pluginWithData(old);
    const store = new ProgressStore(plugin);
    await store.load();
    expect(store.allowNativeModes).toBe(false);
    expect(store.get("Note.md")?.index).toBe(1);
    store.setAllowNativeModes(true);
    store.set("Other.md", 2, "new");
    await store.flush();
    const saved: unknown = saveData.mock.lastCall?.[0];
    const reloaded = new ProgressStore(pluginWithData(saved).plugin);
    await reloaded.load();
    expect(reloaded.allowNativeModes).toBe(true);
    expect(reloaded.get("Note.md")?.index).toBe(1);
    expect(reloaded.get("Other.md")?.index).toBe(2);
  });

  it("retains only the 500 most recently updated files", async () => {
    const files: FocusCardsPluginData["files"] = {};
    for (let index = 0; index <= MAX_PROGRESS_ENTRIES; index += 1) {
      files[`File-${index}.md`] = { index: 0, cardKey: `${index}`, updatedAt: index };
    }
    const { plugin } = pluginWithData({ version: 1, files });
    const store = new ProgressStore(plugin);
    await store.load();

    expect(store.get("File-0.md")).toBeUndefined();
    expect(store.get(`File-${MAX_PROGRESS_ENTRIES}.md`)).toBeDefined();
  });

  it("rejects unknown data versions", async () => {
    const { plugin } = pluginWithData({
      version: 99,
      files: { "Note.md": { index: 1, cardKey: "x", updatedAt: 1 } },
    });
    const store = new ProgressStore(plugin);
    await store.load();
    expect(store.get("Note.md")).toBeUndefined();
  });
});

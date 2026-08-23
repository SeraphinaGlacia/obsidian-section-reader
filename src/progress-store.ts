import type { Plugin } from "obsidian";
import { MAX_PROGRESS_ENTRIES, PLUGIN_DATA_VERSION } from "./constants";
import type { FocusCardsPluginData, ProgressEntry } from "./types";

function isProgressEntry(value: unknown): value is ProgressEntry {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<ProgressEntry>;
  return (
    Number.isInteger(candidate.index) &&
    typeof candidate.index === "number" &&
    candidate.index >= 0 &&
    typeof candidate.cardKey === "string" &&
    typeof candidate.updatedAt === "number" &&
    Number.isFinite(candidate.updatedAt)
  );
}

function parseData(value: unknown): FocusCardsPluginData {
  if (typeof value !== "object" || value === null) {
    return { version: PLUGIN_DATA_VERSION, files: {} };
  }
  const candidate = value as { version?: unknown; files?: unknown };
  if (
    candidate.version !== PLUGIN_DATA_VERSION ||
    typeof candidate.files !== "object" ||
    candidate.files === null
  ) {
    return { version: PLUGIN_DATA_VERSION, files: {} };
  }

  const files: Record<string, ProgressEntry> = {};
  for (const [path, entry] of Object.entries(candidate.files)) {
    if (isProgressEntry(entry)) files[path] = { ...entry };
  }
  return { version: PLUGIN_DATA_VERSION, files };
}

export class ProgressStore {
  private data: FocusCardsPluginData = { version: PLUGIN_DATA_VERSION, files: {} };
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(private readonly plugin: Plugin) {}

  async load(): Promise<void> {
    this.data = parseData(await this.plugin.loadData());
    this.prune();
  }

  get(path: string): ProgressEntry | undefined {
    const entry = this.data.files[path];
    return entry === undefined ? undefined : { ...entry };
  }

  set(path: string, index: number, cardKey: string): void {
    this.data.files[path] = { index, cardKey, updatedAt: Date.now() };
    this.prune();
    this.save();
  }

  rename(oldPath: string, newPath: string): void {
    const entry = this.data.files[oldPath];
    if (entry === undefined || oldPath === newPath) return;
    delete this.data.files[oldPath];
    this.data.files[newPath] = { ...entry, updatedAt: Date.now() };
    this.save();
  }

  delete(path: string): void {
    if (!(path in this.data.files)) return;
    delete this.data.files[path];
    this.save();
  }

  async flush(): Promise<void> {
    await this.writeQueue;
  }

  private prune(): void {
    const entries = Object.entries(this.data.files);
    if (entries.length <= MAX_PROGRESS_ENTRIES) return;
    entries.sort(([, left], [, right]) => right.updatedAt - left.updatedAt);
    this.data.files = Object.fromEntries(entries.slice(0, MAX_PROGRESS_ENTRIES));
  }

  private save(): void {
    const snapshot: FocusCardsPluginData = {
      version: PLUGIN_DATA_VERSION,
      files: Object.fromEntries(
        Object.entries(this.data.files).map(([path, entry]) => [path, { ...entry }]),
      ),
    };
    this.writeQueue = this.writeQueue
      .catch(() => undefined)
      .then(async () => this.plugin.saveData(snapshot));
  }
}

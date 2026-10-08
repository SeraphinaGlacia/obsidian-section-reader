export interface ProgressEntry {
  index: number;
  cardKey: string;
  updatedAt: number;
}

export interface FocusCardsPluginData {
  version: 1;
  files: Record<string, ProgressEntry>;
}

import type { EditorPosition, ViewState } from "obsidian";

export interface ProgressEntry {
  index: number;
  cardKey: string;
  updatedAt: number;
}

export interface FocusCardsPluginData {
  version: 1;
  files: Record<string, ProgressEntry>;
}

export interface ScrollPosition {
  left: number;
  top: number;
}

export interface ReturnViewSnapshot {
  viewState: ViewState;
  cursor?: EditorPosition;
  editorScroll?: ScrollPosition;
  previewScrollTop?: number;
}

export interface FocusCardsState {
  file?: string;
  cardIndex?: number;
  cardKey?: string;
  cursorLine?: number;
  readableLineWidth?: boolean;
  returnView?: ReturnViewSnapshot;
}

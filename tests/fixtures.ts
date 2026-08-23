import type { SectionCache } from "obsidian";

export function section(
  source: string,
  line: number,
  type: SectionCache["type"] = "thematicBreak",
  col = 0,
): SectionCache {
  const lines = source.split("\n");
  const offset = lines.slice(0, line).reduce((total, value) => total + value.length + 1, 0) + col;
  const lineText = lines[line] ?? "";
  return {
    type,
    position: {
      start: { line, col, offset },
      end: { line, col: lineText.length, offset: offset + Math.max(0, lineText.length - col) },
    },
  };
}

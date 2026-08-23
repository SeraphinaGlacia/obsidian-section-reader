import type { ListItemCache } from "obsidian";

export interface TaskLocation {
  line: number;
  markerOffset: number;
  linePrefix: string;
  lineSuffix: string;
  status: string;
}

export interface TaskUpdateResult {
  source: string;
  matched: boolean;
}

interface LineRange {
  start: number;
  end: number;
}

function lineRangeAtOffset(source: string, offset: number): LineRange {
  const start = source.lastIndexOf("\n", Math.max(0, offset - 1)) + 1;
  const newline = source.indexOf("\n", offset);
  return { start, end: newline < 0 ? source.length : newline };
}

function lineRangeAtLine(source: string, line: number): LineRange | null {
  let start = 0;
  for (let currentLine = 0; currentLine < line; currentLine += 1) {
    const newline = source.indexOf("\n", start);
    if (newline < 0) return null;
    start = newline + 1;
  }
  const newline = source.indexOf("\n", start);
  return { start, end: newline < 0 ? source.length : newline };
}

export function findTaskLocations(
  source: string,
  listItems?: ListItemCache[],
): TaskLocation[] {
  if (listItems === undefined) return [];
  const tasks: TaskLocation[] = [];

  for (const item of listItems) {
    if (item.task === undefined || item.task.length !== 1) continue;
    const range = lineRangeAtOffset(source, item.position.start.offset);
    const token = `[${item.task}]`;
    const tokenOffset = source.indexOf(token, item.position.start.offset);
    if (tokenOffset < 0 || tokenOffset + token.length > range.end) continue;
    const markerOffset = tokenOffset + 1;
    tasks.push({
      line: item.position.start.line,
      markerOffset,
      linePrefix: source.slice(range.start, markerOffset),
      lineSuffix: source.slice(markerOffset + 1, range.end),
      status: item.task,
    });
  }

  return tasks.sort((left, right) => left.markerOffset - right.markerOffset);
}

export function updateTaskSource(
  source: string,
  task: TaskLocation,
  nextStatus: " " | "x",
): TaskUpdateResult {
  const range = lineRangeAtLine(source, task.line);
  if (range === null) return { source, matched: false };
  const line = source.slice(range.start, range.end);
  const statusIndex = task.linePrefix.length;
  const prefix = line.slice(0, statusIndex);
  const suffix = line.slice(statusIndex + 1);
  if (prefix !== task.linePrefix || suffix !== task.lineSuffix || statusIndex >= line.length) {
    return { source, matched: false };
  }

  const absoluteStatusOffset = range.start + statusIndex;
  if (source[absoluteStatusOffset] === nextStatus) return { source, matched: true };
  return {
    source: `${source.slice(0, absoluteStatusOffset)}${nextStatus}${source.slice(absoluteStatusOffset + 1)}`,
    matched: true,
  };
}

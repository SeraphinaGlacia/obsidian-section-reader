import type { SectionCache } from "obsidian";

export interface CardBreak {
  line: number;
  start: number;
  end: number;
  lineEnd: number;
}

export interface RawCardSegment {
  index: number;
  start: number;
  end: number;
  source: string;
}

export interface Card {
  index: number;
  segmentIndex: number;
  start: number;
  end: number;
  source: string;
  key: string;
}

export interface CardDocument {
  source: string;
  breaks: CardBreak[];
  segments: RawCardSegment[];
  cards: Card[];
}

export interface CardMetadata {
  sections?: SectionCache[] | undefined;
  frontmatterEndOffset?: number | undefined;
}

interface LineRange {
  start: number;
  end: number;
  lineEnd: number;
}

function lineStarts(source: string): number[] {
  const starts = [0];
  for (let index = 0; index < source.length; index += 1) {
    if (source.charCodeAt(index) === 10) starts.push(index + 1);
  }
  return starts;
}

function getLineRange(source: string, starts: number[], line: number): LineRange | null {
  const start = starts[line];
  if (start === undefined) return null;

  const nextStart = starts[line + 1] ?? source.length;
  let end = nextStart;
  if (end > start && source.charCodeAt(end - 1) === 10) end -= 1;
  if (end > start && source.charCodeAt(end - 1) === 13) end -= 1;

  return { start, end, lineEnd: nextStart };
}

export function findExactCardBreaks(source: string, sections?: SectionCache[]): CardBreak[] {
  if (sections === undefined) return [];

  const starts = lineStarts(source);
  const seenLines = new Set<number>();
  const breaks: CardBreak[] = [];

  for (const section of sections) {
    if (section.type !== "thematicBreak") continue;
    if (section.position.start.col !== 0) continue;

    const line = section.position.start.line;
    if (seenLines.has(line)) continue;
    const range = getLineRange(source, starts, line);
    if (range === null || source.slice(range.start, range.end) !== "---") continue;

    seenLines.add(line);
    breaks.push({ line, ...range });
  }

  return breaks.sort((left, right) => left.start - right.start);
}

function fingerprint(source: string): string {
  const normalized = source.replaceAll("\r\n", "\n").trim();
  let hash = 0x811c9dc5;
  for (let index = 0; index < normalized.length; index += 1) {
    hash ^= normalized.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

function contentForVisibility(segment: RawCardSegment, frontmatterEndOffset?: number): string {
  if (segment.index !== 0 || frontmatterEndOffset === undefined) return segment.source;
  if (frontmatterEndOffset <= segment.start || frontmatterEndOffset >= segment.end) {
    return frontmatterEndOffset === segment.end ? "" : segment.source;
  }
  return segment.source.slice(frontmatterEndOffset - segment.start);
}

export function createCardDocument(source: string, metadata: CardMetadata = {}): CardDocument {
  const breaks = findExactCardBreaks(source, metadata.sections);
  const segments: RawCardSegment[] = [];
  let start = 0;

  for (const cardBreak of breaks) {
    segments.push({
      index: segments.length,
      start,
      end: cardBreak.start,
      source: source.slice(start, cardBreak.start),
    });
    start = cardBreak.lineEnd;
  }

  segments.push({
    index: segments.length,
    start,
    end: source.length,
    source: source.slice(start),
  });

  const visibleSegments = segments.filter(
    (segment) => contentForVisibility(segment, metadata.frontmatterEndOffset).trim().length > 0,
  );
  const cardSegments = visibleSegments.length > 0 ? visibleSegments : [segments[0]!];
  const cards = cardSegments.map((segment, index): Card => ({
    index,
    segmentIndex: segment.index,
    start: segment.start,
    end: segment.end,
    source: segment.source,
    key: fingerprint(contentForVisibility(segment, metadata.frontmatterEndOffset)),
  }));

  return { source, breaks, segments, cards };
}

export function cardIndexForLine(document: CardDocument, line: number): number {
  const rawIndex = document.breaks.filter((cardBreak) => cardBreak.line <= line).length;
  const direct = document.cards.findIndex((card) => card.segmentIndex === rawIndex);
  if (direct >= 0) return direct;

  const following = document.cards.findIndex((card) => card.segmentIndex > rawIndex);
  return following >= 0 ? following : Math.max(0, document.cards.length - 1);
}

export function resolveCardIndex(document: CardDocument, preferredIndex: number, key?: string): number {
  if (key !== undefined) {
    const matches = document.cards
      .map((card, index) => ({ card, index }))
      .filter(({ card }) => card.key === key);
    if (matches.length > 0) {
      matches.sort(
        (left, right) =>
          Math.abs(left.index - preferredIndex) - Math.abs(right.index - preferredIndex),
      );
      return matches[0]!.index;
    }
  }
  return Math.min(Math.max(0, preferredIndex), document.cards.length - 1);
}

export function sourceWithMarkers(document: CardDocument, markerPrefix: string): string {
  let marked = document.source;
  for (let index = document.breaks.length - 1; index >= 0; index -= 1) {
    const cardBreak = document.breaks[index]!;
    const marker = `<hr data-focus-cards-marker="${markerPrefix}-${index}">`;
    marked = `${marked.slice(0, cardBreak.start)}${marker}${marked.slice(cardBreak.end)}`;
  }
  return marked;
}

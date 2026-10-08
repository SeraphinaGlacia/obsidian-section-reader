import { parser } from "@lezer/markdown";
import type { SectionCache } from "obsidian";
import { createCardDocument } from "./cards";
import type { CardDocument } from "./cards";

export interface SectionRange { from: number; to: number }

const sectionParser = parser.configure({
  defineNodes: ["MathBlock", "CommentBlock"],
  parseBlock: [{
    name: "ObsidianBlock",
    before: "HorizontalRule",
    parse(context, line) {
      const text = line.text.slice(line.pos);
      const comment = text.replace(/(`+)[\s\S]*?\1/g, (code) => " ".repeat(code.length)).match(/(^|[^\\])%%/);
      const commentStart = comment === null ? -1 : comment.index! + comment[1]!.length;
      const delimiter = text.startsWith("$$") ? "$$" : commentStart >= 0 ? "%%" : null;
      if (delimiter === null || line.indent - line.baseIndent >= 4) return false;
      const start = context.lineStart + line.pos;
      let end = context.lineStart + line.text.length;
      const delimiterStart = delimiter === "%%" ? commentStart : 0;
      if (!text.slice(delimiterStart + 2).includes(delimiter)) {
        while (context.nextLine()) {
          end = context.lineStart + line.text.length;
          if (line.text.includes(delimiter)) break;
        }
      }
      context.nextLine();
      context.addElement(context.elt(delimiter === "$$" ? "MathBlock" : "CommentBlock", start, end));
      return true;
    },
  }],
});

export function frontmatterEnd(source: string): number {
  const match = /^(?:\uFEFF)?---\r?\n(?:[\s\S]*?\r?\n)?(?:---|\.\.\.)(?:\r?\n|$)/.exec(source);
  return match?.[0].length ?? 0;
}

/** Parse the current editor buffer, including changes not yet in MetadataCache. */
export function parseSectionDocument(source: string): CardDocument {
  const start = frontmatterEnd(source);
  const body = source.slice(start);
  const tree = sectionParser.parse(body);
  const sections: SectionCache[] = [];
  for (let node = tree.topNode.firstChild; node !== null; node = node.nextSibling) {
    if (node.name !== "HorizontalRule") continue;
    const offset = start + node.from;
    const lineStart = source.lastIndexOf("\n", offset - 1) + 1;
    const line = source.slice(0, offset).split("\n").length - 1;
    sections.push({
      type: "thematicBreak",
      position: {
        start: { line, col: offset - lineStart, offset },
        end: { line, col: node.to - node.from, offset: start + node.to },
      },
    });
  }
  return createCardDocument(source, { sections, frontmatterEndOffset: start });
}

export function sectionIndexAt(document: CardDocument, offset: number): number {
  const next = document.cards.findIndex((card) => offset < card.end);
  return next < 0 ? document.cards.length - 1 : next;
}

export function sectionRange(document: CardDocument, index: number): SectionRange {
  const card = document.cards[index]!;
  const propertiesEnd = index === 0 ? frontmatterEnd(document.source) : 0;
  let from = Math.max(card.start, propertiesEnd);
  // Hide the blank separator after properties with the same source-preserving
  // mask. Keep indentation on the first content line and all body whitespace.
  if (propertiesEnd > 0) {
    from += /^(?:[\t ]*\r?\n)*/.exec(document.source.slice(from))![0].length;
  }
  let to = card.end;
  // The newline before a separator belongs to the protected boundary.
  if (to < document.source.length && document.source[to - 1] === "\n") {
    to -= document.source[to - 2] === "\r" ? 2 : 1;
  }
  return { from: Math.min(from, to), to };
}

export function offsetAtLine(source: string, line: number): number {
  let offset = 0;
  for (let current = 0; current < line; current += 1) {
    const next = source.indexOf("\n", offset);
    if (next < 0) return source.length;
    offset = next + 1;
  }
  return offset;
}

export function lineAtOffset(source: string, offset: number): number {
  return source.slice(0, offset).split("\n").length - 1;
}

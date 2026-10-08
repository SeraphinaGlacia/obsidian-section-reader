import { parser } from "@lezer/markdown";
import type { SectionCache } from "obsidian";
import { createCardDocument } from "./cards";
import type { CardDocument } from "./cards";

export interface SectionRange { from: number; to: number }

function scanComments(text: string, open = false): { found: boolean; open: boolean } {
  let found = open;
  let offset = 0;
  const tokens = /\\.|(`+)[\s\S]*?\1|%%/g;
  while (offset < text.length) {
    if (open) {
      const end = text.indexOf("%%", offset);
      if (end < 0) break;
      offset = end + 2;
      open = false;
    } else {
      // Escapes and inline code only mask delimiters outside a comment.
      tokens.lastIndex = offset;
      const token = tokens.exec(text);
      if (token === null) break;
      offset = tokens.lastIndex;
      if (token[0] === "%%") { found = true; open = true; }
    }
  }
  return { found, open };
}

const sectionParser = parser.configure({
  defineNodes: ["MathBlock", "CommentBlock"],
  parseBlock: [{
    name: "ObsidianBlock",
    before: "HorizontalRule",
    parse(context, line) {
      const text = line.text.slice(line.pos);
      const math = text.startsWith("$$");
      const comment = scanComments(text);
      if ((!math && !comment.found) || line.indent - line.baseIndent >= 4) return false;
      const start = context.lineStart + line.pos;
      let end = context.lineStart + line.text.length;
      let open = math ? !text.slice(2).includes("$$") : comment.open;
      while (open && context.nextLine()) {
        end = context.lineStart + line.text.length;
        open = math ? !line.text.includes("$$") : scanComments(line.text, true).open;
      }
      context.nextLine();
      context.addElement(context.elt(math ? "MathBlock" : "CommentBlock", start, end));
      return true;
    },
  }],
});

export function frontmatterEnd(source: string): number {
  const match = /^(?:\uFEFF)?---\r?\n(?:[\s\S]*?\r?\n)?(?:---|\.\.\.)(?:\r?\n|$)/.exec(source);
  return match?.[0].length ?? 0;
}

/** Parse the current editor buffer, including changes not yet in MetadataCache. */
export function parseSectionDocument(source: string, editingRange?: SectionRange): CardDocument {
  const start = frontmatterEnd(source);
  const body = source.slice(start);
  const tree = sectionParser.parse(body);
  const sections: SectionCache[] = [];
  for (let node = tree.topNode.firstChild; node !== null; node = node.nextSibling) {
    if (node.name !== "HorizontalRule") continue;
    const offset = start + node.from;
    if (editingRange !== undefined && offset >= editingRange.from && offset < editingRange.to) continue;
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
  // Hide boundary spacing after properties or a section separator. Preserve
  // the first content line's indentation and whitespace within the body.
  if (propertiesEnd > 0 || card.segmentIndex > 0) {
    from += /^(?:[\t ]*\r?\n)*/.exec(document.source.slice(from))![0].length;
  }
  let to = card.end;
  // Preserve the spacing before a separator too: typing into its blank line
  // could otherwise turn the following dashes into a Setext heading underline.
  if (to < document.source.length) {
    to -= /(?:\r?\n[\t ]*)+$/.exec(document.source.slice(from, to))?.[0].length ?? 0;
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

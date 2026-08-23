import { describe, expect, it } from "vitest";
import {
  cardIndexForLine,
  createCardDocument,
  findExactCardBreaks,
  resolveCardIndex,
  sourceWithMarkers,
} from "../src/cards";
import { section } from "./fixtures";

describe("exact card separator detection", () => {
  it("uses only cache-confirmed root-level exact --- lines", () => {
    const source = [
      "Alpha",
      "***",
      "___",
      "> ---",
      "- ---",
      "--- ",
      "---",
      "Omega",
    ].join("\n");
    const sections = [
      section(source, 1),
      section(source, 2),
      section(source, 3, "thematicBreak", 2),
      section(source, 4, "thematicBreak", 2),
      section(source, 5),
      section(source, 6),
    ];

    expect(findExactCardBreaks(source, sections).map((item) => item.line)).toEqual([6]);
  });

  it("does not split YAML, fenced code, HTML, or Setext lookalikes", () => {
    const source = [
      "---",
      "title: Demo",
      "---",
      "```md",
      "---",
      "```",
      "<div>",
      "---",
      "</div>",
      "Setext heading",
      "---",
      "Real card",
      "---",
      "Second card",
    ].join("\n");
    const sections = [
      section(source, 0, "yaml"),
      section(source, 2, "yaml"),
      section(source, 4, "code"),
      section(source, 7, "html"),
      section(source, 10, "heading"),
      section(source, 12),
    ];
    const document = createCardDocument(source, {
      sections,
      frontmatterEndOffset: source.indexOf("```md"),
    });

    expect(document.breaks.map((item) => item.line)).toEqual([12]);
    expect(document.cards).toHaveLength(2);
    expect(document.cards[0]?.source).toContain("Real card");
    expect(document.cards[1]?.source.trim()).toBe("Second card");
  });

  it("supports CRLF without accepting surrounding whitespace", () => {
    const source = "One\r\n---\r\nTwo\r\n ---\r\nThree";
    const sections = [section(source, 1), section(source, 3, "thematicBreak", 1)];
    const document = createCardDocument(source, { sections });

    expect(document.breaks).toHaveLength(1);
    expect(document.cards.map((card) => card.source.trim())).toEqual(["One", "Two\r\n ---\r\nThree"]);
  });
});

describe("card document behavior", () => {
  it("ignores empty cards at the start, end, and between adjacent separators", () => {
    const source = "---\nFirst\n---\n---\nSecond\n---";
    const sections = [0, 2, 3, 5].map((line) => section(source, line));
    const document = createCardDocument(source, { sections });

    expect(document.segments).toHaveLength(5);
    expect(document.cards.map((card) => card.source.trim())).toEqual(["First", "Second"]);
    expect(document.cards.map((card) => card.segmentIndex)).toEqual([1, 3]);
  });

  it("returns one card for an empty document or while metadata is unavailable", () => {
    expect(createCardDocument("").cards).toHaveLength(1);
    expect(createCardDocument("One\n---\nTwo").cards).toHaveLength(1);
  });

  it("does not mutate source when inserting private render markers", () => {
    const source = "One\n---\nTwo";
    const document = createCardDocument(source, { sections: [section(source, 1)] });
    const marked = sourceWithMarkers(document, "test");

    expect(source).toBe("One\n---\nTwo");
    expect(marked).toContain('data-focus-cards-marker="test-0"');
    expect(marked.split("\n")).toHaveLength(source.split("\n").length);
  });

  it("maps a cursor on a separator to the following non-empty card", () => {
    const source = "First\n---\n---\nSecond";
    const document = createCardDocument(source, {
      sections: [section(source, 1), section(source, 2)],
    });

    expect(cardIndexForLine(document, 0)).toBe(0);
    expect(cardIndexForLine(document, 1)).toBe(1);
    expect(cardIndexForLine(document, 2)).toBe(1);
    expect(cardIndexForLine(document, 3)).toBe(1);
  });

  it("uses fingerprints to retain a card after content is inserted before it", () => {
    const original = "One\n---\nTwo";
    const originalDocument = createCardDocument(original, { sections: [section(original, 1)] });
    const key = originalDocument.cards[1]!.key;
    const modified = "Zero\n---\nOne\n---\nTwo";
    const modifiedDocument = createCardDocument(modified, {
      sections: [section(modified, 1), section(modified, 3)],
    });

    expect(resolveCardIndex(modifiedDocument, 1, key)).toBe(2);
    expect(resolveCardIndex(modifiedDocument, 99, "missing")).toBe(2);
  });
});

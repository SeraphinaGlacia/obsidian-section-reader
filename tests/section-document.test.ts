import { describe, expect, it } from "vitest";
import { frontmatterEnd, parseSectionDocument, sectionIndexAt, sectionRange } from "../src/section-document";

describe("live section parsing", () => {
  it("splits exact root rules while preserving the full source and offsets", () => {
    const source = "# One\n\nFirst\n\n---\n\n# Two\n\nSecond\n";
    const document = parseSectionDocument(source);
    expect(document.cards).toHaveLength(2);
    expect(document.source).toBe(source);
    expect(document.cards[1]!.start).toBe(source.indexOf("\n# Two"));
    expect(sectionIndexAt(document, source.indexOf("Second"))).toBe(1);
  });

  it.each([
    "---\ntitle: Demo\n---\n\nContent",
    "```md\n---\n```",
    "~~~md\n---\n~~~",
    "> First\n>\n> ---\n>\n> Second",
    "- First\n\n  ---\n\n  Second",
    "<div>\n---\n</div>",
    "Heading\n---",
    "    ---",
    "$$\n---\n$$",
    "%%\n---\n%%",
    "Visible %% comment\n\n---\n\ncomment %% text",
    "Text\n\n***\n\nOther\n\n___\n\nEnd",
    "Text\n\n--- \n\nOther",
  ])("does not split non-root or non-exact separators: %s", (source) => {
    expect(parseSectionDocument(source).cards).toHaveLength(1);
  });

  it("excludes properties and separator bytes from the editable range", () => {
    const source = "---\ntitle: Demo\n---\n\nOne\n\n---\n\nTwo";
    const document = parseSectionDocument(source);
    const first = sectionRange(document, 0);
    const second = sectionRange(document, 1);
    expect(first.from).toBe(source.indexOf("One"));
    expect(source.slice(first.from, first.to)).toBe("One\n");
    expect(source.slice(first.to, second.from)).toBe("\n---\n");
  });

  it.each(["\n", "\r\n"])("masks only complete blank lines after frontmatter with %j line endings", (newline) => {
    const source = ["---", "title: Demo", "---", "", "  ", "\t", "  # One", "", "Body", "", "---", "", "# Two"].join(newline);
    const document = parseSectionDocument(source);
    const first = sectionRange(document, 0);
    expect(first.from).toBe(source.indexOf("  # One"));
    expect(source.slice(first.from, first.to)).toBe(["  # One", "", "Body", ""].join(newline));
    expect(source.slice(sectionRange(document, 1).from)).toBe(newline + "# Two");
    expect(document.source).toBe(source);
    expect(sectionRange(parseSectionDocument(newline + "# No properties"), 0).from).toBe(0);
    const empty = ["---", "title: Empty", "---", "", ""].join(newline);
    expect(sectionRange(parseSectionDocument(empty), 0)).toEqual({ from: empty.length, to: empty.length });
  });

  it("supports empty frontmatter and literal comment delimiters in inline code", () => {
    expect(frontmatterEnd("---\n---\nBody")).toBe(8);
    expect(parseSectionDocument("Use `%%`\n\n---\n\nNext").cards).toHaveLength(2);
  });

  it("handles CRLF, empty files, trailing rules, and consecutive rules", () => {
    const source = "# One\r\n\r\n---\r\n\r\n---\r\n\r\n# Two\r\n\r\n---\r\n";
    const document = parseSectionDocument(source);
    expect(document.cards).toHaveLength(2);
    expect(source.slice(sectionRange(document, 0).to, document.cards[1]!.start)).toContain("---");
    expect(parseSectionDocument("").cards).toHaveLength(1);
  });
});

import { describe, expect, it } from "vitest";
import { createCardDocument } from "../src/cards";
import { splitRenderedDocument } from "../src/render-dom";
import { section } from "./fixtures";

describe("splitRenderedDocument", () => {
  it("moves one full-document render into card fragments", () => {
    const source = "Alpha\n---\nBeta";
    const cardDocument = createCardDocument(source, { sections: [section(source, 1)] });
    const root = document.createElement("div");
    const heading = document.createElement("h1");
    heading.textContent = "Alpha";
    const marker = document.createElement("hr");
    marker.dataset.focusCardsMarker = "render-0";
    const paragraph = document.createElement("p");
    const link = document.createElement("a");
    link.className = "internal-link";
    link.dataset.href = "Target";
    link.textContent = "Beta";
    paragraph.append(link);
    root.append(heading, marker, paragraph);

    const fragments = splitRenderedDocument(root, cardDocument, "render");
    expect(fragments).not.toBeNull();
    expect(fragments?.map((fragment) => fragment.textContent)).toEqual(["Alpha", "Beta"]);
    expect(root.childNodes).toHaveLength(0);
  });

  it("maps around ignored empty leading segments", () => {
    const source = "---\nOnly";
    const cardDocument = createCardDocument(source, { sections: [section(source, 0)] });
    const root = document.createElement("div");
    const marker = document.createElement("hr");
    marker.dataset.focusCardsMarker = "lead-0";
    const paragraph = document.createElement("p");
    paragraph.textContent = "Only";
    root.append(marker, paragraph);

    const fragments = splitRenderedDocument(root, cardDocument, "lead");
    expect(fragments).toHaveLength(1);
    expect(fragments?.[0]?.textContent).toBe("Only");
  });

  it("accepts a marker-only renderer wrapper", () => {
    const source = "A\n---\nB";
    const cardDocument = createCardDocument(source, { sections: [section(source, 1)] });
    const root = document.createElement("div");
    const first = document.createElement("p");
    first.textContent = "A";
    const wrapper = document.createElement("div");
    const marker = document.createElement("hr");
    marker.dataset.focusCardsMarker = "wrap-0";
    wrapper.append(" \n", marker, "\n ");
    const second = document.createElement("p");
    second.textContent = "B";
    root.append(first, wrapper, second);

    const fragments = splitRenderedDocument(root, cardDocument, "wrap");
    expect(fragments?.map((fragment) => fragment.textContent)).toEqual(["A", "B"]);
  });

  it("fails safely if marker structure is missing or contains content", () => {
    const source = "A\n---\nB";
    const cardDocument = createCardDocument(source, { sections: [section(source, 1)] });
    const missing = document.createElement("div");
    missing.append(document.createElement("p"), document.createElement("p"));
    expect(splitRenderedDocument(missing, cardDocument, "missing")).toBeNull();

    const mixed = document.createElement("div");
    const mixedWrapper = document.createElement("div");
    const mixedMarker = document.createElement("hr");
    mixedMarker.dataset.focusCardsMarker = "mixed-0";
    mixedWrapper.append("Keep me", mixedMarker);
    mixed.append(document.createElement("p"), mixedWrapper, document.createElement("p"));
    expect(splitRenderedDocument(mixed, cardDocument, "mixed")).toBeNull();
  });
});

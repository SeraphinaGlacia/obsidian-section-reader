import { describe, expect, it } from "vitest";
import {
  detectReadableLineWidth,
  formatCounter,
  formatViewTitle,
  internalLinkFromEvent,
  isInteractiveTarget,
  navigationDirectionForKey,
  setCardAccessibility,
  setReadableLineWidth,
} from "../src/ui";

describe("card UI helpers", () => {
  it("formats the counter and arrow-key directions", () => {
    expect(formatCounter(0, 4)).toBe("1/4");
    expect(formatViewTitle(undefined, "Focus Cards")).toBe("Focus Cards");
    expect(formatViewTitle({ basename: "Note" }, "Focus Cards")).toBe("Note — Focus Cards");
    expect(navigationDirectionForKey("ArrowLeft")).toBe(-1);
    expect(navigationDirectionForKey("ArrowRight")).toBe(1);
    expect(navigationDirectionForKey("Enter")).toBe(0);
  });

  it("makes all non-current cards inert", () => {
    const cards = [document.createElement("section"), document.createElement("section")];
    setCardAccessibility(cards, 1, (current, total) => `${current} of ${total}`);

    expect(cards[0]?.inert).toBe(true);
    expect(cards[0]?.getAttribute("aria-hidden")).toBe("true");
    expect(cards[0]?.tabIndex).toBe(-1);
    expect(cards[1]?.inert).toBe(false);
    expect(cards[1]?.getAttribute("aria-hidden")).toBe("false");
    expect(cards[1]?.getAttribute("aria-label")).toBe("2 of 2");
  });

  it("copies Obsidian's readable-line-width state onto card panels", () => {
    const source = document.createElement("div");
    const preview = document.createElement("div");
    preview.className = "markdown-preview-view is-readable-line-width";
    source.append(preview);
    expect(detectReadableLineWidth(source)).toBe(true);

    const card = document.createElement("section");
    setReadableLineWidth(card, true);
    expect(card.classList.contains("is-readable-line-width")).toBe(true);
    setReadableLineWidth(card, false);
    expect(card.classList.contains("is-readable-line-width")).toBe(false);
    expect(detectReadableLineWidth(card)).toBe(false);
  });

  it("recognizes controls and horizontally scrollable code as non-navigation targets", () => {
    const wrapper = document.createElement("div");
    const button = document.createElement("button");
    const span = document.createElement("span");
    span.textContent = "Go";
    button.append(span);
    const pre = document.createElement("pre");
    const code = document.createElement("code");
    code.textContent = "X";
    pre.append(code);
    const paragraph = document.createElement("p");
    paragraph.textContent = "Text";
    wrapper.append(button, pre, paragraph);
    expect(isInteractiveTarget(span)).toBe(true);
    expect(isInteractiveTarget(code)).toBe(true);
    expect(isInteractiveTarget(paragraph)).toBe(false);
  });

  it("identifies only primary-button internal links", () => {
    const wrapper = document.createElement("div");
    const anchor = document.createElement("a");
    anchor.className = "internal-link";
    anchor.dataset.href = "Note";
    const span = document.createElement("span");
    span.textContent = "Open";
    anchor.append(span);
    wrapper.append(anchor);
    const detected: Array<HTMLAnchorElement | null> = [];
    wrapper.addEventListener("click", (event) => {
      detected.push(internalLinkFromEvent(event));
    });
    span.dispatchEvent(new MouseEvent("click", { bubbles: true, button: 0 }));
    expect(detected[0]?.dataset.href).toBe("Note");

    span.dispatchEvent(new MouseEvent("click", { bubbles: true, button: 1 }));
    expect(detected[1]).toBeNull();
  });
});

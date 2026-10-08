import { describe, expect, it } from "vitest";
import { internalLinkFromEvent, isInteractiveTarget } from "../src/ui";

describe("native view interaction guards", () => {
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

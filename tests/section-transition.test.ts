import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SectionTransition } from "../src/section-transition";

const animateDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "animate");
let transition: SectionTransition;
const cancel = vi.fn();
const animate = vi.fn((_frames: Keyframe[], _options: KeyframeAnimationOptions) => ({ cancel }) as unknown as Animation);

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(document, "hidden", "get").mockReturnValue(false);
  Object.defineProperty(HTMLElement.prototype, "animate", { configurable: true, value: animate });
  vi.stubGlobal("matchMedia", () => ({ matches: false }));
});
afterEach(() => {
  transition?.cancel();
  document.body.replaceChildren();
  if (animateDescriptor) Object.defineProperty(HTMLElement.prototype, "animate", animateDescriptor);
  else Reflect.deleteProperty(HTMLElement.prototype, "animate");
  vi.clearAllMocks(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers();
});

function setup() {
  const container = document.createElement("div");
  const source = document.createElement("div");
  const text = document.createElement("p"); text.id = "native-destination"; text.textContent = "Original section";
  source.append(text); container.append(source); document.body.append(container);
  transition = new SectionTransition(container);
  return { container, source };
}

describe("section navigation transitions", () => {
  it("slides in the requested direction without replacing the native view", () => {
    const { container, source } = setup();
    transition.prepare(source, 1, () => true);
    const snapshot = container.lastElementChild as HTMLElement;
    expect(snapshot.inert).toBe(true);
    expect(snapshot.getAttribute("aria-hidden")).toBe("true");
    expect(snapshot.querySelector("[id]")).toBeNull();
    expect(container.firstElementChild).toBe(source);
    vi.advanceTimersByTime(16);
    expect(animate.mock.calls[1]?.[0]).toEqual([{ transform: "translateX(100%)" }, { transform: "translateX(0)" }]);
    vi.advanceTimersByTime(240);
    expect(container.children).toHaveLength(1);
    expect(container.firstElementChild).toBe(source);
    expect(cancel).toHaveBeenCalledTimes(2);
  });

  it("waits for incoming content and cancels pending frames on cleanup", () => {
    const { container, source } = setup();
    transition.prepare(source, -1, () => false);
    vi.advanceTimersByTime(100);
    expect(animate).not.toHaveBeenCalled();
    transition.cancel();
    vi.advanceTimersByTime(600);
    expect(animate).not.toHaveBeenCalled();
    expect(container.children).toHaveLength(1);
  });

  it("honors reduced motion without producing a snapshot", () => {
    vi.stubGlobal("matchMedia", () => ({ matches: true }));
    const { container, source } = setup();
    transition.prepare(source, 1, () => true);
    vi.advanceTimersByTime(300);
    expect(animate).not.toHaveBeenCalled();
    expect(container.children).toHaveLength(1);
  });

  it("replaces an interrupted transition and leaves no duplicate controls", () => {
    const { container, source } = setup();
    transition.prepare(source, 1, () => true);
    vi.advanceTimersByTime(16);
    transition.prepare(source, -1, () => true);
    expect(container.children).toHaveLength(2);
    vi.advanceTimersByTime(16);
    expect(animate.mock.calls[3]?.[0]).toEqual([{ transform: "translateX(-100%)" }, { transform: "translateX(0)" }]);
    transition.cancel();
    expect(container.children).toHaveLength(1);
  });
});

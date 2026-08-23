import { describe, expect, it, vi } from "vitest";
import { ComponentSlot } from "../src/component-slot";

describe("ComponentSlot", () => {
  it("disposes replaced, stale, and final render components exactly once", () => {
    const dispose = vi.fn<(value: string) => void>();
    const slot = new ComponentSlot(dispose);

    slot.replace("first");
    slot.replace("second");
    slot.discard("stale");
    slot.clear();
    slot.clear();

    expect(dispose.mock.calls).toEqual([["first"], ["stale"], ["second"]]);
  });
});

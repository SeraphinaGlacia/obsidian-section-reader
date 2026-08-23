import { describe, expect, it } from "vitest";
import { EdgeDoubleTapGesture, edgeTapSideForPosition } from "../src/edge-tap";

describe("mobile edge double tap", () => {
  it("recognizes only the outer edge zones and caps their width", () => {
    expect(edgeTapSideForPosition(100, 100, 400)).toBe(-1);
    expect(edgeTapSideForPosition(188, 100, 400)).toBe(-1);
    expect(edgeTapSideForPosition(300, 100, 400)).toBe(0);
    expect(edgeTapSideForPosition(412, 100, 400)).toBe(1);
    expect(edgeTapSideForPosition(500, 100, 400)).toBe(1);
    expect(edgeTapSideForPosition(99, 100, 400)).toBe(0);

    expect(edgeTapSideForPosition(95, 0, 1_000)).toBe(-1);
    expect(edgeTapSideForPosition(97, 0, 1_000)).toBe(0);
    expect(edgeTapSideForPosition(903, 0, 1_000)).toBe(0);
    expect(edgeTapSideForPosition(904, 0, 1_000)).toBe(1);
  });

  it("turns backward after two nearby taps on the left edge", () => {
    const gesture = new EdgeDoubleTapGesture();
    gesture.begin(1, 30, 200, 0, -1);
    expect(gesture.end(1, 31, 201, 80, -1)).toBe(0);
    gesture.begin(2, 34, 204, 250, -1);
    expect(gesture.end(2, 35, 205, 330, -1)).toBe(-1);
  });

  it("turns forward after two nearby taps on the right edge", () => {
    const gesture = new EdgeDoubleTapGesture();
    gesture.begin(1, 370, 200, 0, 1);
    expect(gesture.end(1, 370, 200, 60, 1)).toBe(0);
    gesture.begin(2, 372, 202, 240, 1);
    expect(gesture.end(2, 372, 202, 300, 1)).toBe(1);
  });

  it("does not treat horizontal or vertical movement as a tap", () => {
    const gesture = new EdgeDoubleTapGesture();
    gesture.begin(1, 30, 200, 0, -1);
    gesture.move(1, 60, 200);
    expect(gesture.end(1, 60, 200, 100, -1)).toBe(0);

    gesture.begin(2, 370, 200, 200, 1);
    gesture.move(2, 370, 230);
    expect(gesture.end(2, 370, 230, 300, 1)).toBe(0);
  });

  it("rejects long, mismatched, distant, and expired tap pairs", () => {
    const longPress = new EdgeDoubleTapGesture();
    longPress.begin(1, 20, 100, 0, -1);
    expect(longPress.end(1, 20, 100, 301, -1)).toBe(0);

    const mismatched = new EdgeDoubleTapGesture();
    mismatched.begin(1, 20, 100, 0, -1);
    expect(mismatched.end(1, 20, 100, 50, -1)).toBe(0);
    mismatched.begin(2, 380, 100, 100, 1);
    expect(mismatched.end(2, 380, 100, 150, 1)).toBe(0);

    const distant = new EdgeDoubleTapGesture();
    distant.begin(1, 20, 100, 0, -1);
    expect(distant.end(1, 20, 100, 50, -1)).toBe(0);
    distant.begin(2, 20, 180, 100, -1);
    expect(distant.end(2, 20, 180, 150, -1)).toBe(0);

    const expired = new EdgeDoubleTapGesture();
    expired.begin(1, 20, 100, 0, -1);
    expect(expired.end(1, 20, 100, 50, -1)).toBe(0);
    expired.begin(2, 20, 100, 451, -1);
    expect(expired.end(2, 20, 100, 500, -1)).toBe(0);
  });

  it("cancels a pending sequence", () => {
    const gesture = new EdgeDoubleTapGesture();
    gesture.begin(1, 20, 100, 0, -1);
    expect(gesture.end(1, 20, 100, 50, -1)).toBe(0);
    gesture.begin(2, 20, 100, 100, -1);
    gesture.cancel(2);
    expect(gesture.end(2, 20, 100, 150, -1)).toBe(0);
  });
});

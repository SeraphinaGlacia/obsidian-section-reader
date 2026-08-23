import {
  EDGE_DOUBLE_TAP_MAX_INTERVAL_MS,
  EDGE_DOUBLE_TAP_POSITION_TOLERANCE_PX,
  EDGE_TAP_MAX_DURATION_MS,
  EDGE_TAP_MOVE_TOLERANCE_PX,
  EDGE_TAP_ZONE_MAX_PX,
  EDGE_TAP_ZONE_RATIO,
} from "./constants";

export type EdgeTapSide = -1 | 0 | 1;

interface ActiveTap {
  pointerId: number;
  side: Exclude<EdgeTapSide, 0>;
  startX: number;
  startY: number;
  startTime: number;
}

interface CompletedTap {
  side: Exclude<EdgeTapSide, 0>;
  x: number;
  y: number;
  time: number;
}

function distance(x1: number, y1: number, x2: number, y2: number): number {
  return Math.hypot(x2 - x1, y2 - y1);
}

export function edgeTapSideForPosition(
  clientX: number,
  viewportLeft: number,
  viewportWidth: number,
): EdgeTapSide {
  if (!Number.isFinite(viewportWidth) || viewportWidth <= 0) return 0;
  const relativeX = clientX - viewportLeft;
  if (relativeX < 0 || relativeX > viewportWidth) return 0;

  const edgeWidth = Math.min(viewportWidth * EDGE_TAP_ZONE_RATIO, EDGE_TAP_ZONE_MAX_PX);
  if (relativeX <= edgeWidth) return -1;
  if (relativeX >= viewportWidth - edgeWidth) return 1;
  return 0;
}

export class EdgeDoubleTapGesture {
  private active: ActiveTap | null = null;
  private previous: CompletedTap | null = null;

  begin(
    pointerId: number,
    x: number,
    y: number,
    time: number,
    side: EdgeTapSide,
  ): void {
    this.expirePrevious(time);
    if (side === 0) {
      this.reset();
      return;
    }
    this.active = { pointerId, side, startX: x, startY: y, startTime: time };
  }

  move(pointerId: number, x: number, y: number): void {
    if (this.active?.pointerId !== pointerId) return;
    if (
      distance(this.active.startX, this.active.startY, x, y) >
      EDGE_TAP_MOVE_TOLERANCE_PX
    ) {
      this.reset();
    }
  }

  end(
    pointerId: number,
    x: number,
    y: number,
    time: number,
    side: EdgeTapSide,
  ): EdgeTapSide {
    const active = this.active;
    this.active = null;
    if (
      active === null ||
      active.pointerId !== pointerId ||
      side === 0 ||
      side !== active.side ||
      time - active.startTime < 0 ||
      time - active.startTime > EDGE_TAP_MAX_DURATION_MS ||
      distance(active.startX, active.startY, x, y) > EDGE_TAP_MOVE_TOLERANCE_PX
    ) {
      this.previous = null;
      return 0;
    }

    const completed: CompletedTap = { side: active.side, x, y, time };
    const previous = this.previous;
    const isDoubleTap =
      previous !== null &&
      previous.side === completed.side &&
      completed.time - previous.time >= 0 &&
      completed.time - previous.time <= EDGE_DOUBLE_TAP_MAX_INTERVAL_MS &&
      distance(previous.x, previous.y, completed.x, completed.y) <=
        EDGE_DOUBLE_TAP_POSITION_TOLERANCE_PX;

    if (isDoubleTap) {
      this.previous = null;
      return completed.side;
    }

    this.previous = completed;
    return 0;
  }

  cancel(pointerId?: number): void {
    if (pointerId === undefined || this.active?.pointerId === pointerId) this.reset();
  }

  reset(): void {
    this.active = null;
    this.previous = null;
  }

  private expirePrevious(time: number): void {
    if (
      this.previous !== null &&
      (time < this.previous.time || time - this.previous.time > EDGE_DOUBLE_TAP_MAX_INTERVAL_MS)
    ) {
      this.previous = null;
    }
  }
}

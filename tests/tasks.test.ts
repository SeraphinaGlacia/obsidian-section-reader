import type { ListItemCache } from "obsidian";
import { describe, expect, it } from "vitest";
import { findTaskLocations, updateTaskSource } from "../src/tasks";

function listItem(source: string, line: number, task?: string): ListItemCache {
  const lines = source.split("\n");
  const offset = lines.slice(0, line).reduce((total, value) => total + value.length + 1, 0);
  const item: ListItemCache = {
    parent: -line,
    position: {
      start: { line, col: 0, offset },
      end: { line, col: lines[line]?.length ?? 0, offset: offset + (lines[line]?.length ?? 0) },
    },
  };
  if (task !== undefined) item.task = task;
  return item;
}

describe("native task source updates", () => {
  it("uses CachedMetadata list items instead of task-like code text", () => {
    const source = ["```", "- [ ] Not a task", "```", "- [ ] Real task"].join("\n");
    const tasks = findTaskLocations(source, [
      listItem(source, 3, " "),
    ]);

    expect(tasks).toHaveLength(1);
    expect(tasks[0]?.line).toBe(3);
    expect(tasks[0]?.status).toBe(" ");
  });

  it("checks and unchecks exactly the cached marker", () => {
    const source = "Intro\r\n- [ ] Task with [brackets]\r\nEnd";
    const [task] = findTaskLocations(source, [listItem(source, 1, " ")]);
    expect(task).toBeDefined();

    const checked = updateTaskSource(source, task!, "x");
    expect(checked.matched).toBe(true);
    expect(checked.source).toContain("- [x] Task with [brackets]");

    const unchecked = updateTaskSource(checked.source, task!, " ");
    expect(unchecked.matched).toBe(true);
    expect(unchecked.source).toBe(source);
  });

  it("supports non-space custom completed statuses", () => {
    const source = "- [-] Cancelled";
    const [task] = findTaskLocations(source, [listItem(source, 0, "-")]);
    const result = updateTaskSource(source, task!, " ");
    expect(result.source).toBe("- [ ] Cancelled");
  });

  it("refuses to write if the source line changed or moved", () => {
    const source = "- [ ] Original";
    const [task] = findTaskLocations(source, [listItem(source, 0, " ")]);

    expect(updateTaskSource("- [ ] Changed", task!, "x").matched).toBe(false);
    expect(updateTaskSource(`Inserted\n${source}`, task!, "x").matched).toBe(false);
  });
});

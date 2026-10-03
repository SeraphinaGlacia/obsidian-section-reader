import assert from "node:assert/strict";
import test from "node:test";
import { bracesAdvisory, evaluateScannerAudit } from "./scanner-dependencies.mjs";

const patched = new Set(["node_modules/braces"]);
const reviewDate = new Date("2026-10-03T00:00:00Z");
const report = () => ({
  auditReportVersion: 2,
  vulnerabilities: {
    braces: {
      name: "braces", nodes: ["node_modules/braces"],
      via: [{ source: 1240992, name: "braces", dependency: "braces", url: bracesAdvisory, range: "<=3.0.3" }],
    },
    micromatch: { name: "micromatch", nodes: ["node_modules/micromatch"], via: ["braces"] },
    stylelint: { name: "stylelint", nodes: ["node_modules/stylelint"], via: ["micromatch"] },
  },
  metadata: { vulnerabilities: { total: 3 } },
});

test("accepts a completed clean audit", () => {
  assert.deepEqual(evaluateScannerAudit({ auditReportVersion: 2, vulnerabilities: {}, metadata: { vulnerabilities: { total: 0 } } }, 0, new Set()), []);
});

test("recognizes only the verified backport and its derived advisory chain", () => {
  assert.deepEqual(evaluateScannerAudit(report(), 1, patched, reviewDate), ["braces", "micromatch", "stylelint"]);
});

for (const [label, mutate] of [
  ["another advisory on braces", value => value.vulnerabilities.braces.via.push({ url: "https://github.com/advisories/GHSA-new" })],
  ["an independent dependency advisory", value => value.vulnerabilities.stylelint.via.push({ url: "https://github.com/advisories/GHSA-new" })],
  ["a changed advisory source", value => value.vulnerabilities.braces.via[0].source++],
  ["a changed advisory range", value => value.vulnerabilities.braces.via[0].range = "<=4.0.0"],
  ["an unpatched nested copy", value => value.vulnerabilities.braces.nodes.push("node_modules/x/node_modules/braces")],
  ["missing affected nodes", value => value.vulnerabilities.braces.nodes = []],
  ["missing advisory causes", value => value.vulnerabilities.braces.via = []],
  ["a missing transitive cause", value => value.vulnerabilities.stylelint.via = ["unknown"]],
  ["a cyclic transitive cause", value => value.vulnerabilities.micromatch.via = ["stylelint"]],
  ["incomplete audit counts", value => value.metadata.vulnerabilities.total = 0],
  ["a failed audit request", value => value.error = { code: "EAI_AGAIN" }],
  ["an unsupported report format", value => value.auditReportVersion = 3],
]) {
  test(`rejects ${label}`, () => {
    const value = report();
    mutate(value);
    assert.throws(() => evaluateScannerAudit(value, 1, patched, reviewDate));
  });
}

test("an unverified source repair cannot clear the advisory", () => {
  assert.throws(() => evaluateScannerAudit(report(), 1, new Set(), reviewDate), /unpatched/);
});

test("audit execution failure cannot be treated as a repaired advisory", () => {
  assert.throws(() => evaluateScannerAudit(report(), 2, patched, reviewDate), /execution failed/);
});

test("the backport requires review at its deadline", () => {
  assert.throws(() => evaluateScannerAudit(report(), 1, patched, new Date("2026-11-02T00:00:00Z")), /review is due/);
});

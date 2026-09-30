import assert from "node:assert/strict";
import test from "node:test";
import { verifyReview } from "./verify-obsidian-review.mjs";

const passing = `# Obsidian workflow results

**Strict mode:** policy enforcement is active; policy errors fail the build.
**Overall:** Passed · **Errors:** 0 · **Warnings:** 0 · **Recommendations:** 0 · **Inconclusive:** 0

## scanner-eslint

| scanner-eslint-passed | recommendation | passed | — | Scanner ESLint found no issues. | — |

## scanner-stylelint

| scanner-stylelint-passed | recommendation | passed | — | Scanner Stylelint found no issues. | — |

## Coverage

Action version: 1.2.3 · Rule-catalog version: eslint-plugin-obsidianmd@0.4.1; local-rules@1
`;

test("accepts a complete passing strict report", () => assert.doesNotThrow(() => verifyReview(passing)));
test("preserves official warning severity without suppressing findings", () => assert.doesNotThrow(() => verifyReview(passing.replace("| scanner-eslint-passed | recommendation | passed |", "| some-rule | warning | failed |"))));
for (const [label, report] of [
  ["missing", ""],
  ["duplicate", passing + passing],
  ["advisory", passing.replace("**Strict mode:**", "**Advisory mode:**")],
  ["error", passing.replace("**Errors:** 0", "**Errors:** 1")],
  ["inconclusive", passing.replace("**Inconclusive:** 0", "**Inconclusive:** 1")],
  ["missing ESLint", passing.replace("## scanner-eslint", "## missing-eslint")],
  ["missing Stylelint", passing.replace("## scanner-stylelint", "## missing-stylelint")],
  ["scanner error", passing.replace("| scanner-eslint-passed | recommendation | passed |", "| some-rule | error | failed |")],
  ["skipped scanner", passing.replace("| scanner-eslint-passed | recommendation | passed |", "| scanner-eslint-setup-failed | recommendation | skipped |")],
  ["changed catalog", passing.replace("local-rules@1", "local-rules@2")],
]) {
  test(`rejects ${label} reports`, () => assert.throws(() => verifyReview(report)));
}

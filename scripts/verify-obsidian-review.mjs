import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

// Fail closed against the report contract of the pinned official action.
// Updating the action requires reviewing this parser and its regression tests.
export function verifyReview(summary) {
  const reports = summary.split("# Obsidian workflow results\n");
  if (reports.length !== 2) throw new Error("Expected exactly one official Obsidian report");
  const report = reports[1];
  if (!report.includes("**Strict mode:**")) throw new Error("Official strict mode did not run");
  const counts = /\*\*Overall:\*\* (\w+) · \*\*Errors:\*\* (\d+) · \*\*Warnings:\*\* (\d+) · \*\*Recommendations:\*\* (\d+) · \*\*Inconclusive:\*\* (\d+)/.exec(report);
  if (!counts || counts[1] !== "Passed" || counts[2] !== "0" || counts[5] !== "0") {
    throw new Error("Official review failed, is missing, or is inconclusive");
  }
  for (const scanner of ["scanner-eslint", "scanner-stylelint"]) {
    const section = report.split(`## ${scanner}\n\n`)[1]?.split("\n## ")[0];
    const rows = section?.split("\n").filter((line) => line.startsWith("| ") && !line.startsWith("| Rule ID ") && !line.startsWith("| ---"));
    if (!rows?.length || rows.some((row) => !/^\| [^|]+ \| (warning|recommendation) \| (passed|failed) \|/.test(row))) {
      throw new Error(`${scanner} did not provide a complete non-error result; inspect the official report`);
    }
  }
  if (!report.includes("Action version: 1.2.3 · Rule-catalog version: eslint-plugin-obsidianmd@0.4.1; local-rules@1")) {
    throw new Error("Official report version changed; review the pinned action and gate together");
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const file = process.argv[2];
  if (!file) throw new Error("Pass the official action summary path");
  verifyReview(readFileSync(file, "utf8"));
  process.stdout.write("Official Obsidian checks completed without errors or inconclusive scans; review any warnings in the report.\n");
}

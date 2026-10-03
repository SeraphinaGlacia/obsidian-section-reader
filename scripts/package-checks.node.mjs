import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const checker = fileURLToPath(new URL("./check-package.mjs", import.meta.url));

function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), "section-reader-package-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  for (const file of ["package.json", "manifest.json", "versions.json", "pnpm-lock.yaml"]) {
    copyFileSync(new URL(`../${file}`, import.meta.url), join(dir, file));
  }
  writeFileSync(join(dir, "main.js"), "module.exports = {};\n");
  writeFileSync(join(dir, "styles.css"), ".section-reader {}\n");
  const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
  return { dir, pkg };
}

for (const [label, change, expected] of [
  ["valid pnpm package", () => {}, null],
  ["missing pnpm lockfile", ({ dir }) => rmSync(join(dir, "pnpm-lock.yaml")), /pnpm-lock.yaml/],
  ["empty pnpm lockfile", ({ dir }) => writeFileSync(join(dir, "pnpm-lock.yaml"), ""), /Missing pnpm lockfile/],
  ["competing npm lockfile", ({ dir }) => writeFileSync(join(dir, "package-lock.json"), "{}"), /Keep only the pnpm lockfile/],
  ["wrong pnpm version", ({ pkg }) => { pkg.packageManager = "pnpm@10.0.0"; }, /reviewed pnpm version/],
  ["package version mismatch", ({ pkg }) => { pkg.version = "0.0.0"; }, /versions must match/],
  ["missing asset", ({ dir }) => rmSync(join(dir, "main.js")), /main.js/],
  ["prefixed release tag", () => {}, /Release tag must exactly match/],
]) {
  test(`package gate ${expected ? "rejects" : "accepts"} ${label}`, (t) => {
    const data = fixture(t);
    const version = data.pkg.version;
    change(data);
    writeFileSync(join(data.dir, "package.json"), JSON.stringify(data.pkg));
    const result = spawnSync(process.execPath, [checker], {
      cwd: data.dir,
      encoding: "utf8",
      env: { ...process.env, RELEASE_TAG: label === "prefixed release tag" ? `v${version}` : version },
    });
    assert.ifError(result.error);
    if (expected) {
      assert.equal(result.status, 1, result.stdout + result.stderr);
      assert.match(result.stderr, expected);
    } else {
      assert.equal(result.status, 0, result.stdout + result.stderr);
    }
  });
}

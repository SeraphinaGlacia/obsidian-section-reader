import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

const source = resolve(".");
const temporary = mkdtempSync(join(tmpdir(), "section-reader-relocated-build-"));
const installed = join(temporary, "installed");
const relocated = join(temporary, "build");

try {
  // Copy only repository files, without reusing the caller's node_modules or ignored files.
  const files = execFileSync("git", ["ls-files", "-z"], { cwd: source, encoding: "utf8" }).split("\0").filter(Boolean);
  for (const file of files) {
    const target = join(installed, file);
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(join(source, file), target);
  }

  execFileSync("pnpm", ["install", "--frozen-lockfile"], { cwd: installed, stdio: "inherit" });

  // The Community build report exposes this legacy field in its temporary package.json.
  const manifestPath = join(installed, "package.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  manifest.pnpm = { ...manifest.pnpm, onlyBuiltDependencies: ["esbuild"] };
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  // pnpm's saved workspace metadata contains absolute paths from installation.
  renameSync(installed, relocated);
  execFileSync("pnpm", ["run", "build"], { cwd: relocated, stdio: "inherit" });

  for (const file of ["main.js", "manifest.json", "styles.css"]) {
    assert.deepEqual(readFileSync(join(relocated, file)), readFileSync(join(source, file)), `${file} changed after relocating the build`);
  }
  assert.deepEqual(readFileSync(join(relocated, "pnpm-lock.yaml")), readFileSync(join(source, "pnpm-lock.yaml")), "The build changed the frozen lockfile");
  process.stdout.write("Relocated build succeeded with identical assets and an unchanged lockfile.\n");
} finally {
  rmSync(temporary, { recursive: true, force: true });
}

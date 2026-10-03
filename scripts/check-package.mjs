import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";

const readJson = (file) => JSON.parse(readFileSync(file, "utf8"));
const manifest = readJson("manifest.json");
const pkg = readJson("package.json");
const versions = readJson("versions.json");

assert.equal(manifest.id, "section-reader", "Unexpected plugin installation ID");
assert.equal(manifest.name, "Section Reader", "Unexpected plugin display name");
assert.equal(pkg.name, "obsidian-section-reader", "Unexpected package name");
assert.equal(pkg.description, manifest.description, "Descriptions must match");
assert.equal(pkg.packageManager, "pnpm@11.7.0", "Use the reviewed pnpm version");
assert.equal(pkg.version, manifest.version, "Package and manifest versions must match");
// pnpm does not store the root package version; frozen installation validates its dependency snapshot.
assert.ok(statSync("pnpm-lock.yaml").isFile() && statSync("pnpm-lock.yaml").size > 0, "Missing pnpm lockfile");
assert.ok(!existsSync("package-lock.json"), "Keep only the pnpm lockfile");
assert.equal(versions[manifest.version], manifest.minAppVersion, "Missing or inconsistent compatibility entry");
for (const asset of ["main.js", "manifest.json", "styles.css"]) {
  assert.ok(statSync(asset).isFile() && statSync(asset).size > 0, `${asset} must be a non-empty release asset`);
}
if (process.env.RELEASE_TAG) {
  assert.equal(process.env.RELEASE_TAG, manifest.version, "Release tag must exactly match manifest.version (no v prefix)");
}
process.stdout.write("Package identity, versions, compatibility and release assets are consistent.\n");

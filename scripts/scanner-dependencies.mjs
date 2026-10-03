import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, realpathSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

export const bracesAdvisory = "https://github.com/advisories/GHSA-vfj7-8cjw-p6xm";
// Maintainer-owned backport; require review within 30 days or on any upstream change.
export const backportReviewBefore = "2026-11-02T00:00:00Z";
const bracesIntegrity = "sha512-yQbXgO/OSZVD2IsiLlro+7Hf6Q18EJrKSEsdoMzKePKXct3gvD8oLcOQdIzGupr5Fj+EDe8gO/lxc1BzfMpxvA==";
const hashes = JSON.parse(readFileSync(new URL("./patches/braces-depth-hashes.json", import.meta.url), "utf8"));
const patch = fileURLToPath(new URL("./patches/braces-depth.patch", import.meta.url));

function verifySources(directory, state) {
  for (const [file, digests] of Object.entries(hashes)) {
    const digest = createHash("sha256").update(readFileSync(join(directory, file))).digest("hex");
    assert.equal(digest, digests[state], `Unreviewed braces ${state} source: ${file}`);
  }
}

function nestedAst(depth) {
  let child = { type: "text", value: "ok" };
  for (let i = 0; i < depth; i++) child = { type: "root", nodes: [child] };
  return child;
}

// Exercise the installed code before accepting a version-based advisory as repaired.
export function verifyBracesBehavior(braces) {
  const rejected = { name: "SyntaxError", message: "braces nesting exceeds 100 levels" };
  for (const [open, close] of [["{", "}"], ["(", ")"], ["{(", ")}"]]) {
    const input = open.repeat(101) + "a,b" + close.repeat(101);
    for (const api of ["parse", "compile", "expand", "stringify"]) {
      assert.throws(() => braces[api](input), rejected, `${api} must bound nesting`);
    }
  }
  const originalTrigger = "{".repeat(4998) + "a,b" + "}".repeat(4998);
  for (const api of ["compile", "expand", "stringify"]) {
    assert.throws(() => braces[api](originalTrigger), rejected);
    assert.throws(() => braces[api](nestedAst(10000)), rejected, `${api} must bound direct ASTs`);
    assert.throws(() => braces[api](nestedAst(103)), rejected);
    const cyclic = { type: "root", nodes: [] };
    cyclic.nodes.push(cyclic);
    assert.throws(() => braces[api](cyclic), rejected, `${api} must bound node cycles`);
    assert.doesNotThrow(() => braces[api]("{".repeat(100) + "a,b" + "}".repeat(100)));
  }
  assert.deepEqual(braces.expand("src/{a,b}.{js,css}"), ["src/a.js", "src/a.css", "src/b.js", "src/b.css"]);
  assert.deepEqual(braces.expand("{01..03}"), ["01", "02", "03"]);
  assert.deepEqual(braces.expand("{a..c}"), ["a", "b", "c"]);
  assert.equal(braces.compile("a/{b,c}/d"), "a/(b|c)/d");
  for (const pattern of ["{{a}}", "{1..8}", "${a,b}", "{a,{b,c}}", "{a,b}"]) {
    assert.equal(braces.stringify(pattern, { escapeInvalid: true }), pattern);
  }
  assert.throws(() => braces.expand("{1..1001}"), /range limit/);
}

export function patchBracesInstances(directory) {
  const root = realpathSync(directory);
  const lock = JSON.parse(readFileSync(join(root, "package-lock.json"), "utf8"));
  assert.equal(lock.lockfileVersion, 3, "Review changed scanner lock format");
  assert.ok(lock.packages && typeof lock.packages === "object", "Scanner lock has no packages");
  const patched = new Set();
  for (const [location, metadata] of Object.entries(lock.packages)) {
    if (!location.endsWith("node_modules/braces")) continue;
    assert.match(location, /^node_modules\//);
    assert.ok(!location.split("/").includes(".."), "Invalid braces location");
    assert.equal(metadata.version, "3.0.3", "Review changed braces version");
    assert.equal(metadata.integrity, bracesIntegrity, "Review changed braces tarball");
    const packageDir = realpathSync(join(root, location));
    assert.ok(packageDir.startsWith(root + sep), "Braces must be inside the scanner directory");
    verifySources(packageDir, "original");
    execFileSync("git", ["apply", "--check", `--directory=${location}`, patch], { cwd: root, stdio: "inherit" });
    execFileSync("git", ["apply", `--directory=${location}`, patch], { cwd: root, stdio: "inherit" });
    verifySources(packageDir, "patched");
    const require = createRequire(join(packageDir, "package.json"));
    verifyBracesBehavior(require(packageDir));
    patched.add(location);
  }
  return patched;
}

export function evaluateScannerAudit(report, exitCode, patched, now = new Date()) {
  assert.equal(report.auditReportVersion, 2, "Unsupported npm audit response");
  assert.ok(!report.error, "npm audit could not complete");
  const findings = report.vulnerabilities;
  assert.ok(findings && typeof findings === "object" && !Array.isArray(findings), "Missing audit findings");
  const names = Object.keys(findings);
  assert.equal(report.metadata?.vulnerabilities?.total, names.length, "Incomplete audit counts");
  assert.equal(exitCode, names.length === 0 ? 0 : 1, "npm audit execution failed");
  if (names.length === 0) return [];
  assert.ok(now.getTime() < Date.parse(backportReviewBefore), "Braces backport review is due; publishing is blocked");

  const resolved = new Set();
  function repaired(name, ancestors = new Set()) {
    if (resolved.has(name)) return;
    assert.ok(!ancestors.has(name), "Cyclic audit dependency chain");
    const finding = findings[name];
    assert.ok(finding && finding.name === name, `Unknown audit dependency: ${name}`);
    assert.ok(Array.isArray(finding.nodes) && finding.nodes.length > 0, "Missing affected audit nodes");
    assert.ok(Array.isArray(finding.via) && finding.via.length > 0, "Missing audit cause");
    for (const cause of finding.via) {
      if (typeof cause === "string") {
        repaired(cause, new Set([...ancestors, name]));
      } else {
        assert.ok(name === "braces" && cause?.url === bracesAdvisory && cause.source === 1240992
          && cause.name === "braces" && cause.dependency === "braces" && cause.range === "<=3.0.3",
        `Unrepaired scanner vulnerability: ${name} ${cause?.url ?? "unknown advisory"}`);
        assert.ok(finding.nodes.every(node => patched.has(node)), "Audit includes unpatched braces instances");
      }
    }
    resolved.add(name);
  }
  for (const name of names) repaired(name);
  return [...resolved];
}

export function auditScannerDependencies(directory) {
  const patched = patchBracesInstances(directory);
  const result = spawnSync("npm", ["audit", "--json", "--audit-level=low"], {
    cwd: directory, encoding: "utf8", timeout: 120000, maxBuffer: 8 * 1024 * 1024,
  });
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.error) throw result.error;
  const report = JSON.parse(result.stdout);
  const repaired = evaluateScannerAudit(report, result.status, patched);
  if (repaired.length > 0) {
    process.stdout.write(`Verified source backport for ${bracesAdvisory}: ${patched.size} instance(s), ${repaired.length} version-based audit entries. Review before ${backportReviewBefore}.\n`);
  } else {
    process.stdout.write("Scanner dependency audit: no reported vulnerabilities.\n");
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  assert.ok(process.argv[2], "Pass the installed scanner dependency directory");
  auditScannerDependencies(process.argv[2]);
}

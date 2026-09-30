import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import test from "node:test";
import { runInNewContext } from "node:vm";

// Exercise the patched upstream function itself, not a second implementation.
const bundle = fs.readFileSync(process.env.OBSIDIAN_SCANNER_BUNDLE, "utf8");
const start = bundle.indexOf("async function createScannerDepsDir(deps) {");
const end = bundle.indexOf("async function runUserLint(workspacePath) {", start);
assert.ok(start >= 0 && end > start, "The pinned scanner bootstrap must exist");
const source = `(${bundle.slice(start, end).trim()})`;

for (const [label, statuses] of [
  ["successful installation and audit", [0, 0]],
  ["failed installation", [1]],
  ["failed audit", [0, 1]],
]) {
  test(label, async (t) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "scanner-bootstrap-test-"));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const calls = [];
    const deps = { eslint: "9.37.0", "eslint-plugin-obsidianmd": "0.4.1", "typescript-eslint": "8.61.1" };
    const bootstrap = runInNewContext(source, {
      fs$1: fs,
      path$2: path,
      os$1: { tmpdir: () => root },
      exec: (command, args, options) => {
        const pkg = JSON.parse(fs.readFileSync(path.join(options.cwd, "package.json"), "utf8"));
        assert.deepEqual(pkg.dependencies, deps);
        assert.deepEqual(pkg.overrides, { moment: "2.31.0" });
        assert.equal(options.ignoreReturnCode, true);
        calls.push([command, ...args]);
        return Promise.resolve(statuses[calls.length - 1]);
      },
    });

    if (statuses.includes(1)) {
      await assert.rejects(bootstrap(deps), /install scanner lint dependencies|dependency audit failed/);
      assert.deepEqual(fs.readdirSync(root), [], "Failed scanners must remove their dependency directory");
    } else {
      const scannerDir = await bootstrap(deps);
      assert.ok(fs.existsSync(path.join(scannerDir, "package.json")));
    }
    assert.deepEqual(calls, statuses.length === 1
      ? [["npm", "install"]]
      : [["npm", "install"], ["npm", "audit", "--audit-level=low"]]);
  });
}

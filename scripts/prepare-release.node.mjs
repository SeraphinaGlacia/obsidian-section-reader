import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";
import { createGitHubRequest, prepareRelease, releaseVersion } from "./prepare-release.mjs";

const sha = "a".repeat(40);
const otherSha = "b".repeat(40);
const prefix = "repos/SeraphinaGlacia/obsidian-section-reader";
const version = "0.2.2";
const context = { repository: "SeraphinaGlacia/obsidian-section-reader", eventName: "workflow_dispatch", ref: "refs/heads/main", sha };
const metadata = {
  manifest: { id: "section-reader", name: "Section Reader", version, minAppVersion: "1.8.7", description: "Read one section." },
  pkg: { name: "obsidian-section-reader", version, description: "Read one section.", packageManager: "pnpm@11.7.0" },
  versions: { [version]: "1.8.7" },
};

function fixture(options = {}) {
  const calls = [];
  let tagObject = options.tag;
  let mainReads = 0;
  const request = async (method, path, body) => {
    calls.push({ method, path, body });
    if (options.request) {
      const override = await options.request(method, path, body);
      if (override !== undefined) return override;
    }
    if (path === `${prefix}/git/ref/heads/main`) {
      mainReads++;
      return { status: 200, data: { object: { type: "commit", sha: options.mainMoved && mainReads > 1 ? otherSha : sha } } };
    }
    if (path.includes("/actions/workflows/ci.yml/runs")) {
      return { status: 200, data: { workflow_runs: options.ciRuns ?? [{ id: 5, head_sha: sha, head_branch: "main", event: "push", status: "completed", conclusion: "success" }] } };
    }
    if (path.includes("/releases?")) return { status: 200, data: options.releases ?? [] };
    if (path === `${prefix}/git/ref/tags/${version}`) {
      return tagObject ? { status: 200, data: { object: tagObject } } : { status: 404, data: {} };
    }
    if (path === `${prefix}/git/tags/${otherSha}`) {
      return { status: 200, data: { object: { type: "commit", sha } } };
    }
    if (path === `${prefix}/git/ref/heads/${version}`) return { status: 404, data: {} };
    if (path.includes("/actions/workflows/release.yml/runs")) {
      return { status: 200, data: { workflow_runs: options.releaseRuns ?? [] } };
    }
    if (path.includes("/actions/runs/") && path.endsWith("/jobs?per_page=100")) {
      return { status: 200, data: { jobs: [{ name: "release", conclusion: "success" }] } };
    }
    if (method === "POST" && path === `${prefix}/git/refs`) {
      tagObject = { type: "commit", sha: body.sha };
      return { status: 201, data: { object: tagObject } };
    }
    if (method === "POST" && path.endsWith("/dispatches")) return { status: 204, data: null };
    throw new Error(`Unexpected request: ${method} ${path}`);
  };
  return { calls, request, writes: () => calls.filter((call) => call.method !== "GET") };
}

const prepare = (f, overrides = {}) => prepareRelease({ context, metadata, request: f.request, ...overrides });

test("creates one exact tag and explicitly dispatches the tag ref", async () => {
  const f = fixture();
  const result = await prepare(f);
  assert.equal(result.dispatched, true);
  assert.deepEqual(f.writes(), [
    { method: "POST", path: `${prefix}/git/refs`, body: { ref: "refs/tags/0.2.2", sha } },
    { method: "POST", path: `${prefix}/actions/workflows/release.yml/dispatches`, body: { ref: `refs/tags/${version}` } },
  ]);
});

for (const [label, changed] of [
  ["wrong repository", { repository: "someone/else" }],
  ["push event", { eventName: "push" }],
  ["tag ref", { ref: "refs/tags/0.2.2" }],
  ["other branch", { ref: "refs/heads/topic" }],
  ["invalid SHA", { sha: "main" }],
]) {
  test(`rejects ${label} before any API request`, async () => {
    const f = fixture();
    await assert.rejects(prepare(f, { context: { ...context, ...changed } }));
    assert.equal(f.calls.length, 0);
  });
}

for (const [label, update] of [
  ["non-numeric version", (m) => { m.manifest.version = "0.2.2;echo nope"; }],
  ["v-prefixed version", (m) => { m.manifest.version = "v0.2.2"; }],
  ["package mismatch", (m) => { m.pkg.version = "0.2.1"; }],
  ["package manager mismatch", (m) => { m.pkg.packageManager = "npm@12.0.2"; }],
  ["unpinned package manager", (m) => { delete m.pkg.packageManager; }],
  ["description mismatch", (m) => { m.pkg.description = "Other"; }],
  ["compatibility mismatch", (m) => { m.versions[version] = "1.0.0"; }],
  ["wrong plugin", (m) => { m.manifest.id = "other"; }],
]) {
  test(`rejects ${label} without writes`, async () => {
    const m = structuredClone(metadata);
    update(m);
    assert.throws(() => releaseVersion(m));
    const f = fixture();
    await assert.rejects(prepare(f, { metadata: m }));
    assert.equal(f.writes().length, 0);
  });
}

for (const status of ["missing", "queued", "failure"]) {
  test(`rejects ${status} exact-main CI without writes`, async () => {
    const f = fixture({ ciRuns: status === "missing" ? [] : [{ id: 1, head_sha: sha, head_branch: "main", event: "push", status: status === "queued" ? "queued" : "completed", conclusion: status === "failure" ? "failure" : null }] });
    await assert.rejects(prepare(f), /latest main CI/);
    assert.equal(f.writes().length, 0);
  });
}

test("requires the latest CI run, rather than any historical success", async () => {
  const runs = [1, 2].map((id) => ({ id, head_sha: sha, head_branch: "main", event: "push", status: "completed", conclusion: id === 1 ? "success" : "failure" }));
  const f = fixture({ ciRuns: runs });
  await assert.rejects(prepare(f), /latest main CI/);
  assert.equal(f.writes().length, 0);
});

test("rejects main moving between validation and tag creation", async () => {
  const f = fixture({ mainMoved: true });
  await assert.rejects(prepare(f), /Main changed/);
  assert.equal(f.writes().length, 0);
});

test("blocks published and draft releases, including later pages", async () => {
  for (const draft of [false, true]) {
    const f = fixture({ request: (method, path) => {
      if (path.endsWith("/releases?per_page=100&page=1")) return { status: 200, data: Array.from({ length: 100 }, (_, i) => ({ tag_name: `old-${i}` })) };
      if (path.endsWith("/releases?per_page=100&page=2")) return { status: 200, data: [{ tag_name: version, draft }] };
    } });
    await assert.rejects(prepare(f), /already exists/);
    assert.equal(f.writes().length, 0);
  }
});

test("reuses an identical lightweight or annotated tag without moving it", async () => {
  for (const tag of [{ type: "commit", sha }, { type: "tag", sha: otherSha }]) {
    const f = fixture({ tag });
    const result = await prepare(f);
    assert.equal(result.dispatched, true);
    assert.deepEqual(f.writes().map((call) => call.path), [`${prefix}/actions/workflows/release.yml/dispatches`]);
  }
});

test("refuses to move a conflicting tag", async () => {
  const f = fixture({ tag: { type: "commit", sha: otherSha } });
  await assert.rejects(prepare(f), /another commit/);
  assert.equal(f.writes().length, 0);
});

for (const response of [{ status: 403, data: {} }, { status: 500, data: {} }]) {
  test(`does not treat tag HTTP ${response.status} as absence`, async () => {
    const f = fixture({ request: (method, path) => path.endsWith(`/git/ref/tags/${version}`) ? response : undefined });
    await assert.rejects(prepare(f), /Tag lookup failed/);
    assert.equal(f.writes().length, 0);
  });
}

test("does not duplicate an active or successful release run", async () => {
  for (const status of ["queued", "in_progress", "completed"]) {
    const f = fixture({ tag: { type: "commit", sha }, releaseRuns: [{ id: 8, head_sha: sha, head_branch: version, event: "workflow_dispatch", status, conclusion: status === "completed" ? "success" : null }] });
    assert.equal((await prepare(f)).existingRunId, 8);
    assert.equal(f.writes().length, 0);
  }
});

test("stops after an unconfirmed tag creation, without dispatching or retrying", async () => {
  const f = fixture({ request: (method, path) => method === "POST" && path.endsWith("/git/refs") ? { status: 422, data: {} } : undefined });
  await assert.rejects(prepare(f), /inspect the tag/);
  assert.equal(f.writes().length, 1);
});

test("verifies the tag before dispatching", async () => {
  let reads = 0;
  const f = fixture({ request: (method, path) => {
    if (path.endsWith(`/git/ref/tags/${version}`) && ++reads > 1) return { status: 200, data: { object: { type: "commit", sha: otherSha } } };
  } });
  await assert.rejects(prepare(f), /read-back/);
  assert.equal(f.writes().length, 1);
});

test("retains the tag and reports an unconfirmed dispatch without retrying", async () => {
  const f = fixture({ request: (method, path) => path.endsWith("/dispatches") ? { status: 403, data: {} } : undefined });
  await assert.rejects(prepare(f), /Tag is intact/);
  assert.equal(f.writes().length, 2);
});

test("HTTPS adapter uses fixed GitHub origin without redirect handling", async () => {
  const calls = [];
  const request = createGitHubRequest("test-token", (url, options, callback) => {
    const req = new EventEmitter();
    const call = { url, options, body: "" };
    calls.push(call);
    req.write = (chunk) => { call.body += chunk; };
    req.end = () => {
      const response = new EventEmitter();
      response.statusCode = 302;
      response.setEncoding = () => {};
      callback(response);
      response.emit("end");
    };
    return req;
  });
  assert.deepEqual(await request("POST", `${prefix}/actions/workflows/release.yml/dispatches`, { ref: version }), { status: 302, data: null });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url.href, `https://api.github.com/${prefix}/actions/workflows/release.yml/dispatches`);
  assert.equal(calls[0].options.headers["User-Agent"], "section-reader-release-preparation");
  assert.equal(calls[0].body, JSON.stringify({ ref: version }));
});

test("does not mistake a successful same-named branch run for a tag release", async () => {
  const f = fixture({
    tag: { type: "commit", sha },
    releaseRuns: [{ id: 8, head_sha: sha, head_branch: version, event: "workflow_dispatch", status: "completed", conclusion: "success" }],
    request: (method, path) => path.endsWith("/jobs?per_page=100") ? { status: 200, data: { jobs: [{ name: "release", conclusion: "skipped" }] } } : undefined,
  });
  assert.equal((await prepare(f)).dispatched, true);
  assert.deepEqual(f.writes()[0].body, { ref: "refs/tags/0.2.2" });
});

test("accepts the dispatch API response that includes a run ID", async () => {
  const f = fixture({ request: (method, path) => path.endsWith("/dispatches") ? { status: 200, data: { workflow_run_id: 123 } } : undefined });
  assert.equal((await prepare(f)).runId, 123);
});

test("rejects a same-named branch before deduplicating runs or writing", async () => {
  const f = fixture({ request: (method, path) => path.endsWith(`/git/ref/heads/${version}`) ? { status: 200, data: { object: { type: "commit", sha } } } : undefined });
  await assert.rejects(prepare(f), /same-named branch/);
  assert.equal(f.writes().length, 0);
});

test("finds an active release run on a later page without duplicating it", async () => {
  const f = fixture({ tag: { type: "commit", sha }, request: (method, path) => {
    if (!path.includes("/actions/workflows/release.yml/runs")) return undefined;
    return { status: 200, data: { workflow_runs: path.endsWith("page=1")
      ? Array.from({ length: 100 }, (_, id) => ({ id, head_sha: sha, head_branch: version, event: "workflow_dispatch", status: "completed", conclusion: "failure" }))
      : [{ id: 999, head_sha: sha, head_branch: version, event: "workflow_dispatch", status: "in_progress", conclusion: null }] } };
  } });
  assert.equal((await prepare(f)).existingRunId, 999);
  assert.equal(f.writes().length, 0);
});

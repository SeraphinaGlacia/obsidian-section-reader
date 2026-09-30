import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const repository = "SeraphinaGlacia/obsidian-section-reader";
const shaPattern = /^[0-9a-f]{40}$/;
const versionPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

function expectOk(response, label) {
  if (response.status !== 200) throw new Error(`${label} failed (HTTP ${response.status})`);
  return response.data;
}

export function releaseVersion(metadata) {
  const { manifest, pkg, lock, versions } = metadata;
  assert.equal(manifest.id, "section-reader", "Unexpected plugin identity");
  assert.equal(manifest.name, "Section Reader", "Unexpected plugin name");
  assert.equal(pkg.name, "obsidian-section-reader", "Unexpected package name");
  assert.match(manifest.version, versionPattern, "Expected a numeric version without a v prefix");
  assert.equal(pkg.description, manifest.description, "Descriptions must match");
  assert.equal(lock.name, pkg.name, "Lockfile name must match");
  assert.equal(lock.packages[""].name, pkg.name, "Lockfile root name must match");
  for (const version of [pkg.version, lock.version, lock.packages[""].version]) {
    assert.equal(version, manifest.version, "Versions must match");
  }
  assert.equal(versions[manifest.version], manifest.minAppVersion, "Compatibility entry must match");
  return manifest.version;
}

async function assertCurrentMain(request, prefix, sha) {
  const main = expectOk(await request("GET", `${prefix}/git/ref/heads/main`), "Main lookup");
  if (main.object?.type !== "commit" || main.object.sha !== sha) {
    throw new Error("Main changed; start a new manual run after its CI succeeds");
  }
}

async function resolveTag(request, prefix, object) {
  for (let depth = 0; depth < 8; depth++) {
    if (!object || !shaPattern.test(object.sha)) throw new Error("Malformed tag target");
    if (object.type === "commit") return object.sha;
    if (object.type !== "tag") throw new Error("Tag does not resolve to a commit");
    object = expectOk(await request("GET", `${prefix}/git/tags/${object.sha}`), "Annotated tag lookup").object;
  }
  throw new Error("Tag nesting exceeds the safe limit");
}

export async function prepareRelease({ context, metadata, request }) {
  if (context.repository !== repository || context.eventName !== "workflow_dispatch" || context.ref !== "refs/heads/main") {
    throw new Error("Release preparation requires a manual run on this repository's main branch");
  }
  assert.match(context.sha, shaPattern, "Invalid source commit");
  const version = releaseVersion(metadata);
  const prefix = `repos/${repository}`;
  await assertCurrentMain(request, prefix, context.sha);

  const ci = expectOk(await request("GET", `${prefix}/actions/workflows/ci.yml/runs?event=push&head_sha=${context.sha}&per_page=100`), "CI lookup");
  if (!Array.isArray(ci.workflow_runs)) throw new Error("Malformed CI response");
  const latest = ci.workflow_runs
    .filter((run) => run.head_sha === context.sha && run.head_branch === "main" && run.event === "push")
    .sort((a, b) => b.id - a.id)[0];
  if (!latest || latest.status !== "completed" || latest.conclusion !== "success") {
    throw new Error("The latest main CI run for this exact commit must succeed before tagging");
  }

  // Include drafts, and fail closed if any page cannot be read.
  for (let page = 1; ; page++) {
    const releases = expectOk(await request("GET", `${prefix}/releases?per_page=100&page=${page}`), "Release lookup");
    if (!Array.isArray(releases)) throw new Error("Malformed release response");
    if (releases.some((release) => release.tag_name === version)) {
      throw new Error(`Release ${version} already exists; inspect it instead of overwriting assets`);
    }
    if (releases.length < 100) break;
  }

  const tagPath = `${prefix}/git/ref/tags/${version}`;
  const tag = await request("GET", tagPath);
  if (tag.status !== 200 && tag.status !== 404) throw new Error(`Tag lookup failed (HTTP ${tag.status})`);
  if (tag.status === 200 && await resolveTag(request, prefix, tag.data.object) !== context.sha) {
    throw new Error("Existing tag targets another commit; it will not be moved");
  }

  const branch = await request("GET", `${prefix}/git/ref/heads/${version}`);
  if (branch.status === 200) throw new Error("A same-named branch makes release-run identity ambiguous; inspect it before releasing");
  if (branch.status !== 404) throw new Error(`Branch lookup failed (HTTP ${branch.status})`);

  for (let page = 1; ; page++) {
    const runs = expectOk(await request("GET", `${prefix}/actions/workflows/release.yml/runs?head_sha=${context.sha}&per_page=100&page=${page}`), "Release run lookup");
    if (!Array.isArray(runs.workflow_runs)) throw new Error("Malformed release run response");
    const candidates = runs.workflow_runs.filter((run) =>
      run.head_sha === context.sha && run.head_branch === version &&
      (run.event === "push" || run.event === "workflow_dispatch") &&
      (run.status !== "completed" || run.conclusion === "success"));
    for (const run of candidates) {
      if (run.status === "completed") {
        const jobs = expectOk(await request("GET", `${prefix}/actions/runs/${run.id}/jobs?per_page=100`), "Release job lookup");
        if (!Array.isArray(jobs.jobs)) throw new Error("Malformed release job response");
        // A deleted same-named branch can leave a successful run with the tag job skipped.
        if (!jobs.jobs.some((job) => job.name === "release" && job.conclusion === "success")) continue;
      }
      return { version, sha: context.sha, dispatched: false, existingRunId: run.id };
    }
    if (runs.workflow_runs.length < 100) break;
  }

  // Recheck immediately before writing, and never force-update a ref.
  await assertCurrentMain(request, prefix, context.sha);
  if (tag.status === 404) {
    const created = await request("POST", `${prefix}/git/refs`, { ref: `refs/tags/${version}`, sha: context.sha });
    if (created.status !== 201) {
      throw new Error(`Tag creation did not confirm success (HTTP ${created.status}); inspect the tag before retrying`);
    }
  }
  const verified = expectOk(await request("GET", tagPath), "Tag read-back");
  if (await resolveTag(request, prefix, verified.object) !== context.sha) {
    throw new Error("Tag read-back does not match the checked source commit");
  }

  // GITHUB_TOKEN tag pushes do not trigger another workflow, but explicit dispatch does.
  const dispatched = await request("POST", `${prefix}/actions/workflows/release.yml/dispatches`, { ref: `refs/tags/${version}` });
  if (dispatched.status !== 200 && dispatched.status !== 204) {
    throw new Error(`Tag is intact, but dispatch did not confirm success (HTTP ${dispatched.status}); inspect Actions before retrying`);
  }
  return { version, sha: context.sha, dispatched: true, runId: dispatched.data?.workflow_run_id };
}

// This CI-only script runs in Node, outside the Obsidian plugin runtime.
// eslint-disable-next-line no-restricted-globals
export function createGitHubRequest(token, fetchImpl = fetch) {
  if (!token) throw new Error("GH_TOKEN is required");
  return async (method, path, body) => {
    const response = await fetchImpl(`https://api.github.com/${path}`, {
      method,
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      redirect: "error",
      signal: AbortSignal.timeout(30000),
    });
    const text = await response.text();
    return { status: response.status, data: text ? JSON.parse(text) : null };
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const readJson = (file) => JSON.parse(readFileSync(file, "utf8"));
  const result = await prepareRelease({
    context: {
      repository: process.env.GITHUB_REPOSITORY,
      eventName: process.env.GITHUB_EVENT_NAME,
      ref: process.env.GITHUB_REF,
      sha: process.env.GITHUB_SHA,
    },
    metadata: {
      manifest: readJson("manifest.json"),
      pkg: readJson("package.json"),
      lock: readJson("package-lock.json"),
      versions: readJson("versions.json"),
    },
    request: createGitHubRequest(process.env.GH_TOKEN),
  });
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

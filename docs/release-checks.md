# Release checks

Use Node.js 24 LTS and pnpm 11.7.0. `.node-version` selects the local and release baseline; `package.json` permits Node.js `^22.13.0 || >=24.0.0`, matching pnpm and the locked development dependencies. CI also performs clean installs and full project checks on Node.js 22.13.0 and 26. Every push and pull request runs a frozen dependency install, `pnpm audit --audit-level=low`, the project's full checks, and the official Obsidian review tooling. Tag releases repeat the baseline checks before uploading release assets. A normal commit does not create a release.

## Local checks

```sh
pnpm install --frozen-lockfile
pnpm audit --audit-level=low
pnpm run check
```

`pnpm run check` runs TypeScript against the current and minimum Obsidian APIs, ESLint, Vitest, the release-gate and manual-release guard regression tests, a production build, and packaging checks. Source code must use Obsidian's DOM creation helpers; browser primitives are permitted only in test fixtures that supply those host helpers.

The test environment uses jsdom 28 to avoid the deprecated `whatwg-encoding` dependency. Project-scoped `allowBuilds` entries in `pnpm-workspace.yaml` approve only the reviewed `esbuild@0.28.2` and macOS `fsevents@2.3.3` installation scripts. `strictDepBuilds` rejects unreviewed scripts. Review these pins when upgrading either package. The workspace configuration rejects unsupported Node versions and running scripts with stale dependencies. `pmOnFail: download` lets a different pnpm launcher fetch and execute the exact version in `packageManager`, without replacing the globally installed launcher. External reviewers therefore do not need our local Node major or a preinstalled matching pnpm version. Frozen resolution, dependency engine checks, build approvals, and vulnerability gates remain enforced. See [pnpm's build settings](https://pnpm.io/settings/build) and [CLI settings](https://pnpm.io/settings/cli).

`pnpm-lock.yaml` was imported from the npm lockfile with `pnpm import`. Keep it as the sole project lockfile, and use `pnpm install --frozen-lockfile` for reproducible installs. When switching an existing checkout from npm, move the old `node_modules` directory aside before installing with pnpm. CI installs the pinned pnpm version before restoring its store cache and running the frozen install; it does not cache `node_modules`.

The current and minimum Obsidian API packages still depend on Moment 2.29.4. The development dependency tree overrides it with the fixed version, 2.31.0, using `overrides` in `pnpm-workspace.yaml`. No Moment code is bundled into the plugin. Remove the override once the upstream packages no longer require it. See [Moment's security fix](https://github.com/moment/moment/security/advisories/GHSA-4p3w-j4w9-5jqw).

`eslint-plugin-obsidianmd@0.4.2` declares both an Obsidian 1.12.3 dependency and a conflicting 1.8.7 peer. A narrowly scoped override removes only that obsolete peer declaration, preserving the plugin's own 1.12.3 dependency from the npm lockfile. Review this override when upgrading the lint plugin. The project's current 1.13.1 API and aliased minimum 1.8.7 API checks remain separate.

## Official checks

The local composite action runs the bundle from [obsidianmd/obsidian-workflows](https://github.com/obsidianmd/obsidian-workflows) at commit `8167caed39664214d82c86fdfa32e06d8d55f61d` (v1.2.3), with the dependency-only patch in `scripts/patches/obsidian-scanner-dependencies.patch`. It uses `mode: pr`, `scanner-lint: true`, and `strict: true`. The upstream checkout is moved outside the project before scanning.

Before applying the patch, `scripts/patch-obsidian-scanner.mjs` verifies the original bundle's SHA-256. An upstream change or a previously patched bundle fails this check. The temporary scanner package pins Moment 2.31.0 and braces 3.0.3. Installation disables lifecycle scripts; `scripts/scanner-dependencies.mjs` then applies the reviewed braces source repair and runs `npm audit --json --audit-level=low`. Installation, repair, or audit failures make the scanner inconclusive, which the report gate rejects. The official rule definitions, severities, and configuration are unchanged. Bootstrap regression tests execute the actual patched function and cover success, installation failure, repair/audit failure, and cleanup.

This runs upstream manifest, README/license, repository, dependency-policy, build, artifact-preflight, scanner ESLint, and scanner Stylelint checks. The scanners use the official configuration, independently of the project's ESLint configuration. No official findings are suppressed.

The pinned action detects the project's pnpm lockfile and uses pnpm for project installation and builds. Its separate temporary scanner dependency tree still uses npm, with its own dependency repairs and audit. Project pnpm overrides do not apply to that isolated tree.

The upstream `validation-passed` output only rejects errors; it can still be true when scanner setup or execution is inconclusive. `scripts/verify-obsidian-review.mjs` therefore checks the official report in the same step. Missing, malformed, non-strict, incomplete, or inconclusive reports fail. Both scanners must finish without errors. Warnings remain visible in annotations and the report. Regression fixtures cover these outcomes and reject changed report catalogs. Review the report contract and fixtures together when upgrading the pinned action.

CI retains `contents: read`. Tag releases additionally use `contents: write` to publish assets, `id-token: write` for GitHub's short-lived signing identity, and `attestations: write` to upload build provenance. No personal signing key is required. The official review tool only performs read-only repository checks in this mode. These workflows do not change repository visibility or submit the plugin to the community directory.

## Upstream dependency notices

As of 2026-09-30, npm marks ESLint 9 as deprecated. The official Obsidian lint plugin depends on plugins whose declared peer ranges do not yet support ESLint 10, including `eslint-plugin-import`. This project retains the compatible ESLint 9 toolchain instead of overriding those peer requirements.

The pinned official action installs a separate scanner dependency tree using ESLint 9.37.0 and `eslint-plugin-obsidianmd` 0.4.1. Without the patch, its audit reports one moderate Moment vulnerability against three affected packages: `moment`, `obsidian`, and `eslint-plugin-obsidianmd`. The scanner's own `moment: 2.31.0` override clears these entries. npm output, including the remaining ESLint 9 deprecation notice, stays visible. Review the bundle hash, patches, bootstrap tests, and report gate together when updating upstream. The official action remains at its latest release, v1.2.3, as of 2026-10-03.

The separate Stylelint tree includes `stylelint → globby/fast-glob → micromatch → braces`. [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) permits stack exhaustion from deeply nested patterns; npm reports six affected entries for this single root advisory. As of 2026-10-03, there is no fixed published braces version, and upgrading Stylelint retains the same chain. This is a scanner dependency, not code bundled into Section Reader; a remotely exploitable plugin runtime path has not been established.

The temporary backport in `scripts/patches/braces-depth.patch` applies to the published braces 3.0.3 tarball, corresponding to upstream commit `74b2db2938fad48a2ea54a9c8bf27a37a62c350d`. It limits brace/parenthesis nesting to 100 levels during parsing and checks AST depth iteratively before compile, expand, or stringify recurses. Direct ASTs and node cycles receive the same bound. Existing escaping, range limits, matching behavior, and official scanner rules remain intact. The approach follows the boundary identified in [upstream PR #72](https://github.com/micromatch/braces/pull/72), but does not adopt that unmerged PR or its unrelated stringify behavior change.

Every installed braces copy must match the exact npm tarball integrity and all eight source/metadata SHA-256 values before patching, then match the patched digests. The helper runs nesting, direct-AST, cycle, escaping, and range controls against the installed code. A changed version, source, incomplete patch, failed behavioral check, or unpatched instance blocks the scanner.

**Audited backport policy:** npm still reports the six version-based entries because the package remains honestly identified as 3.0.3. The raw audit JSON stays in CI output. The gate recognizes only advisory source `1240992`, its exact GHSA URL and affected range, and dependency entries whose entire cause chain leads to that advisory, after all affected instances have passed source and behavior verification. Any other advisory, missing node, malformed response, network failure, or unknown chain fails. No global advisory ignore is configured. The owner is the Section Reader maintainers; this exception requires review before **2026-11-02 00:00 UTC** and blocks publishing at that deadline. Remove the backport and this exception once a compatible official fix is released, then rerun source, bootstrap, audit, scanner, and report-contract checks. A repaired source advisory must not be described as a clean raw npm audit.

## Packaging and release

`pnpm run check:package` checks the plugin identity, matching package/manifest versions and descriptions, the pnpm version pin, the sole non-empty pnpm lockfile, the compatibility mapping, and non-empty `main.js`, `manifest.json`, and `styles.css` assets. pnpm lockfiles do not store the root package version; the frozen installation in CI and release jobs validates their dependency declarations instead. When `RELEASE_TAG` is set, it must exactly match the manifest version, without a `v` prefix.

**Section Reader 0.2.0** uses the plugin ID `section-reader`. Historical 0.1.2 assets use the older Focus Cards identity; do not reuse that tag. Push a validated version tag only when releasing is authorized. The tag workflow uploads all three assets after the checks pass.

Starting with 0.2.1, the release workflow uses GitHub's pinned `actions/attest` action to generate SLSA build provenance for `main.js`, `manifest.json`, and `styles.css`. Before publication, it verifies every file against the signed bundle, the repository, this release workflow, the exact tag, and the source commit. Verification also requires a GitHub-hosted runner. A failed attestation or verification prevents publication.

Users can verify downloaded release files independently:

```sh
gh release download 0.2.1 --repo SeraphinaGlacia/obsidian-section-reader --dir section-reader-0.2.1
for asset in main.js manifest.json styles.css; do
  gh attestation verify "section-reader-0.2.1/$asset" \
    --repo SeraphinaGlacia/obsidian-section-reader \
    --signer-workflow SeraphinaGlacia/obsidian-section-reader/.github/workflows/release.yml \
    --source-ref refs/tags/0.2.1 \
    --deny-self-hosted-runners
done
```

An attestation establishes build origin and file identity; it does not certify that the software has no bugs. Existing 0.2.0 release files and tags remain unchanged. See [GitHub's artifact attestation documentation](https://docs.github.com/en/actions/how-tos/secure-your-work/use-artifact-attestations/use-artifact-attestations).

## Manual release preparation

The Release workflow also supports a manual entry point for maintainers who cannot push a tag directly:

1. Merge the intended version and wait for the latest CI push run on that exact `main` commit to succeed.
2. Open Actions → Release → Run workflow, select `main`, and start the run.
3. The preparation job validates package identity, versions, descriptions, compatibility, current `main`, CI, and existing tags/releases. It creates the numeric tag from `manifest.version` at that exact commit, then explicitly dispatches Release on the tag.
4. Follow the separate tag-scoped Release run. It repeats all existing checks, verifies the exact version tag, signs and verifies all three assets, and publishes only after every gate passes.

Tag pushes made with `GITHUB_TOKEN` do not automatically trigger another workflow. The explicit tag dispatch is necessary and ensures provenance still identifies `refs/tags/<version>`, rather than the mutable `main` branch. The tag run skips preparation, so it cannot dispatch itself recursively.

Permissions are scoped by job. Preparation receives only `contents: write` to create the tag and `actions: write` to start the tag workflow. GitHub's Actions write permission is broader than dispatching one workflow; the preparation script limits its use to this repository's Release workflow. The token is short-lived and no personal token, new secret, or OAuth grant is stored. The release job retains its original `contents: write`, `id-token: write`, and `attestations: write` permissions; it does not receive Actions write access. Preparation installs no project dependencies.

Preparation runs only for a manual dispatch on this repository's `main`. Per-ref concurrency prevents overlapping runs. It validates the pnpm version pin and relies on the latest successful CI for the exact source SHA to confirm the frozen lockfile and full checks. It rechecks `main` immediately before writing. Existing tags are never moved: an identical tag may be reused after an interrupted attempt, while a conflicting tag stops the run. Any existing published or draft release stops preparation for inspection. A same-named branch is rejected, and dispatch always uses the fully qualified tag ref. An active or successful tag release run is reused instead of duplicated; completed runs must show a successful, non-skipped release job.

If an API request fails or times out after writing, inspect the tag and Actions runs before retrying; do not delete a tag or overwrite assets to recover. A rerun can reuse a matching tag after a confirmed failed dispatch. If `main` has advanced, start a fresh preparation run only after reviewing the new commit and its CI.

Run the isolated guard tests without installing dependencies:

```sh
node --test scripts/prepare-release.node.mjs
```

These fixtures cover input/context validation, CI gating, main-branch drift, release pagination, tag identity, duplicate-run avoidance, API failures, and safe interrupted-run recovery. They do not create real tags or releases.

## Validation limits

Passing CI does not guarantee community directory approval. The official action provides partial parity: published-release/build verification, private heuristics, and some behavioral/network checks remain with the authoritative directory review. This workflow does not run the directory's entire release service offline.

Before publishing a tooling or dependency migration, use **Review branch** in the Community management page with the final commit SHA. Require a completed source review, including dependency installation and all dependent checks. After publishing, use **Check for new releases** and verify the new version's actual directory review. A successful GitHub release alone is not evidence that the Community review passed. Version 0.2.3 exposed this gap: its GitHub checks passed, but Community could not install its source dependencies. The Community result does not disclose its runtime or installation stderr; local compatibility reproductions must not be presented as the server's exact diagnostic.

Browser-level CSS checks, mocked host tests, and mobile UI emulation do not replace testing in native Obsidian on desktop and physical mobile devices.

Sources: [official action inputs](https://github.com/obsidianmd/obsidian-workflows/blob/8167caed39664214d82c86fdfa32e06d8d55f61d/action.yml), [official scanner dependencies](https://github.com/obsidianmd/obsidian-workflows/blob/8167caed39664214d82c86fdfa32e06d8d55f61d/src/lint.ts), [directory FAQ](https://docs.obsidian.md/community-directory/faq).

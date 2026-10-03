# Release checks

Use Node.js 24 LTS and pnpm 11.7.0. `.node-version` selects the local and CI baseline; `package.json` pins pnpm and restricts the supported Node major. Every push and pull request runs a frozen dependency install, `pnpm audit --audit-level=low`, the project's full checks, and the official Obsidian review tooling. Tag releases repeat these checks before uploading release assets. A normal commit does not create a release.

## Local checks

```sh
pnpm install --frozen-lockfile
pnpm audit --audit-level=low
pnpm run check
```

`pnpm run check` runs TypeScript against the current and minimum Obsidian APIs, ESLint, Vitest, the release-gate and manual-release guard regression tests, a production build, and packaging checks. Source code must use Obsidian's DOM creation helpers; browser primitives are permitted only in test fixtures that supply those host helpers.

The test environment uses jsdom 28 to avoid the deprecated `whatwg-encoding` dependency. Project-scoped `allowBuilds` entries in `pnpm-workspace.yaml` approve only the reviewed `esbuild@0.28.2` and macOS `fsevents@2.3.3` installation scripts. `strictDepBuilds` rejects unreviewed scripts. Review these pins when upgrading either package. The workspace configuration also rejects unsupported Node versions, mismatched pnpm versions, and running scripts with stale dependencies; it does not automatically install another package manager. See [pnpm's build settings](https://pnpm.io/settings/build) and [CLI settings](https://pnpm.io/settings/cli).

`pnpm-lock.yaml` was imported from the npm lockfile with `pnpm import`. Keep it as the sole project lockfile, and use `pnpm install --frozen-lockfile` for reproducible installs. When switching an existing checkout from npm, move the old `node_modules` directory aside before installing with pnpm. CI installs the pinned pnpm version before restoring its store cache and running the frozen install; it does not cache `node_modules`.

The current and minimum Obsidian API packages still depend on Moment 2.29.4. The development dependency tree overrides it with the fixed version, 2.31.0, using `overrides` in `pnpm-workspace.yaml`. No Moment code is bundled into the plugin. Remove the override once the upstream packages no longer require it. See [Moment's security fix](https://github.com/moment/moment/security/advisories/GHSA-4p3w-j4w9-5jqw).

`eslint-plugin-obsidianmd@0.4.2` declares both an Obsidian 1.12.3 dependency and a conflicting 1.8.7 peer. A narrowly scoped override removes only that obsolete peer declaration, preserving the plugin's own 1.12.3 dependency from the npm lockfile. Review this override when upgrading the lint plugin. The project's current 1.13.1 API and aliased minimum 1.8.7 API checks remain separate.

## Official checks

The local composite action runs the bundle from [obsidianmd/obsidian-workflows](https://github.com/obsidianmd/obsidian-workflows) at commit `8167caed39664214d82c86fdfa32e06d8d55f61d` (v1.2.3), with the dependency-only patch in `scripts/patches/obsidian-scanner-moment.patch`. It uses `mode: pr`, `scanner-lint: true`, and `strict: true`. The upstream checkout is moved outside the project before scanning.

Before applying the patch, `scripts/patch-obsidian-scanner.mjs` verifies the original bundle's SHA-256. An upstream change or a previously patched bundle fails this check. The patch adds a Moment 2.31.0 override to the temporary scanner package and runs `npm audit --audit-level=low` after installation. Installation or audit failures make the scanner inconclusive, which the report gate rejects. The official rule definitions, severities, and configuration are unchanged. Bootstrap regression tests execute the actual patched function and cover successful installation, installation failure, and audit failure.

This runs upstream manifest, README/license, repository, dependency-policy, build, artifact-preflight, scanner ESLint, and scanner Stylelint checks. The scanners use the official configuration, independently of the project's ESLint configuration. No official findings are suppressed.

The pinned action detects the project's pnpm lockfile and uses pnpm for project installation and builds. Its separate temporary scanner dependency tree still uses npm with its own Moment override and audit; the project migration does not change that upstream bootstrap.

The upstream `validation-passed` output only rejects errors; it can still be true when scanner setup or execution is inconclusive. `scripts/verify-obsidian-review.mjs` therefore checks the official report in the same step. Missing, malformed, non-strict, incomplete, or inconclusive reports fail. Both scanners must finish without errors. Warnings remain visible in annotations and the report. Regression fixtures cover these outcomes and reject changed report catalogs. Review the report contract and fixtures together when upgrading the pinned action.

CI retains `contents: read`. Tag releases additionally use `contents: write` to publish assets, `id-token: write` for GitHub's short-lived signing identity, and `attestations: write` to upload build provenance. No personal signing key is required. The official review tool only performs read-only repository checks in this mode. These workflows do not change repository visibility or submit the plugin to the community directory.

## Upstream dependency notices

As of 2026-09-30, npm marks ESLint 9 as deprecated. The official Obsidian lint plugin depends on plugins whose declared peer ranges do not yet support ESLint 10, including `eslint-plugin-import`. This project retains the compatible ESLint 9 toolchain instead of overriding those peer requirements.

The pinned official action installs a separate scanner dependency tree using ESLint 9.37.0 and `eslint-plugin-obsidianmd` 0.4.1. Without the patch, its audit reports one moderate Moment vulnerability against three affected packages: `moment`, `obsidian`, and `eslint-plugin-obsidianmd`. The project's Moment override does not apply to that isolated installation. The scanner bootstrap patch now supplies its own `moment: 2.31.0` override, clearing all three audit entries, and rejects any new audit findings. npm output, including the remaining ESLint 9 deprecation notice, stays visible. Remove this patch once the official action provides a compatible fix; review the bundle hash, patch, bootstrap tests, and report gate together when updating upstream. The official action is at its latest release, v1.2.3, as of 2026-09-30.

On 2026-10-03, local validation of the pinned action found that the separate Stylelint dependency tree fails its audit because of [GHSA-vfj7-8cjw-p6xm in braces](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm), which currently lists no patched version. npm reports six high-severity affected entries along that dependency chain. The scanner therefore remains inconclusive and the report gate blocks CI/release, even though the project's pnpm audit and official scanner ESLint pass. The pnpm migration retains the audit threshold and scanner versions; it does not apply npm's suggested breaking Stylelint downgrade.

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

Browser-level CSS checks, mocked host tests, and mobile UI emulation do not replace testing in native Obsidian on desktop and physical mobile devices.

Sources: [official action inputs](https://github.com/obsidianmd/obsidian-workflows/blob/8167caed39664214d82c86fdfa32e06d8d55f61d/action.yml), [official scanner dependencies](https://github.com/obsidianmd/obsidian-workflows/blob/8167caed39664214d82c86fdfa32e06d8d55f61d/src/lint.ts), [directory FAQ](https://docs.obsidian.md/community-directory/faq).

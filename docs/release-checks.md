# Release checks

Use Node.js 24 or later. Every push and pull request runs a clean dependency install, `npm audit`, the project's full checks, and the official Obsidian review tooling. Tag releases repeat these checks before uploading release assets. A normal commit does not create a release.

## Local checks

```sh
npm ci
npm audit
npm run check
```

`npm run check` runs TypeScript against the current and minimum Obsidian APIs, ESLint, Vitest, the release-gate regression tests, a production build, and packaging checks. Source code must use Obsidian's DOM creation helpers; browser primitives are permitted only in test fixtures that supply those host helpers.

The test environment uses jsdom 28 to avoid the deprecated `whatwg-encoding` dependency. Project-scoped `.npmrc` entries approve only the reviewed `esbuild@0.28.2` and macOS `fsevents@2.3.3` installation scripts, independently of user-wide npm settings. Review these pins when upgrading either package.

The current and minimum Obsidian API packages still depend on Moment 2.29.4. The development dependency tree overrides it with the fixed version, 2.31.0. No Moment code is bundled into the plugin. Remove the override once the upstream packages no longer require it. See [Moment's security fix](https://github.com/moment/moment/security/advisories/GHSA-4p3w-j4w9-5jqw).

## Official checks

The local composite action runs the bundle from [obsidianmd/obsidian-workflows](https://github.com/obsidianmd/obsidian-workflows) at commit `8167caed39664214d82c86fdfa32e06d8d55f61d` (v1.2.3), with the dependency-only patch in `scripts/patches/obsidian-scanner-moment.patch`. It uses `mode: pr`, `scanner-lint: true`, and `strict: true`. The upstream checkout is moved outside the project before scanning.

Before applying the patch, `scripts/patch-obsidian-scanner.mjs` verifies the original bundle's SHA-256. An upstream change or a previously patched bundle fails this check. The patch adds a Moment 2.31.0 override to the temporary scanner package and runs `npm audit --audit-level=low` after installation. Installation or audit failures make the scanner inconclusive, which the report gate rejects. The official rule definitions, severities, and configuration are unchanged. Bootstrap regression tests execute the actual patched function and cover successful installation, installation failure, and audit failure.

This runs upstream manifest, README/license, repository, dependency-policy, build, artifact-preflight, scanner ESLint, and scanner Stylelint checks. The scanners use the official configuration, independently of the project's ESLint configuration. No official findings are suppressed.

The upstream `validation-passed` output only rejects errors; it can still be true when scanner setup or execution is inconclusive. `scripts/verify-obsidian-review.mjs` therefore checks the official report in the same step. Missing, malformed, non-strict, incomplete, or inconclusive reports fail. Both scanners must finish without errors. Warnings remain visible in annotations and the report. Regression fixtures cover these outcomes and reject changed report catalogs. Review the report contract and fixtures together when upgrading the pinned action.

CI retains `contents: read`; tag releases retain `contents: write`. The official tool only uses the existing token for read-only repository checks in this mode. These workflows do not change repository visibility or submit the plugin to the community directory.

## Upstream dependency notices

As of 2026-09-30, npm marks ESLint 9 as deprecated. The official Obsidian lint plugin depends on plugins whose declared peer ranges do not yet support ESLint 10, including `eslint-plugin-import`. This project retains the compatible ESLint 9 toolchain instead of overriding those peer requirements.

The pinned official action installs a separate scanner dependency tree using ESLint 9.37.0 and `eslint-plugin-obsidianmd` 0.4.1. Without the patch, its audit reports one moderate Moment vulnerability against three affected packages: `moment`, `obsidian`, and `eslint-plugin-obsidianmd`. The project's Moment override does not apply to that isolated installation. The scanner bootstrap patch now supplies its own `moment: 2.31.0` override, clearing all three audit entries, and rejects any new audit findings. npm output, including the remaining ESLint 9 deprecation notice, stays visible. Remove this patch once the official action provides a compatible fix; review the bundle hash, patch, bootstrap tests, and report gate together when updating upstream. The official action is at its latest release, v1.2.3, as of 2026-09-30.

## Packaging and release

`npm run check:package` checks the plugin identity, matching package/lockfile/manifest versions and descriptions, the compatibility mapping, and non-empty `main.js`, `manifest.json`, and `styles.css` assets. When `RELEASE_TAG` is set, it must exactly match the manifest version, without a `v` prefix.

**Section Reader 0.2.0** uses the plugin ID `section-reader`. Historical 0.1.2 assets use the older Focus Cards identity; do not reuse that tag. Push a validated version tag only when releasing is authorized. The tag workflow uploads all three assets after the checks pass.

## Limits and remaining acceptance

Passing CI does not guarantee community directory approval. The official action provides partial parity: published-release/build verification, private heuristics, and some behavioral/network checks remain with the authoritative directory review. This workflow does not run the directory's entire release service offline.

The [0.2.0 acceptance record](release-acceptance-0.2.0.md) covers a disposable vault in native Obsidian on macOS and its mobile UI emulation. Physical iOS/Android devices and old Focus Cards reading-progress migration were not tested. The new plugin ID installs separately from Focus Cards; do not enable both identities together. Browser-level CSS checks and mocked host tests do not replace native Obsidian acceptance.

Sources: [official action inputs](https://github.com/obsidianmd/obsidian-workflows/blob/8167caed39664214d82c86fdfa32e06d8d55f61d/action.yml), [official scanner dependencies](https://github.com/obsidianmd/obsidian-workflows/blob/8167caed39664214d82c86fdfa32e06d8d55f61d/src/lint.ts), [directory FAQ](https://docs.obsidian.md/community-directory/faq).

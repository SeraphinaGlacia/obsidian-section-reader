# Release checks

Every push (all branches) and pull request runs the existing typechecks, ESLint, tests and production build, packaging checks, and the official Obsidian review tooling. Tag releases repeat these checks before the existing release-upload step. A normal commit does not create a release.

## Official checks

The local composite action runs the unmodified bundle from [obsidianmd/obsidian-workflows](https://github.com/obsidianmd/obsidian-workflows) at commit `8167caed39664214d82c86fdfa32e06d8d55f61d`, the signed `v1` tag inspected on 2026-09-30 (action version 1.2.3). It uses `mode: pr`, `scanner-lint: true` and `strict: true`. The upstream checkout is moved outside the project before scanning.

This runs the upstream manifest, README/license, repository, dependency-policy, build, artifact-preflight, scanner ESLint and scanner Stylelint checks. It deliberately does not use this project's ESLint overrides as the scanner configuration. No lint findings are suppressed by this integration.

The upstream `validation-passed` output only rejects errors; it can still be true when scanner setup/execution is inconclusive. The small `verify-obsidian-review.mjs` gate therefore checks the pinned official report in the same step. Missing, malformed, non-strict or inconclusive reports fail. Both source and stylesheet scanners must complete without errors. Official warnings remain warnings, are visible in annotations and the report, and are not suppressed. Regression fixtures cover success, errors, inconclusive/missing scanners, warnings and changed report catalogs. When upgrading the upstream commit, review the report contract and fixtures together; format drift fails closed.

The workflow keeps its existing permission scopes: CI has `contents: read`; tag release has `contents: write`. There are no new secrets, identity-token grants, attestations or directory submissions. The official tool only uses the provided token for read-only repository checks in this mode.

## Packaging gate

`npm run check:package` checks the intended plugin identity, matching package/lockfile/manifest versions and descriptions, the compatibility mapping, and non-empty `main.js`, `manifest.json`, `styles.css` assets. With `RELEASE_TAG` set, the tag must exactly equal the manifest version, without a `v` prefix. These are project-specific checks, not a claim to reproduce Obsidian's private rules.

The published 0.1.2 artifacts remain the older Focus Cards identity. Do not reuse that tag for Section Reader. Choose and validate a new version only when preparing an authorized release, and follow [the migration guide](migration.md).

## Limits

Passing CI does not guarantee directory approval. The upstream action explicitly describes partial parity: published-release/build verification, private heuristics and some behavioral/network checks remain with the authoritative directory review. This integration runs the official check-mode tools against the current production build before upload; it does not claim to run the directory's entire release service offline. Native Obsidian UI, real-device mobile behavior and old-install migration still require separate testing.

Sources: [official action inputs](https://github.com/obsidianmd/obsidian-workflows/blob/8167caed39664214d82c86fdfa32e06d8d55f61d/action.yml), [official coverage/report behavior](https://github.com/obsidianmd/obsidian-workflows/blob/8167caed39664214d82c86fdfa32e06d8d55f61d/src/summary.ts), [directory FAQ](https://docs.obsidian.md/community-directory/faq).

## Continue in Codex Desktop

The release-preparation branch is `chore/section-reader-release-checks` in `https://github.com/SeraphinaGlacia/obsidian-section-reader`. Clone that repository, or update an existing checkout's origin to that URL, then fetch and check out the branch. Preserve any local work before switching. This prepares version **0.2.0**, which has not been tagged or released; the published historical releases are intentionally retained.

Use Node.js 24, then run:

```sh
npm ci
npm run check
npm audit
```

The official scanner additionally runs in GitHub CI. Inspect its annotations and job summary on the exact commit before merging or tagging. The baseline review has **zero errors and 16 warnings**: 12 `prefer-create-el` warnings in `src/focus-cards-view.ts` and `src/render-dom.ts`, and four `declaration-no-important` warnings in `styles.css`. These implementation/style findings remain unchanged and visible. Address them only as a separately reviewed implementation change.

Development dependency remediation updates brace-expansion, fast-uri, js-yaml and the Obsidian ESLint package within compatible ranges. The current and minimum Obsidian API declarations still pin vulnerable Moment 2.29.4, so an exact `moment: 2.31.0` override is used for the development tree. Remove it when upstream declarations no longer need it. The minimum API remains 1.8.7. No Moment code is bundled, and the production `main.js` is byte-identical to the pre-remediation build. The official action installs its own isolated, upstream-pinned scanner dependencies; that separate install currently reports three moderate Moment-chain advisories even though this project’s lockfile audit is clean. This branch does not rewrite the official scanner or hide its installation output. See [Moment's security fix](https://github.com/moment/moment/security/advisories/GHSA-4p3w-j4w9-5jqw).

Before publication:

- Review and merge the preparation PR only when authorized; do not reuse the existing 0.1.2 tag
- Test the new installation and [old-install migration](migration.md) in a disposable vault, plus available physical mobile devices
- Make repository visibility and directory submission decisions explicitly; neither is changed by this branch
- When release authorization is given, tag the validated 0.2.0 commit; the tag workflow gates asset upload on the checks above
- Submit/review the new identity through the current Obsidian Community directory and resolve any authoritative online findings

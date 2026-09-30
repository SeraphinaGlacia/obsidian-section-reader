# AGENTS.md

## Scope

This file defines repository-specific instructions for agents working on **Section Reader**.

General Git commit mechanics are intentionally kept outside this repository. When available, use the maintainer's `classic-commits` skill for commit decomposition, staging strategy, Conventional Commit type and scope selection, commit-message construction, and commit execution.

Repository-specific instructions in this file take precedence when they conflict with general commit guidance.

## Repository language

Use English for repository-facing engineering artifacts, including:

- branch names;
- commit subjects and bodies;
- pull request titles and descriptions;
- issue titles and descriptions;
- release notes;
- repository metadata;
- code identifiers and code comments;
- non-localized technical documentation.

Chinese is appropriate when it is the intended localized output, including:

- `README.zh-CN.md`;
- Chinese user-interface strings;
- localization-specific examples, fixtures, or screenshots.

Conversation with the maintainer may use the maintainer's preferred language. Before writing repository-facing artifacts, convert the final text to English.

Avoid mixed-language commit messages, PR titles, and PR descriptions. Proper nouns, API names, code symbols, file paths, and quoted interface labels may remain in their original form.

Historical Git metadata does not need to be rewritten solely to satisfy the current language policy.

## Documentation and localization

- `README.md` is the English public entry point.
- `README.zh-CN.md` is the maintained Simplified Chinese counterpart.
- When user-facing behavior, requirements, installation instructions, commands, screenshots, examples, or links change, keep both READMEs semantically aligned.
- Keep user-visible terminology consistent between documentation and localization strings.
- Keep product identity and descriptions aligned across applicable repository metadata such as `manifest.json`, `package.json`, README files, and release-facing documentation.

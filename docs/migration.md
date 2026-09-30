# Migrate from Focus Cards to Section Reader

The development version uses the plugin ID `section-reader` and installation folder `.obsidian/plugins/section-reader/`. The published 0.1.2 release still uses `focus-cards`. Do not rename the directory of an old release without also installing a matching manifest.

Changing the manifest ID is a new plugin identity to Obsidian. There is no automatic migration in this change. The plugin implementation, view type, command suffixes and saved-data format are unchanged.

## Existing manual installations

1. Back up the vault's `.obsidian` directory, including `.obsidian/plugins/focus-cards/data.json` if it exists.
2. Disable Focus Cards. Close its reader tabs, then quit Obsidian completely.
3. Build this checkout (see the README), or use a new Section Reader release when available. Create `.obsidian/plugins/section-reader/` and install its matching `main.js`, `manifest.json` and `styles.css` together.
4. With Obsidian still closed, copy the old `data.json` into the new plugin directory. This preserves the existing reading-progress data without modifying Markdown notes. Keep the old backup until verification is complete.
5. Restart Obsidian and enable Section Reader. Leave Focus Cards disabled; never enable both identities together because they share internal view and hover-link identifiers.
6. Reopen a note, check its saved reading position, and reassign any plugin hotkeys in Settings. Obsidian prefixes command IDs with the manifest ID, so old `focus-cards:` hotkeys do not automatically become `section-reader:` hotkeys.

If you need to roll back, disable Section Reader, quit Obsidian, restore the old installation and its backup, then re-enable Focus Cards. Do not remove either backup while validating the migration.

This is a migration procedure, not a claim that native desktop or mobile migration has already been tested. Release preparation must include a disposable-vault test before publishing the new identity. If the old ID has been listed in the official directory, coordinate the identifier change with Obsidian first; directory identifiers cannot be changed by editing the manifest alone.

Reference: [Obsidian directory identifier guidance](https://docs.obsidian.md/community-directory/faq).

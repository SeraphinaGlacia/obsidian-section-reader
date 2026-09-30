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

## Bounded desktop verification

On 2026-09-30, a disposable synthetic vault was tested in Obsidian 1.13.7 for Linux. The old-ID build from commit `41343cf` (manifest `focus-cards`) saved the third card as index `2`. With Obsidian closed, the configuration was backed up, its `data.json` was copied byte-for-byte to the candidate 0.2.0 `section-reader` installation, and only the new identity was enabled. After restart, the new toggle command reopened the expected third card, **Bring it together**. The synthetic Markdown note remained byte-identical.

The old `focus-cards:toggle-card-view` hotkey no longer toggled the reader; a deliberately reassigned `section-reader:toggle-card-view` binding did. Neither identity was enabled alongside the other.

This verifies the old-ID build-to-candidate migration, not a migration from downloaded release assets. The old-ID build already contained the Section Reader display name. Physical mobile devices, other desktop platforms, and Obsidian 1.8.7 were not tested in this migration check. If the old ID has been listed in the official directory, coordinate the identifier change with Obsidian first; directory identifiers cannot be changed by editing the manifest alone.


Reference: [Obsidian directory identifier guidance](https://docs.obsidian.md/community-directory/faq).

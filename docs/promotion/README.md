# Community listing artwork

The five final images use one SVG template and original screenshots of Section Reader 0.2.1 running in Obsidian 1.13.7 on macOS. The screenshots contain synthetic notes from this directory; no personal-vault content is included.

The SVG files contain editable text, vector framing, and embedded PNG screenshots. Screenshot pixels are uniformly scaled and clipped, never reconstructed. The exported PNGs are the files uploaded to the [community listing](https://community.obsidian.md/plugins/section-reader).

## Gallery

| Order | Feature | Editable source | Store image |
| --- | --- | --- | --- |
| 1 | Focus on one section | [SVG](../media/promotion/01-one-idea.svg) | [PNG](../media/promotion/01-one-idea.png) |
| 2 | Split the view with `---` | [SVG](../media/promotion/02-clear-sections.svg) | [PNG](../media/promotion/02-clear-sections.png) |
| 3 | Native embeds, callouts, and tasks | [SVG](../media/promotion/03-native-notes.svg) | [PNG](../media/promotion/03-native-notes.png) |
| 4 | Outline, links, and footnotes | [SVG](../media/promotion/04-stay-connected.svg) | [PNG](../media/promotion/04-stay-connected.png) |
| 5 | Saved reading progress | [SVG](../media/promotion/05-reading-progress.svg) | [PNG](../media/promotion/05-reading-progress.png) |

## Shared design

- Canvas: **1200 × 800**, with a matching SVG `viewBox` and 3:2 aspect ratio.
- Typeface: **Arial**, with Helvetica and sans-serif fallbacks; headings 54 px, subtitles 20 px, labels 12 px, footer text 13 px.
- Colors: warm white `#F6F4F0`, near-black `#1B1920`, muted gray `#68636F`, lavender `#8861D8`.
- Layout: 48 px horizontal margins, shared text baselines, 12 px screenshot corners, and the same border and shadow.

## Rebuild

Edit the shared `theme` or per-image copy and crops in [render.mjs](render.mjs), then run it with Node.js and an available installation of `sharp`:

```sh
node docs/promotion/render.mjs
```

For a separately installed rendering environment, `PROMOTION_SHARP_MODULE` can point to its Sharp module entry point. This optional artwork tool does not add dependencies to the plugin build or production bundle.

The script writes all five SVG/PNG pairs and [export-manifest.json](export-manifest.json). It checks dimensions and the listing's 5 MB file limit. All screenshots are embedded in the SVG files, so moving an SVG does not break its images. Keep Arial available when editing or exporting live SVG text; the PNG exports already have fixed typography.

## Capture evidence

Original, uncropped screenshots are preserved in [screenshots](screenshots/). They were captured from the isolated project test vault with the public 0.2.1 artifacts. The main JavaScript file had SHA-256 `f7ad963bb103fb0ca9b0a4d6ec87c5817eea743e9f99793c24c43126dc42b0ac`.

The second image uses [Two ideas.md](Two%20ideas.md): one source note on the left, with its two actual section views stacked on the right. The `1/2` and `2/2` counters are crops from those same captures, enlarged and placed at the bottom right of each frame. These are two successive views of one note, not a simultaneous two-card layout in the plugin.

The capture session checked heading-link navigation, an Outline jump to another card, rendered callouts and an embedded note, task rendering, and a Reading-view round trip that restored card `4/4`. The app's developer error log reported no captured errors. These are desktop screenshots; no physical mobile-device test is implied.

For new captures, put `vault=<name>` **before the command**, as required by the [Obsidian CLI](https://help.obsidian.md/cli), and verify the returned vault name immediately before each operation. For example: `obsidian vault=section-reader-release-test vault info=name`. A trailing `vault=` argument does not reliably target the intended vault.

The final SVG/PNG assets are deterministic compositions of the preserved screenshots. Earlier image-generation drafts are not used in the published gallery.

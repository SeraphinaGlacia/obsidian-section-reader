# Community listing artwork

[render.mjs](render.mjs) builds five community listing images from the original PNGs in [screenshots](screenshots/). These source screenshots show synthetic notes in Section Reader; they are required to regenerate the artwork.

## Regenerate

Edit the shared `theme` or per-image copy and crops in [render.mjs](render.mjs), then run it with Node.js and an available installation of `sharp`:

```sh
node docs/promotion/render.mjs
```

For a separately installed rendering environment, set `PROMOTION_SHARP_MODULE` to its Sharp module entry point. Keep Arial available for the SVG text. This optional tool does not add dependencies to the plugin build.

The script writes five SVG/PNG pairs to `docs/media/promotion/` and an export summary to `docs/promotion/export-manifest.json`. These generated files are ignored by Git. Each image is 1200 × 800 pixels, and PNG exports must be smaller than 5 MB.

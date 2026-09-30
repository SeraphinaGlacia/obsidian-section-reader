import { createRequire } from "node:module";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const sharp = require(process.env.PROMOTION_SHARP_MODULE || "sharp");
const output = new URL("../media/promotion/", import.meta.url);
const source = new URL("./screenshots/", import.meta.url);
await mkdir(output, { recursive: true });

// All five designs use the same canvas, typography, colors and spacing.
const theme = {
  width: 1200,
  height: 800,
  font: "Arial, Helvetica, sans-serif",
  background: "#F6F4F0",
  ink: "#1B1920",
  muted: "#68636F",
  accent: "#8861D8",
  border: "#D8D3DE",
  screen: "#1E1E1E",
  margin: 48,
  headingSize: 54,
  subtitleSize: 20,
  labelSize: 12,
  footerSize: 13,
  frameY: 224,
  frameHeight: 504,
  radius: 12,
};

const files = [
  "01-focus.png",
  "02-two-ideas-source.png",
  "03-native-markdown.png",
  "04-navigation.png",
  "05-progress.png",
];
const cardFiles = ["02-card-one.png", "02-card-two.png"];
const images = new Map();
for (const file of [...files, ...cardFiles]) {
  const bytes = await readFile(new URL(file, source));
  const { width, height } = await sharp(bytes).metadata();
  images.set(file, { width, height, href: `data:image/png;base64,${bytes.toString("base64")}` });
}

const escapeXml = (value) => String(value).replace(/[&<>"']/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;",
})[character]);

function text(x, y, value, size, weight = 400, color = theme.ink, extra = "") {
  return `<text x="${x}" y="${y}" font-size="${size}" font-weight="${weight}" fill="${color}" ${extra}>${escapeXml(value)}</text>`;
}

function screenshot(id, file, box, crop, { shadow = true, radius = theme.radius } = {}) {
  const image = images.get(file);
  const scale = Math.min(box.width / crop.width, box.height / crop.height);
  const visibleWidth = crop.width * scale;
  const visibleHeight = crop.height * scale;
  // Clip and uniformly scale the original screenshot; never redraw its interface.
  return `<defs>
      <clipPath id="${id}-frame"><rect x="${box.x}" y="${box.y}" width="${box.width}" height="${box.height}" rx="${radius}"/></clipPath>
      <clipPath id="${id}-crop"><rect x="${box.x}" y="${box.y}" width="${visibleWidth}" height="${visibleHeight}"/></clipPath>
    </defs>
    <rect x="${box.x}" y="${box.y}" width="${box.width}" height="${box.height}" rx="${radius}" fill="${theme.screen}" ${shadow ? 'filter="url(#shadow)"' : ""}/>
    <g clip-path="url(#${id}-frame)"><g clip-path="url(#${id}-crop)">
      <image x="${box.x - crop.x * scale}" y="${box.y - crop.y * scale}" width="${image.width * scale}" height="${image.height * scale}" href="${image.href}"/>
    </g></g>
    <rect x="${box.x + 0.5}" y="${box.y + 0.5}" width="${box.width - 1}" height="${box.height - 1}" rx="${radius}" fill="none" stroke="#37343D" stroke-width="1"/>`;
}

const frame = { x: theme.margin, y: theme.frameY, width: 1104, height: theme.frameHeight };
const wideCrop = { x: 80, y: 70, width: 2320, height: 1059 };
const pages = [
  {
    slug: "01-one-idea",
    title: "One idea at a time.",
    subtitle: "Turn a long Markdown note into a focused reading view.",
    label: "FOCUSED READING",
    footer: "Keep every section in one connected Markdown file.",
    content: () => screenshot("focus", files[0], frame, wideCrop),
  },
  {
    slug: "02-clear-sections",
    title: "One note. Clear sections.",
    subtitle: "Add --- between ideas. Keep everything in one Markdown file.",
    label: "MARKDOWN SOURCE",
    footer: "A divider on its own line starts the next section.",
    content: () => {
      const left = { x: 48, y: 224, width: 500, height: 504 };
      const cardCrop = { x: 100, y: 190, width: 1340, height: 460 };
      const counterCrop = { x: 1328, y: 1524, width: 104, height: 65 };
      const cards = cardFiles.map((file, index) => {
        const y = 224 + index * 264;
        return screenshot(`section-${index}`, file, { x: 652, y, width: 500, height: 240 }, cardCrop)
          + screenshot(`section-counter-${index}`, file, { x: 1072, y: y + 190, width: 64, height: 40 }, counterCrop, { shadow: false, radius: 6 });
      }).join("");
      return screenshot("source", files[1], left, { x: 100, y: 190, width: 1340, height: 1350 })
        + cards
        + text(652, 207, "SECTION READER", theme.labelSize, 700, theme.muted, 'letter-spacing="1.4"')
        + `<path d="M 574 476 H 626 M 615 465 L 626 476 L 615 487" fill="none" stroke="${theme.accent}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`
        + `<rect x="61" y="377" width="40" height="26" rx="6" fill="none" stroke="${theme.accent}" stroke-width="2"/>`;
    },
  },
  {
    slug: "03-native-notes",
    title: "Your notes still work.",
    subtitle: "Keep native callouts, embedded notes, and interactive checkboxes.",
    label: "NATIVE MARKDOWN",
    footer: "Checking a task updates the original Markdown.",
    content: () => screenshot("native", files[2], frame, wideCrop),
  },
  {
    slug: "04-stay-connected",
    title: "Stay connected as you read.",
    subtitle: "Jump through headings, links, and footnotes without losing context.",
    label: "OUTLINE AND LINKS",
    footer: "Navigate within the note while staying in section view.",
    content: () => screenshot("navigation", files[3], frame, { x: 80, y: 80, width: 1968, height: 898 }),
  },
  {
    slug: "05-reading-progress",
    title: "Pick up where you left off.",
    subtitle: "Re-enter from Reading view to resume your last section.",
    label: "READING PROGRESS",
    footer: "Your last section is saved. Editing view starts at the cursor.",
    content: () => screenshot("progress", files[4], frame, { x: 80, y: 180, width: 1968, height: 898 })
      + text(994, 771, "SAVED SECTION", theme.labelSize, 700, theme.muted, 'text-anchor="end" letter-spacing="0.8"')
      + screenshot("counter", files[4], { x: 1012, y: 742, width: 80, height: 50 }, { x: 1328, y: 1524, width: 104, height: 65 }, { shadow: false, radius: 6 }),
  },
];

const manifest = [];
for (const [index, page] of pages.entries()) {
  const count = `${String(index + 1).padStart(2, "0")} / 05`;
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${theme.width}" height="${theme.height}" viewBox="0 0 ${theme.width} ${theme.height}" role="img" aria-labelledby="title description">
  <title id="title">Section Reader — ${escapeXml(page.title)}</title>
  <desc id="description">${escapeXml(page.subtitle)} Original Obsidian 1.13.7 screenshots of Section Reader 0.2.1, with editable SVG typography and framing.</desc>
  <defs><filter id="shadow" x="-10%" y="-10%" width="120%" height="130%"><feDropShadow dx="0" dy="5" stdDeviation="7" flood-color="#20172E" flood-opacity="0.12"/></filter></defs>
  <rect width="1200" height="800" fill="${theme.background}"/>
  <g font-family="${theme.font}">
    ${text(48, 50, "SECTION READER", 14, 700, theme.accent, 'letter-spacing="2.2"')}
    ${text(1152, 50, count, 14, 400, theme.muted, 'text-anchor="end" letter-spacing="1.2"')}
    ${text(48, 122, page.title, theme.headingSize, 700, theme.ink, 'letter-spacing="-1.6"')}
    ${text(48, 166, page.subtitle, theme.subtitleSize, 400, theme.muted)}
    ${text(48, 207, page.label, theme.labelSize, 700, theme.muted, 'letter-spacing="1.4"')}
    ${page.content()}
    ${text(48, 771, page.footer, theme.footerSize, 400, theme.muted)}
  </g>
</svg>
`;
  await writeFile(new URL(`${page.slug}.svg`, output), svg);
  const png = await sharp(Buffer.from(svg), { density: 72 }).png({ compressionLevel: 9 }).toBuffer();
  const metadata = await sharp(png).metadata();
  if (metadata.width !== theme.width || metadata.height !== theme.height || png.length >= 5_000_000) {
    throw new Error(`Invalid listing image: ${page.slug}`);
  }
  await writeFile(new URL(`${page.slug}.png`, output), png);
  manifest.push({ slug: page.slug, title: page.title, width: metadata.width, height: metadata.height, bytes: png.length });
}
await writeFile(new URL("export-manifest.json", import.meta.url), `${JSON.stringify({ theme, images: manifest }, null, 2)}\n`);
process.stdout.write(`Exported ${manifest.length} SVG/PNG pairs to ${fileURLToPath(output)}\n`);
process.stdout.write(`${JSON.stringify(manifest, null, 2)}\n`);

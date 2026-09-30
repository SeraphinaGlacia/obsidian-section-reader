import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

// obsidianmd/obsidian-workflows v1.2.3, commit 8167caed39664214d82c86fdfa32e06d8d55f61d.
// Review this hash and the dependency-only patch together when updating upstream.
const upstreamDigest = "0cefb01db0012943ac14b67e1f19b780a73a104aa3ab34b908ddc44bd82b49c1";
const actionDir = process.argv[2];
if (!actionDir) throw new Error("Pass the pinned official action checkout directory");

const bundle = readFileSync(resolve(actionDir, "dist/index.js"));
const digest = createHash("sha256").update(bundle).digest("hex");
if (digest !== upstreamDigest) {
  throw new Error("Official action bundle changed; review the scanner dependency patch before updating its pin");
}

const patch = fileURLToPath(new URL("./patches/obsidian-scanner-moment.patch", import.meta.url));
execFileSync("git", ["-C", actionDir, "apply", "--check", patch], { stdio: "inherit" });
execFileSync("git", ["-C", actionDir, "apply", patch], { stdio: "inherit" });
process.stdout.write("Applied scanner dependency patch: Moment 2.31.0 and npm audit; official rules unchanged.\n");

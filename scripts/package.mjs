#!/usr/bin/env node
// Packages the plugin into dist/<name>-<version>-darwin.zip, the asset name
// Lithe Store's release tracker recognizes (docs/publishing.md there).
//
// The package is a single plugin.json: it only declares how Lithe starts the
// user's own lldb-dap, so it carries no executable and one archive serves
// every Mac. Nothing is downloaded at build or install time.
//
// Usage: node scripts/package.mjs [--expect-tag <tag>]

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";

const PACKAGE_DIR = "io.github.lithe-idea.lldb-debug";
const ASSET_PREFIX = "lldb-debug";
const PLATFORM = "darwin";

const manifest = JSON.parse(readFileSync(`${PACKAGE_DIR}/plugin.json`, "utf8"));
const problems = [];
if (manifest.id !== PACKAGE_DIR) problems.push(`plugin.json id ${manifest.id} must equal the directory ${PACKAGE_DIR}`);
if (!/^[0-9]+\.[0-9]+\.[0-9]+$/.test(manifest.version)) problems.push(`version ${manifest.version} is not MAJOR.MINOR.PATCH`);
if (manifest.vendor?.signatureRequirement !== "none") problems.push('vendor.signatureRequirement must be "none"');
if (manifest.id === "dev.lithe" || manifest.id.startsWith("dev.lithe.")) problems.push("dev.lithe.* is reserved for official plugins");
// A package that works only on its author's machine is a packaging mistake.
if (/\/Users\/|\/home\//.test(JSON.stringify(manifest))) problems.push("plugin.json contains a personal absolute path");

const tagFlag = process.argv.indexOf("--expect-tag");
if (tagFlag >= 0) {
  const tag = process.argv[tagFlag + 1];
  if (tag !== `v${manifest.version}`) problems.push(`tag ${tag} does not match plugin.json version ${manifest.version} (expected v${manifest.version})`);
}
if (problems.length > 0) {
  for (const problem of problems) console.error(`✗ ${problem}`);
  process.exit(1);
}

const sha256 = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");

rmSync("dist", { recursive: true, force: true });
mkdirSync("dist", { recursive: true });
const asset = resolve("dist", `${ASSET_PREFIX}-${manifest.version}-${PLATFORM}.zip`);
// -X drops extra file attributes; -y stores a symbolic link as a link so
// Lithe refuses it instead of the archive silently carrying its target.
execFileSync("zip", ["-qrXy", asset, PACKAGE_DIR, "-x", "*.DS_Store"]);
if (readdirSync("dist").length !== 1) throw new Error("dist must contain exactly the one archive");
console.log(`dist/${ASSET_PREFIX}-${manifest.version}-${PLATFORM}.zip ${sha256(asset)}`);

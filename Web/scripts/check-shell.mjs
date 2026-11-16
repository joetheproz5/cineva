import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const index = fs.readFileSync(path.join(webRoot, "index.html"), "utf8");
const worker = fs.readFileSync(path.join(webRoot, "service-worker.js"), "utf8");
const shellAssets = new Set();

for (const listName of ["SHELL", "SECURITY_SHELL", "PRIVACY_SHELL"]) {
  const match = worker.match(new RegExp(`const\\s+${listName}\\s*=\\s*\\[([\\s\\S]*?)\\]\\s*;`));
  if (!match) throw new Error(`Could not find ${listName} in service-worker.js`);
  for (const asset of match[1].matchAll(/"([^"\n]+)"/g)) shellAssets.add(asset[1]);
}

const references = new Set();
for (const match of index.matchAll(/<link\b[^>]*\brel="stylesheet"[^>]*\bhref="([^"]+)"[^>]*>/gi)) references.add(match[1]);
for (const match of index.matchAll(/<script\b[^>]*\bsrc="([^"]+)"[^>]*>/gi)) references.add(match[1]);

const missing = [];
for (const reference of references) {
  const url = new URL(reference, "https://seven.invalid/");
  if (url.origin !== "https://seven.invalid") continue;
  const relative = decodeURIComponent(url.pathname.replace(/^\//, ""));
  const localPath = path.resolve(webRoot, relative);
  if (!localPath.startsWith(`${webRoot}${path.sep}`) || !fs.existsSync(localPath)) {
    missing.push(`${reference} (file missing)`);
  }
  if (!shellAssets.has(reference)) missing.push(`${reference} (not precached)`);
}

if (missing.length) {
  console.error(`Shell asset check failed:\n${[...new Set(missing)].map(item => `- ${item}`).join("\n")}`);
  process.exitCode = 1;
} else {
  console.log(`Shell asset check passed: ${references.size} stylesheet and script references exist and are precached.`);
}

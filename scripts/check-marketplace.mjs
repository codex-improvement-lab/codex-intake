import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { hashMarketplaceContent } from "./prepare-marketplace.mjs";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const marketplacePath = path.join(projectRoot, ".agents", "plugins", "marketplace.json");
const packageRoot = path.join(projectRoot, "plugins", "codex-intake");
const failures = [];

function fail(message) {
  failures.push(message);
}

async function fileCount(directory) {
  let count = 0;
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const candidate = path.join(directory, entry.name);
    if (entry.isDirectory()) count += await fileCount(candidate);
    else count += 1;
  }
  return count;
}

const marketplace = JSON.parse(await readFile(marketplacePath, "utf8"));
if (marketplace.name !== "codex-intake-local") fail("Marketplace name must be codex-intake-local.");
if (marketplace.interface?.displayName !== "Codex Intake Local") {
  fail("Marketplace display name must be Codex Intake Local.");
}

const entries = Array.isArray(marketplace.plugins) ? marketplace.plugins : [];
const entry = entries.find((candidate) => candidate?.name === "codex-intake");
if (!entry) {
  fail("Marketplace entry codex-intake is missing.");
} else {
  if (entry.source?.source !== "local" || entry.source?.path !== "./plugins/codex-intake") {
    fail("Marketplace source must be local at ./plugins/codex-intake.");
  }
  if (entry.policy?.installation !== "AVAILABLE") fail("Installation policy must be AVAILABLE.");
  if (entry.policy?.authentication !== "ON_INSTALL") fail("Authentication policy must be ON_INSTALL.");
  if (entry.category !== "Productivity") fail("Marketplace category must be Productivity.");
}

const packageRelative = path.relative(projectRoot, packageRoot);
if (path.isAbsolute(packageRelative) || packageRelative.startsWith("..")) {
  fail("Marketplace package resolves outside the repository.");
}

const sourceManifest = JSON.parse(
  await readFile(path.join(projectRoot, ".codex-plugin", "plugin.json"), "utf8")
);
const packagedManifest = JSON.parse(
  await readFile(path.join(packageRoot, ".codex-plugin", "plugin.json"), "utf8")
);
if (JSON.stringify(packagedManifest) !== JSON.stringify(sourceManifest)) {
  fail("Packaged plugin manifest is stale.");
}

const packageRecord = JSON.parse(await readFile(path.join(packageRoot, ".codex-package.json"), "utf8"));
if (packageRecord.plugin !== sourceManifest.name || packageRecord.version !== sourceManifest.version) {
  fail("Marketplace package record does not match the plugin manifest.");
}
if (packageRecord.candidateId !== `${sourceManifest.name}@${sourceManifest.version}`) {
  fail("Marketplace candidate identity does not match the plugin manifest.");
}
const contentIdentity = await hashMarketplaceContent(packageRoot);
if (
  packageRecord.contentHashAlgorithm !== "sha256-path-and-file-digests-v1" ||
  packageRecord.contentSha256 !== contentIdentity.contentSha256 ||
  packageRecord.fileCount !== contentIdentity.fileCount
) {
  fail("Marketplace package content hash is stale or invalid.");
}
const replacementCandidate = JSON.parse(
  await readFile(path.join(projectRoot, "release", "REPLACEMENT_CANDIDATE.json"), "utf8")
);
if (
  replacementCandidate.candidateId !== packageRecord.candidateId ||
  replacementCandidate.contentSha256 !== packageRecord.contentSha256 ||
  replacementCandidate.packagedFileCount !== packageRecord.fileCount ||
  replacementCandidate.evidenceTransfer !== "none; full real-Mac gate required"
) {
  fail("Replacement candidate record does not match the generated marketplace package.");
}

for (const required of [
  "scripts/intake.mjs",
  "scripts/prepare-ocr.mjs",
  "skills/codex-intake/SKILL.md",
  "src/server/ocr.js",
  "index.html",
  "package.json",
  "pnpm-lock.yaml",
  "LICENSE"
]) {
  try {
    const details = await stat(path.join(packageRoot, required));
    if (!details.isFile()) fail(`Packaged runtime path is not a file: ${required}`);
  } catch {
    fail(`Packaged runtime path is missing: ${required}`);
  }
}

for (const forbidden of [".git", ".agents", "node_modules", "plugins", "vendor", ".cache", ".pnpm-store"]) {
  try {
    await stat(path.join(packageRoot, forbidden));
    fail(`Generated marketplace package contains forbidden local state: ${forbidden}`);
  } catch {
    // Absence is required.
  }
}

if (failures.length) {
  process.stderr.write(`${failures.map((message) => `- ${message}`).join("\n")}\n`);
  process.exitCode = 1;
} else {
  const count = await fileCount(packageRoot);
  process.stdout.write(
    `Marketplace package passed: ${packageRecord.candidateId}, ${count} files, ` +
      `sha256 ${packageRecord.contentSha256}, canonical repo-local source.\n`
  );
}

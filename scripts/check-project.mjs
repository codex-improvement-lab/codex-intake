import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { compileIntake } from "../src/core/intake.js";
import { toJson } from "../src/core/export.js";
import { validateProvenance } from "../src/core/validate.js";
import { DEMO_SOURCES } from "../src/demo.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const requiredFiles = [
  ".codex-plugin/plugin.json",
  ".agents/plugins/marketplace.json",
  "AGENTS.md",
  "README.md",
  "LICENSE",
  "CONTRIBUTING.md",
  "SECURITY.md",
  "CHANGELOG.md",
  "pnpm-lock.yaml",
  "assets/codex-intake-overview.png",
  "assets/codex-intake-full.png",
  "docs/ARCHITECTURE.md",
  "docs/EXTENSION_SURFACE.md",
  "docs/NATIVE_PRODUCT_PROPOSAL.md",
  "docs/PRODUCT_INSIGHTS.md",
  "docs/MACOS_HANDOFF.md",
  "docs/RELEASE_CHECKLIST.md",
  "docs/TEST_EVIDENCE.md",
  "release/MACOS_VALIDATION_RESULT.template.md",
  "release/REPLACEMENT_CANDIDATE.json",
  "release/RELEASE_NOTES_v0.1.0.md",
  "scripts/check-macos-design.mjs",
  "scripts/check-marketplace.mjs",
  "scripts/prepare-marketplace.mjs",
  "scripts/redact-plugin-status.mjs",
  "scripts/resolve-installed-copy.mjs",
  "scripts/verify-macos.mjs",
  "skills/codex-intake/SKILL.md"
];

const failures = [];

for (const relative of requiredFiles) {
  try {
    const details = await stat(path.join(root, relative));
    if (!details.isFile() || details.size === 0) failures.push(`${relative} is empty or not a file.`);
  } catch {
    failures.push(`${relative} is missing.`);
  }
}

const manifest = JSON.parse(await readFile(path.join(root, ".codex-plugin", "plugin.json"), "utf8"));
if (manifest.name !== "codex-intake") failures.push("Plugin manifest name must be codex-intake.");
if (!/^0\.1\.0\+codex\.\d{14}$/.test(manifest.version)) {
  failures.push("Plugin manifest must carry exactly one timestamped v0.1.0 Codex replacement-candidate cachebuster.");
}
if (manifest.license !== "MIT") failures.push("Plugin manifest must declare MIT.");
if (manifest.apps || manifest.mcpServers) failures.push("MVP manifest must not claim an unimplemented MCP or app integration.");

try {
  const candidate = JSON.parse(await readFile(path.join(root, "release", "REPLACEMENT_CANDIDATE.json"), "utf8"));
  if (candidate.candidateId !== `codex-intake@${manifest.version}`) {
    failures.push("Replacement candidate identity must match the plugin manifest.");
  }
  if (!/^[a-f0-9]{64}$/.test(candidate.contentSha256 || "")) {
    failures.push("Replacement candidate must record a SHA-256 content identity.");
  }
  if (candidate.evidenceTransfer !== "none; full real-Mac gate required") {
    failures.push("Replacement candidate must prohibit evidence transfer from earlier candidates.");
  }
} catch {
  failures.push("Replacement candidate record must be valid JSON.");
}

const gitignore = await readFile(path.join(root, ".gitignore"), "utf8");
if (!/^\/plugins\/$/m.test(gitignore) || /^plugins\/$/m.test(gitignore)) {
  failures.push("Generated /plugins/ must be root-ignored without hiding .agents/plugins/marketplace.json.");
}

async function sourceFiles(directory) {
  const results = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if ([".git", ".release-audit", "node_modules", ".pnpm-store", ".pnpm-cache", ".pnpm-home", ".cache", ".tools", "dist", "plugins", "vendor", "test-results", "playwright-report"].includes(entry.name)) continue;
    const candidate = path.join(directory, entry.name);
    if (entry.isDirectory()) results.push(...(await sourceFiles(candidate)));
    else results.push(candidate);
  }
  return results;
}

const unfinishedPattern = new RegExp(`\\[(?:${"TO" + "DO"}):|\\b${"TO" + "DO"}\\b|\\b${"FIX" + "ME"}\\b`);

for (const file of await sourceFiles(root)) {
  if (/\.(?:png|jpg|jpeg|webp|gz|zip|tgz|lock)$/i.test(file) || file.endsWith("pnpm-lock.yaml")) continue;
  const content = await readFile(file, "utf8");
  if (unfinishedPattern.test(content)) failures.push(`${path.relative(root, file)} contains an unfinished marker.`);
}

const brief = compileIntake(DEMO_SOURCES);
failures.push(...validateProvenance(brief));
const exported = toJson(brief);
for (const forbidden of ["dev@example.com", "demo_token_1234567890abcdef", "C:\\Users\\alex"]) {
  if (exported.includes(forbidden)) failures.push(`Portable export leaked fixture value: ${forbidden}`);
}

if (failures.length) {
  process.stderr.write(`${failures.map((failure) => `- ${failure}`).join("\n")}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(`Project checks passed: ${requiredFiles.length} release files, ${brief.findings.length} traceable demo findings, 0 raw fixture leaks.\n`);
}

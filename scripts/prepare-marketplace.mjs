import { createHash } from "node:crypto";
import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const pluginsRoot = path.join(projectRoot, "plugins");
const packageRoot = path.join(pluginsRoot, "codex-intake");

// Keep this explicit: the marketplace bundle must contain everything needed to
// run the CLI, Web UI, OCR, tests, and license review without copying local
// stores, caches, Git state, or the marketplace recursively.
const includedPaths = [
  ".codex-plugin",
  "assets",
  "docs",
  "examples",
  "release/MACOS_VALIDATION_RESULT.template.md",
  "release/RELEASE_NOTES_v0.1.0.md",
  "scripts",
  "skills",
  "src",
  "tests",
  "AGENTS.md",
  "CHANGELOG.md",
  "CONTRIBUTING.md",
  "LICENSE",
  "README.md",
  "SECURITY.md",
  "THIRD_PARTY_NOTICES.md",
  "index.html",
  "package.json",
  "playwright.config.js",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  "vite.config.js"
];

function assertSafePackageTarget() {
  const relative = path.relative(pluginsRoot, packageRoot);
  if (relative !== "codex-intake" || path.isAbsolute(relative) || relative.startsWith("..")) {
    throw new Error(`Refusing to replace unsafe marketplace package target: ${packageRoot}`);
  }
}

async function packageFiles(directory, prefix = "") {
  const results = [];
  const entries = await readdir(directory, { withFileTypes: true });
  entries.sort((left, right) => left.name.localeCompare(right.name, "en"));
  for (const entry of entries) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (relative === ".codex-package.json") continue;
    const candidate = path.join(directory, entry.name);
    if (entry.isDirectory()) results.push(...(await packageFiles(candidate, relative)));
    else if (entry.isFile()) results.push({ relative, content: await readFile(candidate) });
  }
  return results;
}

export async function hashMarketplaceContent(directory) {
  const files = await packageFiles(directory);
  const aggregate = createHash("sha256");
  for (const file of files) {
    const fileDigest = createHash("sha256").update(file.content).digest("hex");
    aggregate.update(file.relative, "utf8");
    aggregate.update("\0", "utf8");
    aggregate.update(fileDigest, "ascii");
    aggregate.update("\n", "utf8");
  }
  return { contentSha256: aggregate.digest("hex"), fileCount: files.length };
}

export async function prepareMarketplacePackage() {
  assertSafePackageTarget();
  await mkdir(pluginsRoot, { recursive: true });
  await rm(packageRoot, { recursive: true, force: true });
  await mkdir(packageRoot, { recursive: true });

  for (const relative of includedPaths) {
    await cp(path.join(projectRoot, relative), path.join(packageRoot, relative), {
      recursive: true,
      dereference: false,
      preserveTimestamps: false
    });
  }

  const manifest = JSON.parse(
    await readFile(path.join(projectRoot, ".codex-plugin", "plugin.json"), "utf8")
  );
  const contentIdentity = await hashMarketplaceContent(packageRoot);
  const packageRecord = {
    schemaVersion: 2,
    kind: "repo-local-marketplace-package",
    plugin: manifest.name,
    version: manifest.version,
    candidateId: `${manifest.name}@${manifest.version}`,
    contentHashAlgorithm: "sha256-path-and-file-digests-v1",
    contentSha256: contentIdentity.contentSha256,
    fileCount: contentIdentity.fileCount,
    generated: true,
    includedPaths
  };
  await writeFile(
    path.join(packageRoot, ".codex-package.json"),
    `${JSON.stringify(packageRecord, null, 2)}\n`,
    "utf8"
  );
  await writeFile(
    path.join(projectRoot, "release", "REPLACEMENT_CANDIDATE.json"),
    `${JSON.stringify({
      schemaVersion: 1,
      kind: "macos-replacement-candidate",
      candidateId: packageRecord.candidateId,
      plugin: packageRecord.plugin,
      version: packageRecord.version,
      contentHashAlgorithm: packageRecord.contentHashAlgorithm,
      contentSha256: packageRecord.contentSha256,
      packagedFileCount: packageRecord.fileCount,
      evidenceTransfer: "none; full real-Mac gate required"
    }, null, 2)}\n`,
    "utf8"
  );

  return { packageRoot, includedPaths: [...includedPaths], manifest, packageRecord };
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  prepareMarketplacePackage()
    .then(({ manifest, packageRecord }) => {
      process.stdout.write(
        `Prepared ${manifest.name}@${manifest.version} for the repo-local marketplace ` +
          `(${includedPaths.length} source paths, sha256 ${packageRecord.contentSha256}).\n`
      );
    })
    .catch((error) => {
      process.stderr.write(`marketplace package: ${error instanceof Error ? error.message : String(error)}\n`);
      process.exitCode = 1;
    });
}

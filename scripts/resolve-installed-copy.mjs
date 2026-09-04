import { mkdir, readFile, readdir, realpath, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { hashMarketplaceContent } from "./prepare-marketplace.mjs";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const evidenceRoot = path.join(projectRoot, "release", "evidence");
const VERSION_FIELDS = ["version", "pluginVersion", "plugin_version", "installedVersion", "installed_version"];

function fail(message) {
  throw new Error(message);
}

function isInside(parent, candidate) {
  const relative = path.relative(parent, candidate);
  return relative !== "" && !path.isAbsolute(relative) && !relative.startsWith("..");
}

function parseArguments(argv) {
  const options = {
    marketplace: "codex-intake-local",
    plugin: "codex-intake",
    cacheRoot: "",
    auditOut: ""
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (["--marketplace", "--plugin", "--cache-root", "--audit-out"].includes(argument)) {
      index += 1;
      if (!argv[index]) fail(`${argument} requires a value.`);
      const key = {
        "--marketplace": "marketplace",
        "--plugin": "plugin",
        "--cache-root": "cacheRoot",
        "--audit-out": "auditOut"
      }[argument];
      options[key] = argv[index];
    } else {
      fail(`Unknown installed-copy resolver option: ${argument}`);
    }
  }
  return options;
}

function collectPluginRecords(value, plugin, records = []) {
  if (Array.isArray(value)) {
    value.forEach((item) => collectPluginRecords(item, plugin, records));
    return records;
  }
  if (!value || typeof value !== "object") return records;

  const identities = [
    value.name,
    value.plugin,
    value.plugin_name,
    value.pluginName,
    value.selector
  ].filter((item) => typeof item === "string");
  if (identities.some((item) => item === plugin || item.startsWith(`${plugin}@`))) records.push(value);
  Object.values(value).forEach((item) => collectPluginRecords(item, plugin, records));
  return records;
}

function statusConstraint(status, plugin) {
  const records = collectPluginRecords(status, plugin);
  if (!records.length) fail(`Codex plugin status did not contain ${plugin}.`);

  const installed = records.filter((record) => record.installed === true);
  const eligible = installed.length ? installed : records.filter((record) => record.installed !== false);
  if (!eligible.length) fail(`Codex plugin status reports ${plugin} as not installed.`);

  const versions = new Set();
  for (const record of eligible) {
    for (const field of VERSION_FIELDS) {
      const value = record[field];
      if (typeof value === "string" && /^[0-9A-Za-z][0-9A-Za-z.+_-]{0,63}$/.test(value)) versions.add(value);
    }
  }
  if (versions.size > 1) fail(`Codex plugin status reported multiple installed versions for ${plugin}.`);
  return { matchedRecords: eligible.length, version: [...versions][0] || null };
}

async function readCandidate(directory, leaf, plugin) {
  try {
    const resolved = await realpath(path.join(directory, leaf));
    const root = await realpath(directory);
    if (!isInside(root, resolved)) return null;
    const manifest = JSON.parse(await readFile(path.join(resolved, ".codex-plugin", "plugin.json"), "utf8"));
    if (manifest.name !== plugin || typeof manifest.version !== "string") return null;
    const packageRecord = JSON.parse(await readFile(path.join(resolved, ".codex-package.json"), "utf8"));
    if (
      packageRecord.plugin !== manifest.name ||
      packageRecord.version !== manifest.version ||
      packageRecord.candidateId !== `${manifest.name}@${manifest.version}` ||
      !/^[a-f0-9]{64}$/.test(packageRecord.contentSha256 || "")
    ) return null;
    const contentIdentity = await hashMarketplaceContent(resolved);
    if (
      contentIdentity.contentSha256 !== packageRecord.contentSha256 ||
      contentIdentity.fileCount !== packageRecord.fileCount
    ) return null;
    return { path: resolved, leaf, manifest, packageRecord };
  } catch {
    return null;
  }
}

export async function resolveInstalledPluginCopy({
  status,
  marketplace = "codex-intake-local",
  plugin = "codex-intake",
  cacheRoot = "",
  expectedCandidate = null
}) {
  const constraint = statusConstraint(status, plugin);
  const defaultCodexRoot = process.env.CODEX_HOME
    ? path.resolve(process.env.CODEX_HOME)
    : path.join(os.homedir(), ".codex");
  const pluginCacheRoot = cacheRoot || path.join(defaultCodexRoot, "plugins", "cache", marketplace, plugin);
  const entries = await readdir(pluginCacheRoot, { withFileTypes: true });
  const candidates = (
    await Promise.all(
      entries.filter((entry) => entry.isDirectory()).map((entry) => readCandidate(pluginCacheRoot, entry.name, plugin))
    )
  ).filter(Boolean);

  const matching = constraint.version
    ? candidates.filter(
        (candidate) => candidate.leaf === constraint.version || candidate.manifest.version === constraint.version
      )
    : candidates;
  if (matching.length !== 1) {
    fail(
      `Expected exactly one audited installed copy for ${plugin}; found ${matching.length}. ` +
        "Remove stale copies or ensure plugin status reports the installed version."
    );
  }

  const selected = matching[0];
  const expected = expectedCandidate || JSON.parse(
    await readFile(path.join(projectRoot, "release", "REPLACEMENT_CANDIDATE.json"), "utf8")
  );
  if (
    selected.packageRecord.candidateId !== expected.candidateId ||
    selected.packageRecord.contentSha256 !== expected.contentSha256
  ) {
    fail("Installed copy identity does not match release/REPLACEMENT_CANDIDATE.json.");
  }
  return {
    path: selected.path,
    audit: {
      schemaVersion: 1,
      kind: "codex-installed-plugin-copy",
      marketplace,
      plugin,
      statusMatched: true,
      statusRecordCount: constraint.matchedRecords,
      statusVersion: constraint.version,
      cacheLeaf: selected.leaf,
      manifestVersion: selected.manifest.version,
      candidateId: selected.packageRecord.candidateId,
      contentSha256: selected.packageRecord.contentSha256,
      manifestIdentityVerified: true,
      packageContentIdentityVerified: true,
      resolvedWithinPluginCache: true,
      privacy: { absolutePathsIncluded: false, statusPayloadIncluded: false }
    }
  };
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  let raw = "";
  for await (const chunk of process.stdin) raw += chunk;
  if (!raw.trim()) fail("Pipe `codex plugin list --json` into this resolver.");
  const status = JSON.parse(raw);
  const result = await resolveInstalledPluginCopy({
    status,
    marketplace: options.marketplace,
    plugin: options.plugin,
    cacheRoot: options.cacheRoot
  });

  if (options.auditOut) {
    const auditPath = path.resolve(projectRoot, options.auditOut);
    if (!isInside(evidenceRoot, auditPath) || path.extname(auditPath) !== ".json") {
      fail("--audit-out must name a JSON file inside release/evidence.");
    }
    await mkdir(evidenceRoot, { recursive: true });
    await writeFile(auditPath, `${JSON.stringify(result.audit, null, 2)}\n`, "utf8");
  }
  process.stdout.write(`${result.path}\n`);
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`installed-copy resolver: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}

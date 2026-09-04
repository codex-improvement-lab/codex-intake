import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const packageJson = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
const lockfile = await readFile(path.join(root, "pnpm-lock.yaml"), "utf8");
const workspace = await readFile(path.join(root, "pnpm-workspace.yaml"), "utf8");
const prepareOcr = await readFile(path.join(root, "scripts", "prepare-ocr.mjs"), "utf8");
const ocrRuntime = await readFile(path.join(root, "src", "server", "ocr.js"), "utf8");
const installedCopyResolver = await readFile(path.join(root, "scripts", "resolve-installed-copy.mjs"), "utf8");
const verifier = await readFile(path.join(root, "scripts", "verify-macos.mjs"), "utf8");
const macHandoff = await readFile(path.join(root, "docs", "MACOS_HANDOFF.md"), "utf8");
const failures = [];
const require = createRequire(import.meta.url);

function requireCondition(condition, message) {
  if (!condition) failures.push(message);
}

requireCondition(packageJson.engines?.node === ">=20.19", "Node support floor must stay explicit at >=20.19.");
requireCondition(packageJson.packageManager === "pnpm@11.19.0", "pnpm must stay pinned to 11.19.0.");
requireCondition(
  packageJson.scripts?.postinstall === "node scripts/prepare-ocr.mjs",
  "The project postinstall must invoke the OCR preparer through Node, not a platform shell."
);
requireCondition(workspace.includes("esbuild: true"), "pnpm must allow the esbuild install required by Vite.");
requireCondition(
  workspace.includes("tesseract.js: true"),
  "pnpm must account for the declared tesseract.js dependency lifecycle script."
);

for (const dependency of [
  "@esbuild/darwin-arm64@",
  "@esbuild/darwin-x64@",
  "@rollup/rollup-darwin-arm64@",
  "@rollup/rollup-darwin-x64@",
  "tesseract.js-core@",
  "@tesseract.js-data/eng@",
  "@tesseract.js-data/chi_sim@"
]) {
  requireCondition(lockfile.includes(dependency), `pnpm lockfile is missing ${dependency}`);
}

const tesseractManifestPath = require.resolve("tesseract.js/package.json");
const tesseractRequire = createRequire(tesseractManifestPath);
for (const [label, manifestPath] of [
  ["tesseract.js", tesseractManifestPath],
  ["tesseract.js-core", tesseractRequire.resolve("tesseract.js-core/package.json")],
  ["English trained data", require.resolve("@tesseract.js-data/eng/package.json")],
  ["Simplified Chinese trained data", require.resolve("@tesseract.js-data/chi_sim/package.json")]
]) {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  requireCondition(!manifest.os, `${label} unexpectedly restricts supported operating systems.`);
  requireCondition(!manifest.cpu, `${label} unexpectedly restricts supported CPU architectures.`);
}

requireCondition(prepareOcr.includes("fileURLToPath"), "OCR preparation must resolve its root from import.meta.url.");
requireCondition(prepareOcr.includes("path.join"), "OCR preparation must join paths without shell concatenation.");
requireCondition(!prepareOcr.includes("child_process"), "OCR preparation must not require a system Tesseract command.");
requireCondition(ocrRuntime.includes('from "tesseract.js"'), "OCR runtime must use the bundled tesseract.js dependency.");
requireCondition(ocrRuntime.includes("path.join"), "OCR runtime must join language-data paths portably.");
requireCondition(installedCopyResolver.includes("realpath"), "Installed-copy resolver must reject cache path escapes.");
requireCondition(
  installedCopyResolver.includes("hashMarketplaceContent"),
  "Installed-copy resolver must reproduce the packaged content identity."
);
requireCondition(
  macHandoff.includes('node "scripts/resolve-installed-copy.mjs"'),
  "Mac handoff must resolve the installed copy dynamically from plugin status."
);
requireCondition(
  !macHandoff.includes("codex-intake/codex-intake/local"),
  "Mac handoff must not hard-code a local cache suffix."
);
requireCondition(
  macHandoff.includes("pnpm verify:macos -- --real-mac"),
  "Mac handoff must retain the exact pnpm separator command."
);
requireCondition(
  verifier.includes('argument === "--" && index === 0'),
  "Mac verifier must accept the leading pnpm argument separator."
);

for (const scriptName of ["dev", "build", "preview", "intake", "prepare:ocr", "postinstall"]) {
  const command = packageJson.scripts?.[scriptName] || "";
  requireCondition(
    !/(?:^|\s)(?:cmd(?:\.exe)?|powershell(?:\.exe)?|pwsh|bash|zsh)(?:\s|$)/i.test(command),
    `${scriptName} must not require a platform-specific command interpreter.`
  );
}

if (failures.length) {
  process.stderr.write(`${failures.map((message) => `- ${message}`).join("\n")}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(
    "Static macOS design preflight passed for darwin-arm64 and darwin-x64. This is not direct Mac validation.\n"
  );
}

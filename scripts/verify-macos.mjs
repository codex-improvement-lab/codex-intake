import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const evidenceRoot = path.join(root, "release", "evidence");

function fail(message) {
  throw new Error(message);
}

function parseArguments(argv) {
  const options = { realMac: false, hardware: "", out: "" };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--" && index === 0) continue;
    if (argument === "--real-mac") options.realMac = true;
    else if (argument === "--hardware") {
      index += 1;
      options.hardware = argv[index] || "";
    } else if (argument === "--out") {
      index += 1;
      options.out = argv[index] || "";
    } else {
      fail(`Unknown macOS verification option: ${argument}`);
    }
  }
  return options;
}

function run(command, args, label, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd || root,
    encoding: "utf8",
    stdio: options.capture ? "pipe" : "inherit",
    env: process.env
  });
  if (result.error) fail(`${label} could not start: ${result.error.message}`);
  if (result.status !== 0) {
    const details = options.capture ? String(result.stderr || result.stdout || "").trim() : "";
    fail(`${label} failed${details ? `: ${details}` : "."}`);
  }
  return result;
}

function isTruthyEnvironmentValue(value) {
  return Boolean(value) && !["0", "false", "no"].includes(String(value).toLowerCase());
}

function isRosettaTranslated() {
  if (process.arch !== "x64") return false;
  const result = spawnSync("/usr/sbin/sysctl", ["-in", "sysctl.proc_translated"], {
    encoding: "utf8",
    stdio: "pipe"
  });
  return result.status === 0 && result.stdout.trim() === "1";
}

function assertEvidencePath(candidate) {
  const relative = path.relative(evidenceRoot, candidate);
  if (!relative || path.isAbsolute(relative) || relative.startsWith("..")) {
    fail("--out must name a JSON file inside release/evidence.");
  }
}

async function verify() {
  const options = parseArguments(process.argv.slice(2));
  if (process.platform !== "darwin") {
    fail("Refusing to emit macOS evidence: this process is not running on Darwin.");
  }

  const ciMarkers = ["CI", "GITHUB_ACTIONS", "BUILDKITE", "TF_BUILD", "TEAMCITY_VERSION", "JENKINS_URL"]
    .filter((name) => isTruthyEnvironmentValue(process.env[name]));
  if (ciMarkers.length) {
    fail(`Refusing to emit real-Mac evidence in CI (${ciMarkers.join(", ")}).`);
  }
  if (!options.realMac) fail("Pass --real-mac only while operating the named real Mac in the handoff.");
  if (!["apple-silicon", "intel"].includes(options.hardware)) {
    fail("Pass --hardware apple-silicon or --hardware intel.");
  }
  if (options.hardware === "apple-silicon" && process.arch !== "arm64") {
    fail("Apple Silicon evidence requires a native arm64 Node process.");
  }
  if (options.hardware === "intel" && process.arch !== "x64") {
    fail("Intel evidence requires a native x64 Node process.");
  }

  const rosettaTranslated = isRosettaTranslated();
  if (rosettaTranslated) fail("Rosetta-translated x64 Node cannot be used as Intel hardware evidence.");
  if (!/\s/.test(root)) fail("Place the project in a path containing a space before running this gate.");

  const [nodeMajor, nodeMinor] = process.versions.node.split(".").map(Number);
  if (nodeMajor < 20 || (nodeMajor === 20 && nodeMinor < 19)) {
    fail(`Node ${process.versions.node} is below the supported 20.19 floor.`);
  }

  const pnpmMatch = String(process.env.npm_config_user_agent || "").match(/\bpnpm\/(\d+\.\d+\.\d+)/);
  if (!pnpmMatch) fail("Run this verifier through `pnpm verify:macos` so pnpm can be identified.");
  if (pnpmMatch[1] !== "11.19.0") fail(`Expected pnpm 11.19.0, observed ${pnpmMatch[1]}.`);

  const pnpmEntry = process.env.npm_execpath;
  if (!pnpmEntry || !path.isAbsolute(pnpmEntry)) fail("Could not resolve the active pnpm entry point.");
  await stat(pnpmEntry);
  run(process.execPath, [pnpmEntry, "run", "release:check"], "full release check");

  const candidate = JSON.parse(
    await readFile(path.join(root, "release", "REPLACEMENT_CANDIDATE.json"), "utf8")
  );
  if (
    !/^codex-intake@/.test(candidate.candidateId || "") ||
    !/^[a-f0-9]{64}$/.test(candidate.contentSha256 || "") ||
    candidate.evidenceTransfer !== "none; full real-Mac gate required"
  ) {
    fail("Replacement candidate identity is missing or invalid after the release check.");
  }

  for (const language of ["eng", "chi_sim"]) {
    const details = await stat(path.join(root, "vendor", "ocr", `${language}.traineddata.gz`));
    if (!details.isFile() || details.size < 100_000) fail(`Prepared ${language} OCR data is missing or truncated.`);
  }

  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "codex-intake macos "));
  let cliSourceCount = 0;
  try {
    const outputPath = path.join(tempRoot, "task brief.json");
    run(
      process.execPath,
      [
        path.join(root, "scripts", "intake.mjs"),
        path.join(root, "examples", "incident.log"),
        path.join(root, "examples", "request.txt"),
        "--format",
        "json",
        "--out",
        outputPath
      ],
      "CLI path-with-spaces workflow",
      { capture: true }
    );
    const cliOutput = await readFile(outputPath, "utf8");
    if (cliOutput.includes("example_redact_me")) fail("CLI evidence leaked the synthetic bearer value.");
    const brief = JSON.parse(cliOutput);
    cliSourceCount = Array.isArray(brief.sources) ? brief.sources.length : 0;
    if (cliSourceCount !== 2 || !Array.isArray(brief.doneWhen) || brief.doneWhen.length === 0) {
      fail("CLI did not produce the expected two-source brief with done-when criteria.");
    }
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }

  const { recognizeBuffer, terminateOcrWorker } = await import("../src/server/ocr.js");
  let ocrResult;
  try {
    ocrResult = await recognizeBuffer(await readFile(path.join(root, "assets", "codex-intake-overview.png")));
  } finally {
    await terminateOcrWorker();
  }
  if (ocrResult.text.length < 20) fail("Direct local OCR returned too little text from the checked-in screenshot.");

  const report = {
    schemaVersion: 1,
    status: "passed",
    claim: "direct-darwin-automated",
    observedAt: new Date().toISOString(),
    hardwareClaim: options.hardware,
    platform: process.platform,
    architecture: process.arch,
    rosettaTranslated,
    nodeVersion: process.versions.node,
    pnpmVersion: pnpmMatch[1],
    candidateId: candidate.candidateId,
    contentSha256: candidate.contentSha256,
    projectPathContainedWhitespace: true,
    checks: {
      releaseCheck: "passed",
      marketplacePackage: "passed",
      cliWithSpacePaths: "passed",
      cliSourceCount,
      webChromiumLoop: "passed",
      localOcr: "passed",
      ocrEngine: ocrResult.engine,
      ocrLanguages: ocrResult.languages
    },
    privacy: {
      absolutePathsIncluded: false,
      sourceBodiesIncluded: false,
      ocrTextIncluded: false
    },
    limits: [
      "The --real-mac and hardware values are operator attestations, not cryptographic proof of physical hardware.",
      "Plugin installation, fresh-task activation, and uninstall are recorded separately in the handoff result."
    ]
  };

  const outputPath = path.resolve(
    root,
    options.out || path.join("release", "evidence", `macos-${options.hardware}.json`)
  );
  assertEvidencePath(outputPath);
  await mkdir(evidenceRoot, { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  process.stdout.write(
    `Direct macOS automated checks passed for ${options.hardware}; wrote a redacted report under release/evidence/.\n`
  );
}

verify().catch((error) => {
  process.stderr.write(`macOS verification: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});

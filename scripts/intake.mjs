#!/usr/bin/env node
import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { compileIntake } from "../src/core/intake.js";
import { toJson, toMarkdown } from "../src/core/export.js";
import { assertValidProvenance } from "../src/core/validate.js";

const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".bmp", ".tif", ".tiff"]);
const LOG_EXTENSIONS = new Set([".log", ".out", ".trace"]);
const INVENTORY_EXTENSIONS = new Set([".lst", ".files"]);
const TEXT_EXTENSIONS = new Set([
  ".txt", ".md", ".json", ".yaml", ".yml", ".toml", ".csv", ".xml", ".html", ".css",
  ".js", ".mjs", ".cjs", ".ts", ".tsx", ".jsx", ".py", ".rs", ".go", ".java", ".cs", ".sh", ".ps1"
]);

function usage() {
  return `Codex Intake\n\nUsage:\n  node scripts/intake.mjs [files...] [options]\n\nOptions:\n  --text <value>       Add pasted text (repeatable)\n  --url <value>        Register a URL without fetching it\n  --inventory <path>   Add a deterministic directory listing\n  --max-depth <n>      Inventory depth, default 2\n  --ocr                 Run local OCR for selected images\n  --format <md|json>   Output format, default md\n  --out <path>         Write output to a selected path\n  --help                Show this help\n`;
}

function parseArguments(argv) {
  const options = {
    files: [],
    text: [],
    urls: [],
    inventories: [],
    format: "md",
    out: null,
    ocr: false,
    maxDepth: 2
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const take = () => {
      index += 1;
      if (index >= argv.length) throw new Error(`Missing value for ${argument}.`);
      return argv[index];
    };

    if (argument === "--help" || argument === "-h") options.help = true;
    else if (argument === "--text") options.text.push(take());
    else if (argument === "--url") options.urls.push(take());
    else if (argument === "--inventory") options.inventories.push(take());
    else if (argument === "--max-depth") options.maxDepth = Number.parseInt(take(), 10);
    else if (argument === "--format") options.format = take();
    else if (argument === "--out") options.out = take();
    else if (argument === "--ocr") options.ocr = true;
    else if (argument.startsWith("-")) throw new Error(`Unknown option: ${argument}`);
    else options.files.push(argument);
  }

  if (!Number.isInteger(options.maxDepth) || options.maxDepth < 0 || options.maxDepth > 8) {
    throw new Error("--max-depth must be an integer from 0 to 8.");
  }
  if (!["md", "json"].includes(options.format)) {
    throw new Error("--format must be md or json.");
  }
  return options;
}

async function listDirectory(root, maxDepth) {
  const rootPath = path.resolve(root);
  const lines = [];

  async function walk(current, depth) {
    const entries = await readdir(current, { withFileTypes: true });
    entries.sort((left, right) => (left.name < right.name ? -1 : left.name > right.name ? 1 : 0));

    for (const entry of entries) {
      const absolute = path.join(current, entry.name);
      const relative = path.relative(rootPath, absolute).split(path.sep).join("/");
      lines.push(`${entry.isDirectory() ? "dir " : entry.isSymbolicLink() ? "link" : "file"} ${relative}`);
      if (entry.isDirectory() && depth < maxDepth) await walk(absolute, depth + 1);
    }
  }

  await walk(rootPath, 0);
  return lines.join("\n");
}

function kindFor(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  if (IMAGE_EXTENSIONS.has(extension)) return "screenshot";
  if (LOG_EXTENSIONS.has(extension)) return "log";
  if (INVENTORY_EXTENSIONS.has(extension)) return "file-list";
  if (TEXT_EXTENSIONS.has(extension)) return "text";
  return null;
}

async function sourceFromFile(filePath, useOcr) {
  const absolute = path.resolve(filePath);
  const details = await stat(absolute);
  if (!details.isFile()) throw new Error(`Selected path is not a file: ${filePath}`);
  if (details.size > 12 * 1024 * 1024) throw new Error(`Selected file exceeds 12 MB: ${filePath}`);
  const kind = kindFor(absolute);
  if (!kind) throw new Error(`Unsupported file type: ${filePath}. Use a text export or transcript.`);

  if (kind === "screenshot") {
    if (!useOcr) {
      return { name: path.basename(absolute), kind, byteSize: details.size, content: "" };
    }
    const { recognizeBuffer } = await import("../src/server/ocr.js");
    const result = await recognizeBuffer(await readFile(absolute));
    return {
      name: path.basename(absolute),
      kind,
      byteSize: details.size,
      content: result.text,
      ocr: result
    };
  }

  return {
    name: path.basename(absolute),
    kind,
    byteSize: details.size,
    content: await readFile(absolute, "utf8")
  };
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(usage());
    return;
  }

  const sources = [];
  for (const [index, content] of options.text.entries()) {
    sources.push({ name: `pasted-note-${index + 1}.txt`, kind: "text", content });
  }
  for (const [index, content] of options.urls.entries()) {
    sources.push({ name: `url-${index + 1}`, kind: "url", content });
  }
  for (const directory of options.inventories) {
    sources.push({
      name: `${path.basename(path.resolve(directory))}-inventory`,
      kind: "file-list",
      content: await listDirectory(directory, options.maxDepth)
    });
  }
  for (const filePath of options.files) {
    sources.push(await sourceFromFile(filePath, options.ocr));
  }

  if (!sources.length) throw new Error("No input supplied. Use a file, --text, --url, or --inventory.");
  const brief = assertValidProvenance(compileIntake(sources));
  const output = options.format === "json" ? toJson(brief) : toMarkdown(brief);

  if (options.out) {
    await writeFile(path.resolve(options.out), output, "utf8");
    process.stderr.write(`Wrote ${path.resolve(options.out)}\n`);
  } else {
    process.stdout.write(output);
  }
}

main().catch((error) => {
  process.stderr.write(`codex-intake: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});

#!/usr/bin/env node
import { readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { assignSourceIds, compileIntake, normalizeText } from "../src/core/intake.js";
import { contentDigest, createRequirements, reviewRequirement, validateRequirements } from "../src/core/requirements.js";

const HELP = `Intake reviewed requirement snapshots (local, explicit files only)
  node scripts/requirements.mjs prepare --scope <project> [--previous <snapshot.json>] [--out <snapshot.json>] <text-files...>
  node scripts/requirements.mjs review --input <snapshot.json> --id <id> --decision confirm|candidate|exclude|keep|revise [--text <text>] [--out <snapshot.json>]
Omit --out to write one JSON document to stdout. New rule candidates remain unconfirmed.
Review decisions are explicit caller declarations, not authenticated human signatures.
`;
async function readSnapshot(file) { return validateRequirements(JSON.parse(await readFile(path.resolve(file), "utf8"))); }
async function main() {
  const [command, ...args] = process.argv.slice(2);
  if (!command || command === "--help") { process.stdout.write(HELP); return; }
  const allowed = command === "prepare" ? ["scope", "previous", "out"] : command === "review" ? ["input", "id", "decision", "text", "out"] : [];
  if (!allowed.length) throw new Error("Use prepare or review.");
  const options = {}, files = [];
  for (let i = 0; i < args.length; i += 1) {
    const token = args[i];
    if (!token.startsWith("--")) { files.push(token); continue; }
    const name = token.slice(2);
    if (!allowed.includes(name) || options[name] !== undefined) throw new Error(`Unsupported or repeated option: ${token}.`);
    if (!args[i + 1] || args[i + 1].startsWith("--")) throw new Error(`Missing value: ${token}.`);
    options[name] = args[++i];
  }
  let snapshot;
  if (command === "prepare") {
    if (!files.length) throw new Error("Select at least one text file.");
    const previous = options.previous ? await readSnapshot(options.previous) : null;
    const known = [...(previous?.sourceHistory || []), ...(previous?.sources || [])];
    const names = new Set();
    let nextSource = Math.max(previous?.nextSourceId ?? 1, ...known.map(source => Number(source.id.slice(1)) + 1));
    const inputs = [];
    for (const file of files) {
      if (!/\.(txt|md|log|json|ya?ml|toml|lst|files)$/i.test(file)) throw new Error("prepare supports selected text/log/inventory files; use the browser for other source types.");
      const info = await stat(path.resolve(file));
      if (!info.isFile() || info.size > 12 * 1024 * 1024) throw new Error("Select a regular text file no larger than 12 MB.");
      const name = path.basename(file);
      if (names.has(name)) throw new Error("Selected source basenames must be unique within this snapshot.");
      names.add(name);
      const content = normalizeText(await readFile(path.resolve(file), "utf8"));
      const old = known.filter(source => source.name === name).sort((a, b) => b.revision - a.revision)[0];
      const digest = await contentDigest(content);
      inputs.push({ id: old?.id ?? `S${String(nextSource++).padStart(2, "0")}`, revision: old ? old.revision + (old.digest === digest ? 0 : 1) : 1,
        name, kind: /\.(log)$/i.test(file) ? "log" : /\.(lst|files)$/i.test(file) ? "file-list" : "text", content });
    }
    snapshot = await createRequirements(compileIntake(assignSourceIds(inputs)), { scope: options.scope || previous?.scope, previous });
  } else {
    if (files.length || !options.input || !options.id || !options.decision) throw new Error("review requires --input, --id and --decision, without file positionals.");
    if (options.text !== undefined && options.decision !== "revise") throw new Error("--text is supported only by the revise decision.");
    snapshot = reviewRequirement(await readSnapshot(options.input), options.id, options.decision, options.text);
  }
  const output = `${JSON.stringify(snapshot, null, 2)}\n`;
  if (options.out) {
    await writeFile(path.resolve(options.out), output, { encoding: "utf8", flag: "wx" });
    process.stderr.write(`Wrote ${path.resolve(options.out)}\n`);
  } else process.stdout.write(output);
}
main().catch(error => { process.stderr.write(`intake requirements: ${error.message}\n`); process.exitCode = 1; });

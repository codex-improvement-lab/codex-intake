import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const root = fileURLToPath(new URL("../", import.meta.url));
const cli = path.join(root, "scripts", "intake.mjs");

describe("CLI", () => {
  it("saves, reviews, updates and revokes a requirement snapshot using only explicit files", async () => {
    const parent = path.join(root, ".release-audit");
    await mkdir(parent, { recursive: true });
    const scratch = await mkdtemp(path.join(parent, "requirements-cli-"));
    const entry = path.join(root, "scripts", "requirements.mjs");
    const invoke = args => spawnSync(process.execPath, [entry, ...args], { cwd: scratch, encoding: "utf8" });
    try {
      await writeFile(path.join(scratch, "request.txt"), "Must preserve all signals.\nMust mask credentials.");
      const prepare = invoke(["prepare", "--scope", "lab", "--out", "candidates.json", "request.txt"]);
      expect(prepare.status).toBe(0);
      expect(prepare.stdout).toBe("");
      const initial = JSON.parse(await readFile(path.join(scratch, "candidates.json"), "utf8"));
      expect(initial.requirements[0].confirmation).toBe("candidate");
      const id = initial.requirements[1].id;
      expect(invoke(["review", "--input", "candidates.json", "--id", id, "--decision", "confirm", "--out", "reviewed.json"]).status).toBe(0);
      expect(invoke(["prepare", "--scope", "lab", "--out", "candidates.json", "request.txt"]).status).toBe(1);
      await writeFile(path.join(scratch, "request.txt"), "New heading\nMust preserve thirty signals.\nMust mask credentials.");
      const updated = invoke(["prepare", "--previous", "reviewed.json", "request.txt"]);
      expect(updated.status).toBe(0);
      const snapshot = JSON.parse(updated.stdout);
      expect(snapshot.requirements.find(item => item.id === id)).toMatchObject({ revision: 1, confirmation: "user-confirmed", pointer: { sourceRevision: 2 } });
      const revoked = JSON.parse(invoke(["review", "--input", "reviewed.json", "--id", id, "--decision", "candidate"]).stdout);
      expect(revoked.requirements.find(item => item.id === id).confirmation).toBe("candidate");
      const injected = { ...initial, rawSource: "PRIVATE-EXTENSION-MUST-NOT-EXPORT" };
      await writeFile(path.join(scratch, "injected.json"), JSON.stringify(injected));
      const rejected = invoke(["review", "--input", "injected.json", "--id", id, "--decision", "confirm"]);
      expect(rejected.status).toBe(1);
      expect(rejected.stdout).toBe("");
      expect(rejected.stderr).not.toContain("PRIVATE-EXTENSION-MUST-NOT-EXPORT");
    } finally {
      if (!path.resolve(scratch).startsWith(path.resolve(parent) + path.sep)) throw new Error("Unsafe test cleanup.");
      await rm(scratch, { recursive: true, force: true });
    }
  });
  it("compiles selected fixture files to Markdown", () => {
    const result = spawnSync(
      process.execPath,
      [cli, path.join(root, "examples", "incident.log"), path.join(root, "examples", "request.txt")],
      { cwd: root, encoding: "utf8" }
    );

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("# Task brief");
    expect(result.stdout).toContain("## Done when");
    expect(result.stdout).toContain("S01:L2");
    expect(result.stdout).not.toContain("example_secret_123456789");
  });

  it("registers URLs without fetching them", () => {
    const result = spawnSync(process.execPath, [cli, "--url", "https://example.com/issues/42", "--format", "json"], {
      cwd: root,
      encoding: "utf8"
    });

    expect(result.status).toBe(0);
    const parsed = JSON.parse(result.stdout);
    expect(parsed.sources[0]).toMatchObject({ kind: "url", rawContentIncluded: false });
    expect(parsed.findings[0].pointer).toMatchObject({ sourceId: "S01", locator: "URL" });
  });

  it("inventories names without embedding file bodies", () => {
    const result = spawnSync(
      process.execPath,
      [cli, "--inventory", path.join(root, "examples"), "--max-depth", "1", "--format", "json"],
      { cwd: root, encoding: "utf8" }
    );

    expect(result.status).toBe(0);
    const parsed = JSON.parse(result.stdout);
    expect(parsed.sources[0]).toMatchObject({ kind: "file-list", rawContentIncluded: false });
    expect(parsed.findings.every((item) => item.pointer.locator.startsWith("entry"))).toBe(true);
    expect(result.stdout).not.toContain("example_secret_123456789");
  });

  it("fails closed for an unsupported selected file", () => {
    const result = spawnSync(process.execPath, [cli, path.join(root, "examples", "unsupported.bin")], {
      cwd: root,
      encoding: "utf8"
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Unsupported file type");
    expect(result.stdout).toBe("");
  });
});

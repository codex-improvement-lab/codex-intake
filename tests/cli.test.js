import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = fileURLToPath(new URL("../", import.meta.url));
const cli = path.join(root, "scripts", "intake.mjs");

describe("CLI", () => {
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

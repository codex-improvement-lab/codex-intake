import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { resolveInstalledPluginCopy } from "../scripts/resolve-installed-copy.mjs";
import { hashMarketplaceContent } from "../scripts/prepare-marketplace.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));

function runNode(script, args = [], options = {}) {
  return spawnSync(process.execPath, [path.join(root, "scripts", script), ...args], {
    cwd: root,
    encoding: "utf8",
    ...options
  });
}

describe("platform and release evidence boundaries", () => {
  it("passes the static dual-architecture macOS design audit without claiming a Mac run", () => {
    const result = runNode("check-macos-design.mjs");
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("darwin-arm64 and darwin-x64");
    expect(result.stdout).toContain("not direct Mac validation");
  });

  it("refuses to emit real-Mac evidence without the guarded handoff context", () => {
    const result = runNode("verify-macos.mjs");
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/Refusing|--real-mac/);
    expect(result.stdout).not.toContain("checks passed");
  });

  it("accepts the exact pnpm leading separator before applying a platform-specific guard", () => {
    const cleanEnvironment = { ...process.env };
    for (const marker of ["CI", "GITHUB_ACTIONS", "BUILDKITE", "TF_BUILD", "TEAMCITY_VERSION", "JENKINS_URL"]) {
      delete cleanEnvironment[marker];
    }
    const result = runNode("verify-macos.mjs", [
      "--",
      "--real-mac",
      "--hardware",
      "test-only-invalid"
    ], { env: cleanEnvironment });
    expect(result.status).toBe(1);
    expect(result.stderr).not.toContain("Unknown macOS verification option: --");
    if (process.platform === "darwin") {
      expect(result.stderr).toContain("Pass --hardware apple-silicon or --hardware intel.");
      expect(result.stderr).not.toContain("not running on Darwin");
    } else {
      expect(result.stderr).toContain("not running on Darwin");
    }
  });

  it("resolves a versioned installed copy from status and an audited space-bearing cache", async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), "codex intake resolver "));
    try {
      const cacheRoot = path.join(tempRoot, "plugins", "cache", "codex-intake-local", "codex-intake");
      const installedRoot = path.join(cacheRoot, "0.1.0");
      await mkdir(path.join(installedRoot, ".codex-plugin"), { recursive: true });
      await writeFile(
        path.join(installedRoot, ".codex-plugin", "plugin.json"),
        `${JSON.stringify({ name: "codex-intake", version: "0.1.0" })}\n`,
        "utf8"
      );
      const contentIdentity = await hashMarketplaceContent(installedRoot);
      await writeFile(
        path.join(installedRoot, ".codex-package.json"),
        `${JSON.stringify({
          plugin: "codex-intake",
          version: "0.1.0",
          candidateId: "codex-intake@0.1.0",
          contentSha256: contentIdentity.contentSha256,
          fileCount: contentIdentity.fileCount
        })}\n`,
        "utf8"
      );

      const result = await resolveInstalledPluginCopy({
        status: {
          plugins: [
            {
              name: "codex-intake",
              marketplace: "codex-intake-local",
              installed: true,
              enabled: true,
              version: "0.1.0"
            }
          ]
        },
        cacheRoot,
        expectedCandidate: {
          candidateId: "codex-intake@0.1.0",
          contentSha256: contentIdentity.contentSha256
        }
      });
      expect(result.path).toBe(await realpath(installedRoot));
      expect(result.audit).toMatchObject({
        cacheLeaf: "0.1.0",
        manifestVersion: "0.1.0",
        manifestIdentityVerified: true,
        packageContentIdentityVerified: true,
        contentSha256: contentIdentity.contentSha256,
        privacy: { absolutePathsIncluded: false, statusPayloadIncluded: false }
      });
      expect(JSON.stringify(result.audit)).not.toContain(tempRoot);
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
  });

  it("redacts paths and unrelated plugin records from Codex status JSON", () => {
    const input = JSON.stringify({
      plugins: [
        {
          name: "codex-intake",
          marketplace: "codex-intake-local",
          installed: true,
          enabled: true,
          root: "/Users/private person/.codex/plugins/cache/codex-intake",
          token: "synthetic-private-value"
        },
        { name: "unrelated-secret-plugin", installed: true }
      ]
    });
    const result = runNode("redact-plugin-status.mjs", ["plugin"], { input });
    expect(result.status).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output).toMatchObject({ target: "codex-intake", found: true });
    expect(output.observations[0]).toMatchObject({
      name: "codex-intake",
      marketplace: "codex-intake-local",
      installed: true,
      enabled: true
    });
    expect(result.stdout).not.toContain("/Users/private person");
    expect(result.stdout).not.toContain("synthetic-private-value");
    expect(result.stdout).not.toContain("unrelated-secret-plugin");
  });
});

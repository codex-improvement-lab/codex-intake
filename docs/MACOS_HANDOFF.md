# Real-Mac release handoff

Status: **replacement candidate implementation ready; complete direct-Mac rerun pending**.

This handoff applies only to the candidate recorded in `release/REPLACEMENT_CANDIDATE.json`. The 2026-08-26 candidate failed and none of its passing rows transfer to this replacement candidate. Run every gate below again from a fresh transferred tree and a fresh plugin install.

This handoff is intentionally fail-closed. A Windows run, a POSIX branch exercised on Windows, a `macos-latest` workflow, or an unreviewed CI artifact cannot satisfy it. The automated evidence command refuses to run outside Darwin, refuses known CI environments, requires an explicit real-Mac operator attestation, and omits absolute paths and OCR text from its report.

## What is ready by inspection

- `package.json` requires Node.js 20.19+ and pins pnpm 11.19.0.
- `pnpm-lock.yaml` contains the native Vite build dependencies for both `darwin-arm64` and `darwin-x64`, including esbuild and Rollup packages.
- Tesseract.js runs its OCR core as WebAssembly. English and Simplified Chinese trained data come from pinned JavaScript packages; Homebrew Tesseract is neither required nor used.
- The project `postinstall` is `node scripts/prepare-ocr.mjs`. It resolves dependency and destination paths through Node APIs and copies data into the project-local ignored `vendor/ocr/` directory.
- The CLI, Vite server, OCR preparer, marketplace packager, and verifier pass paths as argument arrays or use Node path APIs. No core command requires PowerShell, `cmd.exe`, Bash, or a hard-coded Homebrew prefix.
- The repo marketplace follows the official `$REPO_ROOT/.agents/plugins/marketplace.json` layout and packages the plugin at `./plugins/codex-intake`.

These are implementation facts, not evidence that a Mac ran the product.

## Required Mac

Run on a real Mac with one of these native combinations:

| Hardware | `uname -m` | Node `process.arch` | Verifier argument |
| --- | --- | --- | --- |
| Apple Silicon | `arm64` | `arm64` | `apple-silicon` |
| Intel Mac | `x86_64` | `x64` | `intel` |

An x64 Node process translated by Rosetta on Apple Silicon is rejected as Intel evidence. To claim that both architectures were directly validated, return one complete report from each hardware family. One report supports only the hardware family it names.

The Mac also needs:

- a current Codex CLI and ChatGPT desktop app;
- native Node.js 20.19 or newer;
- internet access during dependency and Chromium installation only;
- a fresh copy of this project placed in a path containing at least one space.

No API key and no system Tesseract installation are required.

## 0. Record the replacement-candidate identity

Before installing dependencies, print the non-sensitive candidate identity and content hash:

```zsh
node -e 'const c=require("./release/REPLACEMENT_CANDIDATE.json"); if(!/^codex-intake@/.test(c.candidateId)||!/^[a-f0-9]{64}$/.test(c.contentSha256)) process.exit(1); console.log(JSON.stringify({candidateId:c.candidateId,contentSha256:c.contentSha256}))'
```

Copy those two values into the operator report. A result from any other version or hash is a different candidate and cannot satisfy this gate.

## 1. Put the project in a space-bearing path

There is no project remote yet. Transfer the prepared source tree without `node_modules`, `vendor/ocr`, `.cache`, `.pnpm-store`, `plugins`, or `release/evidence`, then place it at this exact test location:

```zsh
INTAKE_ROOT="$HOME/Codex Intake Release/codex-intake"
cd "$INTAKE_ROOT"
test "$(uname -s)" = "Darwin"
test -f ".codex-plugin/plugin.json"
test -f "release/REPLACEMENT_CANDIDATE.json"
test ! -d node_modules
node -p "JSON.stringify({platform: process.platform, arch: process.arch, node: process.version})"
```

Do not paste the absolute home path into the returned evidence. Record only that the path-space check passed.

## 2. Install the pinned toolchain and fresh dependencies

If pnpm 11.19.0 is not already installed, install that exact version through npm:

```zsh
npm install --global pnpm@11.19.0
pnpm --version
pnpm install --frozen-lockfile
pnpm exec playwright install chromium
```

Expected pnpm output is `11.19.0`. The install must print `Prepared local OCR data for eng + chi_sim.` and complete without a system Tesseract binary.

Confirm the project-local OCR data exists without printing its contents:

```zsh
test -s "vendor/ocr/eng.traineddata.gz"
test -s "vendor/ocr/chi_sim.traineddata.gz"
```

## 3. Run the guarded Mac gate

For Apple Silicon:

```zsh
pnpm verify:macos -- --real-mac --hardware apple-silicon --out "release/evidence/macos-apple-silicon.json"
```

For an Intel Mac:

```zsh
pnpm verify:macos -- --real-mac --hardware intel --out "release/evidence/macos-intel.json"
```

The command runs the repository gate, unit/CLI tests, Vite build, Chromium Web loop, generated-screenshot OCR, marketplace packaging check, a second direct OCR pass, and a CLI read/write flow whose input and output paths contain spaces. Its JSON report contains versions and pass/fail facts but no absolute path, source body, secret, or OCR text.

The first `--` is pnpm's argument separator. The verifier accepts exactly that leading separator as well as direct Node invocation without it; a separator anywhere else remains an error. The automated platform test protects the exact command shape above.

## 4. Install from the repo-local marketplace

From the source root, prepare the package immediately before installation, add the non-default marketplace, and install the plugin:

```zsh
cd "$INTAKE_ROOT"
EXPECTED_CANDIDATE_ID="$(node -p "require('./release/REPLACEMENT_CANDIDATE.json').candidateId")"
EXPECTED_CONTENT_SHA256="$(node -p "require('./release/REPLACEMENT_CANDIDATE.json').contentSha256")"
pnpm marketplace:prepare
pnpm marketplace:check
test "$(node -p "require('./release/REPLACEMENT_CANDIDATE.json').candidateId")" = "$EXPECTED_CANDIDATE_ID"
test "$(node -p "require('./release/REPLACEMENT_CANDIDATE.json').contentSha256")" = "$EXPECTED_CONTENT_SHA256"
codex plugin marketplace add "$INTAKE_ROOT"
codex plugin marketplace list --json | node "scripts/redact-plugin-status.mjs" marketplace > "release/evidence/marketplace-status.json"
codex plugin add codex-intake@codex-intake-local --json | node "scripts/redact-plugin-status.mjs" plugin > "release/evidence/plugin-install.json"
codex plugin list --marketplace codex-intake-local --available --json | node "scripts/redact-plugin-status.mjs" plugin > "release/evidence/plugin-status.json"
```

Open the three generated JSON files. `marketplace-status.json` and `plugin-status.json` must show `found: true`; the plugin observation should show installed/enabled state when the current CLI returns those fields. The redactor intentionally drops source roots, cache roots, unrelated plugins, and unknown fields.

Resolve the installed copy from fresh plugin status and audit the exact package that Codex copied. Do not hard-code a `local`, semantic-version, Apple Silicon, or Intel cache leaf. The resolver fails unless exactly one cache entry matches status, stays within the expected cache root, has the expected manifest and candidate ID, and reproduces the replacement candidate's package SHA-256. Raw status is consumed only through the pipe and is not saved:

```zsh
PLUGIN_CACHE="$(codex plugin list --marketplace codex-intake-local --available --json | node "scripts/resolve-installed-copy.mjs" --audit-out "release/evidence/installed-copy.json")"
test -n "$PLUGIN_CACHE"
test -f "$PLUGIN_CACHE/.codex-plugin/plugin.json"
test -f "$PLUGIN_CACHE/.codex-package.json"
cd "$PLUGIN_CACHE"
pnpm install --frozen-lockfile
pnpm exec playwright install chromium
pnpm test
pnpm build
pnpm test:e2e
node "scripts/intake.mjs" "examples/incident.log" "examples/request.txt" --out "/tmp/codex intake brief.md"
test -s "/tmp/codex intake brief.md"
grep -q "S01:L2" "/tmp/codex intake brief.md"
grep -q "## Done when" "/tmp/codex intake brief.md"
! grep -q "example_redact_me" "/tmp/codex intake brief.md"
rm -f "/tmp/codex intake brief.md"
```

Those safe assertions inspect only `S01:L2`, the `Done when` heading, and absence of the synthetic value `example_redact_me`; they do not print the brief. `installed-copy.json` must show the same candidate ID and content SHA-256 as step 0, with both identity checks set to `true`; it must not contain an absolute path.

## 5. Observe the Web and OCR loop on the Mac

Still inside `PLUGIN_CACHE`, start the local UI:

```zsh
pnpm dev
```

In a local browser at `http://127.0.0.1:5173`:

1. Load the 20-second demo and follow a green source pointer.
2. Replace the objective with `MAC EDIT: preserve this objective after source refresh.`
3. Upload a synthetic screenshot containing an error line and a command.
4. Confirm the screenshot is source `S04`, then run local OCR and confirm an `S04:OCR:L…` pointer appears.
5. Confirm the objective still has the exact edited value after upload and again after OCR.
6. Download Markdown and confirm the exact edited value is present while the raw synthetic bearer value is absent.

This order is also one automated Chromium test. A browser result that edits only after OCR does not satisfy the ownership regression gate.

Stop the server with Control-C. Record this as direct-Mac operator observation, not real-user evidence.

## 6. Activate in a fresh Codex task

Fully quit and reopen the ChatGPT desktop app after marketplace installation. Open the project, confirm **Codex Intake** appears under Installed plugins and is enabled, then create a **new Codex task**. Do not reuse the installation task.

Use this exact first prompt:

```text
$codex-intake Compile only examples/incident.log and examples/request.txt into a reviewed source-linked brief. Do not start implementation. Return the brief and preserve every source pointer.
```

Pass criteria:

- the fresh task recognizes the `codex-intake` skill;
- it uses only the two selected files;
- the result includes `S01:L2`, privacy review, and testable done-when;
- it does not reproduce `example_redact_me`;
- it does not claim an MCP server, hook, native dropzone, or external connector.

Codex CLI can be checked independently by starting `codex`, opening `/plugins`, and then starting a new CLI session before invoking `$codex-intake`. The new-session boundary is required by the official plugin guidance.

## 7. Verify uninstall and state boundaries

After the fresh-task test, remove the plugin and marketplace:

```zsh
cd "$INTAKE_ROOT"
codex plugin remove codex-intake@codex-intake-local --json | node "scripts/redact-plugin-status.mjs" plugin > "release/evidence/plugin-remove.json"
codex plugin marketplace remove codex-intake-local --json | node "scripts/redact-plugin-status.mjs" marketplace > "release/evidence/marketplace-remove.json"
codex plugin marketplace list --json | node "scripts/redact-plugin-status.mjs" marketplace > "release/evidence/marketplace-after-remove.json"
codex plugin list --available --json | node "scripts/redact-plugin-status.mjs" plugin > "release/evidence/plugin-after-remove.json"
```

The final two reports must show `found: false`. Uninstall removes the installed bundle and Codex enablement state. It does not delete the transferred source checkout or dependencies installed inside that checkout. Codex Intake has no connector, account state, telemetry, server, or persistent browser draft to disconnect.

## 8. Return the result

Create a hardware-specific operator report from the template:

```zsh
cp "release/MACOS_VALIDATION_RESULT.template.md" "release/evidence/MACOS_VALIDATION_RESULT.md"
```

Complete it and return only:

- `MACOS_VALIDATION_RESULT.md`;
- the guarded `macos-*.json` report;
- the seven redacted marketplace/plugin status JSON files;
- `installed-copy.json`, containing the redacted installed candidate identity and content hash;
- an optional product-only screenshot with usernames, absolute paths, notifications, and unrelated windows removed.

Do not return raw `codex plugin ... --json` output, shell history, home paths, serial numbers, source bodies, OCR text, tokens, or customer data.

## Release gate

`MACOS_VALIDATION_RESULT=PASS` requires every automated and manual item above to pass on the same candidate ID and content SHA-256 on the named hardware. No row from the failed 2026-08-26 candidate may be reused. Until a complete replacement-candidate report is returned, release status remains **macOS implementation ready / full real-Mac rerun pending**. A second complete report is required before claiming both Apple Silicon and Intel were directly validated.

Official references: [Package your plugin](https://developers.openai.com/plugins/build/plugins) and [Use and install plugins](https://learn.chatgpt.com/docs/plugins).

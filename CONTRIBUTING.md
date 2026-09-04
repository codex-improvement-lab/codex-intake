# Contributing to Codex Intake

Thank you for helping make the minute before execution less chaotic.

## Keep the promise narrow

Changes should improve this loop: **selected messy inputs → editable source-linked brief → privacy review → testable done-when → redacted export**.

Good additions strengthen a supported source type, provenance precision, redaction safety, editability, accessibility, or the handoff. Unrelated task management, agent orchestration, cloud storage, and model-backed summarization belong in separate experiments until evidence shows they are necessary.

## Set up locally

Use Node.js 20.19+ and pnpm 11.

```bash
pnpm install
pnpm test
pnpm build
pnpm test:e2e
pnpm marketplace:check
pnpm check:macos-design
```

`pnpm install` copies Tesseract English and Simplified Chinese trained data from installed packages into ignored `vendor/ocr/`. Do not commit generated OCR data, dependency stores, browser binaries, or reports.

`pnpm marketplace:check` regenerates the ignored `plugins/codex-intake` package before validating it. Never edit that generated copy; change the source tree and regenerate. `pnpm check:macos-design` is a static audit and must never be reported as a Mac run. Direct Mac claims require [docs/MACOS_HANDOFF.md](docs/MACOS_HANDOFF.md).

Normal browser tests write screenshots into Playwright's ignored test-output directory and never rewrite the checked-in README images. Refresh those public assets only as an explicit maintainer action:

```powershell
$env:CODEX_INTAKE_REFRESH_ASSETS = "1"
pnpm test:e2e --grep "the demo explains"
Remove-Item Env:CODEX_INTAKE_REFRESH_ASSETS
```

```bash
CODEX_INTAKE_REFRESH_ASSETS=1 pnpm test:e2e --grep "the demo explains"
```

After a deliberate refresh, visually inspect both PNG files before accepting them. `pnpm release:check` keeps public assets immutable and stamps the marketplace candidate only after every source-mutating gate has finished.

## Non-negotiable invariants

- Every rule-derived finding, risk, gap, and done-when has a valid source ID and locator.
- Source IDs survive updates; pointers identify exact revisions. A changed source never silently inherits a prior edit or confirmation as current evidence.
- Batch preview/discard must not mutate accepted state. Undo restores sources using the current edit ledger so later manual edits survive.
- Portable exports never contain raw source bodies.
- Redaction tests use synthetic secrets and verify the raw values are absent.
- URLs are not fetched without a new, explicit user action and threat review.
- Directory inventory does not read file bodies.
- New platform claims name the actual environment that ran.
- Synthetic, automated, physical-device, and real-user evidence remain separate.
- A successful release check must leave every content-hashed source file unchanged after the final candidate identity is stamped.

## Make a change

1. Add or update an observable test before changing an extraction rule.
2. Use synthetic fixtures; never commit live logs, keys, customer data, or personal screenshots.
3. Run `pnpm release:check`.
4. Update `CHANGELOG.md` and the relevant product or architecture note when behavior changes.
5. Include a before/after screenshot only when the UI changed materially.

Avoid rules that merely match a preferred sentence. Tests should protect behavior: pointer validity, deterministic output, absence of raw secrets, supported input handling, and meaningful interactions.

## Commit and release ownership

Maintainers control commits, tags, remotes, releases, plugin submission, and external claims. Contributors should not treat a green local check as evidence that CI, macOS, a physical device, or a public plugin directory has been validated.

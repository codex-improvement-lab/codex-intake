# Published Intake releases

## Current: 0.2.0-rc.1

[Download the source ZIP and SHA-256 sidecar](https://github.com/codex-improvement-lab/codex-intake/releases/tag/v0.2.0-rc.1).

- Source commit: `1ea38e755c876d3cd80d2a8f89df1358e0311f2d`.
- Source ZIP: 747295 bytes; SHA-256 `3bf8be11737ffb061550ae471ea7ecdfb1cee0c9a683ef1b5ef16c0b6708830f`.
- [Four hosted jobs passed](https://github.com/codex-improvement-lab/codex-intake/actions/runs/33927647670): Windows/macOS/Linux core plus Linux browser checks.
- Local final checks: 26 unit/CLI/platform tests and 12 browser scenarios, including actual local OCR from synthetic input and desktop/narrow source-update review.
- Clean source checkout, isolated plugin installation/upgrade, exact cached-package hash, and the downloaded ZIP's text CLI passed. Download checks used no GitHub authentication.

[Machine-readable publication record](PUBLICATION_v0.2.0-rc.1.json) binds source, CI, assets and verification. The source checklist is a pre-publication snapshot; this record closes its external publication actions without modifying the frozen marketplace payload. No new physical-Mac, real-user, npm or hosted plugin-directory result is claimed.

## Baseline: 0.1.0

[First public preview](https://github.com/codex-improvement-lab/codex-intake/releases/tag/v0.1.0), published before source-update development, remains available independently. [Its publication record](../docs/evidence/releases/v0.1.0.json) contains its own source, checks and hashes.

## Run locally

Extract the ZIP. The text CLI needs Node.js 20.19+ only:

```text
node scripts/intake.mjs examples/incident.log examples/request.txt
```

For the browser and local OCR, install the pinned dependencies, then start the local server:

```text
pnpm install --frozen-lockfile
pnpm dev
```

Open http://127.0.0.1:5173. Source-update review is session-local: accept/discard a pending batch, or undo the latest accepted batch while preserving manual edits.

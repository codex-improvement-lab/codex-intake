# Changelog

## Publication preparation — 2026-09-05

- Add public repository/download/security routes and retain the accepted historical macOS receipt separately from current package identity.
- Prepare a source archive with clean-copy verification; its text CLI runs without dependency installation. Product runtime remains the v0.1 baseline.

All notable changes will be documented here. The project follows Semantic Versioning once the first public tag exists.

## [0.1.0] - Unreleased

### Added

- Local Web dropzone for text, logs, screenshots, URL registration, and file inventories.
- Deterministic source IDs, fingerprints, exact locators, findings, gaps, privacy warnings, and done-when candidates.
- English and Simplified Chinese screenshot OCR through local Tesseract.js.
- Editable title, objective, context ledger, and completion criteria.
- Redacted Markdown, JSON, and ready-to-paste Codex prompt exports that omit raw source bodies.
- Cross-platform CLI and directory inventory mode.
- Skill-only Codex plugin package with no claimed MCP, hook, or App Server integration.
- Unit, CLI, browser, download, OCR, provenance, and privacy tests.
- Windows automated evidence and a macOS/Windows CI design, with direct macOS evidence still pending.
- Repo-local Codex marketplace generation, validation, installed-copy test instructions, and fresh-task/uninstall handoff.
- Static Apple Silicon/Intel dependency audit and a Darwin-only, non-CI macOS evidence gate with redacted reports.
- Exact real-Mac CLI, Web, OCR, path-with-spaces, plugin state, and teardown checklist; direct Mac reports remain pending.
- Explicit user-edit ownership and deterministic merge rules that preserve edited brief fields through source additions and OCR recompiles.
- Strict Chromium regression for the real-Mac handoff order: demo, pointer, objective edit, screenshot upload, OCR, and Markdown export.
- Leading pnpm `--` separator support in the guarded macOS verifier.
- Status-constrained installed-copy resolution with no hard-coded cache leaf, realpath/manifest/package verification, and redacted audit output.
- Cache-busted replacement-candidate identity plus deterministic marketplace content SHA-256; earlier-candidate evidence is non-transferable.
- Provenance Lens for tracing one real source through every linked brief signal while dimming unrelated material.
- Proofing Press design direction and a browser regression for the source-to-brief trace interaction.
- An explicit keyboard-accessible `Trace links` control on every source card, making Provenance Lens discoverable without first finding a pointer chip.

### Fixed

- Made the guarded macOS verifier test assert the actual Darwin/non-Darwin branch instead of expecting a Windows-only refusal on every platform.
- Compared installed plugin paths after `realpath` normalization so macOS `/var` and `/private/var` aliases do not create a false test failure.
- Kept default browser and release validation from rewriting the checked-in public screenshots that participate in marketplace candidate hashing.
- Moved marketplace candidate generation to the final release step so the published identity describes the post-validation source state and is reproducible on an immediate second preparation.
- Corrected the lab handoff selector so it excludes only the generated top-level `plugins/` tree while retaining the required `.agents/plugins/marketplace.json` source file.

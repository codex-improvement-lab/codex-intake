# Security and privacy

Codex Intake handles exactly the kind of material that people accidentally overshare. Its default design is therefore local and data-minimizing, but it is not a data-loss-prevention product.

## Threat model

The v0.1 design assumes the local machine, browser profile, Node runtime, and installed package set are trusted. It aims to reduce these risks:

- raw task material sent to a model or external service before review;
- credentials or personal identifiers copied into a task brief;
- a tool silently reading adjacent files or fetching a URL;
- extracted claims losing the evidence needed to challenge them.

It does not protect against malware on the machine, a compromised dependency, an already-compromised browser, screenshots with steganographic content, or sensitive values outside its deterministic patterns.

## Data flow

- Browser file handles exist only in the current page session.
- Screenshot bytes go to the localhost Vite OCR endpoint and are processed by local Tesseract.js.
- The endpoint enforces a 12 MB limit and does not store the image.
- CLI paths are read only when passed explicitly; `--inventory` lists names and does not open bodies.
- Exports include fingerprints, masked excerpts, and pointers, not raw source content.

## Dependency posture

The lockfile pins resolved artifacts. pnpm `allowBuilds` permits install scripts only for `esbuild` and `tesseract.js`; newly introduced dependency scripts fail closed until reviewed. OCR trained data is copied from the locked language packages during installation.

The local marketplace package is generated from an explicit allowlist and excludes dependency stores, OCR data, caches, Git state, and prior validation evidence. Mac evidence JSON omits absolute paths, source bodies, and OCR text. `scripts/redact-plugin-status.mjs` reduces Codex status output to the Codex Intake record before it is saved; raw global plugin status should not be shared.

## Reporting a vulnerability

Use [GitHub private vulnerability reporting](https://github.com/codex-improvement-lab/codex-intake/security/advisories/new). Keep raw input, credentials and unredacted reproductions out of public issues. If the private route is temporarily unavailable, retain the report privately.

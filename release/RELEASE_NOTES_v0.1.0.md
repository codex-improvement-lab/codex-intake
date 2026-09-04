# Codex Intake v0.1.0 — first public preview

Turn selected notes, logs, screenshots and inventories into an editable, source-linked brief. The local rules engine emits reviewable candidates, masks detected sensitive values and exports Markdown/JSON without raw source bodies.

- Provenance Lens links findings and done-when candidates to explicit source pointers.
- User-edited fields survive source additions and OCR recompiles.
- English and Simplified Chinese OCR run locally after dependency installation. URLs are registered, never fetched.
- Text/log/inventory CLI requires only Node 20.19+; the Web UI and OCR require the pinned pnpm dependency install.

## Try it

Extract the source ZIP and run:

```text
node scripts/intake.mjs examples/incident.log examples/request.txt
```

For the browser and OCR:

```text
pnpm install --frozen-lockfile
pnpm dev
```

Open http://127.0.0.1:5173 and load the demo. See README for optional local plugin preparation.

## Evidence

15 unit/CLI/platform tests and 5 browser scenarios pass locally on Windows, including OCR. The exact historical Mac candidate retains its accepted external functional PASS; current publication metadata has a new identity. Hosted results are recorded separately for the tagged source commit.

This is a GitHub prerelease. No new physical-Mac, real-user, production or market result is claimed. npm and hosted plugin-directory publication are separate.

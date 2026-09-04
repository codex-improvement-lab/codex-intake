# Architecture

## Product boundary

Codex Intake prepares a task contract. It does not run the task, manage agents, fetch remote context, persist a knowledge base, or decide that work is complete.

## Components

### Deterministic core

`src/core/intake.js` normalizes explicitly selected sources, preserves explicit stable desk IDs and revisions (or assigns deterministic IDs for fresh CLI input), computes FNV-1a fingerprints, extracts bounded candidates, scans privacy patterns, and derives initial done-when and gaps. It contains no Node-only API and runs in the browser and CLI. Fingerprints are comparison aids, not authenticity proofs.

`src/core/export.js` builds portable JSON, Markdown, and a Codex prompt. The portable shape is rebuilt field by field; source `content`, browser `File`, and preview URL fields cannot enter the export by accidental object spread.

`src/core/validate.js` checks locators and the exact source ID/revision pair against current sources or retained historical metadata. Duplicate current IDs and missing revisions fail validation.

### Browser dropzone

`src/main.js` owns an in-memory source pile and editable brief. File bodies are read only after browser selection. The app deliberately avoids silent `localStorage` persistence; saving is an explicit export.

`src/core/edit-ownership.js` keeps explicit edit records with their original candidate, source revision and source metadata. A still-supported item receives its user field values. A changed or removed source leaves an edited item visible with its old reference and `needs-review`; new compiler candidates remain separate. Confirmation is revision-bound. Keeping a stale requirement detaches it as `USER:manual` and retains `previousPointer`.

`src/core/source-updates.js` builds a proposed brief and a before/after change list without mutating the accepted state. The UI accepts or discards the whole proposed source batch. One Undo snapshot restores the previous sources using current edit ownership, so edits made after acceptance survive. Changed content must get a new source revision; only the Undo path permits moving back to an earlier revision.

The revision history stores only referenced source metadata. Raw inputs and selected File/blob handles stay in page memory. Unused preview URLs are revoked when no longer needed by current, pending or Undo inputs. Clearing the desk cancels in-flight OCR and invalidates its result. Clearing or loading a demo explicitly resets the desk.

Screenshot OCR calls only `/api/ocr` on the same local origin. `vite.config.js` installs that bounded middleware in both development and preview mode.

### Local OCR

`src/server/ocr.js` reuses one Tesseract worker with English and Simplified Chinese trained data. `scripts/prepare-ocr.mjs` copies trained data from locked dependencies into ignored `vendor/ocr/` during install. No language model is fetched when OCR runs.

### CLI

`scripts/intake.mjs` accepts explicit files, pasted text, registered URLs, and directory inventory. Images are registered without OCR unless `--ocr` is present. Directory traversal follows directories but not symbolic links, uses a bounded depth, sorts entries, and does not open file bodies.

### Codex plugin

The plugin is skill-only. The skill routes Codex to the CLI, the visual editor, or an existing export. It does not gain filesystem permission, silently invoke a hook, or claim a server-backed tool.

`scripts/prepare-marketplace.mjs` creates the ignored `plugins/codex-intake` install copy from an explicit allowlist. The repo-local `.agents/plugins/marketplace.json` points only at that canonical package location. The generated bundle includes the CLI, Web/OCR runtime, tests, documentation, and legal files, but excludes Git state, dependency stores, OCR caches, prior evidence, and the marketplace itself. `scripts/check-marketplace.mjs` rejects a stale manifest or an incomplete/recursive package.

The generated package record carries a candidate ID and a deterministic SHA-256 over sorted relative paths plus each file digest. The candidate record stays outside the package to avoid a self-hash cycle. `scripts/resolve-installed-copy.mjs` combines Codex plugin status with manifest, realpath, package-record, and recomputed-content checks; cache leaf names are never assumed.

## Source and pointer model

| Source kind | Locator examples | Meaning |
| --- | --- | --- |
| text / log | `L4` | normalized one-based line |
| screenshot | `image`, `OCR:L7` | selected image metadata or OCR text line |
| file list | `entry 3` | normalized ordered entry |
| URL | `URL` | registered URL string, not fetched content |
| user edit | `USER:manual` | authored in the brief, not extracted |

Pointers keep a masked excerpt for review. A pointer is provenance, not proof that the extraction is correct.

## Determinism contract

Identical ordered source inputs produce identical core output. The contract excludes:

- OCR across different Tesseract/library versions;
- browser-generated object URLs;
- user edits after compilation;
- filesystem inventories when the selected directory changes.

The portable compiler result itself contains no timestamp or random value.

## Security boundary

The UI and CLI can see raw selected content while compiling. Exports cannot. This is enforced by construction and tested with synthetic secrets. See [SECURITY.md](../SECURITY.md) for the wider threat model.

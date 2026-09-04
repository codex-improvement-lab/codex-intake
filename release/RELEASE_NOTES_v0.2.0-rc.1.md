# Codex Intake 0.2.0-rc.1 — Review source updates

Your inputs change. The brief you reviewed should survive.

This preview adds a complete source-update loop: preview the affected suggestions, accept or discard the batch, and undo the latest accepted update while keeping manual edits.

- Add several sources, update pasted text, replace a selected file, remove a source, or rerun local OCR.
- Keep stable source IDs and revision-specific pointers.
- Preserve edited title, objective, findings, criteria and exclusions. When supporting material changes, retain the old reference and mark the edit for review.
- Distinguish rule candidates from user-confirmed requirements. Keeping a stale requirement records an explicit user decision with its old reference.
- Export schema 1.1 with review states and retained source metadata; raw bodies remain excluded and detected sensitive values masked.
- Keep review actions visible at desktop and 390px widths; cancel obsolete OCR after clearing the desk.

## Try it

Download and extract the source ZIP. Requires Node.js 20.19+ and pnpm 11.19.0 for the browser and OCR:

```text
pnpm install --frozen-lockfile
pnpm dev
```

Open http://127.0.0.1:5173, load the demo, edit the objective, then choose **Update source** on S01. Review the batch and try **Discard update**, **Accept all source changes**, and **Undo last source update**.

Text/log/inventory compilation works without installing dependencies:

```text
node scripts/intake.mjs examples/incident.log examples/request.txt
```

The browser review desk is session-local. Confirmation is a scope decision, not proof of task correctness; old references are not automatically relabeled as current support.

## Validation scope

The release is gated by unit/CLI/platform checks, browser interaction including local OCR, desktop/narrow visual checks, clean source installation, marketplace packaging and hosted CI. The exact report and source commit are linked from the GitHub Release.

The accepted historical v0.1 Mac candidate remains intact. This upgrade has no new physical-Mac or real-user acceptance; hosted results are recorded separately. No npm or hosted plugin-directory submission is included.

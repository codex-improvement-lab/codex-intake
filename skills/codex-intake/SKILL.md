---
name: codex-intake
description: Prepare an editable, source-linked task brief when a user starts with mixed notes, logs, screenshots, URLs, or file inventories. Use before execution when the inputs need privacy review and explicit done-when criteria; do not use for an already clear one-line task.
---

# Codex Intake

Turn the selected inputs into a task contract without inventing missing facts.

## Choose the path

- For text, logs, URLs, and file inventories, use the plugin-root `scripts/intake.mjs` CLI. Resolve the plugin root as two directories above this `SKILL.md`.
- For screenshots or when the user needs to edit the draft visually, use the local Web dropzone from the plugin root with `pnpm install` and `pnpm dev`. Local OCR supports English and Simplified Chinese after dependencies are installed.
- For an existing Codex Intake Markdown or JSON export, read it directly and preserve its source pointers.
- For an existing `intake-requirements/1` snapshot, use plugin-root `scripts/requirements.mjs` to continue explicit review and export to Proofline. New candidates are not confirmed merely because they were generated; confirm only requirements covered by the user's stated scope or explicit review decision.

Do not fetch a registered URL, read an unselected path, call a model API, or upload material unless the user separately asks for that action.

## Produce the handoff

1. Compile the explicitly selected inputs. Example: `node scripts/intake.mjs error.log notes.txt --inventory src --format md`.
2. Review every critical or high privacy finding before sharing. Never reproduce the detected secret value.
3. Treat rule-derived findings as candidates. Keep their `Sxx:locator` and `sourceRevision` pointers and distinguish missing expected behavior or reproduction steps from facts.
4. Let the user edit the title, objective, context ledger, and done-when. User-authored criteria use the `USER:manual` pointer.
5. Start implementation only if the user also asked to execute the task. Otherwise return the reviewed brief as the outcome.

The brief is ready when every extracted finding, privacy warning, gap, and generated done-when has a valid source pointer and the exported artifact contains no raw source body.

## When sources change

Use the Web UI's source-update review for additions, replacements, removals or OCR refreshes. Accept/discard applies to the source batch, separately from requirement confirmation. Undo reverses the last source update while keeping manual edits, including later edits.

In schema 1.1 exports, preserve `candidate`, `user-confirmed` and `needs-review` distinctions. A retained edit can point to an older revision in `sourceHistory`; do not present that as current evidence. `USER:manual` plus `previousPointer` means the user kept a requirement as their own decision, not that new evidence supports it. Confirmation is a scope decision, not proof that a task or test passed.

For cross-session requirements, save a scoped snapshot from the browser or use `node scripts/requirements.mjs prepare --scope <project> --out <new-snapshot> <selected-text-files>`. Continue from a saved file with `--previous`. Review names specific IDs; revise keeps a logical ID but resets confirmation, exclude withdraws it, and keep records explicit manual retention with the previous pointer. Do not silently attach kept manual requirements to a newly selected source. Source renames and ambiguous repeated signals require review.

Inspect detected-signal coverage and explicit exclusions. It does not establish semantic completeness. Saved snapshots contain redacted requirements and pointers, not source bodies. Keep this path optional for already clear tasks; extra snapshots, review and import steps are real maintenance costs.

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

Do not fetch a registered URL, read an unselected path, call a model API, or upload material unless the user separately asks for that action.

## Produce the handoff

1. Compile the explicitly selected inputs. Example: `node scripts/intake.mjs error.log notes.txt --inventory src --format md`.
2. Review every critical or high privacy finding before sharing. Never reproduce the detected secret value.
3. Treat rule-derived findings as candidates. Keep their `Sxx:locator` pointers and distinguish missing expected behavior or reproduction steps from facts.
4. Let the user edit the title, objective, context ledger, and done-when. User-authored criteria use the `USER:manual` pointer.
5. Start implementation only if the user also asked to execute the task. Otherwise return the reviewed brief as the outcome.

The brief is ready when every extracted finding, privacy warning, gap, and generated done-when has a valid source pointer and the exported artifact contains no raw source body.

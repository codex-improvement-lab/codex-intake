# Native product proposal: Codex Intake Shelf

This document describes the part a community plugin cannot honestly implement.

## Proposal

Add an **Intake Shelf** to the native new-task surface: a temporary, on-device area where a user can drop screenshots, files, selected text, URLs, and share-sheet items before the task exists. Codex turns the shelf into an editable brief, shows privacy findings, and creates the task with stable references to the original attachments.

## Observed gap

The community prototype can provide a local browser dropzone, CLI, deterministic compiler, and skill workflow. It cannot:

- add a first-class drop shelf to the signed Codex composer or OS share menu;
- bind source pointers to Codex's internal attachment objects across edits and task creation;
- carry the reviewed brief and original attachments into a new native task as one atomic action;
- guarantee the same on-device extraction/privacy UI across desktop, IDE, mobile, and cloud surfaces.

MCP UI renders alongside a conversation after a tool path is available. Hooks run lifecycle commands after explicit trust. App Server lets a separate product host a deep Codex client. None is an extension point for modifying the existing native new-task composer.

## Native loop

1. User opens New Task or invokes **Share to Codex Intake**.
2. Shelf displays every input as a local source card with type, size, and retention state.
3. On-device extractors create source-linked candidates; unsupported types remain visible and unparsed.
4. Privacy review defaults high-risk values to excluded/redacted.
5. User edits objective and done-when, then selects **Create task**.
6. Codex creates one task whose attachments, brief pointers, and privacy decisions share stable IDs.

## Required product contracts

- No network or model call before the UI clearly discloses it.
- Every generated sentence offers “show source.”
- Redaction affects the model-visible copy, not the user's recoverable original.
- Unsupported extraction is explicit; absence of a warning never means safe.
- Task creation is atomic: either attachment and brief references agree, or creation fails visibly.
- Enterprise policy can disable source types, OCR, model enrichment, or retention independently.

## Falsifiable hypotheses

Compared with today's direct-paste flow for mixed-input tasks:

- median time from first selected input to an actionable first Codex turn decreases by at least 35%;
- source-related clarification turns in the first five turns decrease by at least 25%;
- unintentional synthetic-secret inclusion in the submitted prompt decreases by at least 60%;
- at least 70% of generated done-when retained at submission are still used in final verification.

## Evidence needed

The current prototype supplies automated interaction evidence only. A native investment decision still needs:

- moderated Windows and macOS sessions with 8–12 users doing real mixed-input tasks;
- instrumentation for time-to-first-actionable-turn, pointer opens, edits, warning actions, and retained criteria;
- a controlled synthetic-secret study with consent and no live credentials;
- comparison with direct attachment/paste and a plain prompt-template baseline.

## Continue / stop rule

Continue toward a native prototype if at least two of the four hypotheses pass and privacy interventions do not create a material abandonment spike. Stop or narrow to a share-sheet/attachment organizer if source pointers are rarely opened and clarification reduction is below 10%.


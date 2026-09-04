# Source updates in 0.2.0-rc.1

The browser desk now separates the accepted brief from a proposed source update. This is a page-session workflow: source bodies, edit ownership and the one-step Undo snapshot are not silently saved across browser reloads.

## Review a change

- **Add files / Paste input / Register URL:** the first intake compiles immediately. Later additions enter one review batch; several selected files are accepted or discarded together.
- **Update source:** edit a selected text/log/inventory/URL source while retaining its ID.
- **Replace file:** choose one replacement file explicitly. The source ID stays the same even if the filename or input kind changes.
- **Run local OCR / Run OCR again:** extraction produces a proposed source revision. Review it before applying it to the accepted brief.
- **Remove:** removal also enters the review flow. Later sources keep their existing IDs.

The review panel shows source revisions, before/after suggestions, preserved edits and items requiring review. Editing and export of the accepted brief are temporarily disabled while a batch is pending. The export bar is hidden so it cannot cover the review actions.

**Accept all source changes** applies the source batch and compiler suggestions. It does not confirm generated requirements. **Discard update** leaves the accepted inputs and edited brief unchanged.

## Preserve edits without inventing support

Title and objective remain user-owned once edited. Findings and completion criteria keep their original candidate and source metadata in the edit ledger.

| Original source | Result for a user-edited item |
| --- | --- |
| Same source revision and candidate | Keep the edited text and its current pointer |
| Replaced, OCR-refreshed or removed | Keep the text with its previous pointer; mark `needs-review`; show new compiler candidates separately |
| User chooses **Keep as my requirement** | Keep the wording as an explicit user decision at `USER:manual`, with `previousPointer` retained |

This is deliberately conservative: refreshing an entire source marks its edited findings for review even if a particular line looks similar. Intake does not guess that a changed line or a replacement document supports the old wording.

## Confirmation and Undo

**Rule candidate**, **Edited candidate**, **User-authored candidate** and **User confirmed** have distinct labels. **Confirm requirement** records an explicit scope decision. Editing its text removes confirmation. Source replacement makes source-bound confirmation stale. Confirmation never means that implementation or a test has passed.

**Undo last source update** restores the previous accepted inputs while applying the current edit ledger. Thus manual edits made after acceptance are kept. An edit based on a source removed by Undo is retained with a historical pointer and a review marker. With no later edit, Undo restores the original portable JSON bytes. Only one accepted source batch is undoable at a time.

Clearing the desk or loading a new demo explicitly resets the desk and edit ledger. Clearing aborts in-flight OCR; a late result cannot repopulate the cleared desk. Preview object URLs are kept only while current, pending or Undo inputs need them.

## Export schema 1.1

Current sources carry `id` and positive `revision`. A pointer includes `sourceId`, `sourceRevision`, `locator` and a masked `excerpt`; `USER:manual` has no source revision.

- `fieldOwnership` distinguishes compiler and user-edited scalar fields.
- Done-when items include `authorship` and `confirmation`: `candidate`, `user-confirmed` or `needs-review`.
- Findings include `authorship` and `reviewStatus`.
- `sourceHistory` contains only metadata for earlier or removed revisions referenced by preserved edits.
- `previousPointer` records the old reference when a stale requirement becomes a user decision.

Markdown includes the same distinctions and links to revision-specific source anchors. JSON and Markdown omit raw bodies, File handles and preview URLs, and mask detected sensitive values in preserved edits and historical labels too. FNV-1a source fingerprints are deterministic comparison aids, not cryptographic authenticity proofs.

The CLI shares extraction, revision-aware pointers and schema 1.1 export. Interactive source update/review/Undo is available in the Web UI; the CLI does not import or persist an editable desk.

## Three acceptance examples

1. Edit a task title, objective, finding and acceptance check. Replace S01. The text survives; affected source-bound edits retain r1 and require review; generated r2 candidates are separate.
2. Add two files in one selection. Discard the batch and compare exports; then accept it and undo it. Source order and existing edits remain intact.
3. Accept a replacement, make another manual edit, then undo the source update. The later edit survives. Repeat with OCR, including a clear-desk action while OCR is pending.

The automated suites cover these cases with synthetic inputs. They are implementation evidence, not human usability, real-user or physical-Mac acceptance.

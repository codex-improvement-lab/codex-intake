# Reviewed requirements for Proofline

Save the decisions needed for a later CLI session in one local `intake-requirements/1` file. It contains a project scope, stable requirement IDs, requirement and snapshot revisions, explicit confirmation states, source pointers, retained references and redacted text. It contains no source bodies. This is a review record, not an authenticated human signature or evidence that execution succeeded.

In the browser, review the criteria, expand **Save requirements for Proofline**, choose a stable **Project key**, then download. Repeated saves in the same desk preserve IDs. Browser drafts still live in memory; the saved file is the continuation point for the CLI. Opening a new browser desk does not silently recover or merge old decisions.

```sh
node scripts/requirements.mjs prepare --scope checkout --out candidates.json request.txt
node scripts/requirements.mjs review --input candidates.json --id checkout-R001 --decision confirm --out reviewed.json
```

Review each selected ID explicitly. To confirm or revoke several IDs together, repeat `--id` and supply the exact snapshot revision you read:

```sh
node scripts/requirements.mjs review --input candidates.json --revision 1 --id checkout-R001 --id checkout-R002 --decision confirm --out reviewed.json
node scripts/requirements.mjs review --input reviewed.json --revision 2 --id checkout-R001 --id checkout-R002 --decision candidate --out reconsider.json
```

The whole selection is checked before changes: missing/unknown/duplicate IDs, stale revision, malformed snapshot or a withdrawn/needs-review item rejects the batch. Successful batches advance the snapshot revision once, preserving unselected items and requirement revisions. Already-confirmed or already-candidate items may be selected idempotently; the accepted decision batch still gets a new snapshot revision. `keep`, `revise` and `exclude` remain single-ID operations. Single-ID review supports `--revision` while retaining its prior optional-precondition behavior.

There is no automatic confirm-all switch. `--out` writes complete bytes to a same-directory temporary file and atomically publishes a new file with exclusive hard-link creation; it refuses to overwrite and cleans the temporary file. Filesystems without that operation fail closed. Omit `--out` to write one JSON document to stdout. `prepare --previous reviewed.json --out proposed.json request.txt` updates a snapshot from explicitly selected files. The CLI supports text, logs and inventories; browser exports also support the existing selected image/OCR flow.

Source basenames must be unique. Matching names retain source IDs and content changes advance source revisions; newly selected names get new IDs. Unselected files are not read. Renaming a source is a new selection, not an inferred identity match.

## Identity and source changes

- A unique, identical full signal within the same source keeps its requirement identity and prior confirmation even if its line moves or another line changes. The exact selected signal is compared in memory; its SHA-256 digest is saved. A source digest alone does not decide which requirement survived.
- A changed signal gets a new candidate ID and the old item is withdrawn, or retained as needing review when the desk preserves an edit. The tool does not guess that similar wording is the same logical requirement. Masked-value changes also change the support digest and cannot inherit confirmation.
- Duplicate identical signals are ambiguous. Source revisions invalidate their confirmations conservatively. Metadata-only/image candidates likewise cannot reuse a confirmation across source changes based solely on the same preview.
- `review --decision revise --text "..."` is an explicit change to one logical requirement: keep its ID, increment its revision, mark it candidate, and preserve the previous source pointer. `confirm` is a separate operation.
- `exclude` withdraws an item; `candidate` revokes its confirmation. `keep` explicitly retains an old-source requirement as reviewer-authored with a `USER:manual` pointer and the old reference. It does not claim the new source supports the old text.

Requirement support digests use SHA-256. Source metadata imported from an older desk history may retain the existing FNV-1a fingerprint; `digestAlgorithm` names the difference. Neither fingerprint authenticates the source or reviewer. Unknown snapshot fields are rejected to avoid carrying private extensions through review exports.

## Import and inspect

```sh
proofline doctor --contract reviewed.json --dependencies dependencies.json --json
proofline run AC-01/tests --contract reviewed.json --dependencies dependencies.json -- node --test
proofline query --contract reviewed.json --dependencies dependencies.json --gaps
```

Only `user-confirmed` items enter the normalized goal contract. Candidates, withdrawn and needs-review items remain named in its Intake origin metadata. Every direct and optional `import-intake` entry validates the entire snapshot before projection, including source registry/references and unconfirmed items. The canonical validator is `src/core/requirements-schema.js`; Proofline vendors a byte-identical copy to keep installations independent. Evidence associations remain explicit and reviewable; neither tool chooses which business requirement a test proves. `proofline import-intake --input reviewed.json --output contract.json` remains available when a separate normalized export is useful.

The public Goal Delta projection uses generic requirement labels and scoped IDs. Acceptance text, private pointers and observation bindings stay upstream; Workprint receives only `workprint-profile/0.1`. Review public scope/ID labels before sharing.

For updates, retain the prior reviewed snapshot, the new snapshot, both imported contracts, the explicit dependency map, the Proofline manifest and ordinary ledger. These files let a later session inspect the exact confirmation and observation revisions without relying on chat history.

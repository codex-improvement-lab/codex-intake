# Reviewed requirements for Proofline

Save the decisions needed for a later CLI session in one local `intake-requirements/1` file. It contains a project scope, stable requirement IDs, requirement and snapshot revisions, explicit confirmation states, source pointers, retained references and redacted text. It contains no source bodies. This is a review record, not an authenticated human signature or evidence that execution succeeded.

In the browser, review the criteria, expand **Save requirements for Proofline**, choose a stable **Project key**, then download. Repeated saves in the same desk preserve IDs. Browser drafts still live in memory; the saved file is the continuation point for the CLI. Opening a new browser desk does not silently recover or merge old decisions.

```sh
node scripts/requirements.mjs prepare --scope checkout --out candidates.json request.txt
node scripts/requirements.mjs review --input candidates.json --id checkout-R001 --decision confirm --out reviewed.json
```

Review each selected ID explicitly. There is no automatic confirm-all switch. `--out` refuses to overwrite any existing file; omit it to write one JSON document to stdout. `prepare --previous reviewed.json --out proposed.json request.txt` updates a snapshot from explicitly selected files. The CLI supports text, logs and inventories; browser exports also support the existing selected image/OCR flow.

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
proofline import-intake --input reviewed.json --output contract.json
proofline doctor --contract contract.json --dependencies dependencies.json --json
proofline run AC-01/tests --contract contract.json --dependencies dependencies.json -- node --test
proofline query --contract contract.json --dependencies dependencies.json --gaps
```

Only `user-confirmed` items enter the goal contract. Candidates, withdrawn and needs-review items remain named in the contract's Intake origin metadata. Proofline rejects foreign scopes and inconsistent confirmed-item mappings. Evidence associations are still explicit and reviewable; neither tool chooses which business requirement a test proves.

The public Goal Delta projection uses generic requirement labels and scoped IDs. Acceptance text, private pointers and observation bindings stay upstream; Workprint receives only `workprint-profile/0.1`. Review public scope/ID labels before sharing.

For updates, retain the prior reviewed snapshot, the new snapshot, both imported contracts, the explicit dependency map, the Proofline manifest and ordinary ledger. These files let a later session inspect the exact confirmation and observation revisions without relying on chat history.

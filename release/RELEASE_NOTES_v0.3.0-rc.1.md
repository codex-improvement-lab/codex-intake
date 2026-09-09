# Codex Intake 0.3.0-rc.1 — reviewed requirements with fewer steps

This prerelease candidate retains every detected requirement/problem/command signal and full acceptance text, adds durable scoped requirement snapshots, and supports one atomic confirmation or revocation for explicitly selected IDs. New rule candidates remain unconfirmed.

```sh
node scripts/requirements.mjs prepare --scope checkout --out candidates.json request.txt
# Inspect candidates.json, then choose its actual IDs and exact snapshot revision.
node scripts/requirements.mjs review --input candidates.json --revision 1 --id checkout-R001 --id checkout-R002 --decision confirm --out reviewed.json
node scripts/requirements.mjs review --input reviewed.json --revision 2 --id checkout-R001 --id checkout-R002 --decision candidate --out reconsider.json
```

All selected IDs, duplicates, states and snapshot revision are checked before any decision is applied. One accepted batch advances the snapshot revision once. A stale/withdrawn item needs a separate explicit keep decision. New file output uses an exclusive atomic publication step and refuses to overwrite an existing file; an unsupported filesystem fails rather than publishing partial bytes. Single-ID review remains available, with an optional revision precondition for compatibility.

Proofline 0.2.0-rc.1 can read the explicitly selected snapshot directly as `--contract`, or as either Goal Delta side. It includes only current confirmed items; evidence mappings still require an explicit configuration. Intake's full snapshot validator is shared as a versioned, dependency-free source file with the independently packaged Proofline consumer.

The browser continues its existing source-review and individual confirmation workflow, and can save these snapshots for CLI continuation. Old references, manual retention, masking, scope/ID and revision boundaries remain visible. Confirmation records a caller's explicit scope decision, not an authenticated human signature or test result.

The original controlled maintenance replay remains **14 baseline / 29 assisted operations, with no demonstrated saving**. The new same-baseline replay records **14 / 22**, removing seven assisted operations while still exceeding the strong baseline. This is an internal non-blind automation result, not a claim of user-time or model-token savings.

This file describes a local prerelease candidate. Final artifact identity and actually executed checks accompany the candidate. Historical Mac/CI results are not transferred; publication and promotion are handled by the Lab product owner after independent review.

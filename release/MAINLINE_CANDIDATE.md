# Mainline development candidate — 2026-09-08

This local candidate fixes multi-signal acceptance coverage and adds explicit reviewed-requirement snapshots for Proofline. Existing published archives and tags remain unchanged. A future release version and public publication are chosen after product review.

- Keep every detected signal and full acceptance text; export coverage and exclusions.
- Preserve unrelated exact signals through source updates; changed or ambiguous signals require review.
- Save scoped IDs, revisions, confirmation states and old references to a portable local file. Continue explicit review through `scripts/requirements.mjs`.
- Import confirmed requirements into Proofline, bind normal verification observations, and export a public projection through Workprint.

See [requirement snapshots](../docs/REQUIREMENT_SNAPSHOTS.md). Final candidate checks, internal replay measurements and remaining platform boundaries are recorded separately. Local automation does not inherit the earlier physical-Mac PASS or establish user cost savings.

# v0.2.0-rc.1 release checklist

## Product and engineering gate

- [x] Source updates are staged before acceptance; discard does not mutate the accepted brief.
- [x] Stable IDs, revision pointers, retained edits and historical references survive replacement/removal/OCR.
- [x] Rule candidates and user-confirmed requirements remain distinct; stale source-bound confirmation is not promoted.
- [x] Undo restores the previous source batch while keeping later manual edits.
- [x] Pending review actions are visible on desktop and narrow layouts; exports are hidden during review.
- [x] One-minute demo communicates the source-pile-to-brief loop.
- [x] Text, logs, file inventories, registered URLs, and screenshots have explicit behavior.
- [x] Every extracted conclusion and generated completion check has a source pointer.
- [x] Raw source bodies are omitted from portable exports.
- [x] High-risk values are masked and covered by leak tests.
- [x] UI title, objective, findings, and done-when are editable.
- [x] Directly edited fields and manual criteria survive later source additions and OCR recompiles under documented ownership rules.
- [x] CLI and browser share one compiler.
- [x] Repo-local marketplace entry uses the canonical `./plugins/codex-intake` source and generated install copy.
- [x] Marketplace package excludes Git state, caches, dependency stores, OCR data, and prior evidence.
- [x] Node/pnpm/postinstall and locked native build dependencies are statically audited for Apple Silicon and Intel.
- [x] Real-Mac handoff covers a path with spaces, fresh dependencies, CLI, Web, OCR, installed copy, fresh task, status, uninstall, and redacted evidence.
- [x] Installed copy is resolved from status and verified by realpath, manifest, candidate ID, and content SHA-256 without a hard-coded cache leaf.
- [x] The exact pnpm argument separator and the edit-before-upload/OCR handoff sequence have automated regressions.
- [x] macOS evidence command refuses non-Darwin and known CI environments.
- [x] Hooks, MCP, App Server, and native composer integration are not falsely claimed.
- [x] README, license, contribution guide, security notes, changelog, release notes, product insights, and native proposal exist.
- [x] `pnpm release:check` passes on the final Windows workspace state.

## Evidence gate

- [x] Unit/CLI test count and result recorded in `TEST_EVIDENCE.md`.
- [x] Chromium test count and result recorded in `TEST_EVIDENCE.md`.
- [x] OCR path observed with a generated screenshot.
- [x] README screenshot visually inspected after generation.
- [x] Default browser/release checks do not rewrite the checked-in README screenshots.
- [x] Marketplace candidate identity is stamped last and reproduces without source changes.
- [x] Plugin and skill validators pass.
- [x] Marketplace package and static dual-architecture design checks pass on the final Windows workspace state.
- [ ] Direct macOS run completed if the release page will claim macOS validation.
- [ ] Every Mac row rerun for the replacement candidate ID/hash; no evidence transferred from the failed earlier candidate.
- [ ] Direct Apple Silicon report returned before claiming Apple Silicon validation.
- [ ] Direct Intel report returned before claiming Intel validation.

## Authorized GitHub publication gate

- [x] Use the established Lab organization and maintainer Git identity; retain contributor copyright.
- [x] Use GitHub private vulnerability reporting for the public repository.
- [ ] Replace neutral contributor identity only if the maintainer wants personal or organization attribution.
- [ ] Create GitHub repository and remote.
- [ ] Push initial history and observe CI on all configured operating systems.
- [ ] Enable private vulnerability reporting and branch protection as desired.
- [ ] Create annotated `v0.2.0-rc.1` tag and GitHub prerelease after its exact source commit passes CI.
- [ ] Submit the plugin only after its public repository and legal URLs exist.

Do not mark CI, macOS, plugin directory, or real-user validation complete from local Windows evidence.

Current scope: v0.1.0 was published first; source-update review is the separate v0.2.0-rc.1 candidate. Its current checks are recorded independently. Historical Intake-only Mac acceptance remains bound to its original candidate; no failed row is promoted and no new physical-Mac execution is claimed.

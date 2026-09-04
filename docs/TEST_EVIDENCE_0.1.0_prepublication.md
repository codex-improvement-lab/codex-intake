# Test evidence

## Evidence vocabulary

- **Automated:** a script or headless browser observed the behavior.
- **Synthetic:** the inputs are deliberately invented fixtures.
- **Physical-device:** a human observed the build on named hardware/OS.
- **Real-user:** a target user completed a realistic task and supplied feedback.

No category substitutes for another.

## Current verification snapshot

Date: 2026-08-30

Latest repair check: Windows host, bundled Node.js 24.19.0, pnpm 11.19.0. Exact OS edition and hardware were not recorded, so this local result is not labeled physical-device evidence. A separate user-supplied report records the earlier candidate on a physical Apple Silicon Mac; it is kept distinct below.

| Check | Evidence | Status |
| --- | --- | --- |
| Dependency install and locked local OCR data preparation | Automated, Windows | Passed |
| Fresh install from generated marketplace package, including project postinstall | Automated, Windows | Passed |
| Production Vite build | Automated, Windows | Passed |
| Core, privacy, determinism, edit ownership, CLI, platform-boundary, installed-copy resolution, and evidence-redaction tests | Automated + synthetic, Windows | Passed: 15/15 |
| Chromium dropzone, edit, pointer, download, unsupported-file, and exact Mac-handoff-order loop | Automated + synthetic, Windows | Passed: 5/5 browser tests total |
| Real local Tesseract OCR from a generated screenshot | Automated + synthetic, Windows | Passed inside Chromium suite |
| Edit objective, add `S04` screenshot, OCR, then export Markdown | Automated + synthetic, Windows | Passed; exact edit survived both recompiles and export; raw synthetic token absent |
| Direct Tesseract OCR from the final checked-in product screenshot | Automated + synthetic, Windows | Passed: 1,238 extracted characters; raw OCR text not retained as evidence |
| Reproducible README screenshot | Automated + synthetic, Windows | Passed; PNG regenerated and visually inspected |
| Repo-local marketplace package generation and validation | Automated, Windows | Passed: 54 files total, 53 content-hashed payload files; no cache/store/Git/evidence recursion |
| Fresh dependency install and postinstall inside generated marketplace package | Automated, Windows | Passed; local `eng` + `chi_sim` OCR data prepared |
| Generated marketplace package unit/build/browser/OCR gates | Automated + synthetic, Windows | Passed: 15/15 unit/CLI/platform, build, 5/5 Chromium |
| Apple Silicon + Intel dependency and command design preflight | Static automated audit, Windows | Passed; explicitly not Mac validation |
| Darwin/CI evidence guard | Automated, Windows | Passed: verifier refused to emit a Mac report |
| Plugin manifest validator | Automated, Windows | Passed for source and generated marketplace package |
| Skill validator | Automated, Windows | Passed |
| Failed 2026-08-26 candidate | Direct Apple Silicon Mac | Defect input only; no passing row transfers to this replacement candidate |
| Five-flagship candidate archive dated 2026-08-30 | External physical Apple Silicon Mac report | Core, CLI, build, and Provenance Lens passed; the candidate remained `FAIL` because 2/15 tests used a platform-inverted Darwin assertion and an unnormalized `/var` path expectation |
| Post-report portability repair | Automated, Windows | Platform tests pass after using a Darwin-specific guard expectation and `realpath` for installed-copy comparison; this is repair evidence, not a Mac retest |
| Targeted 2026-08-30 portability rerun | External physical Apple Silicon Mac report | Core platform suite passed 15/15 after the Darwin guard and realpath repairs, but the delivered archive omitted `.agents/plugins/marketplace.json`; `pnpm release:check` therefore failed at `check:project` and the candidate is not a Mac PASS |
| Final Intake-only marketplace install, fresh Codex task, status, and uninstall | Direct Mac | New package pending; no PASS transferred from either failed archive |
| Final Intake-only macOS Node/pnpm/CLI/Web/OCR run | Direct Mac | New package pending; not claimed |
| Final Intake-only Apple Silicon hardware run | Direct Mac | New package pending; not claimed |
| Intel hardware run | Direct Mac | Pending; not claimed |
| Real mixed-input workflow | Real user | Pending; not claimed |

## Commands observed

```text
pnpm release:check
  project gate: 28 required release files, 9 traceable demo findings, 0 raw fixture leaks
  marketplace: 54-file canonical local package passed with deterministic SHA-256
  macOS design preflight: darwin-arm64 + darwin-x64 passed; not direct Mac evidence
  vitest: 3 files, 15 tests passed
  vite build: passed
  playwright: 5 tests passed, including edit ownership, local OCR, and fail-closed binary handling

generated marketplace package: frozen install + postinstall + 15 tests + build + 5 browser tests passed
plugin-creator validate_plugin.py: source and generated package passed
plugin-creator read_marketplace_name.py: codex-intake-local passed
skill-creator quick_validate.py: passed
```

The normal browser suite writes its screenshot observations to Playwright test output and does not mutate `assets/codex-intake-overview.png` or `assets/codex-intake-full.png`. Those checked-in public images are refreshed only when `CODEX_INTAKE_REFRESH_ASSETS=1` is explicitly set. Their latest explicit refresh was visually inspected for toast/sticky-bar collision, clipped workspace title, and primary hierarchy.

CI workflow presence is design evidence only until a GitHub remote runs it. The guarded Mac verifier also refuses known CI environments, so even a future green `macos-latest` job will not be entered as a real-Mac report.

The final replacement candidate keeps the versioned ID recorded in `release/REPLACEMENT_CANDIDATE.json`; its final content SHA-256 is generated only after the full release flow and is intentionally not copied into this hashed payload file, avoiding a self-referential identity. The release gate is required to leave the checked-in public screenshots unchanged, and a second marketplace preparation must reproduce the same candidate hash.

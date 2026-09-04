# Platform and distribution scope

The first GitHub preview is v0.1.0. Source archives include the text/log/inventory CLI, Web UI, local OCR setup, examples and repo-local plugin preparation.

| Surface | Evidence |
| --- | --- |
| Windows / Node 24.19.0 / pnpm 11.19.0 | Current 15 tests and 5 browser tests, including actual Tesseract OCR from a synthetic image; Vite build and marketplace checks pass |
| Historical macOS candidate | [Accepted external functional report](evidence/macos/MACOS_INTAKE_FINAL_RETEST_V2_2026-08-30.json), bound to content hash 74883da55dae3e581fdb22e4cb1db7a58894c38a0041fe4aed69b99e2974454e |
| Current hosted checks | Exact commit results are on [GitHub Actions](https://github.com/codex-improvement-lab/codex-intake/actions); the release must pass before tagging |
| Architecture-specific device claims | No new Apple Silicon, Intel, OS-version or physical-device acceptance is asserted |
| Distribution | GitHub source ZIP plus SHA-256; not published to npm or the hosted plugin directory |

The accepted macOS baseline is preserved. Publication metadata and later upgrades have distinct source identities and never overwrite the historical receipt. Hosted macOS is automated runner evidence, not a new physical-device report.

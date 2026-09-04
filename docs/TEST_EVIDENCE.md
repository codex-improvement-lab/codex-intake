# Test evidence

Current publication preparation: 2026-09-05, v0.2.0-rc.1. The v0.1.0 baseline was released independently first.

- Local Windows / Node 24.19.0 / pnpm 11.19.0: 26/26 unit, CLI and platform tests; 12/12 Chromium scenarios, including real local Tesseract OCR from synthetic images.
- New cases cover source-batch preview/discard/accept/Undo, stable IDs and revisions, retained edited findings and criteria, confirmation invalidation, later edits surviving Undo, and late OCR after clearing.
- Desktop 1440px and narrow 390px checks cover empty state, pending review and accepted state, with no page overflow or external HTTP requests in those scenarios. Review buttons are in the viewport and not covered; the pending export bar and toast are hidden.
- Build, project checks, macOS design audit and marketplace preparation/verification pass.
- Dependency audit reports zero known vulnerabilities at the recorded check.
- The first publication preparation reproduced the accepted historical hash `74883da55dae3e581fdb22e4cb1db7a58894c38a0041fe4aed69b99e2974454e` before metadata edits. Source-update behavior belongs to a new candidate; the old receipt has not been relabeled.
- Historical final Mac acceptance is [retained unchanged](evidence/macos/MACOS_INTAKE_FINAL_RETEST_V2_2026-08-30.json). Its report omitted architecture, hardware and runtime versions; no such specific claims are inferred.
- Hosted results must be checked against the exact release commit on [Actions](https://github.com/codex-improvement-lab/codex-intake/actions).
- A clean source archive must run the text CLI without dependencies and the complete loop after a frozen dependency install. Exact results and final source/package hashes are recorded in release evidence and the public Release.

[Published v0.1.0 record](evidence/releases/v0.1.0.json) binds its separate tag, CI and public downloads. It does not stand in for the upgrade checks.

[Pre-publication ledger](TEST_EVIDENCE_0.1.0_prepublication.md) is historical and includes the earlier failed candidates. The later final report closed the Lab Mac gate; this ledger does not reopen it.

Screenshots are synthetic browser evidence. No real-user, production or market result is claimed. Regular tests do not rewrite checked-in product images.

# Test evidence

Current publication preparation: 2026-09-05, v0.1.0.

- Local Windows / Node 24.19.0 / pnpm 11.19.0: 15/15 unit, CLI and platform tests; 5/5 Chromium scenarios, including real local Tesseract OCR from synthetic images.
- Build, project checks, macOS design audit and marketplace preparation/verification pass.
- Dependency audit reports zero known vulnerabilities at the recorded check.
- Before publication-only changes, marketplace content reproduced the accepted historical hash `74883da55dae3e581fdb22e4cb1db7a58894c38a0041fe4aed69b99e2974454e`. New metadata is stamped separately and does not relabel the old receipt.
- Historical final Mac acceptance is [retained unchanged](evidence/macos/MACOS_INTAKE_FINAL_RETEST_V2_2026-08-30.json). Its report omitted architecture, hardware and runtime versions; no such specific claims are inferred.
- Hosted results must be checked against the exact release commit on [Actions](https://github.com/codex-improvement-lab/codex-intake/actions).
- A clean source archive must run the text CLI without dependencies and the complete loop after a frozen dependency install.

[Pre-publication ledger](TEST_EVIDENCE_0.1.0_prepublication.md) is historical and includes the earlier failed candidates. The later final report closed the Lab Mac gate; this ledger does not reopen it.

Screenshots are synthetic browser evidence. No real-user, production or market result is claimed. Regular tests do not rewrite checked-in product images.

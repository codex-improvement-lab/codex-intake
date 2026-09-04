# Codex Intake macOS acceptance

Status: **PASS for the exact v2 candidate in the Lab's automated macOS functional acceptance scope.**

The user-supplied final report binds:

- archive SHA-256 `198a45ee111bee7804f191653c6ec3dd0f3b31f11877d61d9115f147a0a139bb`;
- candidate `codex-intake@0.1.0+codex.20260826170524`;
- content SHA-256 `74883da55dae3e581fdb22e4cb1db7a58894c38a0041fe4aed69b99e2974454e`;
- source snapshot SHA-256 `d95026b00a87d795aeb298673203b3b687518bb9e88af5f5223487896308dc49`.

The returned macOS run reports `pnpm release:check` exit 0, Vitest 15/15, Playwright 5/5, build and marketplace checks passing, candidate identity stable on a second preparation, and 65/65 outer manifest entries unchanged after the gate.

The report did not repeat its hardware model, architecture, macOS version, Node version, or pnpm version. Therefore this is an exact-candidate macOS functional PASS, not an Apple Silicon-, Intel-, or OS-version-specific claim. It is automated synthetic evidence, not a real-user or production result.

The machine-readable receipt is [the retained original JSON](../docs/evidence/macos/MACOS_INTAKE_FINAL_RETEST_V2_2026-08-30.json). Its original bytes are preserved. Recording this acceptance does not retroactively change the candidate that was tested; new package metadata and upgrades have their own content identities.

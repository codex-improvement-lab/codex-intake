# Codex Intake real-Mac validation result

`MACOS_VALIDATION_RESULT=PENDING`

- Replacement candidate ID:
- Replacement candidate content SHA-256:
- All rows were rerun for this exact candidate; no prior-candidate evidence reused: yes / no

## Environment

- Date (UTC):
- Operator initials or non-sensitive label:
- Hardware family: Apple Silicon / Intel
- Mac model identifier (no serial number):
- macOS version:
- Native architecture from Node: arm64 / x64
- Rosetta translated: no
- Node version:
- pnpm version: 11.19.0
- Codex CLI version:
- ChatGPT desktop app version:
- Project path contained a space: yes / no

Do not paste the absolute project path, username, home directory, device serial number, account email, or shell history.

## Automated gate

- Guarded `pnpm verify:macos` completed outside CI: pass / fail
- Redacted report filename:
- Repository release check: pass / fail
- Marketplace package check: pass / fail
- CLI input/output paths with spaces: pass / fail
- Vite production build: pass / fail
- Chromium Web loop: pass / fail
- Local English + Simplified Chinese OCR data prepared: pass / fail
- Direct local OCR: pass / fail

## Marketplace and installed-copy gate

- `codex-intake-local` marketplace found: yes / no
- `codex-intake` installed and enabled: yes / no
- Installed cache contained the expected manifest: yes / no
- Installed-copy audit matched the candidate ID and content SHA-256: yes / no
- Fresh dependency install in installed copy: pass / fail
- CLI from installed copy: pass / fail
- Web + OCR from installed copy: pass / fail
- Objective edited before screenshot upload remained exact after upload, after OCR, and in Markdown: pass / fail
- Uploaded screenshot was `S04` and produced an `S04:OCR:L…` pointer: pass / fail

## Fresh Codex task gate

- ChatGPT desktop app restarted after installation: yes / no
- New Codex task created after installation: yes / no
- `$codex-intake` recognized: yes / no
- Only the two selected synthetic files used: yes / no
- `S01:L2`, privacy review, and done-when present: yes / no
- Synthetic bearer value absent: yes / no
- No MCP, hook, connector, or native-dropzone claim invented: yes / no

## Uninstall and state gate

- Plugin remove command passed: yes / no
- Marketplace remove command passed: yes / no
- Redacted post-remove marketplace report has `found: false`: yes / no
- Redacted post-remove plugin report has `found: false`: yes / no
- Source checkout correctly remained untouched: yes / no

## Evidence hygiene

- Returned JSON contains no absolute paths: yes / no
- Returned artifacts contain no source bodies or OCR text: yes / no
- Returned artifacts contain no tokens, emails, usernames, serials, or unrelated plugin data: yes / no
- Optional screenshot was manually reviewed and redacted: yes / no / not supplied

## Failures or observations

Record exact failing command, exit status, and a sanitized error excerpt. Do not include secrets or private paths.

- None yet.

## Final decision

Set exactly one:

- `MACOS_VALIDATION_RESULT=PASS`
- `MACOS_VALIDATION_RESULT=FAIL`

This report applies only to the named hardware family. It does not establish real-user validation or validate the other Mac architecture.

# Codex Intake project guide

## Product promise

Turn messy task inputs into an editable, source-linked brief before Codex starts work. Keep the default workflow local, deterministic, and usable without an API key.

## Scope

- Treat text, logs, screenshots, and file inventories as first-class sources.
- Preserve a stable source ID and a precise pointer for every extracted claim, risk, and generated acceptance criterion.
- Keep URL fetching, model calls, telemetry, and cloud storage out of the default product path.
- Prefer one complete intake-to-export loop over unrelated integrations.

## Engineering boundaries

- Make runtime behavior compatible by design with Windows and macOS; claim verification only for environments actually run.
- Share one extraction model across the CLI and browser UI.
- Keep generated exports deterministic for identical ordered inputs.
- Never silently read paths that the user did not select.
- Mask likely secrets in previews and exports; retain source pointers without retaining secret values.

## Evidence and release

- Label automated browser evidence, synthetic fixtures, physical-device checks, and real-user feedback separately.
- Keep tests, changelog, release notes, license, contribution guide, screenshots, and release checks inside this repository.
- Do not commit, tag, push, deploy, publish, or create a remote without explicit user authorization.

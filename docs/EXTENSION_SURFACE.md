# Official Codex extension surface review

Verified against official OpenAI documentation on 2026-08-23 before choosing the MVP shape and again before the macOS marketplace handoff.

## Current surfaces

| Surface | Officially supported role | Fit for intake | Decision |
| --- | --- | --- | --- |
| CLI | Composable local command for files, logs, exports, and automation | Excellent deterministic engine and fallback | Ship |
| Codex plugin + skill | Installable workflow instructions; plugins may package skills and optional MCP servers | Good discovery and handoff layer | Ship as skill-only |
| Repo-local marketplace | Project-scoped catalog discovered from `.agents/plugins/marketplace.json`; CLI can add, inspect, install, and remove configured sources | Reproducible pre-publication install and fresh-task test | Ship as authoring/test entry |
| MCP server | Typed tools, structured results, external/service behavior; bundled stdio is supported in Codex plugins | Useful later if another client needs programmatic compile calls | Defer |
| MCP Apps UI | Optional iframe UI when users need to inspect, compare, edit, or confirm structured information | Interaction fits, but raw local-file acquisition and standalone use become more constrained | Do not make MVP depend on it |
| Hooks | Trusted lifecycle command handlers for events such as prompt submission and tool use | Intake must be deliberate and editable before execution; silent interception is the wrong posture | Do not use |
| App Server | Deep Codex client integration with auth, conversations, approvals, and streamed agent events | Far broader than a pre-task organizer | Do not use |
| Local Web UI | Community-controlled browser surface | Best raw-file drop, editing, privacy review, and screenshot demo | Ship |

## Evidence from official documentation

- [Plugin architecture](https://developers.openai.com/plugins/concepts/plugins) says plugins may contain skills, an MCP server, or both, and that UI is optional. It recommends the smallest shape that supports the use case.
- [Package your plugin](https://developers.openai.com/plugins/build/plugins) documents the required `.codex-plugin/plugin.json`, bundled skill directories, and bundled stdio MCP configuration.
- The same [plugin packaging guide](https://developers.openai.com/plugins/build/plugins) documents repo marketplaces, `codex plugin marketplace` commands, local cache behavior, and the canonical `./plugins/<name>` source layout.
- [Use and install plugins](https://learn.chatgpt.com/docs/plugins) documents `/plugins`, install/enable/uninstall behavior, and the requirement to start a new chat or CLI session after installation.
- [Add UI to your MCP server](https://developers.openai.com/plugins/build/chatgpt-ui) positions custom UI for inspecting, comparing, editing, confirming, or navigating structured information and requires tools to remain useful without UI.
- [Hooks](https://learn.chatgpt.com/docs/hooks) documents explicit trust review and lifecycle events. That is a useful automation surface, not a native pre-composer dropzone.
- [Codex App Server](https://learn.chatgpt.com/docs/app-server) is the protocol for deep rich-client integrations including authentication, conversation history, approvals, and streaming.

## Product conclusion

The community-solvable portion is a local compiler, editor, CLI, plugin workflow, and local marketplace test package. The missing native portion is not simulated: an OS/Codex-level intake shelf that can accept existing attachments before a task exists requires product support. That proposal lives separately in [NATIVE_PRODUCT_PROPOSAL.md](NATIVE_PRODUCT_PROPOSAL.md).

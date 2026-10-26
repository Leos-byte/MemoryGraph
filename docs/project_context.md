# Project Context

Security update (2026-10-26): HTTPS-only APIs, cleared keys on API-origin changes,
restricted Markdown resources/links, limited Codex tools and runtime, canceled
requests before database changes, owner-only database files, single-pass template
expansion. See `security_audit.md` for tests and pending OS security updates.

MemGraph is a local desktop knowledge-learning application.

## Product Definition

Name: **MemGraph：符合大脑记忆规律的知识学习工具**

The product helps users understand, connect, remember, and transfer knowledge by creating a visual graph of concepts. Users enter a concept, generate a Markdown explanation, select unfamiliar text, and expand it into a connected node.

## v0.1.0 Decisions

- Desktop app.
- Qt/C++ with CMake.
- Linux x64 and Linux x86 targets.
- SQLite local storage.
- Provider-aware OpenAI and DeepSeek model presets. OpenAI options mirror the current visible Codex selector: GPT-5.6 Sol, Terra, Luna, GPT-5.5, GPT-5.4, and GPT-5.4 Mini.
- Map rename, Markdown export, and deletion are available only from a map item's context menu; Recycle Bin is available only from File; secondary node actions are consolidated under More.
- API Key authentication and ChatGPT login through the official Codex CLI.
- Full Prompt template editing.
- Graph-first interface.
- Markdown copy and export.
- Chinese and English UI.
- Qt Widgets Fusion-based design system with semantic light/dark tokens and 12 pt desktop body text.

## Current Direction

- Active development is the Qt/C++ implementation.
- The draw.io/Electron integration experiment was rolled back on 2026-05-01 by user request.
- Do not continue draw.io integration work unless the user explicitly reopens that direction.
- The archived draw.io work is stored under `Backup/20260501-drawio-integration-archived` for reference only.

## Out Of Scope For v0.1.0

- Spaced repetition.
- Image explanation generation.
- Cloud sync.
- Account system.
- Additional providers beyond OpenAI and DeepSeek.

## Important Implementation Notes

- Do not store API keys in SQLite, logs, Markdown exports, or backups.
- Prefer local, inspectable project files and scripts.
- On Linux, API keys use Secret Service via `secret-tool` when available.
- If the secret backend is unavailable, API keys are kept for the current app session only.
- ChatGPT credentials are owned by the official Codex CLI; MemGraph must never read or store them.
- ChatGPT login is only valid for OpenAI models. DeepSeek uses API Key authentication.
- Build scripts should detect missing dependencies and print clear install instructions.
- UI changes should follow `docs/ui_audit.md`: preserve visible keyboard focus, semantic action states, localization expansion, and graph readability.

# MemGraph

**MemGraph：符合大脑记忆规律的知识学习工具**

MemGraph is a local desktop knowledge-learning tool. It helps users build a visual concept map instead of only receiving one-off answers. Users create a knowledge map, enter a concept, generate a Markdown explanation, select unfamiliar text inside the explanation, and expand it into connected explanation nodes.

## Project Goal

MemGraph focuses on four learning outcomes:

- Understanding: explain what a concept means.
- Connection: link unfamiliar terms into a growing knowledge map.
- Memory: keep structured Markdown notes that can be reviewed later.
- Transfer: expose use cases, components, and missing-condition consequences.

## Directory Layout

- `Source`: latest source code.
- `Backup`: source and release backups.
- `Releases`: latest packaged release outputs.
- `DevScripts`: environment setup, build, and packaging scripts.
- `test`: test data and test notes.
- `docs`: project status, plans, usage, history, and problem records.

## Current Version

Current active implementation version: `v0.1.0`.

Rollback note: the draw.io integration experiment has been stopped and archived. Active development has returned to the Qt/C++ implementation. The archived draw.io work is kept under `Backup/20260501-drawio-integration-archived` for reference only.

The first version is a Qt/C++ Linux desktop app with:

- local SQLite persistence;
- graph-first UI;
- provider-aware OpenAI and DeepSeek model presets;
- API Key and official Codex CLI based ChatGPT login;
- custom full-prompt explanation templates;
- single-node Markdown copy;
- whole-map Markdown export;
- Chinese and English UI translation scaffolding.

## Build Quick Start

```bash
./DevScripts/setup_env.sh
./DevScripts/build.sh --arch x64 --type Release --package portable
```

If the development dependencies are not installed, `setup_env.sh` prints the Fedora `dnf` command needed to install them.

## Security

See [the security audit](docs/security_audit.md) for the latest source fixes,
regression coverage, and system dependency security updates. Local databases,
credentials, build outputs, backups, and release binaries are excluded from Git.
Build locally to populate `Releases`, including an unpacked copy for manual testing.

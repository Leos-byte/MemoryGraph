# Conversation History

## 2026-10-26 - Electron Migration

User: "Implement the plan."

Agreed: Electron + React + TypeScript, Windows/Linux x64, old SQLite compatibility,
GitHub browser feedback and mailto to leo.oceanai@gmail.com, public repository,
MIT, installer/AppImage updates, unsigned initial Windows beta, local user-directed Codex repairs.

## 2026-10-26 - Security And GitHub

User: "检查并修复当前项目有没有安全漏洞，最后顺便上传到github并设置为隐私项目"

User: "继续"

## 2026-08-27 - Menu simplification

User requested that map rename, delete, and export appear only in the selected map's context menu; Recycle Bin appear only in File; and right-panel actions be consolidated into More without duplicates.

## 2026-08-27

User: "增加chagpt模型的可选项，参考codex的可选项。"

## 2026-04-28

User requested a tool named **MemGraph：符合大脑记忆规律的知识学习工具**.

Original requirements:

- Users set a ChatGPT/OpenAI API key.
- Users create an infinitely extensible knowledge map and enter a concept.
- The system generates an explanation.
- Default explanation logic:
  - what it says or means;
  - what problem it solves;
  - what its components or conditions are;
  - what happens without those parts or conditions.
- Users can select unfamiliar content inside an explanation and generate a new connected knowledge node.
- Every node can continue expanding into a knowledge network.
- Output uses Markdown so users can copy and save notes as `.md`.
- Project directories:
  - `Source`
  - `Backup`
  - `Releases`
  - `DevScripts`
  - `test`
  - `docs`
- Build/debug on Linux.
- One-click build for x86 and x64.
- Package as portable and installer releases.
- Support English and Chinese operating systems.

Planning decisions:

- v1 is a Linux desktop app.
- Technology stack: Qt/C++.
- API mode: user provides local API key.
- Storage: local SQLite.
- Custom explanation logic: full Prompt editing.
- Memory feature scope: v1 focuses on knowledge graph only.
- Markdown: support both node copy and whole-map export.
- UI language: Chinese and English.
- Linux x86 means real 32-bit i686; x64 means x86_64.
- API settings support API key, Base URL, and model name.
- Added DeepSeek V4 Pro as an OpenAI-compatible model preset based on DeepSeek API docs.
- Main UI is graph-first.

## 2026-05-01

User requested rollback:

- "回滚，不继续做与draw.io的集成"

Decision:

- Stop the draw.io integration route.
- Restore the Qt/C++ implementation as active `Source`.
- Keep the draw.io work archived only for reference.

## 2026-08-26

User requested:

- "优化模型设置功能，同时支持key也支持chatgpt登陆方式。新增最近deepseek最近新支持的模型"

Implementation decisions:

- Keep API Key authentication for OpenAI-compatible providers.
- Add ChatGPT login through the official Codex CLI device-auth flow without reading or storing ChatGPT credentials.
- Restrict ChatGPT login to OpenAI models and require API Key authentication for DeepSeek.
- Add the latest DeepSeek V4 Flash (`deepseek-v4-flash`) preset and retain DeepSeek V4 Pro.

User reported:

- "使用chatgpt登陆的时候，返回的内容有一点乱码，有点像表情符号的乱码"

Resolution:

- The initial output normalization did not resolve the login-window problem.

User supplied the exact output:

- "没有解决，乱码如下：Welcome to Codex [v␛[90m0.149.1␛[0m] ␛[90mOpenAI's command-line coding agent␛[0m"

Final resolution:

- Identified the visible characters as raw ANSI color sequences from `codex login --device-auth`.
- Added shared terminal-output sanitization, disabled CLI colors, and added a chunked ANSI regression test.

## 2026-08-27

User requested:

- "使用 https://github.com/TheQtCompanyRnD/agent-skills/blob/main/skills/qt-ui-design/SKILL.md skill 审查并且美化当前项目UI"
- "继续"

Implementation decisions:

- Installed and applied the requested `qt-ui-design` skill.
- Kept the existing Qt Widgets architecture and introduced a Fusion-based semantic design system rather than migrating to QML.
- Prioritized the graph workspace and node explanation workflow, reduced simultaneous actions, and retained advanced management through menus.
- Verified the UI with Qt offscreen screenshots at desktop and narrow window sizes.

## 2026-10-27 - Login Error Report

> 模型登陆的时候出现 Error invoking remote method 'memgraph:command': Error: Login is already running.

## 2026-10-27 - Public Release Approval

> 合并pr并在github发布Releases

> 什么意思

> 继续

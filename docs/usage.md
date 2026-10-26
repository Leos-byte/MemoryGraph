# MemGraph Usage

## Start

1. Run MemGraph.
2. Open Settings.
3. Choose API Key or ChatGPT Login, select a model, and set the preferred UI language.
4. Create a knowledge map.
5. Enter a concept in the right panel.
6. Click Generate.

## Expand A Concept

1. Select a node on the graph.
2. Select unfamiliar text in the Markdown explanation panel.
3. Right-click and choose "Create linked node from selection".
4. By default, MemGraph creates a linked child node without calling the model. Edit the node manually, or turn on automatic linked-node generation in Settings if you want this action to generate immediately.

## Graph Canvas

- Right-click blank canvas space and choose New Node Here to create a node at that position.
- Right-click blank canvas space and choose Fit Map to frame the current knowledge graph.
- The new-node dialog lets you choose whether to generate an explanation immediately.
- Hold and drag the right mouse button to pan the canvas when the map grows large.
- Right-click a node and choose Delete Node to move it to deleted nodes.
- Select a node and press Delete to move it to Recycle Bin.
- Use the mouse wheel to zoom. Zoom limits keep nodes usable at extreme scales.

## Interface Shortcuts

- `Ctrl+N`: create a new map.
- `Ctrl+Return`: generate the concept entered in the explanation panel.
- `Ctrl+,`: open Settings.
- `Ctrl+S`: save the current template in Template Manager.
- Node actions including copy, edit, connect, relation update, delete, and restore are available from the More menu beside Node Markdown.

## Templates

Open Template Manager to create, copy, edit, delete, and set default explanation templates.

Use the `?` button in the template editor for an in-app explanation of System Prompt, User Prompt, required fields, supported variables, and template writing tips.

Required template fields:

- Name.
- System Prompt.
- User Prompt.
- `{{concept}}` inside User Prompt, so MemGraph can pass the selected concept to the model.

Templates support these variables:

- `{{concept}}`
- `{{selected_text}}`
- `{{parent_concept}}`
- `{{map_title}}`
- `{{context_markdown}}`
- `{{language}}`

## Markdown

- Copy Node Markdown copies the selected node explanation.
- Right-click a map and choose Export Map Markdown to write the full map as a Markdown document.

## API Settings

- API Key mode requires an HTTPS Base URL with no embedded credentials, query string, or fragment. Redirects are blocked; enter the final endpoint.
- Changing the endpoint scheme, host, or port clears the key field. Enter the correct key for the new service before saving.
- API requests time out after 120 seconds and responses are limited to 4 MiB. ChatGPT generation times out after 10 minutes.
- Markdown previews block local and remote images/resources and permit only HTTP/HTTPS external links. The original Markdown is preserved for copying and export.
- Changing database directories cancels in-flight generation requests.

- Authentication supports two modes: `API Key` and `ChatGPT Login (Codex CLI)`.
- API Key is never saved into the project database.
- On Linux, MemGraph uses the system Secret Service through `secret-tool` when available.
- If no Secret Service backend is found, the API Key is kept for the current app session only.
- ChatGPT Login uses the official Codex CLI device-login flow and is available for OpenAI models only. MemGraph starts Codex as a child process but never reads or stores ChatGPT credentials.
- Install Codex CLI with `npm install -g @openai/codex`, then choose ChatGPT Login and click `Sign in with ChatGPT` in Settings.
- Base URL defaults to `https://api.openai.com`.
- Model defaults to `gpt-5.6-terra` for new installations.
- API Mode can be `Responses` or `Chat Completions Compatible`.
- OpenAI presets mirror the models currently visible in Codex: `gpt-5.6-sol` (frontier), `gpt-5.6-terra` (balanced), `gpt-5.6-luna` (fast), `gpt-5.5`, `gpt-5.4`, and `gpt-5.4-mini`. They use the Responses API.
- Model availability depends on the OpenAI account used by the API key or ChatGPT login. Select `Custom` to enter another supported model ID.
- DeepSeek presets include the latest `deepseek-v4-flash` and `deepseek-v4-pro`. Both use `https://api.deepseek.com` and `Chat Completions Compatible` mode.
- Existing `OpenAI GPT-5.4 Mini` remains available for compatibility.
- `DeepSeek V4 Pro` sets Base URL to `https://api.deepseek.com`, model to `deepseek-v4-pro`, and API Mode to `Chat Completions Compatible`.
- Linked Node Generation controls whether creating a node from selected explanation text automatically calls the model. It is off by default.

## Database Directory

Settings lets you change the database directory. Changing the directory takes effect immediately after pressing OK: MemGraph opens `memgraph.sqlite3` in the selected directory and reloads the map list from that database. Existing data is not moved automatically.

## Map Management

Use New Map to create a map. Right-click a map in the list to rename it, export it as Markdown, or move it to Recycle Bin. These map-specific actions are intentionally available only from the selected map's context menu.

## Recycle Bin

Recycle Bin manages deleted maps and nodes. Deleted maps are hidden from the map list, and deleted nodes are hidden from the graph. Open Recycle Bin from the File menu to restore selected maps or nodes, or empty it to permanently delete everything inside.

Deleted templates also move to Recycle Bin. Restore a deleted template from the Templates tab before emptying the bin.

## Node Editing And Connections

Use Edit Node to change the selected node title and Markdown content manually. Use Connect Node to create a manual connection from the selected source node to another active node. Use Update Relation to choose a source node and target node, then MemGraph calls the configured API model and writes the generated relationship section at the end of the source concept explanation. The canvas connection remains a visual link only.

## Build And Release

Check or install dependencies:

```bash
./DevScripts/setup_env.sh
./DevScripts/setup_env.sh --install
```

Build x64 portable release:

```bash
./DevScripts/build.sh --arch x64 --type Release --package portable
```

Portable builds create both a compressed archive and an unpacked manual-test directory:

```text
Releases/MemGraph-v0.1.0-linux-x64-portable.tar.gz
Releases/MemGraph-v0.1.0-linux-x64-portable-unpacked/
```

Build both x64 and strict 32-bit x86 packages:

```bash
./DevScripts/build.sh --arch all --type Release --package all
```

On Fedora 43, strict 32-bit Qt development packages conflict with the installed x64 Qt development package on `/usr/bin/qt-configure-module`. Fedora 43 also does not publish a `386` container image, so the default isolated x86 build uses `docker.io/i386/debian:trixie`:

```bash
./DevScripts/build_x86_podman.sh --package portable
```

Create a source and release backup:

```bash
./DevScripts/backup.sh
```

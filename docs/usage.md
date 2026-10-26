# MemGraph 使用说明

## 安装与运行

从 GitHub Releases 选择 Windows x64 安装版或 ZIP、Linux x64 AppImage 或 tar.gz。首批 Windows 测试版没有发布者代码签名，可能出现系统提示。

Linux AppImage 需有可执行权限及系统支持的 FUSE 环境。也可解压 tar.gz 后运行 `memgraph`。解压包保留人工测试用途；开发构建需要 Node.js 22 x64。

## 从 Qt 迁移

首次启动检测旧版默认数据库和旧配置中的自定义目录，经确认后导入。也可使用“文件 > 导入旧版数据库”手动选择文件。

导入使用 SQLite 一致性备份复制数据，原数据库保留；覆盖当前 Electron 数据前会建立恢复快照。地图、节点、连线、模板、回收站和历史记录保留。建议退出旧版后再导入，导入后两份数据库不会自动同步。

普通模型及语言设置随检测到的旧配置迁入。API Key 不复制，需在设置中重新输入；ChatGPT 身份继续由官方 Codex CLI 管理。

## 学习流程

1. 新建地图，输入概念，选择解释模板并生成。
2. 选中节点查看 Markdown；选中陌生文字、右键创建关联节点。
3. 关联节点默认不自动生成，可在创建时选择，或稍后点击生成。
4. 选中已有节点并生成会更新原节点，保留连线。
5. 更多菜单支持复制、编辑、连接、生成关系和删除；关系说明写在源节点解释末尾。

图谱支持拖动节点、右键拖动画布、缩放、适应视图以及空白处右键建点。选中节点按 Delete 会请求确认。

地图的重命名、导出和删除位于地图列表右键菜单；节点操作集中到“更多”。回收站仅位于文件菜单，支持地图、节点、模板恢复及清空。

## 模型与模板

API Key 模式支持 Responses、Chat Completions 兼容接口和自定义模型，地址必须使用 HTTPS。更改服务来源时清除旧密钥，避免发送到另一个服务商。安全存储不可用时密钥仅在本次会话有效。

ChatGPT 登录需先安装官方 Codex CLI：`npm install -g @openai/codex`。设置中登录并查看设备授权信息，在浏览器完成授权。此模式仅适用于 OpenAI；不复制用户的 Codex 登录文件。

模板的名称、System Prompt、User Prompt 必填，User Prompt 必须包含 `{{concept}}`。其余变量为 `{{selected_text}}`、`{{parent_concept}}`、`{{map_title}}`、`{{context_markdown}}`、`{{language}}`。模板管理支持新建、复制、保存、默认选择及回收站删除；问号帮助解释这些字段。

## 数据保护

默认数据位于系统应用数据目录的 `MemGraphElectron/data`。可在设置查看和切换目录；切换会取消进行中的任务并读取目标目录的数据，不自动搬移旧目录。

文件菜单可手动备份或恢复 SQLite。自动快照位于当前数据目录的 `backups` 文件夹。数据库未加密，应使用系统磁盘加密保护敏感知识。Markdown 中的 HTML、图片资源和危险协议不执行，原文仍可复制或导出。

## 反馈

GitHub 反馈打开浏览器的预填 Issue 页面，用户登录后手动提交。默认只含版本、系统、架构及问题模板；不会自动附加知识地图、Prompt、密钥、日志或截图。

邮件反馈打开默认邮件客户端，收件人为 `leo.oceanai@gmail.com`，不自动发送或添加附件。没有可用客户端时可复制地址及反馈文本。

## 更新与恢复

Windows 安装版和 Linux AppImage 可在文件菜单检查更新。更新经过签名和文件摘要验证；用户点击下载后，再确认重启安装。更新前取消任务并备份数据库。

测试版更新需要在设置中启用 Beta 通道。ZIP/tar 解压版不自动替换文件，请从 GitHub Releases 下载新版并使用已有数据目录。

下载、校验或备份失败时保持当前版本。若新版启动或迁移失败，保留快照和旧包，退出程序后使用旧版本与对应的升级前快照恢复；不要让旧程序直接打开不兼容的新结构数据库。

## 开发验证

```bash
cd Source
npm ci
npm run dev
npm run verify
npm run package -- --publish never
```

跨平台发布、签名密钥备份、草稿发布及验收证据见 `electron_release.md`、`acceptance.md`。本地 Codex 修复 Issue 的操作流程见 `codex_workflow.md`。

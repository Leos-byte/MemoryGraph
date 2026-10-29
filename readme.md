# MemGraph

**MemGraph：符合大脑记忆规律的知识学习工具**

理解、连接、记忆与迁移。输入概念生成 Markdown 解释，在解释中选择陌生内容继续展开，构建保存在本机的知识地图。

最新大版本测试版：[**1.0.0-beta.1 - Calico**](https://github.com/Leos-byte/MemoryGraph/releases/tag/v1.0.0-beta.1)，Electron + React + TypeScript。支持 Windows/Linux x64、中英文、OpenAI/DeepSeek、自定义 Prompt、API Key 和官方 Codex CLI 的 ChatGPT 登录。

## 下载与反馈

- [GitHub Releases](https://github.com/Leos-byte/MemoryGraph/releases)：Windows 安装版/ZIP，Linux AppImage/解压包。首版 Windows 未做发布者代码签名，系统可能提示未知发布者。
- [提交问题](https://github.com/Leos-byte/MemoryGraph/issues/new?template=bug.yml)：软件内也可打开预填反馈页，由浏览器完成 GitHub 登录和提交。
- [邮件反馈](mailto:leo.oceanai@gmail.com)：打开默认邮件客户端，不自动发送。

基本学习功能无需账号或自建服务器；调用模型需要自己的 API Key，或已登录的 Codex CLI。GitHub 登录不提供模型额度。

## 开发与测试

使用 Node.js 22 x64 与 npm。Linux 需要 GTK/NSS 等桌面运行库，详见 [发布说明](docs/electron_release.md)。

```bash
cd Source
npm ci
npm run dev
npm run verify
npm run package -- --publish never
```

也可使用 `DevScripts` 中的 Linux/PowerShell 一键脚本。自动化测试使用临时数据库和模拟模型，不读取个人凭据或消耗模型额度。

## 数据与升级

Qt 原版冻结在 `qt-v0.1.0-frozen` 标签。首次导入会复制旧 SQLite 数据库并保留原件；程序与数据分开存储。API Key 需重新输入，Codex 登录继续由官方 CLI 管理。

Windows 安装版和 Linux AppImage 支持检查更新、校验、下载和重启应用。ZIP/解压版提供新版下载入口。更新清单使用独立 Ed25519 签名，数据库迁移前创建快照；失败恢复路径见 [使用说明](docs/usage.md)。

1.0 支持在设置中选择“仅手动更新 / 自动检查更新 / 自动检查并下载”，安装前仍需确认重启并自动备份数据。接收本测试版需启用 Beta 通道；解压版仍需手动下载替换。验证及限制见 [发布记录](test/release-1.0.0-beta.1.md)。

1.0 界面采用 Calico 亮色设计，统一奶油白、杏橘与炭黑的语义化 Tokens，保留工作台布局、中英文和原有业务功能。设计规则见 [Calico 说明](docs/calico_design.md)。旧版 Backup 源码/程序目录已按要求清理，保留本版本备份、独立数据库备份及更新签名私钥；GitHub 历史版本未删除。

## 目录

| 目录 | 用途 |
| --- | --- |
| `Source` | Electron 主进程、React 界面、共享类型、测试及依赖锁文件 |
| `Backup` | 本地源码/发布包/数据库备份，以及未提交的更新签名私钥 |
| `Releases` | 最新本地发布包和解压测试版，不提交 Git |
| `DevScripts` | 环境检查、构建、验证、发布签名及产物检查脚本 |
| `test` | 人工验收记录；自动化测试位于 Source/tests-electron |
| `docs` | 用法、进度、版本、审计和本地 Codex 维护流程 |
| `.github` | 双平台 CI、手动发布流水线、Issue 模板 |

## 许可

[MIT](LICENSE)。依赖和打包的 Electron/Chromium 组件遵循各自许可。用户数据库、凭据及备份不会随源码发布。

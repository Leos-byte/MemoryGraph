# Rich Content / 富内容（未发布）

## 范围

在 Electron + React + TypeScript 工作台中扩展 Markdown，而不是执行模型生成的网页。保留现有模板、模型、划词展开、关系更新、回收站和两套皮肤。原始 Markdown 仍是节点正文，可复制保存；交互配置使用声明式 `memgraph-ui` JSON 代码块。

## 使用

1. 设置中的“增强内容输出”默认开启，给解释请求追加富内容协议，不改写已有模板或节点。关闭后按原模板生成；旧富内容仍可阅读。
2. 选中节点，在“更多 > 编辑”使用可视化工具栏，或切到 Markdown 源码、预览。支持标题、加粗、斜体、列表、链接、代码、表格、任务列表。未知代码块、HTML 原文、公式及交互块通过不可解释的原文节点保留，不当作 HTML 执行。视觉编辑会规范化普通 Markdown 排版；只打开或切换模式不应改写正文。
3. 阅读区右上角可展开阅读，图表提供可展开的数据表。交互块支持说明、提示、折叠、标签页、分栏、指标、筛选/排序/分页表格、折线/柱状/饼图/散点图、输入/下拉/开关/滑块/表单/按钮，以及本地图片。数学由 KaTeX 渲染，Mermaid 使用严格模式和清理后的 SVG。
4. 图片可从文件、剪贴板、拖放或 HTTPS 地址导入。外网图片不会直接自动加载，导入地址需确认，资源复制到本地数据库后不依赖原 URL。接受 PNG/JPEG/WebP/GIF，单图最多 25 MiB、约 16 MP，不接受可执行 SVG。
5. 在设置中单独配置 xAI API Key，默认图像模型 `grok-imagine-image-2.0`。在编辑器打开“Grok 生图”，输入提示词、比例、质量；确认付费提示后才提交单张 1K 图片请求。完成后预览并插入，失败不自动重试。“停止等待”只取消本地等待，不能保证服务端停止计费。ChatGPT 登录不提供 xAI 额度。
6. 实时数据源在设置中添加。指定名称、公网 HTTPS GET URL、允许的参数名、JSON 数组路径和认证方式；保存需原生授权确认。凭据与文本模型、图片服务相互独立。复制数据源 ID 到组件的 `sourceId`，或选中原文组件使用数据源绑定。刷新只在用户点击后进行，每分钟刷新需手动勾选；不可见或卸载时暂停。失败保留最近成功快照，并显示错误/时间。
7. 图像和数据源可独立保存，也纳入主设置“保存”及未保存确认；不会随切换皮肤自动提交。
8. 地图右键“导出”可选普通 Markdown、Markdown 与资源 ZIP、离线交互网页与 Markdown ZIP。离线包解压后直接打开 `index.html`，无需服务器；保留图表、折叠、切换、表格和本地控件联动，不调用 API、不写知识地图。每次打开从导出快照开始，不把离线控件状态写回数据库。

## 协议示例

下面是可粘贴到节点 Markdown 源码中的完整示例。演示数据不是实时统计。

````markdown
## 学习进度（模拟数据）

```memgraph-ui
{
  "version": 1,
  "blocks": [
    {"id":"search","type":"input","title":"筛选概念","state":"q","value":""},
    {"id":"count","type":"metric","title":"匹配数量","aggregate":"count","filter":{"field":"name","state":"q"},"data":[{"name":"理解","value":12},{"name":"记忆","value":7}]},
    {"id":"chart","type":"chart","title":"练习次数（模拟）","chart":"bar","x":"name","y":"value","filter":{"field":"name","state":"q"},"data":[{"name":"理解","value":12},{"name":"记忆","value":7}]},
    {"id":"review","type":"details","title":"复习问题","text":"这个概念解决什么问题？条件缺失时会怎样？"}
  ]
}
```
````

- 每块需要唯一 `id`，以英文字母开头，只含字母/数字/下划线/短横线，最长 64 字符；版本目前只有 `1`。
- `children` 为嵌套组件；`tabs` 的子项各自成为页签。`columns` 使用响应式两栏，窄窗口变为一栏。表单不能嵌套。
- 控件通过 `state` 共享变量；文字及动作可使用 `{{state:q}}`，不支持表达式求值、任意代码或外部模块。
- `filter:{"field":"name","state":"q"}` 为忽略大小写的包含匹配；指标支持 `count/sum/mean`，后两项通过 `field` 指定数值列。图表使用 `chart/x/y`，不接受任意 ECharts 配置/格式化函数。
- 绑定实时源后，源返回的数据优先于 `data`，尚无快照时可显示显式给定的静态示例。源必须返回扁平对象数组，最多 10,000 行，响应最多 4 MiB；只允许已声明参数和固定字段路径。
- `action` 形如 `{"kind":"createChild","title":"{{state:q}}","markdown":"## 新概念"}`。种类为 `query/navigate/createChild/append/update`；`target` 必须为同一地图中已存在节点 ID。写地图时先显示预览，再经原生确认，以单次、60 秒有效凭证提交，节点变化后必须重新预览。新建子节点自动连线，不自动生成解释。离线禁止网络/写操作。
- JSON 未知字段/类型、重复 ID、超深/超大配置只使对应组件报错，源码及后续正文仍保留。单块最多 1 MiB、256 组件、8 层嵌套。

## 存储与安全

- SQLite `user_version` 从 1 升至 2，仅新增 `content_assets/content_refs/content_state/content_sources/content_cache`，原有学习表和正文不变。迁移事务失败回滚；应用启动、导入、更换目录前保留一致性快照，目标旧数据库升级前另存 `before-rich-upgrade-*`。
- 图片按 SHA-256 去重，以 BLOB 存储；组件控件状态和成功数据快照随数据库备份/恢复。删除节点进入回收站，不删除图片；清空后仅清理没有其他节点引用的资源。共享资源引用在节点创建/编辑/生成时记录。
- API 密钥只保存在当前配置的操作系统安全存储文件或内存中；Linux `basic_text` 不作为安全持久化。密钥不返回 renderer、不进入 SQLite/导出包。导入或切换数据库撤销数据源授权，防止导入的 URL 借用原凭据。
- HTTPS 请求在主进程执行，拒绝私有/保留地址、混合 DNS、URL 凭据、重定向和任意请求方法；连接固定到验证后的 DNS 地址。限制响应大小、超时和并发。renderer 保持 `connect-src 'none'`、沙箱和受限 preload。
- 模型不能提供可执行 JS/HTML/JSX、事件处理器、脚本 URL、自定义网络代码或外部写入 API。图片协议只暴露允许的图像 MIME；Mermaid/KaTeX 不允许可信 HTML/外部资源。
- ZIP 包含 `source.md`（原始正文）、`content.md`（相对资源地址和图表/表格降级内容）、`assets/`，交互导出另含 `index.html` 和自带 `viewer/`。不导出密钥或数据源连接配置；导出的正文/快照本身可能包含敏感知识，分享前自行审阅。文本总量限 16 MiB，未压缩总量限 128 MiB。
- 旧 beta.2 无法打开 schema-v2 数据库。回退时先退出新程序，保留新版数据库副本，再将升级前快照复制到独立旧版数据目录。不要用旧程序覆盖新数据库；快照之后新增的内容需先导出。

## 文件与限制

- `shared/content.ts`、`shared/markdown.ts`：协议、校验、Markdown AST、数据与图表纯逻辑。
- `main/content-{store,network,service,export}.ts`：SQLite、网络边界、授权/密钥/图片作业/写入确认、导出；`main.ts/store.ts` 只负责接入。
- `renderer/content/`：阅读运行时、懒加载图表/关系图、可视化编辑器、设置和离线入口。复用既有 Calico/Snow Tokens，不新增平行主题系统。
- `scripts/build.mjs` 构建独立离线运行时；`electron-builder.yml` 显式包含它。
- Tiptap Markdown 仍属于上游 Beta 能力；复杂自定义语法宜在源码模式编辑。原文块只提供标题/首组件数据源的轻量属性编辑，复杂结构继续编辑 JSON，不提供自由拖拽网页设计器。
- 不支持 WebSocket、任意 SQL/脚本、外部 POST 写 API、局域网源、动态图像生成或任意算式引擎；图表最多绘制 2,000 点，表格每页 50 行。离线网页可在用户主动点击时打开普通外部链接，但不会自动请求它们。
- 真实 xAI 账户计费/额度、任意第三方源及 Windows 实机尚需人工验收。自动测试使用隔离数据库及模拟传输，不读取个人密钥、不产生费用。
- 1.1.0-beta.1 不改自动更新或既有用户数据。已发布版本见 [GitHub Releases](https://github.com/Leos-byte/MemoryGraph/releases/tag/v1.1.0-beta.1)；本地解压测试副本位于 `Releases/MemGraph-v1.1.0-beta.1-linux-x64-unpacked/memgraph`。首次测试请显式使用独立 `--user-data-dir`。

## 上游依据

- [xAI image generation](https://docs.x.ai/developers/model-capabilities/images/generation)：独立 Bearer key、固定图像端点和 base64 输出。
- [xAI image-quality migration](https://docs.x.ai/developers/migration/imagine-image-quality-nov-2)：显式模型与质量参数，避免旧质量别名。
- [Tiptap Markdown](https://tiptap.dev/docs/editor/markdown)、[React Node Views](https://tiptap.dev/docs/editor/extensions/custom-extensions/node-views/react)：可视化 Markdown 与不解释的原文节点。
- [Mermaid strict mode](https://mermaid.js.org/config/usage)、[ECharts security](https://echarts.apache.org/handbook/en/best-practices/security/)：严格渲染、仅由程序构造图表选项，不接收任意格式化代码。

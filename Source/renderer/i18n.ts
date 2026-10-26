import type { Settings } from '../shared/types';

const messages = {
  file: ['文件', 'File'], settings: ['设置', 'Settings'], templates: ['模板管理', 'Templates'], about: ['关于', 'About'],
  maps: ['知识地图', 'Knowledge maps'], newMap: ['新建地图', 'New map'], newNode: ['新建节点', 'New node'],
  rename: ['重命名', 'Rename'], delete: ['删除', 'Delete'], export: ['导出 Markdown', 'Export Markdown'],
  trash: ['回收站', 'Recycle bin'], backup: ['备份数据', 'Back up data'], restoreBackup: ['恢复备份', 'Restore backup'],
  import: ['导入旧版数据库', 'Import legacy database'], feedbackGithub: ['GitHub 反馈', 'GitHub feedback'],
  feedbackEmail: ['邮件反馈', 'Email feedback'], feedbackCopy: ['复制反馈信息', 'Copy feedback details'],
  updates: ['检查更新', 'Check for updates'], title: ['标题', 'Title'], name: ['名称', 'Name'],
  cancel: ['取消', 'Cancel'], close: ['关闭', 'Close'], save: ['保存', 'Save'], create: ['创建', 'Create'],
  confirm: ['确认', 'Confirm'], copy: ['复制', 'Copy'], edit: ['编辑', 'Edit'], connect: ['连接节点', 'Connect nodes'],
  updateRelation: ['更新关系', 'Update relationship'], restore: ['恢复', 'Restore'], emptyTrash: ['清空回收站', 'Empty recycle bin'],
  mapsEmpty: ['暂无知识地图', 'No knowledge maps'], nodesEmpty: ['暂无节点', 'No nodes'],
  selectNode: ['未选择节点', 'No node selected'], noContent: ['暂无内容', 'No content yet'],
  concept: ['概念', 'Concept'], conceptPlaceholder: ['输入要探索的概念', 'Enter a concept'], generate: ['生成', 'Generate'],
  regenerate: ['重新生成', 'Regenerate'], stop: ['停止生成', 'Stop generation'], template: ['解释模板', 'Explanation template'],
  default: ['默认', 'Default'], generateNow: ['立即生成解释', 'Generate explanation now'],
  linkedNode: ['创建关联节点', 'Create linked node'], more: ['更多操作', 'More actions'],
  loading: ['正在加载', 'Loading'], working: ['正在处理', 'Working'], ready: ['就绪', 'Ready'],
  generating: ['正在生成', 'Generating'], error: ['错误', 'Error'], cancelled: ['已取消', 'Cancelled'],
  retry: ['重试', 'Retry'], saved: ['已保存', 'Saved'], done: ['操作完成', 'Done'], queued: ['已开始生成', 'Generation started'],
  movedTrash: ['已移至回收站', 'Moved to recycle bin'], restored: ['已恢复', 'Restored'],
  noKey: ['请先在设置中配置 API 密钥', 'Configure an API key in Settings first'],
  bridgeMissing: ['无法连接桌面服务，请通过 MemGraph 桌面应用打开。', 'Desktop bridge unavailable. Open MemGraph in the desktop app.'],
  failed: ['操作失败', 'Operation failed'], selectMap: ['请先选择或新建地图', 'Select or create a map first'],
  source: ['来源节点', 'Source node'], target: ['目标节点', 'Target node'], chooseNode: ['选择节点', 'Choose a node'],
  relationNeedsTwo: ['至少需要两个节点', 'At least two nodes are required'],
  markdown: ['Markdown 内容', 'Markdown content'], nodes: ['节点', 'Nodes'], edges: ['关系', 'Relationships'],
  nodeStatus: ['节点状态', 'Node status'], showMaps: ['显示地图列表', 'Show maps'], showDetails: ['显示详情', 'Show details'],
  fitView: ['适应画布', 'Fit view'], zoomIn: ['放大', 'Zoom in'], zoomOut: ['缩小', 'Zoom out'],
  api: ['模型服务', 'Model service'], preset: ['服务预设', 'API preset'], custom: ['自定义', 'Custom'],
  apiKey: ['API 密钥', 'API key'], keyStored: ['已安全保存密钥', 'Key stored securely'],
  keySession: ['密钥仅在本次会话有效', 'Key available for this session only'], keyMissing: ['未配置密钥', 'No key configured'],
  replaceKey: ['留空保留现有密钥', 'Leave blank to keep the current key'], clearKey: ['清除已保存的密钥', 'Clear saved key'],
  originChanged: ['服务来源已更改，原密钥将被清除。请为新服务填写密钥。', 'The service origin changed. The previous key will be cleared. Enter a key for the new service.'],
  showKey: ['显示密钥', 'Show key'], hideKey: ['隐藏密钥', 'Hide key'], baseUrl: ['服务地址', 'Base URL'],
  model: ['模型', 'Model'], apiMode: ['API 模式', 'API mode'], authMode: ['认证方式', 'Authentication'],
  chatgpt: ['ChatGPT 登录', 'ChatGPT login'], login: ['登录', 'Log in'], loginStatus: ['登录状态', 'Login status'],
  loginOutput: ['登录输出', 'Login output'], checkStatus: ['检查登录状态', 'Check login status'],
  general: ['通用', 'General'], language: ['语言', 'Language'], system: ['跟随系统', 'System'],
  autoGenerate: ['新建节点时自动生成', 'Automatically generate new nodes'], directory: ['数据目录', 'Data directory'],
  chooseDirectory: ['选择目录', 'Choose directory'], beta: ['接收 Beta 更新', 'Receive beta updates'],
  systemPrompt: ['系统提示词', 'System prompt'], userPrompt: ['用户提示词', 'User prompt'],
  newTemplate: ['新建模板', 'New template'], defaultTemplate: ['设为默认模板', 'Set as default template'],
  templateHelp: ['模板帮助', 'Template help'], requiredFields: ['名称、系统提示词、用户提示词均为必填项。', 'Name, system prompt, and user prompt are required.'],
  conceptRequired: ['用户提示词必须包含 {{concept}}。', 'User prompt must contain {{concept}}.'],
  variables: ['可用变量', 'Available variables'], noTemplates: ['暂无模板', 'No templates'],
  trashEmpty: ['回收站为空', 'Recycle bin is empty'], permanentDelete: ['永久删除', 'Permanently delete'],
  emptyWarning: ['这将永久删除回收站内的所有地图、节点和模板，无法撤销。', 'All maps, nodes, and templates in the recycle bin will be permanently deleted. This cannot be undone.'],
  deleteWarning: ['此项目将移至回收站，可稍后恢复。', 'This item will be moved to the recycle bin and can be restored later.'],
  restoreWarning: ['恢复备份会替换当前数据。请先通过文件菜单备份现有数据。', 'Restoring a backup replaces current data. Back up your data from the File menu first.'],
  importTitle: ['导入旧版数据', 'Import legacy data'], importWarning: ['检测到旧版数据库。导入会先备份原文件并保留原始数据库。是否现在导入？', 'A legacy database was detected. Import will back up the original file and keep the original database. Import now?'],
  importManual: ['导入前会备份并保留原数据库，请选择旧版数据库文件。', 'The original database will be backed up and kept. Select a legacy database file.'],
  later: ['稍后', 'Later'], importSuccess: ['数据导入完成', 'Data imported'],
  version: ['版本', 'Version'], platform: ['平台', 'Platform'], download: ['下载更新', 'Download update'],
  install: ['重启并安装', 'Restart and install'], checking: ['正在检查更新', 'Checking for updates'],
  available: ['有可用更新', 'Update available'], downloading: ['正在下载', 'Downloading'], downloaded: ['更新已就绪', 'Update ready'],
  unsupported: ['当前平台不支持自动更新', 'Automatic updates are unavailable on this platform'],
  upToDate: ['已是最新版本', 'Up to date'], updateIdle: ['尚未检查更新', 'Updates have not been checked'],
  unsaved: ['未保存的更改', 'Unsaved changes'], discardWarning: ['放弃未保存的更改？', 'Discard unsaved changes?'],
  discard: ['放弃更改', 'Discard changes'], continueEditing: ['继续编辑', 'Keep editing'],
  newTemplateSystem: ['用 {{language}} 清晰准确地解释概念。使用 Markdown。', 'Explain concepts clearly and accurately in {{language}}. Use Markdown.'],
  newTemplateUser: ['请解释 {{concept}}。\n地图：{{map_title}}\n父概念：{{parent_concept}}\n选中文本：{{selected_text}}\n上下文：\n{{context_markdown}}', 'Explain {{concept}}.\nMap: {{map_title}}\nParent: {{parent_concept}}\nSelected text: {{selected_text}}\nContext:\n{{context_markdown}}'],
  helpConcept: ['目标概念（必填变量）', 'Target concept (required variable)'], helpSelected: ['从父节点选中的文本', 'Text selected in the parent node'],
  helpParent: ['父节点标题', 'Parent node title'], helpMap: ['当前地图标题', 'Current map title'],
  helpContext: ['父节点 Markdown 内容', 'Parent node Markdown'], helpLanguage: ['当前解释语言', 'Current explanation language'],
  leaveBlank: ['必填', 'Required'], status: ['状态', 'Status'], created: ['已创建', 'Created'],
  selectTemplate: ['选择模板', 'Choose a template'], invalidUrl: ['请输入有效的 HTTPS 服务地址', 'Enter a valid HTTPS service URL'],
  chatgptRequiresOpenAi: ['ChatGPT 登录仅支持 OpenAI 服务和 Responses API。', 'ChatGPT login requires the OpenAI service and Responses API.'],
  graph: ['知识图谱', 'Knowledge graph'], aboutDescription: ['理解、连接与沉淀知识。', 'Understand, connect, and retain knowledge.'],
  noResults: ['没有可用项目', 'No items available'],
} as const;

export type MessageKey = keyof typeof messages;
export type Translate = (key: MessageKey) => string;
export function languageFor(language?: Settings['language']): 'zh' | 'en' {
  if (language === 'en_US') return 'en';
  if (language === 'zh_CN' || !language) return 'zh';
  return navigator.language.toLowerCase().startsWith('zh') ? 'zh' : 'en';
}
export function translator(language: 'zh' | 'en'): Translate {
  return key => messages[key][language === 'zh' ? 0 : 1];
}
export function statusLabel(status: string, t: Translate): string {
  if (['generating', 'pending', 'running'].includes(status)) return t('generating');
  if (['error', 'failed'].includes(status)) return t('error');
  if (['cancelled', 'canceled'].includes(status)) return t('cancelled');
  if (['ready', 'complete', 'completed', 'done'].includes(status)) return t('ready');
  if (['empty', 'draft', 'idle', ''].includes(status)) return t('noContent');
  return status;
}

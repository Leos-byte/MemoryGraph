import { useEffect, useRef, useState } from 'react';
import { EditorContent, NodeViewWrapper, ReactNodeViewRenderer, useEditor, type NodeViewProps } from '@tiptap/react';
import { Node, mergeAttributes, type Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from '@tiptap/markdown';
import TiptapImage from '@tiptap/extension-image';
import { TableKit } from '@tiptap/extension-table';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import DOMPurify from 'dompurify';
import { Bold, Italic, List, ListOrdered, Heading2, Link2, Code, Table2, ImagePlus, Undo2, Redo2, Sparkles, Upload, X } from 'lucide-react';
import { RichContent, assetUrl } from './RichContent';
import { editorDocument } from './editor-document';
import { parseRich, type RichProfile, type ImageJob } from '../../shared/content';
import { Modal } from '../ui';
import { useId } from 'react';
import { richFences } from '../../shared/markdown';

function RawView({ node, selected, updateAttributes, extension }: NodeViewProps) {
  const raw = String(node.attrs.raw ?? ''), zh = extension.options.language === 'zh'; let document: ReturnType<typeof parseRich> | undefined;
  const code = richFences(raw)[0];
  try { if (code) document = parseRich(code.raw); } catch { /* The source remains editable and preview reports the error. */ }
  const [profile, setProfile] = useState<RichProfile>();
  useEffect(() => { if (selected) void window.memgraph.invoke<RichProfile>('content.profile').then(setProfile).catch(() => {}); }, [selected]);
  const first = document?.blocks[0];
  function property(key: string, value: string) { if (!document || !first) return; const next = structuredClone(document); (next.blocks[0] as unknown as Record<string,unknown>)[key] = value || undefined; updateAttributes({ raw: '```memgraph-ui\n'+JSON.stringify(next,null,2)+'\n```' }); }
  return <NodeViewWrapper className={`editor-raw ${selected ? 'is-selected' : ''}`} contentEditable={false}>
    <div className="editor-block-label">{code ? (zh ? '交互组件' : 'Interactive component') : (zh ? '原文块' : 'Source block')}</div>
    {selected ? <>{first && <div className="form-grid"><label className="field">{zh ? '标题' : 'Title'}<input value={first.title ?? ''} onChange={event => property('title',event.target.value)} /></label><label className="field">{zh ? '数据源绑定' : 'Data source binding'}<select value={first.sourceId ?? ''} onChange={event => property('sourceId',event.target.value)}><option value="">—</option>{profile?.sources.map(source => <option value={source.id} key={source.id}>{source.name}</option>)}</select></label></div>}<textarea aria-label={zh ? '组件及原文源码' : 'Component and block source'} rows={8} value={raw} onChange={event => updateAttributes({ raw:event.target.value })} spellCheck={false} /></> : <RichContent markdown={raw} offline language={zh ? 'zh' : 'en'} />}
  </NodeViewWrapper>;
}
const RawBlock = Node.create({ name:'rawBlock', group:'block', atom:true, addOptions: () => ({ language:'en' }), addAttributes: () => ({ raw:{ default:'' } }), parseHTML: () => [{ tag:'div[data-raw-block]' }], renderHTML: ({ HTMLAttributes }) => ['div',mergeAttributes(HTMLAttributes,{ 'data-raw-block':'' })], renderMarkdown: node => String(node.attrs?.raw ?? ''), addNodeView: () => ReactNodeViewRenderer(RawView) });
const RawInline = Node.create({ name:'rawInline', group:'inline', inline:true, atom:true, addAttributes: () => ({ raw:{ default:'' } }), parseHTML: () => [{ tag:'span[data-raw-inline]' }], renderHTML: ({ node }) => ['span',{ 'data-raw-inline':'' },String(node.attrs.raw)], renderMarkdown: node => String(node.attrs?.raw ?? '') });
const SafeImage = TiptapImage.extend({ renderHTML({ HTMLAttributes }) { return ['img', { ...HTMLAttributes, src:assetUrl(String(HTMLAttributes.src ?? '')) ?? '' }]; } });
export function ContentEditor({ value, onChange, nodeId, language }: { value:string; onChange:(value:string)=>void; nodeId:string; language:'zh'|'en' }) {
  const zh = language === 'zh', [mode,setMode] = useState<'visual'|'source'|'preview'>('visual'), [error,setError] = useState(''), [image,setImage] = useState(false), [link,setLink] = useState(false), [url,setUrl] = useState(''); const id = useId();
  const synced = useRef<{editor:Editor;markdown:string} | undefined>(undefined);
  const latest = useRef(value); latest.current=value;
  const editor = useEditor({
    immediatelyRender:false,
    extensions:[StarterKit.configure({ link:{ openOnClick:false, protocols:['https','http'] } }),Markdown,TableKit,TaskList,TaskItem,SafeImage.configure({ allowBase64:false }),RawBlock.configure({ language }),RawInline],
    content:'',
    onUpdate:({editor}) => { const markdown=editor.getMarkdown(); latest.current=markdown;synced.current={editor,markdown}; onChange(markdown); },
    editorProps:{
      attributes:{'aria-label':zh?'可视化内容':'Visual content',role:'textbox','aria-multiline':'true'},
      transformPastedHTML:html => DOMPurify.sanitize(html,{FORBID_TAGS:['img','svg','iframe','script','style'],FORBID_ATTR:['style']}),
      handlePaste:(_view,event) => { const file=Array.from(event.clipboardData?.files??[]).find(file=>file.type.startsWith('image/')); if(!file)return false;event.preventDefault();void importFile(file);return true; },
      handleDrop:(_view,event) => { const file=Array.from(event.dataTransfer?.files??[]).find(file=>file.type.startsWith('image/')); if(!file)return false;event.preventDefault();void importFile(file);return true; }
    }
  });
  useEffect(() => {
    if (mode!=='visual' || !editor?.markdown || editor.isDestroyed || synced.current?.editor===editor && synced.current.markdown===value) return;
    editor.chain().setContent(editorDocument(value,editor.markdown),{emitUpdate:false}).setMeta('addToHistory',false).run();
    synced.current={editor,markdown:value};
  },[editor,mode,value]);
  function append(suffix:string) {
    const next=latest.current+suffix;latest.current=next;onChange(next);
    if(editor?.markdown && !editor.isDestroyed){editor.commands.setContent(editorDocument(next,editor.markdown),{emitUpdate:false});synced.current={editor,markdown:next};}
  }
  async function importFile(file?: File) {
    try {
      if (file && file.size>25*1024*1024) throw new Error('Image exceeds 25 MiB.');
      const bytes = file ? await new Promise<string>((resolve,reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(',')[1]); reader.onerror=reject; reader.readAsDataURL(file); }) : undefined;
      const result = await window.memgraph.invoke<{assetId:string}|null>('content.assetImport',{nodeId,...(bytes?{bytes}:{})});
      if (result) append(`\n\n![${zh?'图片':'Image'}](asset:${result.assetId})\n`);
    } catch(error) { setError(String(error)); }
  }
  function insertComponent(type:string) {
    const block: any = { id:'block-'+crypto.randomUUID().slice(0,8),type,title:zh?'新组件':'New component' };
    if (['table','chart','metric'].includes(type)) { block.data=[{category:'A',value:10},{category:'B',value:20}]; if(type==='chart') {block.chart='bar';block.x='category';block.y='value';} if(type==='metric') block.aggregate='count'; }
    else if(['columns','details','tabs','form'].includes(type)) block.children=[{id:'child-'+crypto.randomUUID().slice(0,8),type:'markdown',title:'Content',text:'...'}];
    else if(['input','slider','toggle','select'].includes(type)) {block.state='value';block.value=type==='toggle'?false:type==='slider'?0:'';if(type==='select')block.options=['A','B'];}
    else block.text='...';
    append(`\n\n\`\`\`memgraph-ui\n${JSON.stringify({version:1,blocks:[block]},null,2)}\n\`\`\`\n`);
  }
  const tools = editor ? [
    [Bold,zh?'加粗':'Bold',()=>editor.chain().focus().toggleBold().run()], [Italic,zh?'斜体':'Italic',()=>editor.chain().focus().toggleItalic().run()], [Heading2,zh?'二级标题':'Heading 2',()=>editor.chain().focus().toggleHeading({level:2}).run()],
    [List,zh?'列表':'Bullet list',()=>editor.chain().focus().toggleBulletList().run()], [ListOrdered,zh?'有序列表':'Ordered list',()=>editor.chain().focus().toggleOrderedList().run()], [Code,zh?'代码':'Code',()=>editor.chain().focus().toggleCodeBlock().run()],
    [Table2,zh?'表格':'Table',()=>editor.chain().focus().insertTable({rows:3,cols:2,withHeaderRow:true}).run()], [Link2,zh?'链接':'Link',()=>setLink(true)], [ImagePlus,zh?'导入图片':'Import image',()=>void importFile()], [Sparkles,zh?'Grok 生图':'Grok image',()=>setImage(true)],
    [Undo2,zh?'撤销':'Undo',()=>editor.chain().focus().undo().run()], [Redo2,zh?'重做':'Redo',()=>editor.chain().focus().redo().run()]
  ] as const : [];
  return <div className="content-editor"><div className="content-editor-modes" role="tablist" aria-label={zh?'编辑模式':'Editor mode'}>{(['visual','source','preview'] as const).map((item,index)=><button key={item} type="button" role="tab" aria-selected={mode===item} onClick={()=>setMode(item)}>{(zh?['可视化','Markdown 源码','预览']:['Visual','Markdown source','Preview'])[index]}</button>)}</div>
    <div hidden={mode!=='visual'}><div className="content-editor-tools" role="toolbar" aria-label={zh?'格式':'Formatting'}>{tools.map(([Icon,label,action])=><button type="button" key={label} title={label} aria-label={label} onClick={()=>action()}><Icon size={16}/></button>)}<select aria-label={zh?'插入组件':'Insert component'} value="" onChange={event=>{insertComponent(event.target.value);event.target.value='';}}><option value="">{zh?'插入组件':'Insert component'}</option>{['callout','details','tabs','columns','metric','table','chart','input','select','toggle','slider','form','button'].map(type=><option key={type}>{type}</option>)}</select></div><EditorContent editor={editor}/></div>
    {mode==='source' && <textarea className="markdown-editor" rows={18} aria-label={zh?'Markdown 内容':'Markdown content'} value={value} spellCheck={false} onChange={event=>onChange(event.target.value)}/>}
    {mode==='preview' && <div className="markdown content-preview"><RichContent markdown={value} offline language={language}/></div>}
    {error && <p className="inline-error" role="alert">{error}</p>}
    {link && <div className="content-link-editor"><label htmlFor={id}>{zh?'HTTPS 链接':'HTTPS link'}</label><input id={id} type="url" value={url} onChange={event=>setUrl(event.target.value)}/><button type="button" onClick={()=>{if(/^https?:\/\//i.test(url))editor?.chain().focus().setLink({href:url}).run();setLink(false);}}>{zh?'应用':'Apply'}</button><button type="button" onClick={()=>setLink(false)}><X size={14}/></button></div>}
    <div className="button-row"><button type="button" onClick={()=>setImage(true)}><Sparkles size={15}/>{zh?'Grok 生图':'Grok image'}</button><label className="content-upload"><Upload size={15}/><span>{zh?'导入 / 粘贴 / 拖入图片':'Import / paste / drop image'}</span><input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={event=>void importFile(event.target.files?.[0])}/></label></div>
    {image && <ImageDialog nodeId={nodeId} language={language} onClose={()=>setImage(false)} onInsert={assetId=>{append(`\n\n![${zh?'生成图片':'Generated image'}](asset:${assetId})\n`);setImage(false);}}/>}
  </div>;
}
function ImageDialog({nodeId,language,onInsert,onClose}:{nodeId:string;language:'zh'|'en';onInsert:(id:string)=>void;onClose:()=>void}) {
  const zh=language==='zh', [prompt,setPrompt]=useState(''), [url,setUrl]=useState('');
  const [ratio,setRatio]=useState('16:9'), [quality,setQuality]=useState('low');
  const [job,setJob]=useState<ImageJob>(), [error,setError]=useState(''), [busy,setBusy]=useState(false);
  useEffect(()=>{
    if(job?.status!=='running')return;
    let active=true;
    const timer=setInterval(()=>{void window.memgraph.invoke<ImageJob>('content.imageJob',{id:job.id}).then(value=>{if(active)setJob(value);}).catch(error=>{if(active)setError(String(error));});},1500);
    return()=>{active=false;clearInterval(timer);};
  },[job?.id,job?.status]);
  async function generate() {
    setBusy(true);setError('');
    try { const value=await window.memgraph.invoke<ImageJob|null>('content.imageStart',{nodeId,prompt,ratio,quality});if(value)setJob(value); }
    catch(error){setError(String(error));} finally{setBusy(false);}
  }
  async function importUrl() {
    setBusy(true);
    try {const value=await window.memgraph.invoke<{assetId:string}|null>('content.assetImport',{nodeId,url});if(value)onInsert(value.assetId);}
    catch(error){setError(String(error));} finally{setBusy(false);}
  }
  return <Modal title={zh?'图片与 Grok 生图':'Images and Grok'} onClose={onClose} testId="image-dialog" wide><div className="modal-body">
    <label className="field">{zh?'HTTPS 图片地址':'HTTPS image URL'}<input value={url} onChange={event=>setUrl(event.target.value)}/></label>
    <button type="button" disabled={busy||!url} onClick={()=>void importUrl()}>{zh?'导入图片':'Import image'}</button><hr/>
    <label className="field">{zh?'生图提示词':'Image prompt'}<textarea rows={4} value={prompt} onChange={event=>setPrompt(event.target.value)}/></label>
    <div className="form-grid"><label className="field">{zh?'比例':'Aspect ratio'}<select value={ratio} onChange={event=>setRatio(event.target.value)}>{['1:1','16:9','9:16','4:3','3:4'].map(value=><option key={value}>{value}</option>)}</select></label>
      <label className="field">{zh?'质量':'Quality'}<select value={quality} onChange={event=>setQuality(event.target.value)}><option value="low">{zh?'低':'Low'}</option><option value="medium">{zh?'中':'Medium'}</option></select></label></div>
    <button type="button" disabled={busy||!prompt.trim()||job?.status==='running'} onClick={()=>void generate()}><Sparkles size={15}/>{zh?'生成图片（付费）':'Generate image (paid)'}</button>
    {job && <p role="status">{job.status}{job.message && `: ${job.message}`}</p>}
    {job?.status==='running' && <button type="button" onClick={async()=>setJob(await window.memgraph.invoke('content.imageCancel',{id:job.id}))}>{zh?'停止等待':'Stop waiting'}</button>}
    {job?.assetId && <><img className="content-image" src={assetUrl(`asset:${job.assetId}`)} alt={prompt}/><button type="button" className="primary" onClick={()=>onInsert(job.assetId!)}>{zh?'插入内容':'Insert into content'}</button></>}
    {error && <p className="inline-error" role="alert">{error}</p>}
  </div></Modal>;
}

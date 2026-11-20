import { Alert,Button,ColorPicker,Input,InputNumber,Modal,Select,Slider,Switch,Tooltip } from 'antd'
import { Canvas,Circle,FabricImage,FabricObject,Rect,Textbox } from 'fabric'
import { ArrowDown,ArrowUp,Copy,Download,Eye,EyeOff,ImagePlus,Layers,LayoutTemplate,Lock,Redo2,Shapes,Trash2,Type,Undo2,Unlock } from 'lucide-react'
import { useEffect,useRef,useState } from 'react'
import { referenceTemplates,type ReferenceTemplate } from '../../shared/title-editor/title-reference'
import { readImageFile } from '../../shared/title-editor/TitleImageLayers'
import { Preview } from '../../shared/title-editor/TitleStudio'
import './blank-board.css'
import { installSnapping } from './board-snapping'
import { templateFonts,templateObjects,upgradeTemplateBackgrounds } from './board-template'
FabricObject.customProperties = ['lockMovementX','lockMovementY','lockScalingX','lockScalingY','lockRotation','hasControls','editable','templateRole']

const fonts = [
 {label:'苹方',value:'StudioPingFang'}, {label:'优设标题黑',value:'StudioDisplay'},
 {label:'思源黑体',value:'TitleSans'}, {label:'思源宋体',value:'TitleSong'},
 {label:'站酷快乐体',value:'TitleHappy'}, {label:'马善政毛笔',value:'TitleBrush'},
 {label:'志莽行书',value:'TitleWild'}, {label:'站酷小薇',value:'TitleSerif'},
 ...Object.entries(templateFonts).filter(([,v])=>['TitleButter','TitleGrass','TitleDragon'].includes(v)).map(([label,value])=>({label,value})),
]
export type Doc = { version:1; width:number; height:number; name:string; canvas:ReturnType<Canvas['toJSON']> }
const saveFile=(blob:Blob,name:string)=>{const u=URL.createObjectURL(blob);const a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000)}
export default function BlankBoard({initialTemplate,initialProject,onApply,onClose}:{initialTemplate?:ReferenceTemplate;initialProject?:Doc;onApply?:(image:string,title:string,project:Doc)=>void;onClose?:()=>void} = {}){
 const [templateQuery,setTemplateQuery]=useState('')
 const templateRequest=useRef(0)
 async function openTemplate(template:ReferenceTemplate){
  const request=++templateRequest.current;setBusy(true);setError('')
  try{
   const objects=await templateObjects(template)
   if(request!==templateRequest.current||!engine.current)return
   const c=engine.current;c.clear();c.backgroundColor='#fff';dims.current={width:1800,height:template.height};setSize(dims.current);nameRef.current=template.name;setName(template.name)
   c.add(...objects);const title=objects.find(o=>o.get('templateRole')==='title');if(title)c.setActiveObject(title)
   fit();remember()
  }catch{if(request===templateRequest.current)setError('模板加载失败，请重新选择。')}finally{if(request===templateRequest.current)setBusy(false)}
 }

 const el=useRef<HTMLCanvasElement>(null),host=useRef<HTMLDivElement>(null),engine=useRef<Canvas|null>(null)
 const file=useRef<HTMLInputElement>(null),project=useRef<HTMLInputElement>(null)
 const dims=useRef({width:1200,height:800}),nameRef=useRef('未命名设计'),zoomRef=useRef(.65)
 const stack=useRef<string[]>([]),cursor=useRef(-1),restoring=useRef(false)
 const [selected,setSelected]=useState<FabricObject|null>(null),[objects,setObjects]=useState<FabricObject[]>([])
 const [,refresh]=useState(0),[panel,setPanel]=useState(initialTemplate?'templates':'text'),[name,setName]=useState('未命名设计')
 const [size,setSize]=useState({width:1200,height:800}),[zoom,setZoom]=useState(65),[error,setError]=useState(''),[busy,setBusy]=useState(false)
 const [resizeOpen,setResizeOpen]=useState(false),[newSize,setNewSize]=useState(size)
 const [format,setFormat]=useState<'png'|'jpeg'>('png'),[restoreAvailable,setRestoreAvailable]=useState(false)
 const replacing=useRef(false)
 const snapEnabled=useRef(true)
 const [snapping,setSnapping]=useState(true)
 const sync=()=>{const c=engine.current;if(!c)return;setObjects([...c.getObjects()]);setSelected(c.getActiveObject()||null);refresh(n=>n+1)}
 const snapshot=():Doc=>({version:1,...dims.current,name:nameRef.current,canvas:engine.current!.toJSON()})
 function remember(){
  if(restoring.current||!engine.current)return
  const s=JSON.stringify(snapshot());if(stack.current[cursor.current]===s)return
  stack.current=stack.current.slice(0,cursor.current+1);stack.current.push(s)
  if(stack.current.length>60)stack.current.shift()
  cursor.current=stack.current.length-1
  try{localStorage.setItem('creator.blank-board.v1',s)}catch{setError('浏览器草稿空间不足，请保存工程文件。')}
  sync()
 }
 function scale(percent:number){const c=engine.current;if(!c)return;zoomRef.current=percent/100;setZoom(percent);c.setDimensions({width:dims.current.width*percent/100,height:dims.current.height*percent/100});c.setZoom(percent/100);c.requestRenderAll()}
 function fit(){if(!host.current)return;const r=host.current.getBoundingClientRect();scale(Math.max(10,Math.min(100,Math.floor(Math.min((r.width-100)/dims.current.width,(r.height-100)/dims.current.height)*100))))}
 useEffect(()=>{
  if(!el.current)return
  FabricObject.ownDefaults.borderColor='#0ea5e9';FabricObject.ownDefaults.cornerColor='#fff';FabricObject.ownDefaults.cornerStrokeColor='#a6a8b5';FabricObject.ownDefaults.transparentCorners=false;FabricObject.ownDefaults.cornerStyle='circle';FabricObject.ownDefaults.cornerSize=11
  const c=new Canvas(el.current,{width:1200,height:800,backgroundColor:'#ffffff',preserveObjectStacking:true,selection:true})
  engine.current=c
  c.on('selection:created',sync);c.on('selection:updated',sync);c.on('selection:cleared',sync)
  const disposeSnapping=installSnapping(c,()=>dims.current,()=>snapEnabled.current)
  c.on('object:modified',remember);c.on('text:editing:exited',remember)
  try{setRestoreAvailable(!!localStorage.getItem('creator.blank-board.v1'))}catch{}
  stack.current=[JSON.stringify(snapshot())];cursor.current=0
  const observer=new ResizeObserver(()=>fit());if(host.current)observer.observe(host.current)
  fit();sync()
  if(initialProject){setBusy(true);void load(initialProject).then(()=>remember()).catch(()=>setError('编辑稿恢复失败')).finally(()=>setBusy(false))}
  else if(initialTemplate)void openTemplate(initialTemplate)
  return()=>{disposeSnapping();observer.disconnect();templateRequest.current++;engine.current=null;void c.dispose()}
 },[])
 async function load(d:Doc){
  if(!d||d.version!==1||!Number.isFinite(d.width)||!Number.isFinite(d.height)||d.width<100||d.height<100||d.width>4096||d.height>4096||!d.canvas||!Array.isArray(d.canvas.objects)||d.canvas.objects.length>200)throw new Error('工程格式不正确，尺寸需在 100–4096 像素之间。')
  const types=['Textbox','Rect','Circle','Image']
  for(const o of d.canvas.objects as Record<string,unknown>[]){if(!types.some(t=>t.toLowerCase()===String(o.type).toLowerCase()))throw new Error('工程包含不支持的元素');if(String(o.type).toLowerCase()==='image'&&!/^data:image\/(png|jpeg|webp|gif|avif);base64,/.test(String(o.src)))throw new Error('工程图片必须内嵌')}
  restoring.current=true
  try{await Promise.all(fonts.map(f=>document.fonts.load('48px "'+f.value+'"')));await engine.current!.loadFromJSON(await upgradeTemplateBackgrounds(d.canvas));dims.current={width:d.width,height:d.height};setSize(dims.current);nameRef.current=d.name||'未命名设计';setName(nameRef.current);fit();sync()}finally{restoring.current=false}
 }
 async function history(delta:number){const n=cursor.current+delta;if(n<0||n>=stack.current.length||busy)return;setBusy(true);try{await load(JSON.parse(stack.current[n]));cursor.current=n;sync();try{localStorage.setItem('creator.blank-board.v1',stack.current[n])}catch{}}catch{setError('恢复失败')}finally{setBusy(false)}}
 function patch(props:Record<string,unknown>){if(!selected||selected.lockMovementX)return;selected.set(props);selected.setCoords();engine.current!.requestRenderAll();remember()}
 async function addText(font='StudioPingFang'){await document.fonts.load('64px '+font);const c=engine.current!;const t=new Textbox('双击输入文字',{left:dims.current.width/2,top:dims.current.height/2,originX:'center',originY:'center',width:Math.min(500,dims.current.width*.7),fontFamily:font,fontSize:64,fill:'#292b32',textAlign:'center'});c.add(t);c.setActiveObject(t);remember()}
 async function upload(f:File,replace=false){setBusy(true);setError('');try{const data=await readImageFile(f);const c=engine.current!;if(replace&&c.getActiveObject() instanceof FabricImage){const image=c.getActiveObject() as FabricImage;const w=image.getScaledWidth(),h=image.getScaledHeight();await image.setSrc(data.src);image.set({scaleX:w/image.width,scaleY:h/image.height});image.setCoords()}else{const image=await FabricImage.fromURL(data.src);const s=Math.min(dims.current.width*.65/image.width,dims.current.height*.65/image.height,1);image.set({left:dims.current.width/2,top:dims.current.height/2,originX:'center',originY:'center',scaleX:s,scaleY:s});c.add(image);c.setActiveObject(image)}c.requestRenderAll();remember()}catch(e){setError(e instanceof Error?e.message:'图片加载失败')}finally{setBusy(false)}}
 function shape(circle=false,rounded=false){const props={left:dims.current.width/2,top:dims.current.height/2,originX:'center' as const,originY:'center' as const,fill:'#bca0e9'};const o=circle?new Circle({...props,radius:90}):new Rect({...props,width:240,height:160,rx:rounded?28:0,ry:rounded?28:0});engine.current!.add(o);engine.current!.setActiveObject(o);remember()}
 function remove(){const c=engine.current!;c.getActiveObjects().filter(o=>!o.lockMovementX).forEach(o=>c.remove(o));c.discardActiveObject();c.requestRenderAll();remember()}
 async function duplicate(){if(!selected)return;const o=await selected.clone();o.set({left:selected.left+24,top:selected.top+24});engine.current!.add(o);engine.current!.setActiveObject(o);remember()}
 function lock(o:FabricObject){const locked=!o.lockMovementX;o.set({lockMovementX:locked,lockMovementY:locked,lockScalingX:locked,lockScalingY:locked,lockRotation:locked,hasControls:!locked});if(o instanceof Textbox)o.set({editable:!locked});engine.current!.requestRenderAll();remember()}
 useEffect(()=>{const handler=(e:KeyboardEvent)=>{if((e.target as HTMLElement).closest('input,textarea,[contenteditable=true]')||(engine.current?.getActiveObject() instanceof Textbox&&(engine.current.getActiveObject() as Textbox).isEditing))return
 if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();void history(e.shiftKey?1:-1)}
 else if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();remove()}
 else if(selected&&!selected.lockMovementX&&e.key.startsWith('Arrow')){e.preventDefault();const n=e.shiftKey?10:1;patch({left:selected.left+(e.key==='ArrowRight'?n:e.key==='ArrowLeft'?-n:0),top:selected.top+(e.key==='ArrowDown'?n:e.key==='ArrowUp'?-n:0)})}}
 window.addEventListener('keydown',handler);return()=>window.removeEventListener('keydown',handler)},[selected,busy])
 async function exportImage(){setBusy(true);try{await document.fonts.ready;const c=engine.current!;const data=c.toDataURL({format,quality:.95,multiplier:1/zoomRef.current,enableRetinaScaling:false});saveFile(await (await fetch(data)).blob(),nameRef.current+'.'+(format==='jpeg'?'jpg':'png'))}catch{setError('导出失败，请重试')}finally{setBusy(false)}}
 const text=selected instanceof Textbox?selected:null, image=selected instanceof FabricImage?selected:null
 const iconButton=(label:string,icon:React.ReactNode,fn:()=>void,disabled=false)=><Tooltip title={label}><Button aria-label={label} icon={icon} onClick={fn} disabled={disabled}/></Tooltip>
 return <div className="blank-board">
 <header className="board-header"><Button type="text" href={onClose?undefined:"#/tools"} onClick={onClose}>{onClose?'← 返回排版':'← 全部工具'}</Button><Input aria-label="作品名称" value={name} onChange={e=>{setName(e.target.value);nameRef.current=e.target.value}} onBlur={remember}/><Button onClick={()=>{setNewSize(size);setResizeOpen(true)}}>调整尺寸</Button>{iconButton('撤销',<Undo2 size={18}/>,()=>void history(-1),cursor.current<1||busy)}{iconButton('重做',<Redo2 size={18}/>,()=>void history(1),cursor.current>=stack.current.length-1||busy)}<div className="board-header-end">{onApply&&<Button disabled={busy} onClick={()=>{const c=engine.current!;c.discardActiveObject();const title=c.getObjects().find(o=>o.get('templateRole')==='title');onApply(c.toDataURL({format:'png',multiplier:1/zoomRef.current,enableRetinaScaling:false}),title instanceof Textbox?title.text:nameRef.current,snapshot())}}>添加到文章</Button>}<Button onClick={()=>Modal.confirm({title:'新建空白画板？',content:'当前内容可通过撤销恢复，建议先保存工程。',onOk:()=>{engine.current!.clear();engine.current!.backgroundColor='#ffffff';nameRef.current='未命名设计';setName(nameRef.current);remember()}})}>新建</Button><Button onClick={()=>project.current?.click()}>打开工程</Button><Button onClick={()=>saveFile(new Blob([JSON.stringify(snapshot())],{type:'application/json'}),name+'.creator.json')}>保存工程</Button><Select aria-label="导出格式" value={format} onChange={setFormat} options={[{label:'PNG',value:'png'},{label:'JPG',value:'jpeg'}]}/><Button type="primary" icon={<Download size={17}/>} loading={busy} onClick={()=>void exportImage()}>导出</Button></div></header>
 <div className="board-body"><nav className="board-rail">{[{id:'templates',label:'模板',icon:LayoutTemplate},{id:'text',label:'文字',icon:Type},{id:'image',label:'图片',icon:ImagePlus},{id:'shape',label:'形状',icon:Shapes},{id:'layers',label:'图层',icon:Layers}].map(t=><button key={t.id} className={panel===t.id?'active':''} onClick={()=>setPanel(t.id)}><t.icon size={23}/><span>{t.label}</span></button>)}</nav>
 <aside className="board-panel">
 {panel==='templates'&&<><h2>模板</h2><Input.Search aria-label="搜索画板模板" placeholder="搜索模板" value={templateQuery} onChange={e=>setTemplateQuery(e.target.value)}/><div className="board-templates">{referenceTemplates.filter(t=>(t.name+t.title+t.category).includes(templateQuery)).map(t=><button key={t.id} disabled={busy} onClick={()=>{if(objects.length)Modal.confirm({title:'使用这个模板？',content:'将替换当前画布，修改可通过撤销恢复。',onOk:()=>openTemplate(t)});else void openTemplate(t)}}><Preview value={t}/><span>{t.name}</span></button>)}</div></>}
 {panel==='text'&&<><h2>文字</h2><Button type="primary" block onClick={()=>void addText()}>添加文字</Button><p>双击编辑文字，拖动调整位置。</p><h3>选择字体 <small>点击应用或添加</small></h3><div className="board-font-grid">{fonts.map(f=><button className={`board-font-sample ${text?.fontFamily===f.value?"selected":""}`} aria-pressed={text?.fontFamily===f.value} key={f.value} onClick={()=>{if(text)void document.fonts.load('64px "'+f.value+'"').then(()=>patch({fontFamily:f.value}));else void addText(f.value)}}><span style={{fontFamily:f.value}}>灵感成形</span><small>{f.label}</small></button>)}</div></>}
 {panel==='image'&&<><h2>图片</h2><Button type="primary" block loading={busy} onClick={()=>{replacing.current=false;file.current?.click()}}>上传图片</Button><div className="board-upload-note"><ImagePlus size={36}/><p>也可以把图片拖到画布</p><small>PNG / JPG / WebP，支持透明图片</small></div>{image&&<Button block onClick={()=>{replacing.current=true;file.current?.click()}}>替换选中图片</Button>}</>}
 {panel==='shape'&&<><h2>形状</h2><div className="board-shapes"><button onClick={()=>shape()}>▭<span>矩形</span></button><button aria-label="圆角矩形" onClick={()=>shape(false,true)}>▢<span>圆角矩形</span></button><button onClick={()=>shape(true)}>○<span>圆形</span></button></div></>}
 {panel==='layers'&&<><h2>图层 <small>{objects.length}</small></h2>{!objects.length&&<p>添加文字或图片后，在这里管理。</p>}{[...objects].reverse().map((o,i)=><div className={'board-layer '+(o===selected?'active':'')} key={i}><button onClick={()=>{engine.current!.setActiveObject(o);engine.current!.requestRenderAll();sync()}}>{o instanceof Textbox?o.text.slice(0,15):o instanceof FabricImage?'图片':o instanceof Circle?'圆形':'矩形'}</button>{iconButton(o.visible?'隐藏图层':'显示图层',o.visible?<Eye size={15}/>:<EyeOff size={15}/>,()=>{o.set({visible:!o.visible});engine.current!.discardActiveObject();engine.current!.requestRenderAll();remember()})}{iconButton(o.lockMovementX?'解锁图层':'锁定图层',o.lockMovementX?<Lock size={15}/>:<Unlock size={15}/>,()=>lock(o))}</div>)}</>}
 {restoreAvailable&&<Button className="board-restore" onClick={()=>{Modal.confirm({title:'恢复上次草稿？',content:'当前画布将被替换，可通过撤销恢复。',onOk:async()=>{try{await load(JSON.parse(localStorage.getItem('creator.blank-board.v1')||'null'));remember();setRestoreAvailable(false)}catch{setError('草稿无法读取')}}})}}>恢复上次草稿</Button>}
 </aside>
 <section className="board-workspace"><div className="board-toolbar">
 {!selected?<><span>画布背景</span><ColorPicker disabledAlpha value={String(engine.current?.backgroundColor||'#fff')} onChange={color=>{engine.current!.backgroundColor=color.toHexString();engine.current!.requestRenderAll();remember()}}/><span className="board-tool-hint">添加文字或上传图片开始创作</span></>:<>
 {text&&<div className="board-text-tools"><span className="board-group-label">文字</span><Select aria-label="文字字体" value={text.fontFamily} options={fonts} onChange={font=>void document.fonts.load('64px "'+font+'"').then(()=>patch({fontFamily:font}))}/><InputNumber aria-label="文字字号" min={8} max={500} value={text.fontSize} onChange={n=>n&&patch({fontSize:n})}/><ColorPicker disabledAlpha value={String(text.fill)} onChange={c=>patch({fill:c.toHexString()})}/><Button aria-label="加粗" type={text.fontWeight===700?'primary':'default'} onClick={()=>patch({fontWeight:text.fontWeight===700?400:700})}><b>B</b></Button><Button aria-label="斜体" onClick={()=>patch({fontStyle:text.fontStyle==='italic'?'normal':'italic'})}><i>I</i></Button><Button aria-label="下划线" onClick={()=>patch({underline:!text.underline})}><u>U</u></Button><Select aria-label="文字对齐" value={text.textAlign} onChange={textAlign=>patch({textAlign})} options={['left','center','right'].map((v,i)=>({value:v,label:['左对齐','居中','右对齐'][i]}))}/></div>}
 {image?<><Button onClick={()=>{replacing.current=true;file.current?.click()}}>替换图片</Button><Button disabled={selected.lockMovementX} onClick={()=>{const s=Math.max(dims.current.width/image.width,dims.current.height/image.height);patch({originX:'center',originY:'center',left:dims.current.width/2,top:dims.current.height/2,scaleX:s,scaleY:s,angle:0})}}>铺满画布</Button><Button onClick={()=>patch({flipX:!selected.flipX})}>水平翻转</Button><Button onClick={()=>patch({flipY:!selected.flipY})}>垂直翻转</Button></>:!text&&<ColorPicker value={String(selected.fill)} onChange={c=>patch({fill:c.toHexString()})}/>}
 {selected instanceof Rect&&<label>圆角<InputNumber aria-label="圆角半径" min={0} max={Math.min(selected.width,selected.height)/2} value={selected.rx} onChange={n=>patch({rx:n||0,ry:n||0})}/></label>}
 <div className="board-object-tools"><span className="board-group-label">对象</span><label>旋转<InputNumber aria-label="旋转角度" value={Math.round(selected.angle)} onChange={angle=>patch({angle:angle||0})}/></label><label>透明度<InputNumber aria-label="透明度" min={0} max={100} value={Math.round(selected.opacity*100)} onChange={n=>patch({opacity:(n??100)/100})}/></label>
 {iconButton('上移一层',<ArrowUp size={16}/>,()=>{engine.current!.bringObjectForward(selected);remember()})}{iconButton('下移一层',<ArrowDown size={16}/>,()=>{engine.current!.sendObjectBackwards(selected);remember()})}{iconButton('复制',<Copy size={16}/>,()=>void duplicate())}{iconButton(selected.lockMovementX?'解锁':'锁定',selected.lockMovementX?<Lock size={16}/>:<Unlock size={16}/>,()=>lock(selected))}{iconButton('删除',<Trash2 size={16}/>,remove,selected.lockMovementX)}</div>
 </>}
 </div>{error&&<Alert title={error} type="error" closable={{onClose:()=>setError('')}}/>}
 <div className="board-stage" ref={host} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();const f=e.dataTransfer.files[0];if(f)void upload(f)}}><div className="board-paper"><canvas ref={el}/></div></div>
 <footer className="board-footer"><label className="board-snap-toggle"><Switch aria-label="对齐吸附" size="small" checked={snapping} onChange={v=>{snapEnabled.current=v;setSnapping(v)}}/> 对齐吸附 <small>Alt 暂时关闭</small></label><span>{size.width} × {size.height} 像素 · {objects.length} 个元素</span><div><Button onClick={fit}>适应画布</Button><Slider ariaLabelForHandle="画布缩放" min={10} max={150} value={zoom} onChange={scale}/><span>{zoom}%</span></div></footer>
 </section></div>
 <input ref={file} hidden type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/avif" onChange={e=>{const f=e.target.files?.[0];if(f)void upload(f,replacing.current);e.target.value=''}}/>
 <input ref={project} hidden type="file" accept=".json" onChange={async e=>{const f=e.target.files?.[0];e.target.value='';if(!f)return;setBusy(true);try{await load(JSON.parse(await f.text()));remember()}catch(err){setError(err instanceof Error?err.message:'工程打开失败')}finally{setBusy(false)}}}/>
 <Modal title="画布尺寸" open={resizeOpen} onCancel={()=>setResizeOpen(false)} onOk={()=>{dims.current=newSize;setSize(newSize);fit();remember();setResizeOpen(false)}}><div className="board-size-fields"><label>宽度<InputNumber aria-label="画布宽度" min={100} max={4096} value={newSize.width} onChange={width=>width&&setNewSize({...newSize,width})}/></label><label>高度<InputNumber aria-label="画布高度" min={100} max={4096} value={newSize.height} onChange={height=>height&&setNewSize({...newSize,height})}/></label></div></Modal>
 </div>
}

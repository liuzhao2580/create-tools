import TitleCanvasEditor from './TitleCanvasEditor'
import { useEffect, useRef, useState } from 'react'
import { Alert, Button, Input, Select, Space, Spin } from 'antd'
import { referenceTemplates, extraTextFields, type ReferenceTemplate } from './title-reference'
import './title-studio.css'
import './design-workspace.css'

const fontFamilies: Record<string, string> = {
  '思源黑体': 'TitleSans', '思源宋体': 'TitleSong', '站酷庆科黄油体': 'TitleButter',
  '站酷快乐体': 'TitleHappy', '站酷小薇': 'TitleSerif', '马善政毛笔': 'TitleBrush',
  '志莽行': 'TitleWild', '流江毛草': 'TitleGrass', '龙藏体': 'TitleDragon',
  '系统黑体': 'PingFang SC',
}
type Run={text:string;color:string;font:string;size:number;weight:string;italic:string;stroke:string}
function richLines(source:string,base:Run){
 const doc=new DOMParser().parseFromString(source,'text/html');const rows:Run[][]=[[]]
 function visit(n:Node,style:Run){if(n.nodeType===Node.TEXT_NODE){rows[rows.length-1].push({...style,text:n.textContent||''});return}if(!(n instanceof HTMLElement))return
 if(['SCRIPT','STYLE','IFRAME','IMG','OBJECT','SVG','LINK'].includes(n.tagName))return
 if(n.tagName==='BR'){rows.push([]);return}
 if(['DIV','P'].includes(n.tagName)&&rows[rows.length-1].length)rows.push([])
 const z={...style};const st=n.style
 if(st.color)z.color=st.color
 if(st.fontFamily){const key=st.fontFamily.replace(/["']/g,'');z.font=fontFamilies[key]||Object.values(fontFamilies).find(f=>f===key)||style.font}
 if(st.fontSize){const v=parseFloat(st.fontSize);if(Number.isFinite(v))z.size=Math.max(16,Math.min(240,st.fontSize.endsWith('em')?style.size*v:v))}
 if(st.fontWeight)z.weight=st.fontWeight
 if(['B','STRONG'].includes(n.tagName))z.weight='900'
 if(['I','EM'].includes(n.tagName)||st.fontStyle==='italic')z.italic='italic'
 if(st.webkitTextStrokeColor)z.stroke=st.webkitTextStrokeColor
 n.childNodes.forEach(c=>visit(c,z))
 }
 doc.body.childNodes.forEach(n=>visit(n,base));return rows.filter(r=>r.length).slice(0,3)
}

const templates = referenceTemplates
const categories = ['全部模板', ...new Set(templates.map(t => t.category))]
const images = new Map<string, Promise<HTMLImageElement>>()
function loadImage(path: string) {
  if (!images.has(path)) {
    const image = new Image()
    image.src = path.startsWith('data:image/') ? path : `${import.meta.env.BASE_URL}${path}`
    images.set(path, image.decode().then(() => image).catch(error => { images.delete(path); throw error }))
  }
  return images.get(path)!
}
const fontLoads = new Map<string, Promise<FontFace[]>>()
function loadFont(name: string, weight = 400) {
  const family = fontFamilies[name] || 'TitleSans'
  const key = `${weight} 60px "${family}"`
  if (!fontLoads.has(key)) fontLoads.set(key, document.fonts.load(key))
  return fontLoads.get(key)!
}
async function draw(canvas: HTMLCanvasElement, value: ReferenceTemplate, isCurrent = () => true) {
  const image = await loadImage(value.background)
  const imageLayers = await Promise.all((value.images || []).map(async layer=>({layer,image:await loadImage(layer.src)})))
  await Promise.all(value.layers.map(l => loadFont(l.font || (l.text === 'title' ? value.font : '思源黑体'), l.weight || 400)))
  if (value.html) await Promise.all(Object.keys(fontFamilies).map(f => loadFont(f)))
  if (!isCurrent()) return
  const c = canvas.getContext('2d')
  if (!c) throw new Error('浏览器无法创建画布')
  canvas.width = 1800
  canvas.height = value.height
  c.drawImage(image, 0, 0, canvas.width, canvas.height)
  for (const {layer,image:asset} of imageLayers) {
    c.save();c.translate(layer.x,layer.y);c.rotate(layer.rotate*Math.PI/180);c.globalAlpha=layer.opacity
    c.drawImage(asset,-layer.width/2,-layer.height/2,layer.width,layer.height);c.restore()
  }
  for (const [index, l] of value.layers.entries()) {
    if (l.hidden) continue
    const text = l.text === 'title' ? value.title : l.text === 'subtitle' ? value.subtitle : l.text === 'tag' ? value.tag : value.extraText?.[String(index)] ?? l.text
    const family = fontFamilies[l.font || (l.text === 'title' ? value.font : '思源黑体')] || 'TitleSans'
    if (l.text === 'title' && value.html) {
      const rows = richLines(text, {text:'',color:l.color,font:family,size:l.size,weight:String(l.weight||400),italic:l.italic?'italic':'normal',stroke:l.stroke||''})
      const font = (r:Run) => `${r.italic} ${r.weight} ${r.size}px "${r.font}", sans-serif`
      const widths = rows.map(row => row.reduce((total,r) => {c.font=font(r);return total+c.measureText(r.text).width},0))
      const heights = rows.map(row => Math.max(30,...row.map(r=>r.size)) * 1.18)
      const totalHeight = heights.reduce((a,b)=>a+b,0)
      const scale = Math.min(1,l.width / Math.max(1,...widths),value.height*.62/Math.max(1,totalHeight))
      c.save();c.translate(l.x,l.y);c.rotate((l.rotate||0)*Math.PI/180);c.scale(scale,scale);c.textAlign='left';c.textBaseline='middle'
      let y = -totalHeight/2
      rows.forEach((row,i)=>{let x=-widths[i]/2;y+=heights[i]/2;row.forEach(r=>{c.font=font(r);c.fillStyle=r.color;if(r.stroke){c.strokeStyle=r.stroke;c.lineWidth=4;c.strokeText(r.text,x,y)}c.fillText(r.text,x,y);x+=c.measureText(r.text).width});y+=heights[i]/2})
      c.restore();continue
    }
    const rows = text.split('\n').slice(0, 3)
    c.save()
    c.font = `${l.italic ? 'italic' : 'normal'} ${l.weight || 400} ${l.size}px "${family}", sans-serif`
    const width = Math.max(1, ...rows.map(row => c.measureText(row).width))
    const scale = Math.min(1, l.width / width)
    c.translate(l.x, l.y)
    c.rotate((l.rotate || 0) * Math.PI / 180)
    c.scale(scale, scale)
    c.textAlign = l.align || 'center'
    c.textBaseline = 'middle'
    c.fillStyle = l.color
    const lineHeight = l.size * (l.lineHeight || 1.18)
    rows.forEach((row, i) => {
      const y = (i - (rows.length - 1) / 2) * lineHeight
      if (l.stroke) { c.strokeStyle = l.stroke; c.lineWidth = 5; c.lineJoin = 'round'; c.strokeText(row, 0, y) }
      c.fillStyle = l.lineColors?.[i] || l.color
      if (l.highlights?.length) {
        const chars = [...row]
        let offset = c.textAlign === 'left' ? 0 : -c.measureText(row).width / 2
        c.textAlign = 'left'
        let index = 0
        for (const char of chars) {
          const match = l.highlights.find(([part]) => { const start = row.indexOf(part); return start >= 0 && index >= start && index < start + part.length })
          c.fillStyle = match?.[1] || l.lineColors?.[i] || l.color
          c.fillText(char, offset, y); offset += c.measureText(char).width; index += char.length
        }
        c.textAlign = l.align || 'center'
      } else c.fillText(row, 0, y)
    })
    c.restore()
  }
}
export function Preview({ value }: { value: ReferenceTemplate }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  useEffect(() => {
    let active = true
    setLoading(true); setError(false)
    if (ref.current) void draw(ref.current, value, () => active)
      .catch(() => { if (active) setError(true) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [value])
  return <div className="title-canvas-wrap" style={{ aspectRatio: `1800 / ${value.height}` }}>
    <canvas ref={ref} style={{ aspectRatio: `1800 / ${value.height}`, visibility: loading || error ? 'hidden' : 'visible' }} aria-label={`${value.name}预览`} role="img" />
    {loading && <div className="title-canvas-status"><Spin size="small" /></div>}
    {error && <div className="title-canvas-status">素材加载失败，请刷新重试</div>}
  </div>
}
function readDraft(): ReferenceTemplate {
  try {
    const selected=templates.find(t=>t.id===sessionStorage.getItem('creator.home.template'))
    if(selected) return selected
    const v = JSON.parse(localStorage.getItem('creator.title.v2') || 'null')
    const template = templates.find(t => t.id === v?.id)
    if (template && ['title', 'subtitle', 'tag'].every(k => typeof v[k] === 'string')) {
      const layers = Array.isArray(v.layers) && v.layers.length<=100 && v.layers.every((l:Record<string,unknown>)=>typeof l.text==='string' && typeof l.color==='string' && ['x','y','size','width'].every(k=>typeof l[k]==='number' && Number.isFinite(l[k]))) ? v.layers : template.layers
      const images = Array.isArray(v.images) ? v.images.filter((l:Record<string,unknown>)=>typeof l.id==='string' && typeof l.name==='string' && typeof l.src==='string' && /^data:image\/(png|jpeg|webp|gif|avif);base64,/.test(l.src) && ['x','y','width','height','rotate','opacity'].every(k=>typeof l[k]==='number' && Number.isFinite(l[k]))).slice(0,30) : []
      return { ...template, layers, images, background:typeof v.background==='string'&&v.background.startsWith('data:image/')?v.background:template.background, title: v.title, subtitle: v.subtitle, tag: v.tag, font: fontFamilies[v.font] ? v.font : template.font, html:v.html===true, extraText: Object.fromEntries(extraTextFields({...template,layers}).flatMap(f=>typeof v.extraText?.[f.key]==='string'?[[f.key,v.extraText[f.key].slice(0,200)]]:[])) }
    }
  } catch { /* Fall back to the first template when storage is unavailable. */ }
  return templates[0]
}
export async function renderTitleImage(value: ReferenceTemplate) {
  const canvas = document.createElement('canvas')
  await draw(canvas, value)
  return canvas.toDataURL('image/png')
}
export default function TitleStudio({ initialTitle, initialTemplate, onApply, onClose }: { onClose?: () => void; initialTitle?: string; initialTemplate?: ReferenceTemplate; onApply?: (image: string, title: string) => void } = {}) {
  const [category, setCategory] = useState('全部模板')
  const [value, setValue] = useState(()=>{const draft=initialTemplate || readDraft();return initialTitle?{...draft,title:initialTitle}:draft})
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => { try {sessionStorage.removeItem('creator.home.template')} catch {} }, [])
  useEffect(() => {
    try { localStorage.setItem('creator.title.v2', JSON.stringify({ id: value.id, title: value.title, subtitle: value.subtitle, tag: value.tag, font: value.font, html:value.html, extraText:value.extraText, layers:value.layers, background:value.background, images:value.images })) }
    catch { setMessage('草稿保存失败，请导出图片后再离开。') }
  }, [value])
  async function output(apply: boolean) {
    setBusy(true); setMessage('')
    try {
      const canvas = document.createElement('canvas')
      await draw(canvas, value)
      if (apply) onApply?.(canvas.toDataURL('image/png'), value.html ? new DOMParser().parseFromString(value.title, 'text/html').body.textContent || '' : value.title)
      else {
        const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('导出失败')), 'image/png'))
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a'); a.href = url
        a.download = `${value.title.replace(/[\n\\/:*?"<>|]/g, ' ').slice(0, 60) || '文章标题'}.png`
        a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
        setMessage(`已导出 ${canvas.width} × ${canvas.height} PNG。`)
      }
    } catch { setMessage('字体或图片加载失败，未生成文件，请检查网络后重试。') }
    finally { setBusy(false) }
  }
  function choose(t: ReferenceTemplate) {
    setValue({ ...t }); setMessage('')
  }
  const [query,setQuery]=useState('')
  const valid = !!value.title.trim()
  return <div className="design-workspace">
    <header className="design-header">
      <Button type="text" onClick={onClose}>← 返回排版</Button>
      <span className="design-document-name">{value.name}</span>
      <Space><Button onClick={()=>setValue(templates.find(t=>t.id===value.id)!)}>恢复模板</Button>{onApply&&<Button loading={busy} disabled={!valid} onClick={()=>void output(true)}>添加到文章</Button>}<Button type="primary" loading={busy} disabled={!valid} onClick={()=>void output(false)}>导出 PNG</Button></Space>
    </header>
    <div className="design-body">
      <aside className="design-template-sidebar" aria-label="模板">
        <h2>模板</h2>
        <Input.Search aria-label="搜索模板" placeholder="搜索标题模板" allowClear value={query} onChange={e=>setQuery(e.target.value)}/>
        <Select aria-label="模板分类" value={category} onChange={setCategory} options={categories.map(c=>({label:c,value:c}))}/>
        <div className="design-template-list">{templates.filter(t=>(category==='全部模板'||t.category===category)&&`${t.name} ${t.title}`.includes(query.trim())).map(t=><button className="title-template-option" key={t.id} aria-pressed={t.id===value.id} onClick={()=>choose(t)}><Preview value={t}/><span>{t.name}</span></button>)}</div>
      </aside>
      <main className="design-canvas-area">
        <TitleCanvasEditor key={value.id} value={value} onChange={setValue} fonts={fontFamilies}><Preview value={value}/></TitleCanvasEditor>
        {message&&<Alert className="design-feedback" title={message} type={message.includes('失败')?'error':'info'} closable={{onClose:()=>setMessage('')}}/>}
      </main>
    </div>
  </div>
}

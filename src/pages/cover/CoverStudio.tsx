import { Alert,Button,Card,ColorPicker,Input,InputNumber,Modal,Select,Slider,Space } from 'antd'
import { useEffect,useRef,useState } from 'react'
import { downloadBlob } from '../../shared/utils/text'
import './cover.css'
import { creatorBrushFamily,creatorBrushCount,creatorBrushCharacters,missingCreatorBrushCharacters } from '../../shared/fonts/creator-brush'

type Draft = { image: string; text: string; font: string; fontData?: string; size: number; x: number; y: number; color: string; outline: string; stroke: number }
const initial: Draft = { image: '', text: '在这里输入副标题', font: 'StudioPingFang', size: 70, x: 50, y: 92, color: '#111111', outline: '#ffffff', stroke: 1 }
const artFonts = [{ value: 'Creator Brush', label: `定制毛笔体 · ${creatorBrushCount} 字` }, { value: 'ZCOOL KuaiLe', label: '站酷快乐体 · 活泼卡通' }, { value: 'Ma Shan Zheng', label: '马善政楷书 · 毛笔书法' }, { value: 'Zhi Mang Xing', label: '志莽行书 · 洒脱手写' }, { value: 'ZCOOL XiaoWei', label: '站酷小薇体 · 文艺标题' }]
const fonts = ['StudioPingFang', 'StudioDisplay', 'PingFang SC', 'Songti SC', 'Kaiti SC', 'Heiti SC', 'Arial', 'sans-serif', 'serif']
const dataURL = (file: File) => new Promise<string>((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(String(r.result)); r.onerror = reject; r.readAsDataURL(file) })
export default function CoverStudio() {
  const [draft, setDraft] = useState<Draft>(initial)
  const [photo, setPhoto] = useState<HTMLImageElement>()
  const [message, setMessage] = useState('')
  const [ready, setReady] = useState(false)
  const [rendering, setRendering] = useState(false)
  const canvas = useRef<HTMLCanvasElement>(null)
  const imageInput = useRef<HTMLInputElement>(null)
  const drag = useRef<{clientX:number;clientY:number;x:number;y:number;width:number;height:number} | undefined>(undefined)
  const [dragOver, setDragOver] = useState(false)
  const [showBrushCharacters, setShowBrushCharacters] = useState(false)
  const missingBrushCharacters = draft.font === creatorBrushFamily ? missingCreatorBrushCharacters(draft.text) : []
  const missingBrushLetters = missingBrushCharacters.filter(char => !/\p{P}/u.test(char))
  async function loadImage(file: File) {
    if (!file.type.startsWith('image/')) { setMessage('请拖入图片文件。'); return }
    try { const image = await dataURL(file); patch({image}); setMessage('') } catch { setMessage('读取图片失败') }
  }
  const patch = (v: Partial<Draft>) => setDraft(d => ({ ...d, ...v }))
  useEffect(() => { let active = true; setReady(false); setPhoto(undefined); if (!draft.image) return; const img = new Image(); img.onload = () => { if (active) { setPhoto(img); setReady(true) } }; img.onerror = () => setMessage('图片无法读取，请重新上传。'); img.src = draft.image; return () => { active = false } }, [draft.image])
  useEffect(() => {
    let active = true
    setRendering(true)
    async function draw() {
      if (!photo || !canvas.current) { setRendering(false); return }
      await document.fonts.load(`${draft.size}px "${draft.font}"`)
      if (!active || !canvas.current) return
      const c = canvas.current; c.width = photo.naturalWidth; c.height = photo.naturalHeight
      const ctx = c.getContext('2d')!; ctx.drawImage(photo, 0, 0)
      ctx.font = `${draft.size}px "${draft.font}"`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round'; ctx.strokeStyle = draft.outline; ctx.lineWidth = draft.stroke * 2; ctx.fillStyle = draft.color
      const lines = draft.text.split('\n'); lines.forEach((line, i) => { const x = c.width * draft.x / 100; const y = c.height * draft.y / 100 + (i - (lines.length - 1) / 2) * draft.size * 1.25; if (draft.stroke) ctx.strokeText(line, x, y); ctx.fillText(line, x, y) })
      setRendering(false)
    }
    void draw().catch(() => setMessage('字体加载失败，请选择其他字体。'))
    return () => { active = false }
  }, [draft, photo])
  async function fontLoad(data: string) { const face = new FontFace('CoverCustom', `url(${data})`); await face.load(); document.fonts.add(face) }
  async function importProject(file: File) {
    try { const d = JSON.parse(await file.text()) as Draft
      if (!d || typeof d.image !== 'string' || !d.image.startsWith('data:image/') || typeof d.text !== 'string' || typeof d.font !== 'string' || ![d.size,d.x,d.y,d.stroke].every(Number.isFinite) || d.size < 1 || d.size > 1000 || d.x < 0 || d.x > 100 || d.y < 0 || d.y > 100 || d.stroke < 0 || d.stroke > 30 || !/^#[0-9a-f]{6}$/i.test(d.color) || !/^#[0-9a-f]{6}$/i.test(d.outline)) throw Error()
      if (d.fontData) await fontLoad(d.fontData)
      setDraft(d); setMessage('编辑稿已恢复。')
    } catch { setMessage('编辑稿格式无效，或其中的字体无法读取。') }
  }
  async function save() { try { const image = draft.image.startsWith('data:') ? draft.image : await dataURL(new File([await (await fetch(draft.image)).blob()], 'cover')); downloadBlob(new Blob([JSON.stringify({ ...draft, image })], { type: 'application/json' }), '封面编辑稿.json'); setMessage('编辑稿已保存到下载目录，可通过“打开编辑稿”继续修改。') } catch { setMessage('保存失败，请重试。') } }
  const upload = (accept: string, action: (f: File) => void, label: string) => <label className="cover-upload">{label}<input type="file" accept={accept} onChange={e => { const file = e.target.files?.[0]; if (file) action(file); e.target.value = '' }} /></label>
  return <div className="cover-workspace">
    {message && <Alert title={message} closable={{ onClose: () => setMessage('') }} style={{ marginBottom: 16 }} />}
    <input ref={imageInput} type="file" accept="image/*" hidden onChange={e=>{const file=e.target.files?.[0];if(file)void loadImage(file);e.target.value=''}}/><div className="cover-toolbar"><div className="cover-file-actions">      <Space wrap>{upload('image/*', f => { void loadImage(f) }, '更换封面')}{upload('.json', f => { void importProject(f) }, '打开编辑稿')}</Space></div><div className="cover-export-actions">      <Button onClick={() => void save()} disabled={!ready}>保存编辑稿</Button>
      <Button type="primary" disabled={!ready || rendering || missingBrushLetters.length > 0} loading={rendering} onClick={() => { if (missingBrushLetters.length) return; canvas.current?.toBlob(blob => { if (blob) downloadBlob(blob, '封面.png'); else setMessage('导出失败，请重试。') }, 'image/png') }}>导出 PNG 图片</Button></div></div>
    <div className="cover-layout"><Card className="cover-preview-card" title={<div className="cover-panel-title"><span>画布预览</span><small>拖动文字，自由排版</small></div>} extra={<span className="cover-dimension">{photo ? `${photo.naturalWidth} × ${photo.naturalHeight}` : "空画板"}</span>}><div className={`cover-stage ${dragOver ? 'is-drag-over' : ''}`} role={!photo?'button':undefined} tabIndex={!photo?0:undefined} aria-label={!photo?'上传封面图片':undefined} onClick={()=>{if(!photo)imageInput.current?.click()}} onKeyDown={e=>{if(!photo&&(e.key==='Enter'||e.key===' ')){e.preventDefault();imageInput.current?.click()}}} onDragOver={e=>{e.preventDefault();setDragOver(true)}} onDragLeave={e=>{if(!e.currentTarget.contains(e.relatedTarget as Node))setDragOver(false)}} onDrop={e=>{e.preventDefault();setDragOver(false);const file=e.dataTransfer.files[0];if(file)void loadImage(file)}}>{!photo ? <div className="cover-empty"><span className="empty-cross">＋</span><h2>请上传图片</h2><p>将图片拖到这里，开始你的封面创作</p><span className="cover-upload">选择图片</span></div> : <canvas ref={canvas} aria-label="封面预览，拖动设置副标题位置" onPointerDown={e=>{if(e.button!==0)return;const c=e.currentTarget;const r=c.getBoundingClientRect();const scale=Math.min(r.width/c.width,r.height/c.height);drag.current={clientX:e.clientX,clientY:e.clientY,x:draft.x,y:draft.y,width:c.width*scale,height:c.height*scale};c.setPointerCapture(e.pointerId)}} onPointerMove={e=>{const d=drag.current;if(!d)return;patch({x:Math.max(0,Math.min(100,d.x+(e.clientX-d.clientX)/d.width*100)),y:Math.max(0,Math.min(100,d.y+(e.clientY-d.clientY)/d.height*100))})}} onPointerUp={()=>{drag.current=undefined}} onPointerCancel={()=>{drag.current=undefined}} onLostPointerCapture={()=>{drag.current=undefined}} /> }</div><p className="field-hint">{photo ? `${photo.naturalWidth} × ${photo.naturalHeight} 像素` : '支持拖放上传'} · 导出不含编辑界面，原图保持不变。</p></Card>
    <Card className="cover-inspector" title={<div className="cover-panel-title"><span>副标题</span><small>修改即时呈现在画布上</small></div>}>
      <div className="cover-properties">
        <section className="cover-property-section">
          <label className="cover-property-heading" htmlFor="cover-caption">文字内容 <span>{draft.text.length} / 500</span></label>
          <Input.TextArea id="cover-caption" value={draft.text} rows={2} maxLength={500} onChange={e => patch({text:e.target.value})} />
        </section>
        <section className="cover-property-section">
          <h3>字体</h3>
          <div className="cover-type-select">
            <Select aria-label="全部字体" value={draft.font} onChange={font=>patch({font})} options={[...artFonts,...[...fonts,...(draft.fontData?['CoverCustom']:[])].map(f=>({value:f,label:f==='CoverCustom'?'导入的字体':f==='StudioPingFang'?'苹方 · 默认':f}))]} />
            {upload('.ttf,.otf,.woff,.woff2', f => { void dataURL(f).then(async fontData => { await fontLoad(fontData); patch({fontData,font:'CoverCustom'}) }).catch(()=>setMessage('字体导入失败，请使用有效的字体文件。')) }, '导入字体')}
          </div>
          <div className="cover-type-presets" aria-label="常用艺术字体">{artFonts.map(f=><Button key={f.value} title={f.label} aria-pressed={draft.font===f.value} className={draft.font===f.value?'selected':''} onClick={()=>patch({font:f.value})}><span style={{fontFamily:f.value}}>{f.label.split(' · ')[0]}</span></Button>)}</div>
          {draft.font === creatorBrushFamily && <>
            <div className="cover-brush-status"><span>已制作 {creatorBrushCount} 个定制字 · 字库扩充中</span><Button type="link" size="small" onClick={()=>setShowBrushCharacters(true)}>查看已完成字库</Button></div>
            {missingBrushCharacters.length > 0 && <p className="cover-brush-missing" role="status">{missingBrushLetters.length > 0 ? `尚未定制：${missingBrushLetters.join(' ')}。这些字在预览中暂用系统字形显示；请改字或切换字体后导出。` : '横线等标点使用系统字形补齐，可按当前预览效果导出。'}</p>}
          </>}
        </section>
        <section className="cover-property-section">
          <h3>外观</h3>
          <div className="cover-property-pair">
            <label className="cover-value-field">字号 <InputNumber aria-label="字号" min={1} max={1000} value={draft.size} onChange={v=>v!==null&&patch({size:v})} suffix="px" /></label>
            <label className="cover-value-field">描边 <InputNumber aria-label="描边宽度" min={0} max={30} value={draft.stroke} onChange={v=>v!==null&&patch({stroke:v})} suffix="px" /></label>
            <div className="cover-value-field"><span>文字色</span><ColorPicker showText value={draft.color} onChange={c=>patch({color:c.toHexString()})}/></div>
            <div className="cover-value-field"><span>描边色</span><ColorPicker showText value={draft.outline} onChange={c=>patch({outline:c.toHexString()})}/></div>
          </div>
        </section>
        <section className="cover-property-section">
          <div className="cover-property-heading"><h3>位置</h3><Button type="text" size="small" onClick={()=>patch({x:50})}>水平居中</Button></div>
          {(['x','y'] as const).map(axis=><div className="cover-position-row" key={axis}><span>{axis==='x'?'水平':'垂直'}</span><Slider aria-label={axis==='x'?'水平位置':'垂直位置'} min={0} max={100} step={.1} value={draft[axis]} onChange={v=>patch({[axis]:v})}/><InputNumber aria-label={axis==='x'?'水平位置百分比':'垂直位置百分比'} min={0} max={100} precision={1} value={draft[axis]} suffix="%" onChange={v=>v!==null&&patch({[axis]:v})}/></div>)}
        </section>
      </div>
    </Card></div>
    <Modal title={`定制毛笔体 · 已制作 ${creatorBrushCount} 字`} open={showBrushCharacters} footer={null} onCancel={()=>setShowBrushCharacters(false)} width={720} styles={{body:{maxHeight:'60vh',overflowY:'auto'}}}>
      <p>以下字符使用定制笔触。完整常用字库仍在扩充，未列出的字符尚未制作。</p>
      <div className="creator-brush-character-list">{creatorBrushCharacters}</div>
    </Modal>
  </div>
}

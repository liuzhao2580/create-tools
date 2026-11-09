import { useEffect, useRef, useState } from 'react'
import { Alert, Button, Card, ColorPicker, Input, InputNumber, Select, Slider, Space } from 'antd'
import { downloadBlob } from './text'
import './cover.css'

type Draft = { image: string; text: string; font: string; fontData?: string; size: number; x: number; y: number; color: string; outline: string; stroke: number }
const initial: Draft = { image: '/covers/shinchan.jpg', text: '在这里输入副标题', font: 'PingFang SC', size: 70, x: 50, y: 92, color: '#111111', outline: '#ffffff', stroke: 4 }
const artFonts = [{ value: 'Creator Brush', label: '定制毛笔体 · 集数常用字' }, { value: 'ZCOOL KuaiLe', label: '站酷快乐体 · 活泼卡通' }, { value: 'Ma Shan Zheng', label: '马善政楷书 · 毛笔书法' }, { value: 'Zhi Mang Xing', label: '志莽行书 · 洒脱手写' }, { value: 'ZCOOL XiaoWei', label: '站酷小薇体 · 文艺标题' }]
const fonts = ['PingFang SC', 'Songti SC', 'Kaiti SC', 'Heiti SC', 'Arial', 'sans-serif', 'serif']
const dataURL = (file: File) => new Promise<string>((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(String(r.result)); r.onerror = reject; r.readAsDataURL(file) })
export default function CoverStudio() {
  const [draft, setDraft] = useState<Draft>(initial)
  const [photo, setPhoto] = useState<HTMLImageElement>()
  const [message, setMessage] = useState('')
  const [ready, setReady] = useState(false)
  const [rendering, setRendering] = useState(false)
  const canvas = useRef<HTMLCanvasElement>(null)
  const drag = useRef(false)
  const patch = (v: Partial<Draft>) => setDraft(d => ({ ...d, ...v }))
  useEffect(() => { let active = true; setReady(false); const img = new Image(); img.onload = () => { if (active) { setPhoto(img); setReady(true) } }; img.onerror = () => setMessage('图片无法读取，请重新上传。'); img.src = draft.image; return () => { active = false } }, [draft.image])
  useEffect(() => {
    let active = true
    setRendering(true)
    async function draw() {
      if (!photo || !canvas.current) return
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
    <div className="cover-toolbar"><div className="cover-file-actions">      <Space wrap>{upload('image/*', f => { void dataURL(f).then(image => patch({ image })).catch(() => setMessage('读取图片失败')) }, '更换封面')}{upload('.json', f => { void importProject(f) }, '打开编辑稿')}</Space></div><div className="cover-export-actions">      <Button onClick={() => void save()} disabled={!ready}>保存编辑稿</Button>
      <Button type="primary" disabled={!ready || rendering} loading={rendering} onClick={() => canvas.current?.toBlob(blob => { if (blob) downloadBlob(blob, '封面.png'); else setMessage('导出失败，请重试。') }, 'image/png')}>导出 PNG 图片</Button></div></div>
    <div className="cover-layout"><Card className="cover-preview-card" title={<div className="cover-panel-title"><span>画布预览</span><small>拖动文字，自由排版</small></div>} extra={<span className="cover-dimension">{photo ? `${photo.naturalWidth} × ${photo.naturalHeight}` : "加载中"}</span>}><div className="cover-stage"><canvas ref={canvas} aria-label="封面预览，拖动设置副标题位置" onPointerDown={e => { drag.current = true; e.currentTarget.setPointerCapture(e.pointerId) }} onPointerMove={e => { if (!drag.current) return; const c = e.currentTarget; const r = c.getBoundingClientRect(); const scale = Math.min(r.width / c.width, r.height / c.height); const w = c.width * scale; const h = c.height * scale; patch({ x: Math.max(0, Math.min(100, (e.clientX-r.left-(r.width-w)/2)/w*100)), y: Math.max(0, Math.min(100, (e.clientY-r.top-(r.height-h)/2)/h*100)) }) }} onPointerUp={() => { drag.current = false }} onPointerCancel={() => { drag.current = false }} /></div><p className="field-hint">{photo ? `${photo.naturalWidth} × ${photo.naturalHeight} 像素` : '正在加载'} · 导出不含编辑界面，原图保持不变。</p></Card>
    <Card className="cover-inspector" title={<div className="cover-panel-title"><span>编辑副标题</span><small>实时预览每一次调整</small></div>}><div className="cover-controls">

      <section className="cover-control-section"><h3><span>01</span>文字内容</h3><label>副标题<Input.TextArea value={draft.text} rows={3} showCount maxLength={500} onChange={e => patch({ text: e.target.value })} /></label>
      </section><section className="cover-control-section"><h3><span>02</span>字体与外观</h3><div className="cover-font-grid">{artFonts.map(f => <Button key={f.value} className={`cover-font-option ${draft.font === f.value ? "selected" : ""}`} aria-pressed={draft.font === f.value} onClick={() => patch({ font: f.value })}><span className="cover-font-sample" style={{ fontFamily: f.value }}>快乐时光</span><span>{f.label.split(" · ")[0]}</span></Button>)}</div><label>全部字体<Select aria-label="全部字体" value={draft.font} style={{ width: '100%' }} onChange={font => patch({ font })} optionRender={option => <span style={{ fontFamily: String(option.value), fontSize: 18 }}>{option.label}</span>} options={[...artFonts, ...[...fonts, ...(draft.fontData ? ['CoverCustom'] : [])].map(f => ({ value: f, label: f === 'CoverCustom' ? '导入的字体' : f }))]} /></label>
      {upload('.ttf,.otf,.woff,.woff2', f => { void dataURL(f).then(async fontData => { await fontLoad(fontData); patch({ fontData, font: 'CoverCustom' }) }).catch(() => setMessage('字体导入失败，请使用有效的字体文件。')) }, '导入字体 TTF / OTF / WOFF')}
      <p className="field-hint">艺术字体已内置，也可导入自己的字体。</p>
      <label>字号（原图像素）<InputNumber min={1} max={1000} value={draft.size} onChange={size => size && patch({ size })} /><Slider min={10} max={300} value={draft.size} onChange={size => patch({ size })} /></label>

      <Space className="cover-color-row">文字<ColorPicker value={draft.color} onChange={c => patch({ color: c.toHexString() })} />描边<ColorPicker value={draft.outline} onChange={c => patch({ outline: c.toHexString() })} /></Space>
      <label>描边宽度<Slider min={0} max={30} value={draft.stroke} onChange={stroke => patch({ stroke })} /></label>
      </section><section className="cover-control-section"><h3><span>03</span>文字位置</h3>      {(['x','y'] as const).map(axis => <label key={axis}>{axis === 'x' ? '水平位置' : '垂直位置'}（%）<InputNumber min={0} max={100} precision={1} value={draft[axis]} onChange={v => v !== null && patch({ [axis]: v })} /><Slider min={0} max={100} step={0.1} value={draft[axis]} onChange={v => patch({ [axis]: v })} /></label>)}<Button block onClick={() => patch({ x: 50 })}>水平居中</Button></section>

    </div></Card></div>
  </div>
}

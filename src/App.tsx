import CoverStudio from './CoverStudio'
import SubtitleStudio from './SubtitleStudio'
import { StudioAlert, StudioButton, StudioCard, StudioInput, VoiceMode, VoiceSelect, VoiceSlider } from './ui/antd'
import { useEffect, useRef, useState } from 'react'
import { ArrowDownToLine, ArrowRight, AudioLines, Check, CheckCircle2, ChevronRight, CircleHelp, Cpu, FileText, HardDrive, Headphones, Info, LoaderCircle, Menu, RotateCcw, Settings2, ShieldCheck, SlidersHorizontal, Sparkles, Square, Trash2, Upload, X } from 'lucide-react'
import { voiceEngine } from './voice-engine'
import { generatePresetVoice, voices } from './edge-voice'
import type { EngineProgress, EngineStatus, SupportInfo, VoiceResult } from './engine-types'
import { DEFAULT_PAUSE, DEFAULT_TEMPO, downloadBlob, errorMessage, formatDuration, readTextFile, textStats, validateText } from './text'
import { toolRegistry } from './tools'

const DRAFT_KEY = 'shengzuo.draft.v1'
const PREFS_KEY = 'shengzuo.preferences.v1'

type Preferences = { tempo: number; pauseSeconds: number; filename: string }
function readPreferences(): Preferences {
  const defaults = { tempo: DEFAULT_TEMPO, pauseSeconds: DEFAULT_PAUSE, filename: '我的配音' }
  try {
    const saved = JSON.parse(localStorage.getItem(PREFS_KEY) || '{}') as Partial<Preferences>
    return {
      tempo: typeof saved.tempo === 'number' && saved.tempo >= 0.65 && saved.tempo <= 1.25 ? saved.tempo : defaults.tempo,
      pauseSeconds: typeof saved.pauseSeconds === 'number' && saved.pauseSeconds >= 0.2 && saved.pauseSeconds <= 1.2 ? saved.pauseSeconds : defaults.pauseSeconds,
      filename: typeof saved.filename === 'string' ? saved.filename.slice(0, 80) : defaults.filename,
    }
  } catch { return defaults }
}
function readDraft() {
  try { return localStorage.getItem(DRAFT_KEY) || '' } catch { return '' }
}
function getRoute() { return window.location.hash.slice(1) || '/voice' }
function readableBytes(bytes: number) {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`
  return `${Math.round(bytes / 1024 ** 2)} MB`
}

export function OperationProgress({ progress }: { progress: EngineProgress }) {
  const percent = progress.progress == null ? null : Math.max(0, Math.min(100, progress.progress))
  const stage = progress.stage === 'download' ? '下载模型' : progress.stage === 'load' ? '初始化模型' : '生成配音'
  return <div className="model-progress">
    <div className="model-progress-heading"><span><LoaderCircle size={15} className="spin" />{stage}</span><strong>{percent === null ? '处理中…' : `${Math.round(percent)}%`}</strong></div>
    <div className={`progress-track ${percent === null ? 'is-indeterminate' : ''}`} role="progressbar" aria-label={stage} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent ?? undefined} aria-valuetext={percent === null ? progress.message : `${Math.round(percent)}%，${progress.message}`}><span style={percent === null ? undefined : { width: `${percent}%` }} /></div>
    <p>{progress.message}</p>
  </div>
}

export default function App() {
  const [voiceMode, setVoiceMode] = useState<'preset' | 'clone'>('preset')
  const [selectedVoice, setSelectedVoice] = useState(voices[0].id)
  const [previewing, setPreviewing] = useState(false)
  const [serviceError, setServiceError] = useState('')
  const [route, setRoute] = useState(getRoute)
  const [mobileNav, setMobileNav] = useState(false)
  const [text, setText] = useState(readDraft)
  const [preferences, setPreferences] = useState(readPreferences)
  const [draftSaved, setDraftSaved] = useState(true)
  const [storageAvailable, setStorageAvailable] = useState(true)
  const [support, setSupport] = useState<SupportInfo | null>(null)
  const [status, setStatus] = useState<EngineStatus>('idle')
  const [modelReady, setModelReady] = useState(false)
  const [progress, setProgress] = useState<EngineProgress | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [reference, setReference] = useState<File | undefined>()
  const [referenceText, setReferenceText] = useState('')
  const [result, setResult] = useState<(VoiceResult & { script: string; filename: string }) | null>(null)
  const [audioUrl, setAudioUrl] = useState('')
  const [storage, setStorage] = useState<StorageEstimate | null>(null)
  const [clearingCache, setClearingCache] = useState(false)
  const controller = useRef<AbortController | null>(null)
  const importInput = useRef<HTMLInputElement>(null)
  const referenceInput = useRef<HTMLInputElement>(null)
  const resultPanel = useRef<HTMLElement>(null)
  const busy = status === 'downloading' || status === 'loading' || status === 'generating'
  const effectiveTempo = voiceMode === 'clone' && support?.supportsTempo === false ? 1 : preferences.tempo
  const stats = textStats(text, effectiveTempo, preferences.pauseSeconds)
  const limit = support?.maxTextChars ?? 5000
  const validation = text.trim() ? validateText(text, limit) : null
  const settingsRoute = route === '/settings'
  const articleRoute = route === '/article'
  const titleRoute = route === '/titles'
  const coverRoute = route === '/cover'
  const subtitlesRoute = route === '/subtitles'
  const knownRoute = settingsRoute || toolRegistry.some((tool) => tool.route === route)

  useEffect(() => {
    const onHashChange = () => { setRoute(getRoute()); setMobileNav(false) }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  useEffect(() => {
    const abort = new AbortController()
    fetch(new URL('api/edge/health', document.baseURI), { signal: abort.signal }).then(async response => {
      if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) throw new Error('微软音色需要本地语音服务，请通过 npm run dev 或 npm run preview 打开。')
      const info = await response.json()
      if (!info.ready) throw new Error(info.error || '语音服务不可用')
    }).catch(reason => { if (!abort.signal.aborted) setServiceError(errorMessage(reason)) })
    return () => abort.abort()
  }, [])

  useEffect(() => {
    let active = true
    voiceEngine.inspectSupport().then((info) => { if (active) setSupport(info) }).catch((reason) => { if (active) setError(errorMessage(reason)) })
    navigator.storage?.estimate().then((estimate) => { if (active) setStorage(estimate) }).catch(() => {})
    return () => { active = false }
  }, [])

  useEffect(() => {
    setDraftSaved(false)
    const timeout = window.setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_KEY, text)
        localStorage.setItem(PREFS_KEY, JSON.stringify(preferences))
        setDraftSaved(true)
        setStorageAvailable(true)
      } catch { setStorageAvailable(false) }
    }, 400)
    return () => window.clearTimeout(timeout)
  }, [text, preferences])

  useEffect(() => {
    if (!result) { setAudioUrl(''); return }
    const url = URL.createObjectURL(result.audio)
    setAudioUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [result])

  useEffect(() => () => { controller.current?.abort() }, [])

  function onProgress(update: EngineProgress) {
    setProgress(update)
    if (update.stage === 'download') setStatus('downloading')
    else if (update.stage === 'load') setStatus('loading')
    else setStatus('generating')
  }

  async function loadModel() {
    if (busy || clearingCache) return
    const operation = new AbortController()
    controller.current = operation
    setError(''); setNotice(''); setStatus('loading')
    setProgress({ stage: 'load', progress: null, message: '正在准备本地配音模型…' })
    try {
      await voiceEngine.loadModel({ signal: operation.signal, onProgress })
      if (operation.signal.aborted) throw new DOMException('Aborted', 'AbortError')
      setModelReady(true); setStatus('ready'); setNotice('模型已就绪，可以开始生成配音。'); setProgress(null)
      navigator.storage?.estimate().then(setStorage).catch(() => {})
    } catch (reason) {
      setModelReady(false); setStatus('idle'); setProgress(null)
      if (operation.signal.aborted) setNotice('模型加载已取消。')
      else { setError(errorMessage(reason)); setStatus('error') }
    } finally { if (controller.current === operation) controller.current = null }
  }

  async function generate(preview = false) {
    const issue = preview ? null : validateText(text, limit)
    if (issue) { setError(issue); document.getElementById('voice-text')?.focus(); return }
    if ((voiceMode === 'clone' && !modelReady) || busy || clearingCache) return
    if (voiceMode === 'clone' && support?.supportsReferenceAudio && !reference) { setError('请先上传用于匹配音色的参考音频。'); return }
    if (voiceMode === 'clone' && support?.supportsReferenceText && !referenceText.trim()) { setError('请填写参考音频中准确说出的文字。'); return }
    const operation = new AbortController()
    controller.current = operation
    const script = preview ? '你好，欢迎使用声作。这是我的声音，愿每一段文字都能被听见。' : text.trim()
    setPreviewing(preview)
    const filename = (preview ? `${voices.find(v => v.id === selectedVoice)?.name}试听` : preferences.filename).trim().replace(/[\/:*?"<>|]/g, '_') || '我的配音'
    setError(''); setNotice(''); setStatus('generating')
    setProgress({ stage: 'generate', progress: null, message: '正在生成配音，请保持此页面打开…' })
    try {
      const options = { text: script, tempo: effectiveTempo, pauseSeconds: preferences.pauseSeconds, referenceAudio: reference, referenceText: support?.supportsReferenceText ? referenceText.trim() : undefined, signal: operation.signal, onProgress }
      const generated = voiceMode === 'preset' ? await generatePresetVoice(options, selectedVoice) : await voiceEngine.generate(options)
      if (operation.signal.aborted) throw new DOMException('Aborted', 'AbortError')
      if (!generated.audio.size) throw new Error('模型没有返回有效的音频，请重试。')
      setResult({ ...generated, script, filename }); setStatus('ready'); setProgress(null)
      setNotice('配音已生成。建议先试听，再导入剪辑软件。')
      window.setTimeout(() => resultPanel.current?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'nearest' }), 100)
    } catch (reason) {
      setProgress(null)
      if (operation.signal.aborted || (reason instanceof DOMException && reason.name === 'AbortError')) {
        if (voiceMode === 'clone') setModelReady(false)
        setStatus('idle')
        setNotice(voiceMode === 'preset' ? '本次在线合成已取消。' : '本次生成已取消。请重新加载模型后继续，已下载的缓存可以复用。')
      } else { setStatus('ready'); setError(errorMessage(reason)) }
    } finally { if (controller.current === operation) controller.current = null }
  }

  async function importText(file?: File) {
    if (!file) return
    try {
      const imported = await readTextFile(file)
      setText(imported); setError(''); setNotice(`已导入 ${file.name}`)
      setPreferences((previous) => ({ ...previous, filename: file.name.replace(/\.txt$/i, '').slice(0, 80) }))
      document.getElementById('voice-text')?.focus()
    } catch (reason) { setError(errorMessage(reason)) }
    if (importInput.current) importInput.current.value = ''
  }

  async function unloadModel() {
    if (busy || clearingCache) return
    try { await voiceEngine.unloadModel(); setModelReady(false); setStatus('idle'); setNotice('模型已从内存卸载。已下载的缓存仍然保留。'); setError('') }
    catch (reason) { setError(errorMessage(reason)) }
  }

  async function clearCache() {
    if (busy || clearingCache) return
    setClearingCache(true); setError('')
    try {
      await voiceEngine.unloadModel(); setModelReady(false); setStatus('idle')
      await voiceEngine.clearModelCache()
      setProgress(null); setNotice('模型已删除，完整文件和下载分片均已清理。再次使用需重新下载，文案草稿不受影响。')
      navigator.storage?.estimate().then(setStorage).catch(() => {})
    } catch (reason) { setError(errorMessage(reason)) }
    finally { setClearingCache(false) }
  }

  function cancel() { controller.current?.abort(); setNotice('正在停止当前操作…') }
  const modelStateLabel = voiceMode === 'preset' && !settingsRoute ? (busy ? '在线合成中' : '微软在线音色') : busy ? status === 'generating' ? '正在配音' : '模型加载中' : modelReady ? '模型已就绪' : '模型未加载'

  return (
    <div className={`app-shell ${coverRoute ? "cover-shell" : ""}`}>
      <a className="skip-link" href="#main-content" onClick={(event) => { event.preventDefault(); document.getElementById('main-content')?.focus() }}>跳到主要内容</a>
      {mobileNav && <button className="nav-scrim" aria-label="关闭导航" onClick={() => setMobileNav(false)} />}
      <aside className={`sidebar ${mobileNav ? 'is-open' : ''}`} aria-label="工具导航">
        <a href="#/voice" className="brand"><span className="brand-mark"><AudioLines size={26} strokeWidth={2.1} /></span><span>声作<span className="brand-caption">创作工具箱</span></span></a>
        <button className="mobile-nav-close icon-button" onClick={() => setMobileNav(false)} aria-label="关闭导航"><X size={20} /></button>
        <div className="sidebar-section-label">公众号专栏与创作工具</div>
        <nav className="tool-navigation">
          {toolRegistry.map((tool) => <a key={tool.id} href={`#${tool.route}`} className={`nav-link ${route === tool.route ? 'active' : ''}`} aria-current={route === tool.route ? 'page' : undefined}><tool.icon size={19} /><span>{tool.name}</span>{route === tool.route && <span className="nav-dot" />}</a>)}
          <a href="#/settings" className={`nav-link ${settingsRoute ? 'active' : ''}`} aria-current={settingsRoute ? 'page' : undefined}><Settings2 size={19} /><span>模型与设置</span>{settingsRoute && <span className="nav-dot" />}</a>
        </nav>
        <div className="sidebar-bottom">
          <div className="local-card"><span className="local-card-icon"><ShieldCheck size={20} /></span><strong>在你的设备上创作</strong><p>预设音色在线合成，<br />音色克隆在本机运行。</p><a href="#/settings">了解本地运行 <ArrowRight size={13} /></a></div>
          <div className="sidebar-footer"><span className="tiny-mark"><AudioLines size={13} /></span> 少一点重复，多一点创作 <span>v0.1</span></div>
        </div>
      </aside>

      <div className="workspace">
        <header className="topbar"><div className="breadcrumbs"><button className="mobile-menu icon-button" aria-label="打开导航" aria-expanded={mobileNav} onClick={() => setMobileNav(true)}><Menu size={20} /></button><span>创作工具箱</span><ChevronRight size={13} /><strong>{articleRoute ? '公众号排版' : titleRoute ? '标题模板' : coverRoute ? '封面编辑' : settingsRoute ? '模型与设置' : subtitlesRoute ? '字幕配音' : '文案配音'}</strong></div><a className={`engine-pill ${modelReady ? 'connected' : ''}`} href="#/settings"><span className={`status-dot ${busy ? 'working' : ''}`} />{articleRoute ? '公众号排版 · 本地处理' : titleRoute ? '标题模板 · 本地处理' : coverRoute ? '封面编辑 · 本地处理' : subtitlesRoute ? '已确认音色 · 本机合成' : modelStateLabel}<ChevronRight size={12} /></a></header>
        <main id="main-content" tabIndex={-1}>
          <div className="page-heading"><div><div className="eyebrow">声作 STUDIO <span>/ {articleRoute ? 'ARTICLE LAYOUT' : titleRoute ? 'TITLE TEMPLATES' : coverRoute ? 'COVER EDITOR' : settingsRoute ? 'PREFERENCES' : subtitlesRoute ? 'SUBTITLE TO SPEECH' : 'TEXT TO SPEECH'}</span></div><h1>{articleRoute ? '公众号排版' : titleRoute ? '标题模板' : coverRoute ? '封面编辑' : settingsRoute ? '模型与设置' : subtitlesRoute ? '字幕配音' : '配音工作台'}</h1><p>{articleRoute ? '编辑内容，预览排版，复制到公众号正文。' : titleRoute ? '按主题挑选模板，改好标题，导出公众号横幅。' : coverRoute ? '给封面加一句话，调好字体，保存你的作品。' : settingsRoute ? '管理本地克隆模型与存储；微软预设音色无需下载。' : subtitlesRoute ? '文字跟着画面，声音跟着时间。' : '写好文案，调好声音，生成你的下一段配音。'}</p></div><span className="local-badge"><span className="status-dot" /> 本地工作空间</span></div>

          {error && <StudioAlert message={error} type="error" onClose={() => setError('')} />}
          {notice && <StudioAlert message={notice} type="success" onClose={() => setNotice('')} />}
          {progress && settingsRoute && <div className="operation-panel"><OperationProgress progress={progress} /><StudioButton className="text-button" onClick={cancel}><Square size={12} />取消</StudioButton></div>}

          {!knownRoute ? <StudioCard className="card not-found"><CircleHelp size={35} /><h2>这个工具还不存在</h2><p>从左侧选择一个已上线的创作工具。</p><a className="button primary" href="#/voice">返回配音工作台</a></StudioCard> : articleRoute ? null : titleRoute ? null : coverRoute ? <CoverStudio /> : subtitlesRoute ? <SubtitleStudio /> : settingsRoute ? <div className="settings-layout">
            <StudioCard className="card settings-card"><div className="card-heading"><div className="section-icon"><Cpu size={20} /></div><div><h2>本地配音模型</h2><p>首次使用需要下载，之后可复用浏览器缓存。</p></div></div><dl className="details-list"><div><dt>配音引擎</dt><dd>{support?.engineName || '正在检查…'}</dd></div><div><dt>模型</dt><dd>{support?.modelName || '正在检查…'}</dd></div><div><dt>首次下载</dt><dd>{support?.downloadLabel || '正在检查…'}</dd></div><div><dt>运行状态</dt><dd><span className={`inline-status ${modelReady ? 'is-ready' : ''}`}><span className="status-dot" />{modelStateLabel}</span></dd></div></dl><div className="settings-actions"><StudioButton className="button primary" disabled={!support?.supported || busy || clearingCache || modelReady} onClick={() => void loadModel()}>{busy && status !== 'generating' ? <LoaderCircle size={16} className="spin" /> : <ArrowDownToLine size={16} />}{modelReady ? '模型已加载' : '加载配音模型'}</StudioButton><StudioButton className="button secondary" disabled={!modelReady || busy || clearingCache} onClick={() => void unloadModel()}>卸载模型</StudioButton></div><p className="field-hint">卸载只释放运行内存，不会删除缓存和文案。</p></StudioCard>
            <StudioCard className="card settings-card"><div className="card-heading"><div className="section-icon"><ShieldCheck size={20} /></div><div><h2>浏览器兼容性</h2><p>计算在你的设备上完成，性能取决于设备与浏览器。</p></div></div><div className={`compatibility-box ${support?.supported ? 'compatible' : ''}`}>{support?.supported ? <CheckCircle2 size={21} /> : <Info size={21} />}<div><strong>{support ? support.supported ? '当前浏览器可以运行' : '当前环境暂不支持' : '正在检查浏览器能力'}</strong><p>{support?.message || '正在检查本地推理所需的浏览器功能…'}</p></div></div><dl className="details-list compact"><div><dt>WebGPU</dt><dd>{support ? support.webgpu ? '可用' : '不可用' : '检查中'}</dd></div><div><dt>参考音频</dt><dd>{support ? support.supportsReferenceAudio ? '支持上传参考音色' : '当前模型不支持音色克隆' : '检查中'}</dd></div></dl><div className="info-note"><Info size={16} /><p>F5 克隆在浏览器运行，可部署到静态网站。微软预设音色需要本机语音服务和网络，纯静态部署不提供在线合成接口。</p></div></StudioCard>
            <StudioCard className="card settings-card"><div className="card-heading"><div className="section-icon"><HardDrive size={20} /></div><div><h2>存储与缓存</h2><p>模型缓存由浏览器管理，不同浏览器之间不会共用。</p></div></div><dl className="details-list"><div><dt>此站点已用存储</dt><dd>{storage?.usage == null ? '浏览器未提供' : readableBytes(storage.usage)}</dd></div><div><dt>文案草稿</dt><dd>{storageAvailable ? '自动保存在当前浏览器' : '当前浏览器不允许保存'}</dd></div></dl><StudioButton className="button secondary danger-text" disabled={busy || clearingCache} onClick={() => void clearCache()}>{clearingCache ? <LoaderCircle size={15} className="spin" /> : <Trash2 size={15} />}{clearingCache ? '正在删除…' : '删除模型'}</StudioButton><p className="field-hint">清理后需要重新下载模型，不会删除文案草稿。生成的音频请及时下载保存。</p></StudioCard>
          </div> : <>
            <div className="studio-layout">
              <StudioCard className="card editor-card"><div className="editor-header"><div className="section-title"><span className="step-tag">01</span><h2>配音文案</h2></div><StudioButton className="button subtle compact-button" onClick={() => importInput.current?.click()} disabled={busy}><Upload size={15} /> 导入 TXT</StudioButton><input ref={importInput} type="file" accept=".txt,text/plain" className="visually-hidden" tabIndex={-1} aria-label="导入 TXT 文案" onChange={(event) => void importText(event.target.files?.[0])} /></div><div className="editor-tip"><FileText size={14} /><span>按完整段落书写，空一行表示段落停顿。</span></div><label className="visually-hidden" htmlFor="voice-text">需要朗读的文案</label><StudioInput type="textarea" id="voice-text" aria-label="配音文案" className="script-editor" value={text} onValueChange={setText} disabled={busy} placeholder={'从一段文字开始…\n\n输入或导入你的故事、视频解说或旁白。\n段落之间留一个空行，让声音自然停顿。'} spellcheck={false} aria-describedby="text-help text-validation" /><div className="editor-footer"><span className={`draft-state ${!storageAvailable ? 'storage-warning' : ''}`}>{storageAvailable ? <Check size={13} /> : <Info size={13} />}{!storageAvailable ? '草稿未能保存，请先下载文案' : draftSaved ? '草稿已保存在本机' : '正在保存…'}</span><span className={validation ? 'over-limit' : ''}>{stats.characters.toLocaleString()} <span className="muted">/ {limit.toLocaleString()} 字</span></span></div><div id="text-validation" className={validation ? 'validation-message' : 'visually-hidden'}>{validation || ''}</div><div className="script-metrics" id="text-help"><span><FileText size={15} /><strong>{stats.paragraphs}</strong> 个段落</span><span><Headphones size={15} />预计 <strong>{formatDuration(stats.estimatedSeconds)}</strong><span className="estimate-note">仅供参考</span></span></div></StudioCard>


              <StudioCard className="card voice-controls" aria-label="配音参数"><div className="controls-heading"><div className="section-title"><span className="step-tag">02</span><h2>声音设置</h2></div><SlidersHorizontal size={17} /></div><div className="parameter-section voice-model-section"><VoiceMode value={voiceMode} disabled={busy || clearingCache} onValueChange={value => { setVoiceMode(value as 'preset' | 'clone'); setError(''); setNotice('') }} />{voiceMode === 'preset' ? <>
                <label className="field-label" htmlFor="preset-voice">微软在线音色 · 免费使用</label>
                <VoiceSelect id="preset-voice" aria-label="微软在线音色" value={selectedVoice} disabled={busy} onValueChange={setSelectedVoice} options={voices.map(voice => ({ value: voice.id, label: `${voice.name} · ${voice.description}` }))} />
                <StudioButton className="button secondary voice-preview" disabled={busy || clearingCache || !!serviceError} onClick={() => void generate(true)}><Headphones size={15} />{previewing && busy ? '正在生成试听…' : '试听这个音色'}</StudioButton>
                <p className="field-hint">无需上传录音或下载模型。文案将发送到微软在线合成，生成后可试听、下载 WAV。</p>
                {serviceError && <p className="field-hint over-limit" role="alert">{serviceError}</p>}
              </> : <><label className="field-label">本地克隆模型</label><div className="voice-profile"><div className="voice-avatar"><AudioLines size={24} /></div><div><strong>{support?.modelName || '浏览器配音引擎'}</strong><span>{modelReady ? '已加载 · 本机运行' : '加载后即可开始配音'}</span></div></div><div className="model-management"><StudioButton className="text-button danger-text" disabled={busy || clearingCache} onClick={() => void clearCache()}>{clearingCache ? <LoaderCircle size={14} className="spin" /> : <Trash2 size={14} />}{clearingCache ? '正在删除…' : '删除模型'}</StudioButton><span>{busy ? '请先停止当前任务再删除' : '删除本地缓存，再次使用需下载'}</span></div>{support?.supportsReferenceAudio && <><StudioButton className="reference-button" onClick={() => referenceInput.current?.click()} disabled={busy}><Upload size={14} />{reference ? reference.name : '上传参考音频'}</StudioButton><input ref={referenceInput} type="file" accept="audio/*" className="visually-hidden" tabIndex={-1} aria-label="上传参考音频" onChange={(event) => { const file = event.target.files?.[0]; if (file && file.size > 20 * 1024 * 1024) { setError('参考音频请控制在 20 MB 以内。'); return } setReference(file) }} /><p className="field-hint">请使用 5–10 秒干净人声，使用你拥有或获授权使用的音色。</p>{support.supportsReferenceText && <><label className="field-label reference-label" htmlFor="reference-text">参考音频说了什么</label><StudioInput type="textarea" id="reference-text" className="reference-transcript" value={referenceText} onValueChange={setReferenceText} disabled={busy} maxlength={1000} placeholder="准确填写音频中的原话，用于匹配音色。" /></>}<p className="field-hint">实验功能 · 尚未完成音色试听验收。</p></>}{support && !support.supportsReferenceAudio && <p className="field-hint">当前模型使用内置声音，不支持参考音色克隆。</p>}</>}</div><div className="parameter-section"><div className="slider-label"><label htmlFor="tempo">语速</label><output htmlFor="tempo">{effectiveTempo.toFixed(2)}×</output></div><VoiceSlider id="tempo" aria-label="语速" min={0.65} max={1.25} step={0.01} value={effectiveTempo} disabled={busy || (voiceMode === 'clone' && support?.supportsTempo === false)} onValueChange={value => setPreferences(previous => ({ ...previous, tempo: value }))} /><div className="slider-extents"><span>舒缓</span><span>轻快</span></div>{voiceMode === 'clone' && support?.supportsTempo === false && <p className="field-hint">此实验引擎暂用原始语速。</p>}</div><div className="parameter-section"><div className="slider-label"><label htmlFor="pause">段落停顿</label><output htmlFor="pause">{preferences.pauseSeconds.toFixed(1)} 秒</output></div><VoiceSlider id="pause" aria-label="段落停顿" min={0.2} max={1.2} step={0.1} value={preferences.pauseSeconds} disabled={busy} onValueChange={value => setPreferences(previous => ({ ...previous, pauseSeconds: value }))} /><div className="slider-extents"><span>紧凑</span><span>留白</span></div><p className="field-hint">只在空行分隔的段落之间添加。</p></div><div className="parameter-section filename-section"><label className="field-label" htmlFor="filename">导出文件名</label><StudioInput id="filename" className="filename-input" value={preferences.filename} maxlength={80} disabled={busy} onValueChange={value => setPreferences(previous => ({ ...previous, filename: value }))} placeholder="我的配音" /></div><StudioButton className="reset-button" disabled={busy} onClick={() => setPreferences((previous) => ({ ...previous, tempo: DEFAULT_TEMPO, pauseSeconds: DEFAULT_PAUSE }))}><RotateCcw size={13} />恢复默认节奏</StudioButton></StudioCard>

            <div className="generation-bar">{progress ? <OperationProgress progress={progress} /> : <div className="generation-note"><ShieldCheck size={18} /><div><strong>{voiceMode === 'preset' ? '微软在线合成 · 无需下载模型' : '文案与声音，在本机处理'}</strong><span>{voiceMode === 'preset' ? '文案发送至微软服务；音频生成后请下载保存。' : modelReady ? '生成过程中请保持页面打开；速度取决于设备性能。' : support?.supported === false ? support.message : `首次使用需下载模型${support?.downloadLabel ? `（${support.downloadLabel}）` : ''}。`}</span></div></div>}{busy ? <StudioButton className="button secondary generate-button" onClick={cancel}><Square size={15} />停止{status === 'generating' ? '生成' : '加载'}</StudioButton> : (voiceMode === 'preset' || modelReady) ? <StudioButton className="button primary generate-button" onClick={() => void generate()} disabled={!text.trim() || !!validation || clearingCache || (voiceMode === 'preset' && !!serviceError)}><Sparkles size={17} />生成配音<ArrowRight size={17} /></StudioButton> : <StudioButton className="button primary generate-button" onClick={() => void loadModel()} disabled={!support?.supported || clearingCache}><ArrowDownToLine size={17} />加载配音模型<ArrowRight size={17} /></StudioButton>}</div>

            <section className="result-panel" ref={resultPanel} aria-label="配音结果"><StudioCard className={`card result-card ${result ? 'has-result' : ''}`}><div className="result-heading"><div className="section-title"><span className="step-tag">03</span><h2>配音结果</h2></div>{result && <span className="result-success"><CheckCircle2 size={14} /> 已生成</span>}</div>{result ? <div className="result-content"><div className="result-file"><div className="result-file-icon"><AudioLines size={28} /></div><div><strong>{result.filename}.{result.mimeType.includes('mpeg') ? 'mp3' : 'wav'}</strong><span>{formatDuration(result.durationSeconds)} <span className="dot-separator">·</span> {(result.audio.size / 1024 / 1024).toFixed(2)} MB <span className="dot-separator">·</span> {result.mimeType.includes('mpeg') ? 'MP3 音频' : 'WAV 音频'}</span></div></div><audio controls src={audioUrl} preload="metadata" aria-label="试听生成的配音" /><div className="result-actions"><StudioButton className="button secondary" onClick={() => downloadBlob(new Blob([result.script], { type: 'text/plain;charset=utf-8' }), `${result.filename}.txt`)}><FileText size={15} />下载文案</StudioButton><StudioButton className="button primary" onClick={() => downloadBlob(result.audio, `${result.filename}.${result.mimeType.includes('mpeg') ? 'mp3' : 'wav'}`)}><ArrowDownToLine size={16} />下载音频</StudioButton></div><p className="result-hint">这是上次生成的结果。修改文案后，需要重新生成；离开页面前请下载保存。</p></div> : <div className="result-empty"><div className="empty-audio-icon"><Headphones size={26} /></div><div><strong>音频将在这里呈现</strong><p>完成生成后，试听声音并下载到本机。</p></div></div>}</StudioCard></section>


            </div>
            <div className="bottom-hint"><Info size={14} /><span>小建议：先用一小段文案试听，确认发音和节奏，再生成完整内容。</span></div>
          </>}
          <footer className="page-footer"><span>声作 · 为创作留一点空间</span><a href="#/settings">本地运行说明 <ArrowRight size={12} /></a></footer>
        </main>
      </div>
    </div>
  )
}

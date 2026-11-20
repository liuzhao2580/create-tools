import { useEffect,useRef,useState } from 'react'
import { generatePresetVoice,voices } from '../../shared/audio/edge-voice'
import type { EngineProgress,EngineStatus,SupportInfo,VoiceResult } from '../../shared/audio/engine-types'
import { voiceEngine } from '../../shared/audio/voice-engine'
import { DEFAULT_PAUSE,DEFAULT_TEMPO,errorMessage,readTextFile,textStats,validateText } from '../../shared/utils/text'

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

export function useVoiceStudio(route: string) {
  const [voiceMode, setVoiceMode] = useState<'preset' | 'clone'>('preset')
  const [selectedVoice, setSelectedVoice] = useState(voices[0].id)
  const [previewing, setPreviewing] = useState(false)
  const [serviceError, setServiceError] = useState('')
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
    const script = preview ? '你好，欢迎使用创作者工具。这是我的声音，愿每一段文字都能被听见。' : text.trim()
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


 return { voiceMode, setVoiceMode, selectedVoice, setSelectedVoice, previewing, setPreviewing, serviceError, setServiceError, text, setText, preferences, setPreferences, draftSaved, setDraftSaved, storageAvailable, setStorageAvailable, support, setSupport, status, setStatus, modelReady, setModelReady, progress, setProgress, error, setError, notice, setNotice, reference, setReference, referenceText, setReferenceText, result, setResult, audioUrl, setAudioUrl, storage, setStorage, clearingCache, setClearingCache, controller, importInput, referenceInput, resultPanel, busy, effectiveTempo, stats, limit, validation, settingsRoute, onProgress, loadModel, generate, importText, unloadModel, clearCache, cancel, modelStateLabel }
}

import { Alert,Button,Empty,InputNumber,Modal,message,Progress,Segmented,Select,Upload } from 'antd'
import { AudioLines,CircleHelp,Copy,Download,Headphones,Square,UploadCloud } from 'lucide-react'
import { useEffect,useRef,useState } from 'react'
import './separation.css'

type Track = { name: string; file: string; kind: string }
type Job = { id: string; state: string; message: string; filename: string; model: string; start: number; duration: number; outputFolder?: string; log?: string; tracks?: Track[] }
const labels: Record<string, string> = { melband: 'MelBand RoFormer', bsroformer: 'BS-RoFormer' }
const key = 'creator-tools.separation.jobs.v1'
const endpoint = (path: string) => new URL(`api/separation/${path}`, document.baseURI).href
async function api(path: string, init?: RequestInit) {
  const response = await fetch(endpoint(path), init)
  if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('需要本地服务。请在项目目录运行 npm run dev 后打开此页面。')
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || '请求失败')
  return result
}
function readJobs(): Job[] { try { return JSON.parse(sessionStorage.getItem(key) || '[]').map((job: Job) => (job.state !== 'running' && job.state !== 'done' && /正在分离|正在加载|正在提取/.test(job.message)) ? { ...job, message: '上次任务未完成，分离进程已退出，请重新选择素材后重试。' } : job) } catch { return [] } }
function trackUrl(id: string, file: string, download = false) { return endpoint(`jobs/${id}/file?name=${encodeURIComponent(file)}${download ? '&download=1' : ''}`) }
export default function SeparationStudio() {
  const [messageApi, messageContext] = message.useMessage()
  const [copyingLog, setCopyingLog] = useState(false)
  const [selectedJobId, setSelectedJobId] = useState<string>()
  const [logJob, setLogJob] = useState<Job>()
  const [installationHelpOpen, setInstallationHelpOpen] = useState(false)
  const [setup, setSetup] = useState({ state: 'idle', log: '', message: '' })
  const [installPending, setInstallPending] = useState(false)
  const [ready, setReady] = useState(false)
  const [health, setHealth] = useState('正在检查本地分离环境…')
  const [file, setFile] = useState<File>()
  const [model, setModel] = useState('melband')
  const [start, setStart] = useState(0)
  const [duration, setDuration] = useState(30)
  const [destination, setDestination] = useState<{token:string;path:string}>()
  const [choosing, setChoosing] = useState(false)
  async function chooseDirectory() {
    setChoosing(true); setError('')
    try { const result = await api('output-directory', {method:'POST',headers:{'Content-Type':'application/json'}}); if(!result.cancelled) setDestination(result) }
    catch(e) { setError((e as Error).message) } finally { setChoosing(false) }
  }
  const [jobs, setJobs] = useState<Job[]>(readJobs)
  const [error, setError] = useState('')
  const [upload, setUpload] = useState<number | null>(null)
  const [checking, setChecking] = useState(true)
  const [installationPaths, setInstallationPaths] = useState({ modelDir: '', defaultModelDir: '', python: '' })
  const [choosingModels, setChoosingModels] = useState(false)
  async function loadInstallation() { const data = await api('installation'); setInstallationPaths(data); setSetup(data) }
  async function chooseModels() {
    setChoosingModels(true); setError('')
    try { const data = await api('model-directory', { method: 'POST', headers: { 'Content-Type': 'application/json' } }); if (!data.cancelled) { setInstallationPaths(data); setReady(false); setSetup({state:'idle',message:'',log:''}); await check() } }
    catch (e) { setError((e as Error).message) } finally { setChoosingModels(false) }
  }
  const xhr = useRef<XMLHttpRequest | null>(null)
  const players = useRef(new Map<string, HTMLAudioElement>())
  const active = jobs.find(j => j.state === 'running')
  const busy = upload !== null || !!active
  async function install() {
    setInstallPending(true); setError('')
    try { setSetup(await api('setup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })) }
    catch (e) { setError((e as Error).message) }
    finally { setInstallPending(false) }
  }
  useEffect(() => { void loadInstallation().catch(() => {}) }, [])
  useEffect(() => {
    if (setup.state !== 'running') return
    let closed = false
    let timer: ReturnType<typeof setTimeout>
    async function poll() {
      try {
        const data = await api('setup')
        if (closed) return
        setSetup(data)
        if (data.state === 'done') void check()
        if (data.state !== 'running') return
      } catch (e) { if (!closed) setError(`读取安装进度失败，正在重试：${(e as Error).message}`) }
      if (!closed) timer = setTimeout(poll, 1500)
    }
    void poll()
    return () => { closed = true; clearTimeout(timer) }
  }, [setup.state])
  async function check() {
    setChecking(true)
    try { const data = await api('health'); setReady(data.ready); setHealth(data.message) }
    catch (e) { setReady(false); setHealth((e as Error).message) }
    finally { setChecking(false) }
  }
  useEffect(() => {
    let closed = false
    for (const job of readJobs()) {
      void api(`jobs/${job.id}`).then((data: Job) => { if (!closed) setJobs(prev => prev.map(item => item.id === data.id ? data : item)) }).catch(() => {})
    }
    return () => { closed = true }
  }, [])
  useEffect(() => { void check(); return () => { xhr.current?.abort() } }, [])
  useEffect(() => { try { sessionStorage.setItem(key, JSON.stringify(jobs.map(j => ({ ...j, log: undefined })))) } catch { /* session storage unavailable */ } }, [jobs])
  useEffect(() => {
    if (!active) return
    let closed = false
    let timer: ReturnType<typeof setTimeout>
    async function poll() {
      try {
        const data: Job = await api(`jobs/${active!.id}`)
        if (closed) return
        setError('')
        setJobs(prev => prev.map(j => j.id === data.id ? data : j))
        if (data.state === 'running') timer = setTimeout(poll, 1800)
      } catch (e) {
        if (closed) return
        const message = (e as Error).message
        if (message.includes('任务不可用')) setJobs(prev => prev.map(j => j.id === active!.id ? { ...j, state: 'error', message } : j))
        else { setError(`暂时无法读取进度，正在重试：${message}`); timer = setTimeout(poll, 4000) }
      }
    }
    void poll()
    return () => { closed = true; clearTimeout(timer) }
  }, [active?.id])
  async function run() {
    if (!file || busy || !ready) return
    if (file.size > 4 * 1024 ** 3) { setError('文件超过 4 GB，请先截取需要的片段。'); return }
    setError(''); setUpload(0)
    const request = new XMLHttpRequest(); xhr.current = request
    const params = new URLSearchParams({ model, start: String(start), duration: String(duration), filename: file.name })
    if(destination) params.set('destination',destination.token)
    request.open('POST', endpoint(`jobs?${params}`)); request.setRequestHeader('Content-Type', 'application/octet-stream')
    request.upload.onprogress = e => { if (e.lengthComputable) setUpload(Math.round(e.loaded / e.total * 100)) }
    request.onload = () => {
      try {
        const data = JSON.parse(request.responseText)
        if (request.status !== 202) throw new Error(data.error || '提交失败')
        setJobs(prev => [{ id: data.id, state: 'running', message: '任务已提交…', filename: file.name, model, start, duration }, ...prev].slice(0, 10))
      } catch (e) { setError((e as Error).message) }
      setUpload(null); xhr.current = null
    }
    request.onerror = () => { setError('传入素材失败，请检查本地服务。'); setUpload(null); xhr.current = null }
    request.onabort = () => { setUpload(null); xhr.current = null }
    request.send(file)
  }
  async function cancel() {
    if (xhr.current) { xhr.current.abort(); return }
    if (active) { try { await api(`jobs/${active.id}/cancel`, { method: 'POST' }) } catch (e) { setError((e as Error).message) } }
  }
  function solo(player: HTMLAudioElement) { for (const other of players.current.values()) if (other !== player) other.pause() }
  function compare(id: string) {
    const target = players.current.get(id)
    if (!target) return
    const playing = [...players.current.values()].find(p => !p.paused)
    if (playing && playing !== target) { const time = playing.currentTime; playing.pause(); target.currentTime = time }
    void target.play().catch(() => setError('播放失败，请点击音频播放器重试。'))
  }
  const displayedLog = jobs.find(job => job.id === logJob?.id)?.log || logJob?.log || ''
  async function copyLog() {
    if (!displayedLog) return
    setCopyingLog(true)
    try {
      await navigator.clipboard.writeText(displayedLog)
      void messageApi.success('处理日志已复制')
    } catch {
      void messageApi.error('复制失败，请允许剪贴板权限，或选中日志文字手动复制')
    } finally { setCopyingLog(false) }
  }
  return <section className="separation-workspace" aria-label="人声分离工作台">
    {messageContext}
    <div className="separation-intro"><AudioLines size={24}/><div><strong>先听 30 秒，再决定用哪个模型</strong><p>从原始视频或音频提取人声。比较音乐残留和人声自然度，结果保留在本机。</p></div><Button type="text" shape="circle" className="separation-help-button" aria-label="查看模型安装信息" title="模型安装信息" aria-haspopup="dialog" onClick={() => setInstallationHelpOpen(true)} icon={<CircleHelp size={22}/>}/></div>
    <Modal title="处理日志" open={!!logJob} onCancel={() => setLogJob(undefined)} footer={<Button icon={<Copy size={16}/>} onClick={() => void copyLog()} loading={copyingLog} disabled={!displayedLog}>复制日志</Button>} width={800}><pre className="separation-log">{displayedLog}</pre></Modal>
    <Modal title="模型安装信息" open={installationHelpOpen} onCancel={() => setInstallationHelpOpen(false)} footer={null} width={680}>
    <div className="separation-destination">
<p>10 秒或 30 秒用于试听对比；全部处理从文件开头处理到结尾。</p>
<p>两种模型均分离人声与背景音。背景音包含音乐和音效，不是独立音效轨。相同素材、相同区间，更容易听出差别。</p>
      <strong>模型安装位置</strong>
      <p className="separation-path">{installationPaths.modelDir || '正在读取安装位置…'}</p>
      <Button onClick={() => void chooseModels()} loading={choosingModels} disabled={busy || checking || installPending || setup.state === 'running'}>选择模型目录</Button>
      <p className="separation-path">默认目录：{installationPaths.defaultModelDir || '读取中…'}</p>
      <p className="separation-path">Python 环境：{installationPaths.python || '读取中…'}</p>
      <p>位置保存在本机，刷新后继续使用。可选择已有模型目录；切换目录不会移动或删除原模型。</p>
      {ready && <span>环境与两个模型已就绪，无需重复安装。</span>}
    </div>
    {(!ready || setup.state === 'running' || setup.state === 'error') && <Alert type={setup.state === 'error' ? 'error' : 'info'} showIcon title={checking ? '正在检查已安装的环境与模型…' : setup.state === 'running' || setup.state === 'error' ? setup.message : health} description={<div>
      <p>一次安装 FFmpeg、Python 依赖及两个分离模型。下载与加载验证全部完成后即可处理，处理时不再下载模型。首次安装需要联网，耗时取决于网速。</p>
      <Button type="primary" onClick={() => void install()} loading={installPending || setup.state === 'running'} disabled={busy || checking || choosingModels || !installationPaths.modelDir}> {setup.state === 'running' ? '正在安装环境与模型…' : setup.state === 'error' ? '继续安装' : '一键安装环境与模型'}</Button>
      <Button onClick={() => void check()} loading={checking} disabled={installPending || setup.state === 'running'} type="link">重新检查</Button>
      {setup.log && <details><summary>安装日志</summary><pre aria-live="polite" style={{ maxHeight: 240, overflow: 'auto', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{setup.log}</pre></details>}
    </div>}/>}
    </Modal>
    {(!ready || setup.state === 'running' || setup.state === 'error') && <Button className="separation-environment-status" type="link" onClick={() => setInstallationHelpOpen(true)}>{checking ? '正在检查环境…' : setup.state === 'running' ? '环境正在安装 · 查看进度' : '查看环境状态与安装详情'}</Button>}
    {error && <Alert type="error" showIcon title={error} closable={{ onClose: () => setError('') }}/>}
    <div className="separation-layout">
      <aside className="separation-controls">
        <h2>01 <span>素材与区间</span></h2>
        <Upload.Dragger accept="audio/*,video/*,.mkv,.flac,.m4a" multiple={false} showUploadList={false} disabled={busy} beforeUpload={f => { setFile(f); setError(''); return false }}>
          <UploadCloud size={32}/><p>{file ? file.name : '拖入视频或音频'}</p><small>{file ? `${(file.size / 1024 ** 2).toFixed(1)} MB · 点击更换` : '点击选择 · 最大 4 GB'}</small>
        </Upload.Dragger>
        <div className="separation-times"><label>起始位置（秒）<InputNumber aria-label="起始位置（秒）" min={0} max={86400} value={start} onChange={v => setStart(v ?? 0)} disabled={busy || duration===0}/></label><label>处理时长<Segmented aria-label="处理时长" value={duration} onChange={v=>{setDuration(v);if(v===0)setStart(0)}} disabled={busy} options={[{label:"10 秒",value:10},{label:"30 秒",value:30},{label:"全部处理",value:0}]}/></label></div>

        <div className="separation-destination"><Button disabled={busy} loading={choosing} onClick={()=>void chooseDirectory()}>选择导出位置</Button><p className="separation-path">{destination?.path || "未选择时使用本机默认输出目录"}</p></div>
        <label className="separation-model">分离模型<Select aria-label="分离模型" value={model} onChange={setModel} disabled={busy} options={Object.entries(labels).map(([value, label]) => ({ value, label }))}/></label>

        <Button type="primary" size="large" block style={busy?{display:"none"}:undefined} disabled={!file || !ready || busy} onClick={() => void run()} icon={<AudioLines size={17}/>}>开始分离</Button>
        {busy && <Button size="large" block onClick={() => void cancel()} icon={<Square size={15}/>}>停止当前任务</Button>}
        <a className="separation-source" href="https://github.com/nomadkaraoke/python-audio-separator" target="_blank" rel="noreferrer">开源引擎与模型说明 ↗</a>
      </aside>
      <div className="separation-results">
        <header><h2>02 <span>试听与导出</span></h2><Select aria-label="选择历史任务" placeholder="最近 10 次任务" value={selectedJobId || jobs[0]?.id} onChange={setSelectedJobId} style={{width:260}} options={jobs.map(job=>({value:job.id,label:job.filename + " · " + labels[job.model]}))}/></header>
        {upload !== null && <div role="status"><p>{upload === 100 ? '素材传入完成，正在启动…' : '正在将素材传入本机服务…'}</p><Progress percent={upload}/></div>}
        {!jobs.length && upload === null && <Empty image={<Headphones size={48}/>} description="处理完成后，在这里切换原声与人声试听"/>}
        {jobs.filter(job => job.id === (selectedJobId || jobs[0]?.id)).map(job => <article className="separation-job" key={job.id}>
          <div className="separation-job-title"><div><h3>{labels[job.model]} <small>{job.start} 秒起 · {job.duration===0?'全部处理':`最长 ${job.duration} 秒`}</small></h3><p>{job.filename}</p></div><span>{job.state === 'done' ? '已完成' : job.state === 'running' ? '处理中' : job.state === 'cancelled' ? '已停止' : '处理失败'}</span></div>
          <p role={job.state === 'running' ? 'status' : undefined}>{job.message}</p>
          {job.tracks?.map(track => { const id = `${job.id}:${track.file}`; return <div className="separation-track" key={track.file}>
            <div><strong>{track.name}</strong><div><Button onClick={() => compare(id)} size="small">切换试听</Button><a href={trackUrl(job.id, track.file, true)} download><Download size={14}/> WAV</a></div></div>
            <audio ref={el => { if (el) players.current.set(id, el); else players.current.delete(id) }} src={trackUrl(job.id, track.file)} controls preload="metadata" aria-label={`${labels[job.model]} ${track.name}`} onPlay={e => solo(e.currentTarget)}/>
          </div> })}
          {job.state === 'done' && <p className="separation-hint">“切换试听”从当前播放位置继续；对比不同模型时，请使用相同起点和时长。将人声 WAV 导入剪辑软件，再加入新 BGM。</p>}
          {job.outputFolder && <p className="separation-path">保存位置：{job.outputFolder}</p>}
          {job.log && <Button type="link" onClick={() => setLogJob(job)}>查看处理日志</Button>}
        </article>)}
      </div>
    </div>
  </section>
}

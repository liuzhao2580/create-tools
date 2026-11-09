import { useEffect, useRef, useState } from 'react'
import { Upload, Square, ArrowDownToLine } from 'lucide-react'
import { StudioButton, StudioCard } from './ui/antd'
import { parseSrt, timecode, type SubtitleJob } from './subtitles'
import { errorMessage } from './text'

const endpoint = (suffix: string) => new URL(`api/subtitles/${suffix}`, document.baseURI).href
async function request(suffix: string, options?: RequestInit) {
  const response = await fetch(endpoint(suffix), options)
  if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('字幕配音需要本机服务，请通过 npm run dev 或 npm run preview 打开。')
  const body = await response.json()
  if (!response.ok) throw new Error(body.error || '请求失败，请重试。')
  return body
}
const savedJobKey = 'shengzuo.subtitle-job.v1'
export default function SubtitleStudio() {
  const input = useRef<HTMLInputElement>(null)
  const [job, setJob] = useState<SubtitleJob | null>(null)
  const [error, setError] = useState('')
  const [ready, setReady] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [retry, setRetry] = useState(0)
  const busy = uploading || job?.state === 'running'
  useEffect(() => {
    let alive = true
    request('health').then(() => { if (alive) setReady(true) }).catch(e => { if (alive) setError(errorMessage(e)) })
    try {
      const id = localStorage.getItem(savedJobKey)
      if (id) request(`jobs/${id}`).then(value => { if (alive) setJob(value) }).catch(() => {})
    } catch { /* Local storage is optional. */ }
    return () => { alive = false }
  }, [retry])
  useEffect(() => {
    if (job?.state !== 'running') return
    const id = job.id
    let alive = true
    let timer: ReturnType<typeof setTimeout>
    const poll = async () => {
      try { const value = await request(`jobs/${id}`); if (alive) { setJob(value); setError('') } }
      catch (e) { if (alive) setError(`读取进度失败：${errorMessage(e)} 将自动重试。`) }
      if (alive) timer = setTimeout(poll, 1500)
    }
    timer = setTimeout(poll, 1000)
    return () => { alive = false; clearTimeout(timer) }
  }, [job?.id, job?.state])
  async function upload(file?: File) {
    if (!file || busy) return
    setUploading(true); setError('')
    try {
      if (!/\.srt$/i.test(file.name)) throw new Error('请选择 .srt 字幕文件。')
      if (file.size > 200000) throw new Error('字幕文件过大，请控制在 200 KB 以内。')
      let srt: string
      try { srt = new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer()) }
      catch { throw new Error('字幕不是 UTF-8 编码，请另存为 UTF-8 后上传。') }
      parseSrt(srt)
      const value: SubtitleJob = await request('jobs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ srt, filename: file.name.replace(/\.srt$/i, '') }) })
      setJob(value)
      try { localStorage.setItem(savedJobKey, value.id) } catch { /* Downloads still work. */ }
    } catch (e) { setError(errorMessage(e)) }
    finally { setUploading(false); if (input.current) input.current.value = '' }
  }
  async function cancel() {
    if (!job) return
    try { setJob(await request(`jobs/${job.id}`, { method: 'DELETE' })) }
    catch (e) { setError(errorMessage(e)) }
  }
  return <div className="subtitle-studio">
    <StudioCard className="card">
      <div className="card-heading"><div><h2>上传字幕，按时间配音</h2><p>使用已确认音色与自然语速，上传后自动开始。</p></div></div>
      <p>在剪映排好画面与解说字幕，导出 SRT。这里只上传需要朗读的解说字幕，原片对白和标题不用放进来。</p>
      <div className="subtitle-actions"><StudioButton className="button primary" disabled={busy || !ready} onClick={() => input.current?.click()}><Upload size={17} />{uploading ? '正在读取字幕…' : '上传 SRT 并生成配音'}</StudioButton>{!uploading && job?.state === 'running' && <StudioButton onClick={() => void cancel()}><Square size={15} />取消生成</StudioButton>}{!ready && <StudioButton onClick={() => { setError(''); setRetry(n => n + 1) }}>重新检查服务</StudioButton>}</div>
      <input ref={input} className="visually-hidden" type="file" accept=".srt" aria-label="上传 SRT 字幕" tabIndex={-1} onChange={event => void upload(event.target.files?.[0])} />
      <p className="field-hint">UTF-8 · 最多 1000 条 / 2 小时 · 每条不超过 110 字。文案与音频在本机处理。</p>
      {error && <p role="alert" className="subtitle-error">{error}</p>}
    </StudioCard>
    {job && <StudioCard className="card">
      <div className="card-heading"><div><h2>{job.filename}</h2><p>共 {job.total} 条 · 时间轴结束于 {timecode(job.cues.at(-1)?.end || 0)}</p></div></div>
      <p role="status" aria-live="polite">{job.message}</p>
      {job.state === 'running' && <progress aria-label="字幕配音进度" max={job.total} value={job.completed} />}
      <p className="field-hint">已生成 {job.completed} / {job.total} 条。切换页面或刷新后可恢复查看进度；生成期间保持本机服务运行。</p>
      {job.state === 'needs-edit' && <p className="subtitle-error" role="alert">下方标出的句子读不完：请缩短文案或延长字幕时间，再重新上传。完整音轨暂不导出，避免配音越过画面或覆盖下一句。</p>}
      {job.state === 'error' && <p className="subtitle-error" role="alert">生成未完成。处理上方错误后，可重新上传同一字幕重试。</p>}
      {job.state === 'complete' && <div className="subtitle-output"><audio controls src={endpoint(`jobs/${job.id}/timeline.wav`)} aria-label="试听完整同步配音" preload="metadata" /><a className="button primary" href={endpoint(`jobs/${job.id}/timeline.wav`)} download={`${job.filename}_从0秒开始.wav`}><ArrowDownToLine size={16} />下载完整 WAV</a><p><strong>导入剪映后，把音轨左边缘对齐第 0 秒。</strong>保留开头和句间静音，不要删除空白；后续改动画面或字幕时间，需要重新生成。</p></div>}
      <ol className="subtitle-cues">{job.cues.map((cue, index) => {
        const result = job.results[index]
        return <li key={cue.index}><div className="subtitle-cue-head"><strong>第 {cue.index} 条</strong><span>{timecode(cue.start)} → {timecode(cue.end)}</span></div><p>{cue.text}</p><div className={result?.overflow ? 'subtitle-error' : 'field-hint'}>{result ? result.overflow > 0 ? `超出 ${result.overflow.toFixed(2)} 秒（实际 ${result.seconds.toFixed(2)} 秒，可用 ${(cue.end - cue.start).toFixed(2)} 秒）` : `已生成 · ${result.seconds.toFixed(2)} 秒 / 可用 ${(cue.end - cue.start).toFixed(2)} 秒` : '等待生成'}</div>{result && <audio controls preload="none" src={endpoint(`jobs/${job.id}/${result.file}`)} aria-label={`试听第 ${cue.index} 条配音`} />}</li>
      })}</ol>
    </StudioCard>}
    {!job && <p className="bottom-hint">每句话按字幕起点放入音轨，空白保留。读不完的句子会标出，不会自动截断或强行加速。</p>}
  </div>
}

import { createReadStream, existsSync, mkdirSync, readFileSync, writeFileSync, statSync } from 'node:fs'
import { spawn, type ChildProcess } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin } from 'vite'
import { parseSrt, type SubtitleJob } from '../src/subtitles.ts'

const root = fileURLToPath(new URL('../.local/subtitle-jobs/', import.meta.url))
const configPath = fileURLToPath(new URL('../.local/subtitle-voice.json', import.meta.url))
const script = fileURLToPath(new URL('./subtitle_voice.py', import.meta.url))
export function subtitleSpeechPlugin(): Plugin {
  const jobs = new Map<string, SubtitleJob>()
  let active: { id: string; child: ChildProcess } | undefined
  function config() {
    if (!existsSync(configPath)) throw new Error('请先配置 .local/subtitle-voice.json 中的本地 Python、模型和已确认音色。')
    const value = JSON.parse(readFileSync(configPath, 'utf8'))
    if (![value.python, value.model, value.profile].every(p => typeof p === 'string' && existsSync(p))) throw new Error('本地配音配置中的文件不存在，请检查 Python、模型与音色路径。')
    return value as { python: string; model: string; profile: string }
  }
  const middleware = async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const path = req.url?.split('?')[0] || ''
    if (!path.startsWith('/api/subtitles/')) return next()
    const json = (code: number, value: unknown) => { if (!res.destroyed) { res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(value)) } }
    const host = req.headers.host || ''
    if (!/^(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/.test(host) || req.headers['sec-fetch-site'] === 'cross-site' || (req.headers.origin && ![`http://${host}`, `https://${host}`].includes(req.headers.origin))) return json(403, { error: '字幕配音仅允许本机同源访问。' })
    try {
      if (path === '/api/subtitles/health' && req.method === 'GET') {
        config()
        return json(200, { ready: true, busy: !!active })
      }
      if (path === '/api/subtitles/jobs' && req.method === 'POST') {
        if (active) return json(409, { error: '已有字幕配音任务正在运行，请完成或取消后再试。' })
        if (!req.headers['content-type']?.startsWith('application/json')) return json(415, { error: '请使用 JSON 请求。' })
        let body = ''
        for await (const chunk of req) { body += chunk; if (Buffer.byteLength(body) > 250000) return json(413, { error: '字幕文件过大。' }) }
        const payload = JSON.parse(body)
        if (typeof payload.srt !== 'string') return json(400, { error: '缺少 SRT 字幕。' })
        const cues = parseSrt(payload.srt), settings = config()
        // Recheck after awaiting the body: only one GPU synthesis process at a time.
        if (active) return json(409, { error: '已有字幕配音任务正在运行。' })
        const id = randomUUID(), dir = join(root, id)
        mkdirSync(dir, { recursive: true })
        writeFileSync(join(dir, 'input.json'), JSON.stringify({ cues }))
        writeFileSync(join(dir, 'input.srt'), payload.srt)
        const job: SubtitleJob = { id, cues, filename: typeof payload.filename === 'string' ? payload.filename.slice(0, 100) : '字幕配音', state: 'running', message: '正在启动本地配音…', completed: 0, total: cues.length, results: [] }
        jobs.set(id, job)
        const child = spawn(settings.python, [script, configPath, dir], { stdio: ['ignore', 'pipe', 'pipe'] })
        active = { id, child }
        let buffer = ''
        const timer = setTimeout(() => { job.state = 'error'; job.message = '任务超过 2 小时，请拆分字幕后重试。'; child.kill() }, 2 * 60 * 60 * 1000)
        child.stdout?.setEncoding('utf8')
        child.stdout?.on('data', (chunk: string) => {
          buffer += chunk
          let end: number
          while ((end = buffer.indexOf('\n')) >= 0) {
            const line = buffer.slice(0, end); buffer = buffer.slice(end + 1)
            if (job.state !== 'running') continue
            try {
              const event = JSON.parse(line)
              if (event.message) job.message = event.message
              if (event.completed) job.completed = event.completed
              if (event.result) job.results.push(event.result)
              if (event.error) { job.state = 'error'; job.message = event.error }
              if (event.state === 'complete' || event.state === 'needs-edit') job.state = event.state
            } catch { /* Model diagnostics are not protocol events. */ }
          }
        })
        child.stderr?.resume()
        child.on('error', () => { job.state = 'error'; job.message = '本地 Python 启动失败，请检查配置。' })
        child.on('close', () => {
          clearTimeout(timer)
          if (active?.id === id) active = undefined
          if (job.state === 'running') { job.state = 'error'; job.message = '配音进程意外结束，请检查本地依赖或缩短文案后重试。' }
          writeFileSync(join(dir, 'job.json'), JSON.stringify(job))
        })
        return json(202, job)
      }
      const match = /^\/api\/subtitles\/jobs\/([a-f0-9-]{36})(?:\/(timeline\.wav|cue-\d+\.wav))?$/.exec(path)
      if (!match) return json(404, { error: '接口不存在。' })
      let job = jobs.get(match[1])
      if (!job && existsSync(join(root, match[1], 'job.json'))) {
        job = JSON.parse(readFileSync(join(root, match[1], 'job.json'), 'utf8')) as SubtitleJob
        jobs.set(job.id, job)
      }
      if (!job) return json(404, { error: '任务不存在，请重新上传字幕。' })
      if (match[2] && req.method === 'GET') {
        if (match[2] === 'timeline.wav' ? job.state !== 'complete' : !job.results.some(r => r.file === match[2])) return json(409, { error: '此音频尚不可用。' })
        const file = join(root, job.id, match[2])
        if (!existsSync(file)) return json(404, { error: '音频文件不存在。' })
        const size = statSync(file).size
        let start = 0, end = size - 1
        const range = req.headers.range
        if (range) {
          const parts = /^bytes=(\d*)-(\d*)$/.exec(range)
          if (!parts || (!parts[1] && !parts[2])) { res.writeHead(416, { 'Content-Range': `bytes */${size}` }); res.end(); return }
          start = parts[1] ? Number(parts[1]) : Math.max(0, size - Number(parts[2]))
          end = parts[1] && parts[2] ? Math.min(size - 1, Number(parts[2])) : size - 1
          if (start >= size || start > end) { res.writeHead(416, { 'Content-Range': `bytes */${size}` }); res.end(); return }
        }
        res.writeHead(range ? 206 : 200, { 'Content-Type': 'audio/wav', 'Cache-Control': 'no-store', 'Content-Disposition': `inline; filename="${match[2]}"`, 'Accept-Ranges': 'bytes', 'Content-Length': end - start + 1, ...(range ? { 'Content-Range': `bytes ${start}-${end}/${size}` } : {}) })
        const stream = createReadStream(file, { start, end })
        stream.on('error', () => res.destroy()); res.on('close', () => stream.destroy()); stream.pipe(res)
        return
      }
      if (!match[2] && req.method === 'GET') return json(200, job)
      if (!match[2] && req.method === 'DELETE') {
        if (job.state === 'running') { job.state = 'cancelled'; job.message = '任务已取消，已生成的分段可试听。'; if (active?.id === job.id) active.child.kill() }
        return json(200, job)
      }
      return json(405, { error: '请求方法不支持。' })
    } catch (error) { return json(400, { error: error instanceof Error ? error.message : '请求失败。' }) }
  }
  return { name: 'local-subtitle-speech', configureServer(server) { server.middlewares.use(middleware) }, configurePreviewServer(server) { server.middlewares.use(middleware) } }
}

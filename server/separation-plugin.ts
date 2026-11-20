import { createReadStream, createWriteStream, existsSync, readFileSync, writeFileSync, mkdirSync, renameSync } from 'node:fs'
import { mkdir, readFile, stat, unlink } from 'node:fs/promises'
import { spawn, type ChildProcess } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { join, basename } from 'node:path'
import { randomUUID } from 'node:crypto'
import { pipeline } from 'node:stream/promises'
import { Transform } from 'node:stream'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin } from 'vite'

const root = fileURLToPath(new URL('../', import.meta.url))
const script = join(root, 'server/separate_audio.py')
const python = process.env.SEPARATION_PYTHON || join(root, '.local/separation-venv/bin/python')
const output = process.env.SEPARATION_OUTPUT_DIR || '/Volumes/liu/MoviesClips/音频分离'
const defaultModelDir = join(root, '.local/separation-models')
const configPath = join(root, '.local/separation-config.json')
function configuredModels() {
  try { return JSON.parse(readFileSync(configPath, 'utf8')).modelDir || defaultModelDir } catch { return defaultModelDir }
}
const jobIndexPath = join(root, '.local/separation-jobs.json')
const installStatePath = join(root, '.local/separation-install.json')
const MAX_BYTES = 4 * 1024 ** 3
const models = ['melband', 'bsroformer']
export function validateSeparationParams(url: URL) {
  const model = url.searchParams.get('model') || ''
  const start = Number(url.searchParams.get('start'))
  const duration = Number(url.searchParams.get('duration'))
  if (!models.includes(model) || !Number.isFinite(start) || start < 0 || start > 86400 || !Number.isFinite(duration) || (duration !== 0 && (duration < 5 || duration > 600))) throw new Error('请选择有效模型，起点须为非负秒数，时长须为 5–600 秒或全部处理。')
  return { model, start: duration === 0 ? 0 : start, duration }
}
type Job = { id: string; folder: string; filename: string; model: string; start: number; duration: number; state?: string; message?: string; process?: ChildProcess }

export function separationPlugin(): Plugin {
  const jobs = new Map<string, Job>()
  const destinations = new Map<string, string>()
  let active: Job | undefined
  let installer: ChildProcess | undefined
  let modelDir: string = configuredModels()
  let selectingModelDir = false
  let setup = { state: 'idle', log: '', message: '' }

  function installation() {
    try {
      const saved = JSON.parse(readFileSync(installStatePath, 'utf8'))
      if (installer && saved.pid !== installer.pid) return setup
      if (saved.state === 'running') {
        try { process.kill(saved.pid, 0) } catch { saved.state = 'error'; saved.message = '上次安装已中断，完整模型已保留，可继续安装。' }
      }
      setup = { state: saved.state, message: saved.message, log: '' }
      try { setup.log = readFileSync(join(root, '.local/separation-install.log'), 'utf8').slice(-12000) } catch { /* no log yet */ }
    } catch { /* legacy in-memory installer */ }
    return setup
  }
  function paths() {
    return { modelDir, defaultModelDir, python, configPath }
  }

  function stop(job: Job) {
    job.state = 'cancelled'; job.message = '任务已停止，已完成的结果仍保留。'
    if (job.process?.pid) { try { process.kill(-job.process.pid, 'SIGTERM') } catch { job.process.kill() } }
  }
  const middleware = async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const url = new URL(req.url || '/', 'http://localhost')
    if (!url.pathname.startsWith('/api/separation/')) return next()
    const json = (code: number, data: unknown) => { if (!res.destroyed && !res.headersSent) { res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(data)) } }
    const host = req.headers.host || ''
    if (!/^(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/.test(host) || (req.headers.origin && ![`http://${host}`, `https://${host}`].includes(req.headers.origin))) return json(403, { error: '此接口仅允许同源本机访问。' })
    try {
      if (url.pathname === '/api/separation/installation' && req.method === 'GET') return json(200, { ...paths(), ...installation() })
      if (url.pathname === '/api/separation/model-directory' && req.method === 'POST') {
        if (!req.headers['content-type']?.startsWith('application/json') || req.headers['sec-fetch-site'] === 'cross-site') return json(403, { error: '仅允许本机页面选择目录。' })
        if (active || installer || installation().state === 'running' || selectingModelDir) return json(409, { error: '请等待当前任务完成后再选择安装位置。' })
        if (process.platform !== 'darwin') return json(400, { error: '此目录选择器目前支持 macOS。' })
        selectingModelDir = true
        const picker = spawn('osascript', ['-e', 'POSIX path of (choose folder with prompt "选择模型安装目录（已有模型也可直接选择）")'])
        let selected = ''
        picker.stdout.on('data', data => { selected += data }); picker.stderr.resume()
        picker.on('error', () => { selectingModelDir = false; json(500, { error: '无法打开目录选择器。' }) })
        picker.on('close', code => {
          selectingModelDir = false
          if (code !== 0 || !selected.trim()) return json(200, { cancelled: true })
          try {
            const chosen = selected.trim()
            mkdirSync(join(root, '.local'), { recursive: true })
            writeFileSync(configPath + '.tmp', JSON.stringify({ modelDir: chosen }))
            renameSync(configPath + '.tmp', configPath)
            modelDir = chosen
            json(200, paths())
          } catch (error) { json(500, { error: String(error) }) }
        })
        return
      }
      if (url.pathname === '/api/separation/output-directory' && req.method === 'POST') {
        if (!req.headers['content-type']?.startsWith('application/json') || req.headers['sec-fetch-site'] === 'cross-site') return json(403, { error: '仅允许本机页面选择目录。' })
        if (process.platform !== 'darwin') return json(400, { error: '此目录选择器目前支持 macOS。' })
        const child = spawn('osascript', ['-e', 'POSIX path of (choose folder with prompt "选择音频分离导出位置")'])
        let selected = ''
        child.stdout.on('data', data => { selected += data }); child.stderr.resume()
        child.on('error', () => json(500, { error: '无法打开目录选择器。' }))
        child.on('close', code => {
          if (code !== 0 || !selected.trim()) return json(200, { cancelled: true })
          const token = randomUUID(); destinations.set(token, selected.trim())
          json(200, { token, path: selected.trim() })
        })
        return
      }
      if (url.pathname === '/api/separation/setup') {
        if (req.method === 'GET') return json(200, installation())
        if (req.method !== 'POST') return json(405, { error: '请求方法不支持。' })
        if (req.headers['sec-fetch-site'] === 'cross-site' || !req.headers['content-type']?.startsWith('application/json')) return json(403, { error: '安装仅允许本机页面发起。' })
        if (installer || installation().state === 'running') return json(200, setup)
        if (selectingModelDir) return json(409, { error: '请先完成目录选择。' })
        if (active) return json(409, { error: '请先停止分离任务再安装。' })
        setup = { state: 'running', log: '', message: '正在安装环境与全部模型…' }
        const child = spawn(process.execPath, [join(root, 'scripts/separation-install-worker.mjs')], { cwd: root, detached: true, env: { ...process.env, SEPARATION_MODEL_DIR: modelDir }, stdio: 'ignore' })
        installer = child
        child.unref()
        child.on('error', error => { setup = { state: 'error', log: '', message: error.message }; installer = undefined })
        child.on('close', () => { installer = undefined })
        return json(202, setup)
      }
      if (url.pathname === '/api/separation/health' && req.method === 'GET') {
        if (!existsSync(python)) return json(200, { ready: false, message: '请先运行 npm run setup:separation 安装本地分离环境。' })
        const child = spawn(python, [script, '--check', '--models', modelDir])
        let data = ''
        const timer = setTimeout(() => child.kill(), 60000)
        child.stdout.on('data', c => { data += c }); child.stderr.resume()
        child.on('error', () => { clearTimeout(timer); json(200, { ready: false, message: '无法启动分离环境，请重新运行安装命令。' }) })
        child.on('close', () => { clearTimeout(timer); try { json(200, JSON.parse(data)) } catch { json(200, { ready: false, message: '环境检查失败，请重新安装分离环境。' }) } })
        return
      }
      if (url.pathname === '/api/separation/jobs' && req.method === 'POST') {
        if (installer || installation().state === 'running') return json(409, { error: '依赖正在安装，请稍后重试。' })
        if (active) return json(409, { error: '已有分离任务正在运行，请完成或停止后再试。' })
        if (!existsSync(python)) return json(503, { error: '分离环境未安装，请运行 npm run setup:separation。' })
        if (!existsSync(join(modelDir, 'ready.json'))) return json(503, { error: '请先点击一键安装环境与模型，完成全部安装后再处理。' })
        let params: ReturnType<typeof validateSeparationParams>
        try { params = validateSeparationParams(url) } catch (e) { return json(400, { error: String((e as Error).message) }) }
        if (!req.headers['content-type']?.startsWith('application/octet-stream')) return json(415, { error: '请上传原始媒体文件。' })
        if (Number(req.headers['content-length'] || 0) > MAX_BYTES) return json(413, { error: '文件超过 4 GB，请先截取需要的片段。' })
        const destination = url.searchParams.get('destination')
        if (destination && !destinations.has(destination)) return json(400, { error: '请重新选择导出目录。' })
        const id = randomUUID()
        const job: Job = { id, folder: join(destination ? destinations.get(destination)! : output, id), filename: (url.searchParams.get('filename') || '素材').slice(0, 200), ...params }
        active = job; jobs.set(id, job)
        let index: Record<string, unknown> = {}
        try { index = JSON.parse(readFileSync(jobIndexPath, 'utf8')) } catch { /* first task */ }
        index[id] = { id, folder: job.folder, filename: job.filename, model: job.model, start: job.start, duration: job.duration }
        mkdirSync(join(root, '.local'), { recursive: true })
        writeFileSync(jobIndexPath + '.tmp', JSON.stringify(index)); renameSync(jobIndexPath + '.tmp', jobIndexPath)
        try {
          await mkdir(job.folder, { recursive: true }); await mkdir(modelDir, { recursive: true })
          let size = 0
          const limiter = new Transform({ transform(chunk, _, cb) { size += chunk.length; cb(size > MAX_BYTES ? new Error('文件超过 4 GB。') : null, chunk) } })
          await pipeline(req, limiter, createWriteStream(join(job.folder, 'input'), { flags: 'wx' }))
          if (!size) throw new Error('文件为空。')
          const child = spawn(python, [script, '--job', job.folder, '--model', params.model, '--start', String(params.start), '--duration', String(params.duration), '--models', modelDir], { detached: true, env: { ...process.env, PYTHONUNBUFFERED: '1', PYTORCH_ENABLE_MPS_FALLBACK: '1' } })
          job.process = child
          const log = createWriteStream(join(job.folder, 'worker.log'))
          child.stdout.pipe(log, { end: false }); child.stderr.pipe(log, { end: false }); child.stdin.end()
          const timeout = setTimeout(() => { stop(job); job.message = '任务超过 2 小时，已停止。请缩短处理区间。' }, 2 * 60 * 60 * 1000)
          child.on('error', e => { job.state = 'error'; job.message = e.message })
          child.on('close', async (code, signal) => {
            clearTimeout(timeout); log.end(); if (active === job) active = undefined
            if (code !== 0 && !job.state) {
              try { const status = JSON.parse(await readFile(join(job.folder, 'status.json'), 'utf8')); if (status.state === 'error') job.message = status.message } catch { /* terminated before status */ }
              job.state = 'error'; job.message ||= `分离进程已退出（${signal || code}），任务未完成，请查看日志后重试。`
            }
            if (job.state) writeFileSync(join(job.folder, 'status.json'), JSON.stringify({state:job.state,message:job.message}))
            await unlink(join(job.folder, 'input')).catch(() => {})
          })
          return json(202, { id })
        } catch (e) { if (active === job) active = undefined; job.state = 'error'; job.message = String(e); await unlink(join(job.folder, 'input')).catch(() => {}); throw e }
      }
      const match = url.pathname.match(/^\/api\/separation\/jobs\/([a-f0-9-]+)(?:\/(file|cancel))?$/)
      if (!match) return json(404, { error: '接口不存在。' })
      let job = jobs.get(match[1])
      if (!job) {
        try { const saved = JSON.parse(readFileSync(jobIndexPath, 'utf8'))[match[1]]; if (saved) { job = saved; jobs.set(match[1], saved) } } catch { /* unknown task */ }
      }
      if (!job) return json(404, { error: '任务不可用，服务可能已重启。已有 WAV 仍在输出目录中。' })
      if (match[2] === 'cancel' && req.method === 'POST') { if (active === job) stop(job); return json(200, { ok: true }) }
      let state: { state: string; message: string; tracks?: { name: string; file: string; kind: string }[] } = { state: 'running', message: '正在准备分离任务…' }
      try { state = JSON.parse(await readFile(join(job.folder, 'status.json'), 'utf8')) } catch { /* worker starting */ }
      if (state.state === 'running' && !job.process) state = { state: 'error', message: '服务已重启，上次任务已中断，请重新选择素材后重试。' }
      if (job.state && state.state !== 'done') state = { state: job.state, message: job.message || '' }
      if (!match[2] && req.method === 'GET') {
        let log = ''
        try { const buffer = await readFile(join(job.folder, 'worker.log')); log = buffer.subarray(-6000).toString() } catch { /* not yet created */ }
        return json(200, { ...state, id: job.id, filename: job.filename, model: job.model, start: job.start, duration: job.duration, outputFolder: job.folder, log })
      }
      if (match[2] === 'file' && req.method === 'GET') {
        const name = url.searchParams.get('name') || ''
        if (state.state !== 'done' || name !== basename(name) || !state.tracks?.some(t => t.file === name)) return json(404, { error: '结果文件不存在。' })
        const path = join(job.folder, name), info = await stat(path)
        let start = 0, end = info.size - 1
        const range = req.headers.range
        if (range) {
          const r = range.match(/^bytes=(\d+)-(\d*)$/)
          if (!r) { res.writeHead(416, { 'Content-Range': `bytes */${info.size}` }); return res.end() }
          start = Number(r[1]); end = r[2] ? Math.min(Number(r[2]), end) : end
          if (start > end || start >= info.size) { res.writeHead(416, { 'Content-Range': `bytes */${info.size}` }); return res.end() }
        }
        res.writeHead(range ? 206 : 200, { 'Content-Type': 'audio/wav', 'Content-Length': end - start + 1, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-store', ...(range ? { 'Content-Range': `bytes ${start}-${end}/${info.size}` } : {}), ...(url.searchParams.has('download') ? { 'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(name)}` } : {}) })
        await pipeline(createReadStream(path, { start, end }), res).catch(() => {})
        return
      }
      json(405, { error: '请求方法不支持。' })
    } catch (e) { json(500, { error: (e as Error).message }) }
  }
  const cleanup = () => { if (active) stop(active) }
  return { name: 'local-audio-separation', configureServer(server) { server.middlewares.use(middleware); server.httpServer?.once('close', cleanup) }, configurePreviewServer(server) { server.middlewares.use(middleware); server.httpServer.once('close', cleanup) } }
}

import { existsSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin } from 'vite'
import voices from '../src/voices.json' with { type: 'json' }
const script = fileURLToPath(new URL('./edge_bridge.py', import.meta.url))
const localPython = fileURLToPath(new URL('../.local/edge-venv/bin/python', import.meta.url))
const python = process.env.EDGE_TTS_PYTHON || (existsSync(localPython) ? localPython : 'python3')

export function edgeSpeechPlugin(): Plugin {
  let active = 0
  const middleware = async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const path = req.url?.split('?')[0]
    if (path !== '/api/edge/health' && path !== '/api/edge/speech') return next()
    const fail = (code: number, message: string) => { if (!res.destroyed) { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: message })) } }
    // Same-origin only; never become an anonymous public speech proxy.
    const host = req.headers.host || ''
    if (!/^(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/.test(host)) return fail(403, '语音接口仅支持本机访问')
    if (req.headers.origin && req.headers.origin !== `http://${host}` && req.headers.origin !== `https://${host}`) return fail(403, '不允许跨站调用')
    const health = path.endsWith('/health')
    if (req.method !== (health ? 'GET' : 'POST')) return fail(405, '请求方法不支持')
    if (!health && !req.headers['content-type']?.startsWith('application/json')) return fail(415, '请使用 JSON 请求')
    if (active >= 2) return fail(429, '已有配音任务，请稍后重试')
    let payload = ''
    if (!health) {
      try {
        for await (const chunk of req) { payload += chunk; if (Buffer.byteLength(payload) > 40000) return fail(413, '文案过长') }
        const value = JSON.parse(payload)
        if (typeof value.text !== 'string' || !value.text.trim() || value.text.length > 5000 || !voices.some(v => v.id === value.voice) || !Number.isFinite(value.tempo) || value.tempo < .65 || value.tempo > 1.25) return fail(400, '文案、音色或语速无效')
      } catch { return fail(400, '请求内容无效') }
    }
    active++
    const child = spawn(python, [script, ...(health ? ['--check'] : [])], { stdio: ['pipe', 'pipe', 'pipe'] })
    const buffers: Buffer[] = []
    let length = 0, settled = false
    const timer = setTimeout(() => { child.kill(); finish(504, '在线配音超时，请稍后重试') }, 120000)
    function finish(code: number, message?: string) {
      if (settled) return
      settled = true; active--; clearTimeout(timer)
      if (res.destroyed) return
      if (code !== 200) return fail(code, message!)
      res.writeHead(200, { 'Content-Type': health ? 'application/json' : 'audio/mpeg', 'Cache-Control': 'no-store' })
      res.end(health ? JSON.stringify({ ready: true }) : Buffer.concat(buffers))
    }
    res.on('close', () => { if (!settled) { child.kill(); finish(499, '已取消') } })
    child.stdout.on('data', (data: Buffer) => { length += data.length; if (length > 30 * 1024 * 1024) { child.kill(); finish(502, '音频过大，请缩短文案') } else buffers.push(data) })
    child.stderr.resume()
    child.stdin.on('error', () => {})
    child.on('error', () => finish(503, '未找到 Python，请配置 EDGE_TTS_PYTHON'))
    child.on('close', code => finish(code === 0 && length > 0 ? 200 : 503, health ? '请安装 server/requirements.txt 中的 edge-tts 依赖' : '微软在线合成失败，请检查网络后重试'))
    child.stdin.end(payload)
  }
  return { name: 'local-edge-speech', configureServer(server) { server.middlewares.use(middleware) }, configurePreviewServer(server) { server.middlewares.use(middleware) } }
}

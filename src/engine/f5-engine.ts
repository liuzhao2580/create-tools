import type { BrowserVoiceEngine, EngineProgress, SupportInfo, VoiceOptions, VoiceResult } from '../engine-types'
import { SAMPLE_RATE } from './f5-audio'

const CACHE = 'creator-tools-f5-v1'
const details = {
  engineName: 'F5-TTS 音色克隆实验版',
  modelName: 'F5-TTS ONNX FP16',
  downloadLabel: '约 792 MB，首次下载后在本浏览器缓存',
  supportsReferenceAudio: true,
  supportsReferenceText: true,
  supportsTempo: true,
  maxTextChars: 5000,
}
type GpuNavigator = Navigator & { gpu?: { requestAdapter: (options?: { powerPreference: string }) => Promise<{ features: { has: (name: string) => boolean } } | null> } }
interface Pending { resolve: (data: { wav: ArrayBuffer; durationSeconds: number } | undefined) => void; reject: (error: Error) => void; progress: (data: EngineProgress) => void; removeAbort: () => void }

export class F5BrowserEngine implements BrowserVoiceEngine {
  private worker: Worker | null = null
  private pending = new Map<number, Pending>()
  private sequence = 0
  private ready = false

  async inspectSupport(): Promise<SupportInfo> {
    const gpu = (navigator as GpuNavigator).gpu
    if (!window.isSecureContext || !gpu) return { ...details, supported: false, webgpu: false, message: '此实验引擎需要支持 WebGPU 的桌面浏览器，并通过 HTTPS 或 localhost 打开。' }
    try {
      const adapter = await gpu.requestAdapter({ powerPreference: 'high-performance' })
      if (!adapter) return { ...details, supported: false, webgpu: false, message: '浏览器未获得可用显卡，请检查硬件加速设置。' }
      if (!adapter.features.has('shader-f16')) return { ...details, supported: false, webgpu: true, message: '当前显卡不支持所需的 FP16 计算，暂时无法运行这个音色克隆模型。' }
      return { ...details, supported: true, webgpu: true, message: '可以运行浏览器音色克隆；这是 F5 实验引擎，生成后请核对音色与发音。' }
    } catch { return { ...details, supported: false, webgpu: false, message: '无法初始化浏览器显卡，请检查硬件加速设置。' } }
  }

  private getWorker(): Worker {
    if (this.worker) return this.worker
    const worker = new Worker(new URL('./f5-worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = ({ data }: MessageEvent) => {
      const request = this.pending.get(data.id)
      if (!request) return
      if (data.type === 'progress') { request.progress(data.data); return }
      request.removeAbort(); this.pending.delete(data.id)
      if (data.type === 'error') request.reject(new Error(data.message))
      else request.resolve(data.data)
    }
    worker.onerror = () => this.stop(new Error('配音引擎意外退出，请关闭其他占用显存的页面后重新加载模型。'))
    this.worker = worker
    return worker
  }

  private stop(error: Error): void {
    this.worker?.terminate(); this.worker = null; this.ready = false
    for (const request of this.pending.values()) { request.removeAbort(); request.reject(error) }
    this.pending.clear()
  }

  private request(type: 'load' | 'generate', payload: Record<string, unknown>, signal: AbortSignal, progress: (data: EngineProgress) => void, transfer: Transferable[] = []): Promise<{ wav: ArrayBuffer; durationSeconds: number } | undefined> {
    if (signal.aborted) return Promise.reject(new DOMException('操作已取消', 'AbortError'))
    if (this.pending.size) return Promise.reject(new Error('已有任务正在运行，请稍候。'))
    const id = ++this.sequence
    const worker = this.getWorker()
    return new Promise((resolve, reject) => {
      const abort = () => this.stop(new DOMException('操作已取消', 'AbortError'))
      signal.addEventListener('abort', abort, { once: true })
      this.pending.set(id, { resolve, reject, progress, removeAbort: () => signal.removeEventListener('abort', abort) })
      worker.postMessage({ id, type, ...payload }, transfer)
    })
  }

  async loadModel({ signal, onProgress }: { signal: AbortSignal; onProgress: (data: EngineProgress) => void }): Promise<void> {
    if (this.ready) { onProgress({ stage: 'load', progress: 100, message: '音色克隆引擎已就绪' }); return }
    const support = await this.inspectSupport()
    if (!support.supported) throw new Error(support.message)
    await this.request('load', {}, signal, onProgress)
    this.ready = true
  }

  async generate(options: VoiceOptions): Promise<VoiceResult> {
    const reference = options.referenceAudio
    const referenceText = (options as VoiceOptions & { referenceText?: string }).referenceText?.trim()
    if (!reference) throw new Error('请选择一段 5–10 秒的参考音频。')
    if (!referenceText) throw new Error('请填写参考音频中实际说出的完整文字。')
    if (reference.size > 20 * 1024 * 1024) throw new Error('参考音频过大，请使用 5–10 秒的短录音。')
    if (!options.text.trim() || options.text.length > details.maxTextChars) throw new Error('请输入 1–5000 字的配音文案。')
    if (!Number.isFinite(options.tempo) || options.tempo < 0.65 || options.tempo > 1.25) throw new Error('语速应在 0.65–1.25 之间。')
    if (!Number.isFinite(options.pauseSeconds) || options.pauseSeconds < 0.2 || options.pauseSeconds > 1.2) throw new Error('段落停顿应在 0.2–1.2 秒之间。')
    if (options.signal.aborted) throw new DOMException('操作已取消', 'AbortError')
    const context = new OfflineAudioContext(1, 1, SAMPLE_RATE)
    let decoded: AudioBuffer
    try { decoded = await context.decodeAudioData(await reference.arrayBuffer()) } catch { throw new Error('无法读取参考录音，请使用有效的 WAV 音频文件。') }
    if (decoded.duration < 4.9 || decoded.duration > 10.1) throw new Error(`参考录音为 ${decoded.duration.toFixed(1)} 秒，请使用 5–10 秒完整、干净的短段，并填写对应原话。`)
    const mono = new Float32Array(decoded.length)
    for (let channel = 0; channel < decoded.numberOfChannels; channel++) {
      const samples = decoded.getChannelData(channel)
      for (let i = 0; i < samples.length; i++) mono[i] += samples[i] / decoded.numberOfChannels
    }
    await this.loadModel(options)
    const result = await this.request('generate', { reference: mono, referenceText, text: options.text, tempo: options.tempo, pauseSeconds: options.pauseSeconds }, options.signal, options.onProgress, [mono.buffer])
    if (!result) throw new Error('没有获得生成结果，请重试。')
    return { audio: new Blob([result.wav], { type: 'audio/wav' }), mimeType: 'audio/wav', durationSeconds: result.durationSeconds }
  }

  async unloadModel(): Promise<void> { this.stop(new DOMException('模型已卸载', 'AbortError')) }
  async clearModelCache(): Promise<void> { await this.unloadModel(); await caches.delete(CACHE) }
}

export const f5VoiceEngine = new F5BrowserEngine()

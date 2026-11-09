/// <reference lib="webworker" />
/**
 * F5 ONNX graph orchestration adapted from nsarang/voice-cloning-f5-tts,
 * Apache-2.0. Modified: Chinese syllable tokens, pinned weights, one WASM thread,
 * explicit resource disposal, progress, reference validation and audio assembly.
 * See F5-NOTICE.md. This is an experimental model, not the original Qwen engine.
 */
import * as ort from 'onnxruntime-web/webgpu'
import { downloadRanges } from './download'
import { tokenize, splitText } from './f5-text'
import { toHalf, fromHalf, processAudio, joinAudio, encodeWav, SAMPLE_RATE } from './f5-audio'
import type { EngineProgress } from '../engine-types'

const scope = self as unknown as DedicatedWorkerGlobalScope
const CACHE = 'creator-tools-f5-v1'
const REVISION = '2e7e47e103a565c85dcd32141b6b11eeeb57eee6'
const ROOT = `https://huggingface.co/nsarang/F5-TTS-ONNX/resolve/${REVISION}/`
const FILES = [
  { key: 'encoder', name: 'onnx/encoder_fp32.onnx', bytes: 68549853 },
  { key: 'transformer', name: 'onnx/transformer_fp16.onnx', bytes: 661145803 },
  { key: 'decoder', name: 'onnx/decoder_fp32.onnx', bytes: 62550703 },
] as const
const TOTAL = FILES.reduce((n, file) => n + file.bytes, 13800)
const sessions = new Map<string, ort.InferenceSession>()
let vocabulary: Map<string, number> | null = null
let activeId = 0
const report = (stage: EngineProgress['stage'], progress: number | null, message: string) => scope.postMessage({ id: activeId, type: 'progress', data: { stage, progress, message } })

async function download(name: string, completed: number): Promise<ArrayBuffer> {
  report('download', Math.min(99, Math.round(completed / TOTAL * 100)), `正在检查模型文件：${name}`)
  const url = ROOT + name
  let cache: Cache | undefined
  try { cache = await caches.open(CACHE) } catch { /* caching may be unavailable in private browsing */ }
  const saved = await cache?.match(url)
  if (saved) { report('download', Math.round(completed / TOTAL * 100), `读取已缓存的 ${name}`); return saved.arrayBuffer() }
  const expected = FILES.find((file) => file.name === name)?.bytes
  if (expected) {
    let previous = 0
    const buffer = await downloadRanges(url, expected, (loaded) => {
      if (Date.now() - previous > 200) {
        report('download', Math.min(99, Math.round((completed + loaded) / TOTAL * 100)), `下载模型：${Math.round((completed + loaded) / 1000000)} / 792 MB`)
        previous = Date.now()
      }
    }, cache)
    try { await cache?.put(url, new Response(buffer, { headers: { 'Content-Type': 'application/octet-stream' } })) } catch { /* cache is optional */ }
    if (cache && await cache.match(url)) {
      const keys = await cache.keys(); await Promise.all(keys.filter((key) => key.url.startsWith(url + '?part=')).map((key) => cache.delete(key)))
    }
    return buffer
  }
  const response = await fetch(url, { credentials: 'omit' })
  if (!response.ok) throw new Error(`模型下载失败（HTTP ${response.status}），请检查网络后重试。`)
  if (!response.body) throw new Error('浏览器未能读取模型文件。')
  const chunks: Uint8Array[] = []
  const reader = response.body.getReader()
  let downloaded = 0, previous = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value); downloaded += value.length
    if (Date.now() - previous > 200) {
      report('download', Math.min(99, Math.round((completed + downloaded) / TOTAL * 100)), `下载模型：${Math.round((completed + downloaded) / 1000000)} / 792 MB`)
      previous = Date.now()
    }
  }
  const bytes = new Uint8Array(downloaded)
  let offset = 0
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length }
  chunks.length = 0
  try { await cache?.put(url, new Response(bytes, { headers: { 'Content-Type': 'application/octet-stream' } })) } catch { /* quota errors must not block generation */ }
  return bytes.buffer
}

async function load(): Promise<void> {
  if (sessions.size === 3 && vocabulary) { report('load', 100, '音色克隆引擎已就绪'); return }
  ort.env.wasm.numThreads = 1
  ort.env.wasm.proxy = false
  let completed = 0
  for (let index = 0; index < FILES.length; index++) {
    const file = FILES[index]
    if (!sessions.has(file.key)) {
      const model = await download(file.name, completed)
      report('load', null, `初始化模型 ${index + 1} / 3，首次运行可能需要一些时间`)
      sessions.set(file.key, await ort.InferenceSession.create(model, { executionProviders: ['webgpu'], graphOptimizationLevel: 'all' }))
    }
    completed += file.bytes
  }
  const text = new TextDecoder().decode(await download('vocab.txt', completed))
  vocabulary = new Map(text.split(/\r?\n/).map((token, index) => [token, index]))
  report('load', 100, '音色克隆引擎已就绪')
}

function referenceInt16(reference: Float32Array): Int16Array {
  const sorted = Float32Array.from(reference, Math.abs).sort()
  const peak = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.999))]
  if (!Number.isFinite(peak) || peak < 0.003) throw new Error('参考音频过轻或没有清晰人声，请换一段干净录音。')
  const scale = 32767 / peak
  return Int16Array.from(reference, (x) => Math.max(-32768, Math.min(32767, Math.round(x * scale))))
}

async function synthesize(reference: Float32Array, refText: string, text: string, speed: number, chunkIndex: number, count: number): Promise<Float32Array> {
  const encoder = sessions.get('encoder')!, transformer = sessions.get('transformer')!, decoder = sessions.get('decoder')!
  const own = new Set<ort.Tensor>()
  const keep = (tensor: ort.Tensor) => { own.add(tensor); return tensor }
  const release = (tensor: ort.Tensor) => { tensor.dispose(); own.delete(tensor) }
  try {
    const encoded = new TextEncoder()
    const referenceFrames = Math.trunc(reference.length / 256)
    const generatedFrames = Math.trunc(referenceFrames * encoded.encode(text).length / (encoded.encode(refText).length + 1) / speed)
    const duration = referenceFrames + generatedFrames
    if (generatedFrames < 12 || duration > 2700) throw new Error('本段预计时长不合适，请缩短文案，或核对参考文字是否完整。')
    const tokens = tokenize(refText + ' ' + text, vocabulary!)
    const inputs = [
      keep(new ort.Tensor('int16', referenceInt16(reference), [1, 1, reference.length])),
      keep(new ort.Tensor('int32', tokens, [1, tokens.length])),
      keep(new ort.Tensor('int64', BigInt64Array.from([BigInt(duration)]), [1])),
    ]
    const encodedResult = await encoder.run(Object.fromEntries(inputs.map((t, i) => [encoder.inputNames[i], t])))
    inputs.forEach(release)
    const values = encoder.outputNames.map((name) => keep(encodedResult[name]))
    const halfValues = values.slice(0, 7).map((value) => {
      if (value.type !== 'float32') throw new Error('模型张量格式与当前引擎不匹配。')
      const half = keep(new ort.Tensor('float16', toHalf(value.data as Float32Array), value.dims))
      release(value); return half
    })
    const refSignalLength = values[7]
    let noise = halfValues[0]
    let timeStep = keep(new ort.Tensor('int32', Int32Array.from([0]), [1]))
    // The exported graph uses a fixed 32-point schedule (31 integration updates).
    for (let step = 0; step < 31; step++) {
      const feeds = [noise, ...halfValues.slice(1), timeStep]
      const result = await transformer.run(Object.fromEntries(feeds.map((t, i) => [transformer.inputNames[i], t])))
      const nextNoise = keep(result[transformer.outputNames[0]])
      const nextTime = keep(result[transformer.outputNames[1]])
      release(noise); release(timeStep); noise = nextNoise; timeStep = nextTime
      report('generate', Math.floor((chunkIndex + (step + 1) / 33) / count * 100), `正在生成第 ${chunkIndex + 1} / ${count} 段（${step + 1} / 31）`)
    }
    const floatNoise = keep(new ort.Tensor('float32', fromHalf(noise.data as Uint16Array), noise.dims))
    const output = await decoder.run({ [decoder.inputNames[0]]: floatNoise, [decoder.inputNames[1]]: refSignalLength })
    const signal = keep(output[decoder.outputNames[0]])
    return processAudio(Float32Array.from(signal.data as Int16Array, (value) => value / 32767))
  } finally { for (const tensor of own) tensor.dispose() }
}

interface Request { id: number; type: 'load' | 'generate'; reference?: Float32Array; referenceText?: string; text?: string; tempo?: number; pauseSeconds?: number }
scope.onmessage = async ({ data }: MessageEvent<Request>) => {
  activeId = data.id
  try {
    if (data.type === 'load') { await load(); scope.postMessage({ id: data.id, type: 'done' }); return }
    if (!vocabulary || sessions.size !== 3) throw new Error('请先加载音色克隆模型。')
    const reference = data.reference!, refText = data.referenceText!.trim(), speed = data.tempo!
    const refBytes = new TextEncoder().encode(refText).length
    const referenceSeconds = reference.length / SAMPLE_RATE
    const maxBytes = Math.max(24, Math.floor(14 * speed * refBytes / referenceSeconds))
    const chunks = splitText(data.text!, maxBytes)
    const parts: Float32Array[] = []
    for (let i = 0; i < chunks.length; i++) parts.push(await synthesize(reference, refText, chunks[i].text, speed, i, chunks.length))
    const audio = joinAudio(parts, chunks.map((c) => c.paragraphEnd), data.pauseSeconds!)
    const wav = encodeWav(audio)
    report('generate', 100, '配音已生成，请试听检查读音与音色')
    scope.postMessage({ id: data.id, type: 'done', data: { wav, durationSeconds: audio.length / SAMPLE_RATE } }, [wav])
  } catch (error) {
    const raw = error instanceof Error ? error.message : String(error)
    const message = /[\u3400-\u9fff]/.test(raw) ? raw : '浏览器模型运行失败。请确认显卡支持 WebGPU 和 FP16，关闭占用显存的页面后重试。'
    console.error('F5 engine error', error)
    scope.postMessage({ id: data.id, type: 'error', message })
  }
}

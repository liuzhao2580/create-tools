import type { VoiceOptions, VoiceResult } from './engine-types'
import voices from './voices.json'
export { voices }

export async function generatePresetVoice(options: VoiceOptions, voice: string): Promise<VoiceResult> {
  if (!voices.some(item => item.id === voice)) throw new Error('请选择有效音色。')
  const paragraphs = options.text.trim().split(/\n\s*\n/).filter(Boolean)
  const context = new OfflineAudioContext(1, 1, 24000)
  const parts: Float32Array[] = []
  for (let index = 0; index < paragraphs.length; index++) {
    options.signal.throwIfAborted()
    options.onProgress({ stage: 'generate', progress: paragraphs.length === 1 ? null : Math.round(index / paragraphs.length * 100), message: `微软在线合成，第 ${index + 1} / ${paragraphs.length} 段…` })
    const response = await fetch(new URL('api/edge/speech', document.baseURI), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: paragraphs[index], voice, tempo: options.tempo }), signal: options.signal })
    if (!response.ok || !response.headers.get('content-type')?.includes('audio/')) {
      const error = await response.json().catch(() => null)
      throw new Error(error?.error || '在线配音服务未启动。请使用 npm run dev 或 npm run preview；纯静态部署不提供微软合成接口。')
    }
    const decoded = await context.decodeAudioData(await response.arrayBuffer())
    options.signal.throwIfAborted()
    parts.push(Float32Array.from(decoded.getChannelData(0)))
  }
  const pause = Math.round(options.pauseSeconds * 24000)
  const samples = new Float32Array(parts.reduce((n, part) => n + part.length, 0) + Math.max(0, parts.length - 1) * pause)
  let offset = 0
  parts.forEach((part, index) => { samples.set(part, offset); offset += part.length + (index < parts.length - 1 ? pause : 0) })
  const { encodeWav } = await import('./engine/f5-audio')
  return { audio: new Blob([encodeWav(samples)], { type: 'audio/wav' }), durationSeconds: samples.length / 24000, mimeType: 'audio/wav' }
}

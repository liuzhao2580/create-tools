import { afterEach, describe, expect, it, vi } from 'vitest'
import { generatePresetVoice, voices } from '../../src/edge-voice'
const options = () => ({ text: '第一段。\n\n第二段。', tempo: .88, pauseSeconds: .6, signal: new AbortController().signal, onProgress: vi.fn() })
afterEach(() => vi.unstubAllGlobals())
function browser() {
  vi.stubGlobal('document', { baseURI: 'http://localhost:5173/' })
  vi.stubGlobal('OfflineAudioContext', class { async decodeAudioData() { return { getChannelData: () => new Float32Array(240).fill(.1) } } })
}
describe('微软预设音色', () => {
  it('无需参考录音，按段生成并保留设定停顿，返回可下载 WAV', async () => {
    browser()
    const fetch = vi.fn(async () => new Response(new Uint8Array([1]), { headers: { 'Content-Type': 'audio/mpeg' } }))
    vi.stubGlobal('fetch', fetch)
    const result = await generatePresetVoice(options(), voices[0].id)
    expect(fetch).toHaveBeenCalledTimes(2)
    const request = JSON.parse((fetch.mock.calls as unknown as [URL, RequestInit][])[0][1].body as string)
    expect(request).toEqual({ text: '第一段。', voice: voices[0].id, tempo: .88 })
    expect(result.mimeType).toBe('audio/wav')
    expect(result.durationSeconds).toBeCloseTo(.62)
    expect(new TextDecoder().decode((await result.audio.arrayBuffer()).slice(0, 4))).toBe('RIFF')
  })
  it('静态托管返回 HTML 时明确说明需要服务，不把页面当音频', async () => {
    browser()
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html/>', { headers: { 'Content-Type': 'text/html' } })))
    await expect(generatePresetVoice(options(), voices[0].id)).rejects.toThrow('纯静态部署')
  })
  it('无效音色和已取消任务不会发出合成请求', async () => {
    browser()
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch)
    await expect(generatePresetVoice(options(), 'invalid')).rejects.toThrow('有效音色')
    const abort = new AbortController(); abort.abort()
    await expect(generatePresetVoice({ ...options(), signal: abort.signal }, voices[0].id)).rejects.toThrow()
    expect(fetch).not.toHaveBeenCalled()
  })
  it('服务失败保留真实错误信息', async () => {
    browser()
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: '微软在线合成失败' }), { status: 503, headers: { 'Content-Type': 'application/json' } })))
    await expect(generatePresetVoice(options(), voices[0].id)).rejects.toThrow('微软在线合成失败')
  })
})

export interface SubtitleCue { index: number; start: number; end: number; text: string }
export interface CueResult extends SubtitleCue { seconds: number; overflow: number; file: string }
export interface SubtitleJob { id: string; state: 'running' | 'complete' | 'needs-edit' | 'error' | 'cancelled'; message: string; completed: number; total: number; cues: SubtitleCue[]; results: CueResult[]; filename: string }

export function parseSrt(source: string): SubtitleCue[] {
  if (source.length > 200000) throw new Error('字幕文件过大，请控制在 200 KB 以内。')
  const blocks = source.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').trim().split(/\n[ \t]*\n/)
  const cues = blocks.map((block, i) => {
    const lines = block.trim().split('\n')
    if (/^\d+$/.test(lines[0])) lines.shift()
    const match = /^(\d{2,}):([0-5]\d):([0-5]\d)[,.](\d{3})\s*-->\s*(\d{2,}):([0-5]\d):([0-5]\d)[,.](\d{3})$/.exec(lines.shift()?.trim() || '')
    if (!match) throw new Error(`第 ${i + 1} 条时间码无效，请上传 UTF-8 编码的 SRT 字幕。`)
    const seconds = (offset: number) => Number(match[offset]) * 3600 + Number(match[offset + 1]) * 60 + Number(match[offset + 2]) + Number(match[offset + 3]) / 1000
    const start = seconds(1), end = seconds(5)
    const text = lines.join(' ').replace(/<[^>]*>/g, '').trim()
    if (!text || !/[\p{L}\p{N}]/u.test(text)) throw new Error(`第 ${i + 1} 条没有可朗读文字。`)
    if (text.includes('\uFFFD')) throw new Error('字幕编码有误，请另存为 UTF-8。')
    if (text.length > 110) throw new Error(`第 ${i + 1} 条超过 110 字，请按完整意思拆分并分配时间。`)
    if (end <= start || end > 7200) throw new Error(`第 ${i + 1} 条时间范围无效（结束须晚于开始，最多 2 小时）。`)
    return { index: i + 1, start, end, text }
  })
  if (cues.length > 1000) throw new Error('一次最多处理 1000 条字幕。')
  for (let i = 1; i < cues.length; i++) {
    if (cues[i].start < cues[i - 1].end) throw new Error(`第 ${i + 1} 条与上一条重叠或顺序错误，请先调整时间码。`)
  }
  return cues
}
export function timecode(seconds: number) {
  const ms = Math.round(seconds * 1000)
  return `${String(Math.floor(ms / 3600000)).padStart(2, '0')}:${String(Math.floor(ms / 60000) % 60).padStart(2, '0')}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')},${String(ms % 1000).padStart(3, '0')}`
}

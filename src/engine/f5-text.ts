import { pinyin } from 'pinyin-pro'

/** F5's vocabulary contains whole numbered Mandarin syllables, not Han characters. */
export function textTokens(text: string): string[] {
  const normalized = text.normalize('NFKC').replace(/[“”]/g, '\"').replace(/[‘’]/g, "'").replace(/;/g, ',')
  const entries = pinyin(normalized, { type: 'all', toneType: 'num', v: true, toneSandhi: true })
  return entries.flatMap((entry) => entry.isZh
    ? [' ', entry.result.replace(/[05]$/, '')]
    : Array.from(entry.origin))
}

export function tokenize(text: string, vocabulary: Map<string, number>): Int32Array {
  const tokens = textTokens(text)
  const unsupported = [...new Set(tokens.filter((token) => !vocabulary.has(token)))]
  if (unsupported.length) throw new Error(`文案含暂不支持的字符或读音：${unsupported.slice(0, 5).join('、')}`)
  return Int32Array.from(tokens.map((token) => vocabulary.get(token)!))
}

export interface SpeechChunk { text: string; paragraphEnd: boolean }
const bytes = (text: string) => new TextEncoder().encode(text).length

/** Split only at punctuation, retaining every character and every explicit paragraph. */
export function splitText(text: string, maxBytes: number): SpeechChunk[] {
  const chunks: SpeechChunk[] = []
  for (const paragraph of text.trim().split(/\n\s*\n/)) {
    const normalized = paragraph.replace(/\s*\n\s*/g, '').trim()
    if (!normalized) continue
    const sentences = normalized.match(/[^。！？!?；;]+[。！？!?；;]*/gu) ?? []
    let buffer = ''
    const flush = () => { if (buffer) { chunks.push({ text: buffer, paragraphEnd: false }); buffer = '' } }
    for (const sentence of sentences) {
      const pieces = bytes(sentence) <= maxBytes ? [sentence] : sentence.match(/[^，,：:]+[，,：:]*/gu) ?? []
      for (const piece of pieces) {
        if (bytes(piece) > maxBytes) throw new Error('有一段话过长，请在完整意思结束处添加句号或逗号后再生成。')
        if (buffer && bytes(buffer + piece) > maxBytes) flush()
        buffer += piece
      }
    }
    flush()
    if (chunks.length) chunks[chunks.length - 1].paragraphEnd = true
  }
  if (!chunks.length) throw new Error('请先输入需要朗读的文案。')
  return chunks
}

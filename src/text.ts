export const DEFAULT_TEMPO = 0.88
export const DEFAULT_PAUSE = 0.6
export const MAX_TEXT_CHARS = 5000

export function textStats(text: string, tempo = DEFAULT_TEMPO, pauseSeconds = DEFAULT_PAUSE) {
  const characters = Array.from(text.replace(/\s/g, '')).length
  const paragraphs = text.split(/\n\s*\n/).filter((part) => part.trim()).length
  const spokenCharacters = Array.from(text.replace(/[\s\p{P}\p{S}]/gu, '')).length
  const estimatedSeconds = spokenCharacters / (5.6 * (tempo / DEFAULT_TEMPO)) + Math.max(0, paragraphs - 1) * pauseSeconds
  return { characters, paragraphs, estimatedSeconds }
}

export function validateText(text: string, maxChars = MAX_TEXT_CHARS): string | null {
  if (!text.trim()) return '先写下需要朗读的文案。'
  if (Array.from(text.trim()).length > maxChars) return `文案超过 ${maxChars.toLocaleString()} 字，请分批生成。`
  const longest = text.split(/[。！？!?；;\n]/).find((sentence) => Array.from(sentence.trim()).length > 110)
  if (longest) return '有一句文案超过 110 字，请用句号分成完整的短句，让配音更自然。'
  return null
}

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:00'
  const rounded = Math.round(seconds)
  return `${Math.floor(rounded / 60)}:${String(rounded % 60).padStart(2, '0')}`
}

export async function readTextFile(file: File): Promise<string> {
  if (!file.name.toLowerCase().endsWith('.txt')) throw new Error('请选择 .txt 格式的文案文件。')
  if (file.size > 1024 * 1024) throw new Error('TXT 文件过大，请选择小于 1 MB 的文案。')
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer()).replace(/^\uFEFF/, '')
  } catch {
    throw new Error('这个文件不是 UTF-8 编码，请另存为 UTF-8 文本后再导入。')
  }
}

export function downloadBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 10000)
}

export function errorMessage(error: unknown): string {
  if (error instanceof DOMException && error.name === 'AbortError') return '操作已取消。'
  return error instanceof Error ? error.message : '发生了意外错误，请重试。'
}

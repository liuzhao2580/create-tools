export const SAMPLE_RATE = 24000

export function encodeWav(samples: Float32Array): ArrayBuffer {
  const buffer = new ArrayBuffer(44 + samples.length * 2)
  const view = new DataView(buffer)
  const tag = (offset: number, text: string) => [...text].forEach((char, i) => view.setUint8(offset + i, char.charCodeAt(0)))
  tag(0, 'RIFF'); view.setUint32(4, buffer.byteLength - 8, true); tag(8, 'WAVE'); tag(12, 'fmt ')
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true)
  view.setUint32(24, SAMPLE_RATE, true); view.setUint32(28, SAMPLE_RATE * 2, true)
  view.setUint16(32, 2, true); view.setUint16(34, 16, true); tag(36, 'data'); view.setUint32(40, samples.length * 2, true)
  samples.forEach((sample, i) => { const value = Math.max(-1, Math.min(1, sample)); view.setInt16(44 + i * 2, Math.round(value * (value < 0 ? 32768 : 32767)), true) })
  return buffer
}

export function processAudio(input: Float32Array): Float32Array {
  if (!input.length || input.some((n) => !Number.isFinite(n))) throw new Error('生成音频异常，请重试较短的文案。')
  let first = input.findIndex((n) => Math.abs(n) > 0.002)
  let last = input.length - 1
  while (last >= 0 && Math.abs(input[last]) <= 0.002) last--
  if (first < 0 || last <= first) throw new Error('模型没有生成可用人声，请检查参考音频与文字是否一致。')
  first = Math.max(0, first - Math.round(0.08 * SAMPLE_RATE))
  last = Math.min(input.length, last + Math.round(0.12 * SAMPLE_RATE))
  const output = input.slice(first, last)
  let sum = 0, peak = 0
  for (const sample of output) { sum += sample * sample; peak = Math.max(peak, Math.abs(sample)) }
  const gain = Math.min(0.089 / Math.sqrt(sum / output.length), 0.9 / peak)
  const edge = Math.min(120, Math.floor(output.length / 4))
  for (let i = 0; i < output.length; i++) output[i] *= gain
  for (let i = 0; i < edge; i++) { output[i] *= i / edge; output[output.length - i - 1] *= i / edge }
  return output
}

export function joinAudio(parts: Float32Array[], paragraphEnds: boolean[], pauseSeconds: number): Float32Array {
  const gaps = parts.map((part, i) => {
    if (!paragraphEnds[i] || i === parts.length - 1) return 0
    let tail = 0, head = 0
    for (let j = part.length - 1; j >= 0 && Math.abs(part[j]) < 0.002; j--) tail++
    const next = parts[i + 1]
    while (head < next.length && Math.abs(next[head]) < 0.002) head++
    return Math.max(0, Math.round(pauseSeconds * SAMPLE_RATE) - head - tail)
  })
  const lead = Math.round(0.18 * SAMPLE_RATE), tail = Math.round(0.24 * SAMPLE_RATE)
  const output = new Float32Array(lead + tail + parts.reduce((n, p, i) => n + p.length + gaps[i], 0))
  let cursor = lead
  parts.forEach((part, i) => { output.set(part, cursor); cursor += part.length + gaps[i] })
  return output
}

export function toHalf(float: Float32Array): Uint16Array {
  const out = new Uint16Array(float.length)
  const f = new Float32Array(1), u = new Uint32Array(f.buffer)
  for (let i = 0; i < float.length; i++) {
    f[0] = float[i]
    const bits = u[0], sign = (bits >>> 16) & 0x8000
    let exponent = ((bits >>> 23) & 0xff) - 127 + 15
    let mantissa = bits & 0x7fffff
    if (exponent <= 0) {
      if (exponent < -10) { out[i] = sign; continue }
      mantissa = (mantissa | 0x800000) >>> (1 - exponent)
      out[i] = sign | ((mantissa + 0x1000) >>> 13)
    } else if (exponent >= 31) out[i] = sign | 0x7c00 | (((bits >>> 23) & 0xff) === 255 && mantissa ? 0x200 : 0)
    else {
      mantissa += 0x1000
      if (mantissa & 0x800000) { mantissa = 0; exponent++ }
      out[i] = sign | (Math.min(exponent, 31) << 10) | (mantissa >>> 13)
    }
  }
  return out
}

export function fromHalf(half: Uint16Array): Float32Array {
  return Float32Array.from(half, (bits) => {
    const sign = bits & 0x8000 ? -1 : 1, exponent = (bits >>> 10) & 31, mantissa = bits & 1023
    return exponent === 0 ? sign * 2 ** -14 * (mantissa / 1024)
      : exponent === 31 ? (mantissa ? NaN : sign * Infinity)
        : sign * 2 ** (exponent - 15) * (1 + mantissa / 1024)
  })
}

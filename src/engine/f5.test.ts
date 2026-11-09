import { describe, expect, it } from 'vitest'
import { textTokens, tokenize, splitText } from './f5-text'
import { encodeWav, fromHalf, joinAudio, processAudio, SAMPLE_RATE, toHalf } from './f5-audio'

describe('F5 Mandarin input', () => {
  it('uses complete vocabulary syllables and handles dispatch-order polyphone', () => {
    expect(textTokens('调令')).toEqual([' ', 'diao4', ' ', 'ling4'])
    expect(textTokens('女的')).toEqual([' ', 'nv3', ' ', 'de'])
  })
  it('retains mixed English text and rejects out-of-vocabulary input', () => {
    const tokens = textTokens('你好 React！')
    expect(tokens.join('')).toContain('React')
    expect(tokens).toContain('ni3')
    const vocabulary = new Map([[' ', 0], ['ni3', 1], ['hao3', 2]])
    expect([...tokenize('你好', vocabulary)]).toEqual([0, 1, 0, 2])
    expect(() => tokenize('你好🙂', vocabulary)).toThrow('暂不支持')
  })
  it('preserves text at sentence boundaries and marks only explicit paragraph ends', () => {
    const source = '第一句话。第二句话。\n\n第三句话。'
    const chunks = splitText(source, 18)
    expect(chunks.map((chunk) => chunk.text).join('')).toBe(source.replace(/\n/g, ''))
    expect(chunks.map((chunk) => chunk.paragraphEnd)).toEqual([false, true, true])
    expect(() => splitText('没有标点的一整段长话', 10)).toThrow('过长')
  })
})

describe('F5 generated audio', () => {
  it('round-trips representable half precision and handles overflow', () => {
    const values = Float32Array.from([0, -0, 1, -2, 0.5, 65504, Infinity, -Infinity])
    expect([...fromHalf(toHalf(values))]).toEqual([...values])
    expect(fromHalf(toHalf(Float32Array.from([70000])))[0]).toBe(Infinity)
  })
  it('rejects invalid or silent audio without silently inventing a result', () => {
    expect(() => processAudio(new Float32Array(24000))).toThrow('没有生成')
    expect(() => processAudio(Float32Array.from([0, NaN, 1]))).toThrow('异常')
  })
  it('adds explicit paragraph pauses without imposing a pause on every chunk', () => {
    const part = new Float32Array(2400).fill(0.1)
    const continuous = joinAudio([part, part], [false, true], 0.6)
    const separated = joinAudio([part, part], [true, true], 0.6)
    expect(separated.length - continuous.length).toBe(Math.round(0.6 * SAMPLE_RATE))
    const wav = new DataView(encodeWav(continuous))
    expect(wav.getUint32(24, true)).toBe(24000)
    expect(wav.getUint16(22, true)).toBe(1)
    expect(wav.getUint32(40, true)).toBe(continuous.length * 2)
  })
})

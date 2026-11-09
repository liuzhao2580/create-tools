import { describe, expect, it } from 'vitest'
import { parseSrt, timecode } from '../../src/subtitles'
const line = (start = '00:00:05,000', end = '00:00:08,500', text = '第一句。') => `1\n${start} --> ${end}\n${text}`
describe('SRT timing', () => {
  it('preserves leading silence, gaps, BOM, CRLF and multiline text', () => {
    const cues = parseSrt('\uFEFF' + (line(undefined, undefined, '<i>第一句。</i>\n第二行。') + '\n\n' + line('00:00:12.000', '00:00:16.000', '下一句。')).replace(/\n/g, '\r\n'))
    expect(cues).toEqual([{ index: 1, start: 5, end: 8.5, text: '第一句。 第二行。' }, { index: 2, start: 12, end: 16, text: '下一句。' }])
  })
  it.each(['', line('00:60:00,000'), line('00:00:09,000'), line(undefined, undefined, ''), line(undefined, undefined, '字'.repeat(111)), line('02:00:00,000', '02:00:01,000')])('rejects invalid or unbounded input', value => expect(() => parseSrt(value)).toThrow())
  it('rejects overlapping subtitles rather than moving them', () => expect(() => parseSrt(line() + '\n\n' + line('00:00:08,000', '00:00:09,000'))).toThrow('重叠'))
  it('allows adjacent cues and formats exact milliseconds', () => {
    expect(parseSrt(line() + '\n\n' + line('00:00:08,500', '00:00:09,000'))).toHaveLength(2)
    expect(timecode(3600.125)).toBe('01:00:00,125')
  })
})

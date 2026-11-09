import { describe, expect, it } from 'vitest'
import { validateText, readTextFile, textStats, formatDuration } from '../../src/text'

describe('文案输入边界', () => {
  it('阻止空白、超长文案以及未断句的长句', () => {
    expect(validateText('   \n')).toBeTruthy()
    expect(validateText('字'.repeat(5001))).toContain('5,000')
    expect(validateText('字'.repeat(111))).toContain('110')
    expect(validateText('你好。\n\n这是完整的下一段。')).toBeNull()
  })
  it('读取 UTF-8 BOM，拒绝损坏编码和错误扩展名', async () => {
    expect(await readTextFile(new File(['\uFEFF你好，配音。'], '文案.txt'))).toBe('你好，配音。')
    await expect(readTextFile(new File([new Uint8Array([0xff, 0xfe, 0x81])], '坏文件.txt'))).rejects.toThrow('UTF-8')
    await expect(readTextFile(new File(['内容'], '文案.pdf'))).rejects.toThrow('.txt')
  })
  it('估算只随正文、语速和实际分段变化', () => {
    const a = textStats('第一句话。\n\n第二句话。')
    const b = textStats('第一句话。第二句话。')
    expect(a.paragraphs).toBe(2)
    expect(a.estimatedSeconds - b.estimatedSeconds).toBeCloseTo(.6)
    expect(formatDuration(75)).toBe('1:15')
  })
})

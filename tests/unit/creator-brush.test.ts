import { describe,expect,it } from 'vitest'
import { creatorBrushCharacters,creatorBrushCount,missingCreatorBrushCharacters } from '../../src/shared/fonts/creator-brush'

describe('custom brush coverage', () => {
  it('supports the approved example and newly made common words', () => {
    expect(missingCreatorBrushCharacters('第十四集 人物故事\n信仰选择 命运真相\n我的生活 文字创作 定制毛笔体')).toEqual([])
    expect(new Set(creatorBrushCharacters).size).toBe(creatorBrushCount)
  })
  it('reports uncustimized Chinese, digits and punctuation instead of treating fallback as coverage', () => {
    expect(missingCreatorBrushCharacters('我的生活，龘龘14😀')).toEqual(['，','龘','1','4','😀'])
  })
  it('ignores spaces and line breaks while preserving distinct missing characters', () => {
    expect(missingCreatorBrushCharacters(' \n\t\u3000')).toEqual([])
    expect(missingCreatorBrushCharacters('A A B\nB')).toEqual(['A','B'])
  })
})

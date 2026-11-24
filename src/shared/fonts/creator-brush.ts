import coverage from './creator-brush-coverage.json'

export const creatorBrushFamily = 'Creator Brush'
export const creatorBrushCount = coverage.count
export const creatorBrushCharacters = coverage.characters
const supported = new Set(creatorBrushCharacters + coverage.punctuation)

/** Don't treat normal font fallback as a completed custom glyph. */
export function missingCreatorBrushCharacters(text: string): string[] {
  return [...new Set([...text].filter(char => !/\s/u.test(char) && !supported.has(char)))]
}

import { describe, expect, it } from 'vitest'
import { validateSeparationParams } from '../../server/separation-plugin'
const url = (query: string) => new URL(`http://localhost/api/separation/jobs?${query}`)
describe('separation job validation', () => {
  it('accepts fractional source offset and bounded duration', () => {
    expect(validateSeparationParams(url('model=melband&start=10.25&duration=30'))).toEqual({ model: 'melband', start: 10.25, duration: 30 })
  })
  it('processes the entire file from the beginning',()=>{expect(validateSeparationParams(url('model=melband&start=50&duration=0'))).toEqual({model:'melband',start:0,duration:0})})
  it.each(['model=unknown&start=0&duration=30', 'model=melband&start=-1&duration=30', 'model=melband&start=NaN&duration=30', 'model=melband&start=0&duration=601', 'model=melband&start=0&duration=Infinity'])('rejects invalid workload %s', query => {
    expect(() => validateSeparationParams(url(query))).toThrow()
  })
})

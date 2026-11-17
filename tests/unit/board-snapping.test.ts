import {describe,it,expect} from 'vitest'
import {findSnaps} from '../../src/board-snapping'
describe('board alignment snapping',()=>{
 it('snaps the center with a zoom-independent screen tolerance',()=>{
  const t={left:456,top:200,width:100,height:100}
  expect(findSnaps(t,[],1000,800,1).x).toEqual({delta:-6,guide:500})
  expect(findSnaps({...t,left:439},[],1000,800,1).x).toBeNull()
  expect(findSnaps({...t,left:460},[],1000,800,.5).x).toEqual({delta:-10,guide:500})
 })
 it('matches object edges and centers independently',()=>{
  const target={left:203,top:406,width:60,height:80}
  const other={left:200,top:300,width:100,height:100}
  const result=findSnaps(target,[other],1200,800,1)
  expect(result.x).toEqual({delta:-3,guide:200})
  expect(result.y).toEqual({delta:-6,guide:400})
 })
 it('prioritizes canvas edges over nearby text when dragging a full-size image',()=>{
  const result=findSnaps({left:15,top:12,width:1800,height:766},[{left:16,top:14,width:300,height:100}],1800,766,.5)
  expect(result).toEqual({x:{delta:-15,guide:900},y:{delta:-12,guide:383}})
 })
 it('snaps to canvas boundaries and leaves distant axes alone',()=>{
  expect(findSnaps({left:3,top:137,width:80,height:50},[],1000,800,1)).toEqual({x:{delta:-3,guide:0},y:null})
 })
})

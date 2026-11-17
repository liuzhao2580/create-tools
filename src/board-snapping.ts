import type { Canvas } from 'fabric'

export type Bounds = { left:number; top:number; width:number; height:number }
export type AxisSnap = { delta:number; guide:number }
function nearest(anchors:number[], guides:number[], threshold:number):AxisSnap|null {
 let result:AxisSnap|null=null
 for(const guide of guides)for(const anchor of anchors){
  const delta=guide-anchor
  if(Math.abs(delta)<=threshold&&(!result||Math.abs(delta)<Math.abs(result.delta)))result={delta,guide}
 }
 return result
}
export function findSnaps(target:Bounds, others:Bounds[], width:number,height:number,zoom:number) {
 const threshold=10/Math.max(.01,zoom)
 const x:number[]=[],y:number[]=[]
 for(const b of others){x.push(b.left,b.left+b.width/2,b.left+b.width);y.push(b.top,b.top+b.height/2,b.top+b.height)}
 return {
  x:nearest([target.left+target.width/2,target.left,target.left+target.width],[width/2,0,width],threshold) || nearest([target.left+target.width/2,target.left,target.left+target.width],x,threshold),
  y:nearest([target.top+target.height/2,target.top,target.top+target.height],[height/2,0,height],threshold) || nearest([target.top+target.height/2,target.top,target.top+target.height],y,threshold),
 }
}

/** DOM guides never enter the exported image or the saved document. */
export function installSnapping(canvas:Canvas, size:()=>{width:number;height:number}, enabled:()=>boolean){
 const overlay=document.createElement('div')
 overlay.className='board-snap-guides'
 Object.assign(overlay.style,{position:'absolute',inset:'0',pointerEvents:'none',overflow:'hidden',zIndex:'3'})
 canvas.upperCanvasEl.parentElement!.appendChild(overlay)
 const clear=()=>overlay.replaceChildren()
 const offMove=canvas.on('object:moving',({target,e})=>{
  clear()
  if(!enabled()||e?.altKey)return
  target.setCoords()
  const dimensions=size()
  const active=canvas.getActiveObjects()
  const others=canvas.getObjects().filter(o=>o!==target&&!active.includes(o)&&o.visible&&o.opacity>0).map(o=>o.getBoundingRect())
   .filter(b=>!(Math.abs(b.left)<1&&Math.abs(b.top)<1&&Math.abs(b.width-dimensions.width)<1&&Math.abs(b.height-dimensions.height)<1))
  const zoom=canvas.getZoom(),snaps=findSnaps(target.getBoundingRect(),others,dimensions.width,dimensions.height,zoom)
  target.set({left:target.left+(snaps.x?.delta||0),top:target.top+(snaps.y?.delta||0)})
  target.setCoords()
  canvas.requestRenderAll()
  for(const axis of ['x','y'] as const){
   const snap=snaps[axis];if(!snap)continue
   const line=document.createElement('div');line.dataset.axis=axis
   Object.assign(line.style,{position:'absolute',...(axis==='x'?{left:snap.guide*zoom+'px',top:'0',height:'100%',borderLeft:'1px dashed #f044ad'}:{top:snap.guide*zoom+'px',left:'0',width:'100%',borderTop:'1px dashed #f044ad'})})
   overlay.appendChild(line)
  }
 })
 const offUp=canvas.on('mouse:up',clear)
 const offClear=canvas.on('selection:cleared',clear)
 const offModified=canvas.on('object:modified',clear)
 const alt=(e:KeyboardEvent)=>{if(e.key==='Alt')clear()}
 window.addEventListener('keydown',alt)
 return ()=>{offMove();offUp();offClear();offModified();window.removeEventListener('keydown',alt);overlay.remove()}
}

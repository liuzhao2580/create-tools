import { useRef } from 'react'
import type { ImageLayer, ReferenceTemplate } from './title-reference'

export async function readImageFile(file: File) {
 if (!/^image\/(png|jpeg|webp|gif|avif)$/.test(file.type)) throw new Error('请选择 PNG、JPG、WebP、GIF 或 AVIF 图片。')
 if(file.size>10*1024*1024) throw new Error('图片不能超过 10 MB。')
 const src=await new Promise<string>((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result));r.onerror=()=>reject(new Error('读取图片失败'));r.readAsDataURL(file)})
 const img=new Image();img.src=src;await img.decode()
 return {src,width:img.naturalWidth,height:img.naturalHeight}
}
export default function TitleImageLayers({value,selected,onSelect,onChange}:{value:ReferenceTemplate;selected:string|null;onSelect:(id:string)=>void;onChange:(value:ReferenceTemplate)=>void}) {
 const drag=useRef<{id:string;x:number;y:number;clientX:number;clientY:number;scale:number}|undefined>(undefined)
 function patch(id:string,delta:Partial<ImageLayer>){onChange({...value,images:value.images?.map(l=>l.id===id?{...l,...delta}:l)})}
 return <div className="title-image-hit-layer">{value.images?.map(l=><button key={l.id} aria-label={'移动图片：'+l.name} className={'title-image-handle '+(selected===l.id?'selected':'')} style={{left:(l.x-l.width/2)/18+'%',top:(l.y-l.height/2)/value.height*100+'%',width:l.width/18+'%',height:l.height/value.height*100+'%',transform:'rotate('+l.rotate+'deg)'}} onClick={()=>onSelect(l.id)} onPointerDown={e=>{if(e.button!==0)return;onSelect(l.id);drag.current={id:l.id,x:l.x,y:l.y,clientX:e.clientX,clientY:e.clientY,scale:1800/e.currentTarget.parentElement!.getBoundingClientRect().width};e.currentTarget.setPointerCapture(e.pointerId)}} onPointerMove={e=>{const d=drag.current;if(!d||d.id!==l.id)return;patch(l.id,{x:Math.max(0,Math.min(1800,d.x+(e.clientX-d.clientX)*d.scale)),y:Math.max(0,Math.min(value.height,d.y+(e.clientY-d.clientY)*d.scale))})}} onPointerUp={()=>{drag.current=undefined}} onPointerCancel={()=>{drag.current=undefined}} onLostPointerCapture={()=>{drag.current=undefined}} onKeyDown={e=>{const step=e.shiftKey?10:1;if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();patch(l.id,{x:Math.max(0,Math.min(1800,l.x+(e.key==='ArrowRight'?step:e.key==='ArrowLeft'?-step:0))),y:Math.max(0,Math.min(value.height,l.y+(e.key==='ArrowDown'?step:e.key==='ArrowUp'?-step:0)))})}}} />)}</div>
}

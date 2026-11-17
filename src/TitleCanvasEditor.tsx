import TitleImageLayers, { readImageFile } from './TitleImageLayers'
import { useRef, useState, type ReactNode } from 'react'
import { Button, ColorPicker, Input, InputNumber, Select, Space, Slider, Checkbox, Alert } from 'antd'
import type { ReferenceTemplate, TitleLayer } from './title-reference'
import './title-canvas-editor.css'

export default function TitleCanvasEditor({value,onChange,fonts,children}:{value:ReferenceTemplate;onChange:(v:ReferenceTemplate)=>void;fonts:Record<string,string>;children:ReactNode}) {
 const [selected,setSelected]=useState(0)
 const [imageSelected,setImageSelected]=useState<string|null>(null)
 const [imageError,setImageError]=useState('')
 const [imageBusy,setImageBusy]=useState(false)
 const imageInput=useRef<HTMLInputElement>(null)
 const replaceInput=useRef<HTMLInputElement>(null)
 const imageLayer=value.images?.find(l=>l.id===imageSelected)
 const patchImage=(patch:Partial<NonNullable<ReferenceTemplate['images']>[number]>)=>onChange({...value,images:value.images?.map(l=>l.id===imageSelected?{...l,...patch}:l)})
 async function uploadImage(file:File,replace=false) {
  setImageBusy(true);setImageError('')
  try {
   const img=await readImageFile(file)
   if(replace&&imageLayer){patchImage({src:img.src,name:file.name});return}
   if((value.images?.length||0)>=30)throw new Error('最多添加 30 张图片。')
   const width=Math.min(600,img.width,value.height*0.65*img.width/img.height)
   const id=crypto.randomUUID()
   onChange({...value,images:[...(value.images||[]),{id,name:file.name,src:img.src,x:900,y:value.height/2,width,height:width*img.height/img.width,rotate:0,opacity:1}]})
   setImageSelected(id)
  }catch(error){setImageError(error instanceof Error?error.message:'图片加载失败，请重试。')}finally{setImageBusy(false)}
 }
 const [zoom,setZoom]=useState(85)
 const drag=useRef<{x:number;y:number;startX:number;startY:number;scale:number;index:number} | undefined>(undefined)
 const current=value.layers[selected]
 const text=(l:TitleLayer,i:number)=>l.text==='title'?value.title:l.text==='subtitle'?value.subtitle:l.text==='tag'?value.tag:value.extraText?.[String(i)]??l.text
 const update=(patch:Partial<TitleLayer>,index=selected)=>onChange({...value,layers:value.layers.map((l,i)=>i===index?{...l,...patch}:l)})
 function write(s:string){if(!current)return;if(['title','subtitle','tag'].includes(current.text))onChange({...value,[current.text]:s});else onChange({...value,extraText:{...value.extraText,[selected]:s}})}
 function add(copy=false){
  const l:TitleLayer=copy&&current?{...current,text:text(current,selected),x:current.x+30,y:current.y+30,hidden:false}:{text:'新增文字',x:900,y:value.height/2,width:900,size:100,color:'#333333',font:'思源黑体'}
  // Literal copies must not resolve to the original title binding.
  const index=value.layers.length
  onChange({...value,layers:[...value.layers,l],extraText:{...value.extraText,[index]:l.text}})
  setSelected(index);setImageSelected(null)
 }
 return <div className="title-canvas-editor">
  <div className="canvas-layer-toolbar"><div className="canvas-tool-actions"><Button onClick={()=>add()}>添加文字</Button><Button loading={imageBusy} onClick={()=>imageInput.current?.click()}>添加图片</Button><input hidden ref={imageInput} type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/avif" onChange={e=>{const f=e.target.files?.[0];if(f)void uploadImage(f);e.target.value=''}}/><input hidden ref={replaceInput} type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/avif" onChange={e=>{const f=e.target.files?.[0];if(f)void uploadImage(f,true);e.target.value=''}}/><label className="canvas-background-upload">替换背景<input type="file" accept="image/*" onChange={e=>{const f=e.target.files?.[0];if(!f)return;const reader=new FileReader();reader.onload=()=>onChange({...value,background:String(reader.result)});reader.readAsDataURL(f);e.target.value=''}}/></label></div>
   <Select aria-label="选择文字图层" value={current&&!current.hidden?selected:undefined} placeholder="选择文字" onChange={i=>{setSelected(i);setImageSelected(null)}} options={value.layers.flatMap((l,i)=>l.hidden?[]:[{label:text(l,i).slice(0,22)||'空文字',value:i}])}/>
   {!!value.images?.length&&<Select aria-label="选择图片图层" placeholder="选择图片" value={imageSelected||undefined} onChange={setImageSelected} options={value.images.map(l=>({label:l.name,value:l.id}))}/>}
   {imageLayer&&<>
    <Button loading={imageBusy} onClick={()=>replaceInput.current?.click()}>替换选中图片</Button>
    <label>图片宽度<InputNumber aria-label="图片宽度" min={20} max={3600} value={Math.round(imageLayer.width)} onChange={width=>width&&patchImage({width,height:width*imageLayer.height/imageLayer.width})}/></label>
    <label>旋转<InputNumber aria-label="图片旋转" min={-180} max={180} value={imageLayer.rotate} onChange={rotate=>patchImage({rotate:rotate||0})}/></label>
    <label>透明度<InputNumber aria-label="图片透明度" min={0} max={100} value={Math.round(imageLayer.opacity*100)} onChange={opacity=>patchImage({opacity:(opacity??100)/100})}/></label>
    <Button onClick={()=>patchImage({x:900,y:value.height/2})}>图片居中</Button>
    <Button danger onClick={()=>{onChange({...value,images:value.images?.filter(l=>l.id!==imageSelected)});setImageSelected(null)}}>删除图片</Button>
   </>}
   {!imageLayer&&current&&!current.hidden&&<>
    <Input.TextArea autoSize={{minRows:1,maxRows:3}} aria-label="选中文字内容" value={text(current,selected)} onChange={e=>write(e.target.value)}/>
    <Select aria-label="选中文字字体" value={current.font||(current.text==='title'?value.font:'思源黑体')} onChange={font=>update({font})} options={Object.keys(fonts).map(f=>({label:f,value:f}))}/>
    {current.text==='title'&&<Checkbox checked={!!value.html} onChange={e=>onChange({...value,html:e.target.checked})}>HTML</Checkbox>}
    <label>字号<InputNumber aria-label="文字字号" min={12} max={600} value={current.size} onChange={size=>size&&update({size})}/></label>
    <ColorPicker value={current.color} disabledAlpha onChange={c=>update({color:c.toHexString(),lineColors:undefined,highlights:undefined})}/>
    <Button aria-pressed={(current.weight||400)>=700} onClick={()=>update({weight:(current.weight||400)>=700?400:900})}>加粗</Button>
    <Button aria-pressed={!!current.italic} onClick={()=>update({italic:!current.italic})}>斜体</Button>
    <label>旋转<InputNumber aria-label="文字旋转" min={-180} max={180} value={current.rotate||0} onChange={rotate=>update({rotate:rotate||0})}/></label>
    <label>X<InputNumber aria-label="文字横坐标" min={0} max={1800} value={Math.round(current.x)} onChange={x=>x!==null&&update({x})}/></label>
    <label>Y<InputNumber aria-label="文字纵坐标" min={0} max={value.height} value={Math.round(current.y)} onChange={y=>y!==null&&update({y})}/></label>
    <Space><Button onClick={()=>add(true)}>复制文字</Button><Button danger onClick={()=>update({hidden:true})}>删除文字</Button></Space>
   </>}
  </div>
  {imageError&&<Alert title={imageError} type="error" closable={{onClose:()=>setImageError('')}}/>}
  <div className="design-stage-well"><div className="editable-title-stage" style={{width:`${zoom}%`,maxWidth:1800}}> 
   {children}
   <div className="title-hit-layer">{value.layers.map((l,i)=>{
    if(l.hidden)return null
    const lines=text(l,i).split('\n').slice(0,3)
    const ctx=document.createElement('canvas').getContext('2d')!
    ctx.font=`${l.italic?'italic':'normal'} ${l.weight||400} ${l.size}px "${fonts[l.font||(l.text==='title'?value.font:'思源黑体')]}"`
    const naturalWidth=Math.max(1,...lines.map(t=>ctx.measureText(t).width))
    const width=Math.min(l.width,naturalWidth)
    const height=l.size*(l.lineHeight||1.18)*lines.length*Math.min(1,l.width/naturalWidth)
    return <button key={i} type="button" className={`title-layer-handle ${!imageSelected&&selected===i?'selected':''}`} aria-label={`移动文字：${text(l,i)}`} style={{left:`${(l.x-(l.align==='left'?0:width/2))/18}%`,top:`${(l.y-height/2)/value.height*100}%`,width:`${width/18}%`,height:`${height/value.height*100}%`,transform:`rotate(${l.rotate||0}deg)`,transformOrigin:l.align==='left'?'left center':'center'}} onClick={()=>{setSelected(i);setImageSelected(null)}} onPointerDown={e=>{if(e.button!==0)return;setSelected(i);setImageSelected(null);const rect=e.currentTarget.parentElement!.getBoundingClientRect();drag.current={x:l.x,y:l.y,startX:e.clientX,startY:e.clientY,scale:1800/rect.width,index:i};e.currentTarget.setPointerCapture(e.pointerId)}} onPointerMove={e=>{const d=drag.current;if(!d||d.index!==i)return;update({x:Math.max(0,Math.min(1800,d.x+(e.clientX-d.startX)*d.scale)),y:Math.max(0,Math.min(value.height,d.y+(e.clientY-d.startY)*d.scale))},i)}} onPointerUp={()=>{drag.current=undefined}} onPointerCancel={()=>{drag.current=undefined}} onLostPointerCapture={()=>{drag.current=undefined}} onKeyDown={e=>{const step=e.shiftKey?10:1;if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();update({x:Math.max(0,Math.min(1800,l.x+(e.key==='ArrowRight'?step:e.key==='ArrowLeft'?-step:0))),y:Math.max(0,Math.min(value.height,l.y+(e.key==='ArrowDown'?step:e.key==='ArrowUp'?-step:0)))},i)}}}/>
   })}</div><TitleImageLayers value={value} selected={imageSelected} onSelect={setImageSelected} onChange={onChange}/>
  </div>
  </div><footer className="design-canvas-footer"><span>点选文字编辑 · 拖动调整位置</span><div><Button onClick={()=>setZoom(85)}>适应画布</Button><Slider ariaLabelForHandle="画布缩放" min={30} max={100} value={zoom} onChange={setZoom}/><span>{zoom}%</span><span>1800 × {value.height}</span></div></footer>
 </div>
}

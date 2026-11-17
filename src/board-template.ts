import assetRevisions from './template-asset-revisions.json'
import { FabricImage, Textbox, type FabricObject } from 'fabric'
import type { ReferenceTemplate } from './title-reference'

export const templateFonts: Record<string,string> = {
 '思源黑体':'TitleSans','思源宋体':'TitleSong','站酷庆科黄油体':'TitleButter',
 '站酷快乐体':'TitleHappy','站酷小薇':'TitleSerif','马善政毛笔':'TitleBrush',
 '志莽行':'TitleWild','流江毛草':'TitleGrass','龙藏体':'TitleDragon','系统黑体':'StudioPingFang',
}
async function embeddedImage(path:string){
 if(path.startsWith('data:image/'))return path
 const response=await fetch(import.meta.env.BASE_URL+path)
 if(!response.ok)throw new Error('模板背景加载失败')
 return new Promise<string>((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result));r.onerror=reject;void response.blob().then(blob=>r.readAsDataURL(blob)).catch(reject)})
}
export async function templateObjects(template:ReferenceTemplate):Promise<FabricObject[]>{
 await Promise.all(template.layers.map(l=>document.fonts.load(`${l.weight||400} 60px "${templateFonts[l.font||(l.text==='title'?template.font:'思源黑体')]||'TitleSans'}"`)))
 const background=await FabricImage.fromURL(await embeddedImage(template.background))
 background.set({left:0,top:0,originX:'left',originY:'top',scaleX:1800/background.width,scaleY:template.height/background.height})
 background.set('templateRole','background')
 const result:FabricObject[]=[background]
 for(const image of template.images||[]){
  const asset=await FabricImage.fromURL(image.src)
  asset.set({left:image.x,top:image.y,originX:'center',originY:'center',scaleX:image.width/asset.width,scaleY:image.height/asset.height,angle:image.rotate,opacity:image.opacity})
  result.push(asset)
 }
 for(const [index,layer] of template.layers.entries()){
  if(layer.hidden)continue
  const content=layer.text==='title'?template.title:layer.text==='subtitle'?template.subtitle:layer.text==='tag'?template.tag:template.extraText?.[String(index)]??layer.text
  const font=templateFonts[layer.font||(layer.text==='title'?template.font:'思源黑体')]||'TitleSans'
  const ctx=document.createElement('canvas').getContext('2d')!
  ctx.font=`${layer.italic?'italic':'normal'} ${layer.weight||400} ${layer.size}px "${font}"`
  const lines=content.split('\n'),natural=Math.max(1,...lines.map(l=>ctx.measureText(l).width))
  const scale=Math.min(1,layer.width/natural)
  const text=new Textbox(content,{
   left:layer.x,top:layer.y,originX:layer.align==='left'?'left':'center',originY:'center',
   width:natural+2,fontFamily:font,fontSize:layer.size,fontWeight:layer.weight||400,
   fontStyle:layer.italic?'italic':'normal',textAlign:layer.align==='left'?'left':layer.align==='right'?'right':'center',fill:layer.color,
   scaleX:scale,scaleY:scale,angle:layer.rotate||0,lineHeight:layer.lineHeight||1.18,
   stroke:layer.stroke,strokeWidth:layer.stroke?5:0,paintFirst:'stroke',
  })
  text.set('templateRole',layer.text==='title'?'title':'copy')
  lines.forEach((line,row)=>{
   const styles:Record<number,{fill:string}>={}
   for(let i=0;i<line.length;i++){
    const highlight=layer.highlights?.find(([word])=>{const start=line.indexOf(word);return start>=0&&i>=start&&i<start+word.length})
    const color=highlight?.[1]||layer.lineColors?.[row]
    if(color)styles[i]={fill:color}
   }
   text.styles[row]=styles
  })
  result.push(text)
 }
 return result
}

// Match embedded legacy bytes, not filenames or dimensions: user uploads stay untouched.
async function revisedBackground(source: string): Promise<string | undefined> {
 if (!source.startsWith('data:image/')) return
 const bytes = await (await fetch(source)).arrayBuffer()
 const digest = await crypto.subtle.digest('SHA-256', bytes)
 const hash = Array.from(new Uint8Array(digest), n => n.toString(16).padStart(2, '0')).join('')
 return (assetRevisions as Record<string, string>)[hash]
}
export async function upgradeTemplateBackgrounds<T extends { objects: Record<string, unknown>[] }>(canvas: T): Promise<T> {
 const candidates = canvas.objects.filter(o => String(o.type).toLowerCase() === 'image' &&
  Number(o.cropX || 0) === 0 && Number(o.cropY || 0) === 0)
 if (!candidates.length) return canvas
 const replacements = new Map<Record<string, unknown>, Record<string, unknown>>()
 for (const object of candidates) {
  const path = await revisedBackground(String(object.src))
  if (!path) continue
  const src = await embeddedImage(path)
  const img = new Image(); img.src = src; await img.decode()
  replacements.set(object, { ...object, src, width: img.naturalWidth, height: img.naturalHeight,
   scaleX: Number(object.scaleX ?? 1) * Number(object.width) / img.naturalWidth,
   scaleY: Number(object.scaleY ?? 1) * Number(object.height) / img.naturalHeight })
 }
 return { ...canvas, objects: canvas.objects.map(o => replacements.get(o) || o) }
}

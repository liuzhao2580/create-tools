import { useEffect, useRef, useState } from 'react'
import './title-studio.css'

type Template = { font?: string; html?: boolean; id: string; category: string; name: string; style: string; color: string; title: string; subtitle: string; tag: string }
const templates: Template[] = [
 {id:'orange',category:'正常文章标题',name:'橙色手绘剪纸',style:'paper',color:'#ff9f21',title:'意外身故\n社保白交了吗？',subtitle:'账户继承、遗属待遇，一次讲清',tag:'社保知识'},
 {id:'blue',category:'正常文章标题',name:'蓝色重点解读',style:'paper',color:'#82b9ee',title:'重要信息\n这些事情要知道',subtitle:'把条件讲清，把重点说明白',tag:'实用解读'},
 {id:'frost',category:'二十四节气',name:'霜降 · 水墨柿语',style:'ink',color:'#6d4238',title:'霜 降',subtitle:'霜降忽而至 · 秋意渐无声',tag:'二十四节气'},
 {id:'season',category:'二十四节气',name:'四季 · 雅致留白',style:'season',color:'#677b62',title:'立 冬',subtitle:'万物收藏 · 岁月静好',tag:'二十四节气'},
 {id:'health',category:'医疗饮食科普',name:'薄荷绿 · 健康科普',style:'health',color:'#059bad',title:'全民健康\n生活科普',subtitle:'了解身体信号，科学照顾自己',tag:'健康知识'},
 {id:'food',category:'医疗饮食科普',name:'暖黄绿 · 日常食养',style:'health',color:'#739b38',title:'应季饮食\n温和养护',subtitle:'因人制宜 · 合理搭配',tag:'饮食科普'},
 {id:'mind',category:'心理与生活',name:'柔粉 · 心理关怀',style:'soft',color:'#d085a1',title:'少些焦虑\n多些从容',subtitle:'关注心理健康，从了解自己开始',tag:'心理健康'},
 {id:'life',category:'心理与生活',name:'草木绿 · 日常生活',style:'soft',color:'#67996b',title:'认真生活\n慢慢向前',subtitle:'把平常的日子过得有滋有味',tag:'生活随笔'}
]
const additions = [
 ['二十四节气','霜叶晨光','#cc8a48','霜降','朝露凝霜 · 万物敛藏','season'],
 ['二十四节气','茶席柿香','#816943','霜降','一盏秋茶 · 满庭柿香','ink'],
 ['二十四节气','横排宋韵','#7a5846','霜 降','霜落枝头 · 柿事安好','season'],
 ['二十四节气','朱印枝头','#a44932','霜·降','中国传统二十四节气','ink'],
 ['二十四节气','晴蓝冬枝','#669bc7','霜 降','秋意渐深 · 顺时而养','season'],
 ['二十四节气','素纸题字','#555445','霜降','霜降柿子红 · 时至秋日终','season'],
 ['二十四节气','橙秋山色','#d78343','霜降','秋深露重 · 草木知寒','paper'],
 ['二十四节气','今日霜降','#927453','今日  霜降','四时流转 · 岁岁安然','ink'],
 ['二十四节气','金色山岚','#c99a4c','霜 降','秋将尽 · 冬可期','season'],
 ['心理与生活','云朵心语','#d494af','心理健康','你比想象中的更强大','soft'],
 ['心理与生活','粉蓝社团','#81abc3','心理社团纳新','共同守护健康心灵','soft'],
 ['心理与生活','晴空关怀','#5e9cc6','关注心理健康','爱自己是一生的课题','soft'],
 ['心理与生活','春日讲堂','#9aab76','心理健康讲座','让心灵与春天相遇','soft'],
 ['心理与生活','以爱浇灌','#82a564','以爱浇灌\n心灵开花','少些焦虑 · 多些快乐','soft'],
 ['正常文章标题','暑期手账','#e9b65d','出发暑期\n艺术大冒险','一起发现生活的色彩','paper'],
 ['正常文章标题','活动提醒','#d99c91','第一次参加漫展\n要注意什么','活动指南 · 提前准备','paper'],
 ['心理与生活','内心晴空','#a58b46','关爱心灵成长\n守护内心晴空','心理健康讲座','soft'],
 ['医疗饮食科普','心理咨询','#6ca7c1','心理咨询\n能帮你做什么？','了解咨询 · 认识自己','health'],
 ['医疗饮食科普','女性健康','#858bc8','女性健康科普','关注不同阶段的身体变化','health'],
 ['医疗饮食科普','有机农场','#7ca341','有机农场','新鲜蔬果 · 日常食养','soft'],
 ['医疗饮食科普','节约粮食','#acb45d','节约粮食','光盘行动 · 从我做起','soft'],
 ['医疗饮食科普','社区义诊','#dbb05b','健康进社区\n义诊暖人心','活动时间与地点请填写','health'],
 ['医疗饮食科普','智慧医疗','#4f92ba','智慧医疗平台','守护每一份健康','health'],
 ['医疗饮食科普','心理健康课堂','#d9aa59','心理健康科普','学会了解自己','soft'],
 ['医疗饮食科普','打工人计划','#92aa5f','打工人\n无班味计划','给生活留一点余地','soft'],
 ['正常文章标题','蓝色重要信息','#678ee0','重要信息','这些信息请留意','paper'],
 ['医疗饮食科普','医保知识','#ac94d5','你的医保\n这样用才对','条件与范围 · 一次讲清','health']
]
additions.forEach(([category,name,color,title,subtitle,style],i)=>templates.push({id:`reference-${i}`,category,name,color,title,subtitle,style,tag:category}))
const fontChoices = ['站酷快乐体','马善政毛笔','志莽行','站酷小薇','系统黑体']
const fontFamilies: Record<string,string> = {'站酷快乐体':'TitleHappy','马善政毛笔':'TitleBrush','志莽行':'TitleWild','站酷小薇':'TitleSerif','系统黑体':'PingFang SC'}
const fontsReady=typeof document === 'undefined' ? Promise.resolve() : Promise.all(['TitleHappy','TitleBrush','TitleWild','TitleSerif'].map(f=>document.fonts.load(`60px "${f}"`))).then(()=>undefined)
templates.forEach(t=>{t.font=t.category==='二十四节气'?'马善政毛笔':'站酷快乐体'})
type Run={text:string;color:string;font:string;size:number;weight:string;italic:string;stroke:string}
function richLines(source:string,base:Run){
 const doc=new DOMParser().parseFromString(source,'text/html');const rows:Run[][]=[[]]
 function visit(n:Node,style:Run){if(n.nodeType===Node.TEXT_NODE){rows[rows.length-1].push({...style,text:n.textContent||''});return}if(!(n instanceof HTMLElement))return
 if(['SCRIPT','STYLE','IFRAME','IMG','OBJECT','SVG','LINK'].includes(n.tagName))return
 if(n.tagName==='BR'){rows.push([]);return}
 if(['DIV','P'].includes(n.tagName)&&rows[rows.length-1].length)rows.push([])
 const z={...style};const st=n.style
 if(st.color)z.color=st.color
 if(st.fontFamily){const key=st.fontFamily.replace(/["']/g,'');z.font=fontFamilies[key]||Object.values(fontFamilies).find(f=>f===key)||style.font}
 if(st.fontSize){const v=parseFloat(st.fontSize);if(Number.isFinite(v))z.size=Math.max(16,Math.min(240,st.fontSize.endsWith('em')?style.size*v:v))}
 if(st.fontWeight)z.weight=st.fontWeight
 if(['B','STRONG'].includes(n.tagName))z.weight='900'
 if(['I','EM'].includes(n.tagName)||st.fontStyle==='italic')z.italic='italic'
 if(st.webkitTextStrokeColor)z.stroke=st.webkitTextStrokeColor
 n.childNodes.forEach(c=>visit(c,z))
 }
 doc.body.childNodes.forEach(n=>visit(n,base));return rows.filter(r=>r.length).slice(0,3)
}
const categories = ['全部模板', ...new Set(templates.map(t=>t.category))]
const terms='立春 雨水 惊蛰 春分 清明 谷雨 立夏 小满 芒种 夏至 小暑 大暑 立秋 处暑 白露 秋分 寒露 霜降 立冬 小雪 大雪 冬至 小寒 大寒'.split(' ')
const bg = typeof Image === 'undefined' ? null : new Image(); if(bg) bg.src = new URL('../public/title-templates/solar-ink.png', import.meta.url).href
const orangeBg = typeof Image === 'undefined' ? null : new Image(); if(orangeBg) orangeBg.src = new URL('../public/title-templates/orange-paper.png', import.meta.url).href
function draw(canvas: HTMLCanvasElement,t:Template){
 const c=canvas.getContext('2d'); if(!c)return
 canvas.width=1800;canvas.height=766
 const box=(x:number,y:number,w:number,h:number,r:number,fill:string,stroke?:string)=>{c.beginPath();c.roundRect(x,y,w,h,r);c.fillStyle=fill;c.fill();if(stroke){c.strokeStyle=stroke;c.lineWidth=5;c.stroke()}}
 c.fillStyle=t.style==='paper'?t.color:t.style==='ink'?'#f8eedb':t.style==='season'?'#f8f3e8':t.style==='health'?'#e7f7e9':'#fff2ec';c.fillRect(0,0,1800,766)
 if(t.style==='ink'&&bg?.complete&&bg.naturalWidth)c.drawImage(bg,0,0,1800,766)
 if(t.style==='paper'){
  c.strokeStyle='#ffffff33';c.lineWidth=2;for(let x=0;x<1800;x+=65){c.beginPath();c.moveTo(x,0);c.lineTo(x,766);c.stroke()}for(let y=0;y<766;y+=65){c.beginPath();c.moveTo(0,y);c.lineTo(1800,y);c.stroke()}
  box(65,90,1670,570,8,'#fff','#292929');c.strokeStyle='#eee';c.lineWidth=2;for(let x=80;x<1730;x+=32){c.beginPath();c.moveTo(x,94);c.lineTo(x,654);c.stroke()}
  for(let y=100;y<650;y+=32){c.beginPath();c.moveTo(70,y);c.lineTo(1730,y);c.stroke()}
  box(270,610,1260,100,2,'#ffda62','#252525');box(55,30,360,86,2,'#fff0ae')
 }else if(t.style!=='ink'){
  box(45,45,1710,676,35,'#ffffff88',t.color+'55')
  c.fillStyle=t.color+'20';for(let i=0;i<6;i++){c.beginPath();c.arc(1570+(i%2)*95,100+i*120,100,0,Math.PI*2);c.fill()}
  if(t.style==='health'){box(1400,265,240,240,45,'#fff');c.fillStyle=t.color;c.fillRect(1500,310,40,150);c.fillRect(1445,365,150,40)}
 }
 if(t.id==='orange'&&orangeBg?.complete&&orangeBg.naturalWidth)c.drawImage(orangeBg,0,0,1800,766)
 const isInk=t.style==='ink',center=t.style==='paper',max=isInk?1000:center?1360:1200,x=center?900:isInk?610:120
 c.textAlign=center||isInk?'center':'left';c.textBaseline='middle'
 const family=fontFamilies[t.font||'站酷快乐体']||'TitleHappy'
 const base:Run={text:'',color:isInk?'#603e35':'#202329',font:family,size:isInk?205:145,weight:'400',italic:'normal',stroke:''}
 const rows=t.html?richLines(t.title,base):t.title.split('\n').slice(0,3).map(l=>[{...base,text:l}])
 const font=(r:Run)=>`${r.italic} ${r.weight} ${r.size}px "${r.font}", sans-serif`
 const widths=rows.map(row=>row.reduce((w,r)=>{c.font=font(r);return w+c.measureText(r.text).width},0))
 const heights=rows.map(row=>Math.max(30,...row.map(r=>r.size))*1.16)
 const scale=Math.min(1,max/Math.max(1,...widths),400/Math.max(1,heights.reduce((a,b)=>a+b,0)))
 let y=360-heights.reduce((a,b)=>a+b,0)*scale/2
 rows.forEach((row,i)=>{let left=center||isInk?x-widths[i]*scale/2:x;y+=heights[i]*scale/2;c.save();c.translate(left,y);c.scale(scale,scale);c.textAlign='left';let offset=0;row.forEach(r=>{c.font=font(r);c.fillStyle=r.color;if(r.stroke){c.strokeStyle=r.stroke;c.lineWidth=4;c.strokeText(r.text,offset,0)}c.fillText(r.text,offset,0);offset+=c.measureText(r.text).width});c.restore();y+=heights[i]*scale/2})
 const fit=(text:string,y:number,font:number,width:number)=>{let s=font;do{c.font=`700 ${s}px "PingFang SC",sans-serif`;if(c.measureText(text).width<=width)break;s--}while(s>15);c.fillText(text,x,y)}
 c.fillStyle=isInk?'#75554a':t.style==='paper'?'#252525':t.color;fit(t.subtitle,t.id==='orange'?690:center?660:620,44,t.id==='orange'?625:max)
 c.textAlign='left';c.fillStyle=isInk?'#a34f3b':'#414136';c.font='700 38px "PingFang SC",sans-serif';if(t.id==='orange'){c.save();c.translate(180,120);c.rotate(-.23);c.fillText(t.tag,0,0);c.restore()}else c.fillText(t.tag,center?80:120,center?72:110)
}
function Preview({value}:{value:Template}){const ref=useRef<HTMLCanvasElement>(null);useEffect(()=>{const run=()=>ref.current&&draw(ref.current,value);void fontsReady.then(run);bg?.addEventListener('load',run);orangeBg?.addEventListener('load',run);return()=>{bg?.removeEventListener('load',run);orangeBg?.removeEventListener('load',run)}},[value]);return <canvas ref={ref} aria-label={`${value.name}预览`} role="img"/>}
export default function TitleStudio(){
 const [category,setCategory]=useState('全部模板');const [value,setValue]=useState<Template>(()=>{try{const v=JSON.parse(localStorage.getItem('creator.title.v1')||'null');if(v&&templates.some(t=>t.id===v.id)&&['title','subtitle','tag'].every(k=>typeof v[k]==='string'))return {...templates.find(t=>t.id===v.id)!,title:v.title,subtitle:v.subtitle,tag:v.tag,font:fontChoices.includes(v.font)?v.font:templates.find(t=>t.id===v.id)!.font,html:v.html===true}}catch{}return templates[0]});const [message,setMessage]=useState('')
 useEffect(()=>{try{localStorage.setItem('creator.title.v1',JSON.stringify(value))}catch{setMessage('浏览器未能保存草稿，请导出后再离开。')}},[value])
 const valid=!!value.title.trim()
 async function exportImage(){try{await fontsReady;const canvas=document.createElement('canvas');draw(canvas,value);canvas.toBlob(blob=>{if(!blob){setMessage('导出失败，请重试');return}const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`${value.title.replace(/[\n\\/:*?"<>|]/g,' ').slice(0,60)||'文章标题'}.png`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setMessage('标题图已导出（1800 × 766 PNG）。')},'image/png')}catch{setMessage('导出失败，请刷新后重试。')}}
 return <div className="title-studio"><aside className="title-categories" aria-label="标题模板分类"><h2>模板分类</h2>{categories.map(c=><button key={c} aria-pressed={category===c} onClick={()=>setCategory(c)}>{c}<span>{c==='全部模板'?templates.length:templates.filter(t=>t.category===c).length}</span></button>)}<p>选择风格，替换文字。<br/>草稿自动保存在当前浏览器。</p></aside><div className="title-body"><div className="title-gallery">{templates.filter(t=>category==='全部模板'||t.category===category).map(t=><button key={t.id} aria-pressed={t.id===value.id} onClick={()=>{setValue(t);setMessage('')}}><Preview value={t}/><span>{t.name}</span></button>)}</div><section className="title-editor"><div className="title-preview"><Preview value={value}/><p>公众号横版标题 · 1800 × 766 · 字号随标题长度调整</p>{value.id==='orange'&&<details><summary>查看已确认的橙色标题样例</summary><img src="title-templates/orange-reference.png" alt="已确认的社保标题样例"/></details>}</div><div className="title-fields"><h2>编辑标题</h2>{value.category==='二十四节气'&&<label>节气<select value={terms.find(t=>value.title.replace(/\s/g,'')===t)||''} onChange={e=>{const term=e.target.value;setValue({...templates[term==='霜降'?2:3],title:term.split('').join(' '),subtitle:'顺应时节 · 感知四季'})}}><option value="" disabled>选择节气</option>{terms.map(t=><option key={t}>{t}</option>)}</select></label>}<label>标题字体<select value={value.font||'站酷快乐体'} onChange={e=>setValue({...value,font:e.target.value})}>{fontChoices.map(f=><option key={f}>{f}</option>)}</select></label><label><input type="checkbox" checked={!!value.html} onChange={e=>setValue({...value,html:e.target.checked})}/>识别 HTML 富文本</label>{value.html&&<p>支持 span、b、strong、em、br、p、div；内联颜色、字号(px/em)、字体、粗细及描边颜色。其他标签和脚本不会执行。</p>}<label>主标题（最多三行）<textarea rows={value.html?6:3} maxLength={value.html?4000:60} value={value.title} onChange={e=>setValue({...value,title:value.html?e.target.value:e.target.value.split('\n').slice(0,3).join('\n')})}/></label><label>副标题<input maxLength={60} value={value.subtitle} onChange={e=>setValue({...value,subtitle:e.target.value})}/></label><label>左上标签<input maxLength={12} value={value.tag} onChange={e=>setValue({...value,tag:e.target.value})}/></label><button className="title-export" disabled={!valid} onClick={exportImage}>导出 PNG 标题图</button><button onClick={()=>setValue(templates.find(t=>t.id===value.id)!)}>恢复当前模板</button><p role="status">{message}</p></div></section></div></div>
}

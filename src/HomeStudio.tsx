import { useState } from 'react'
import { Input, Button, Empty } from 'antd'
import { Search, ArrowUpRight } from 'lucide-react'
import { toolRegistry } from './tools'
import './home.css'

const order = ['cover', 'voice', 'subtitles', 'article']
const details: Record<string, { action: string; summary: string; format: string }> = {
 cover: { action: '开始创作', summary: '从空白画板开始，自由编辑文字、图片和形状。', format: '图片 · 字体 · PNG 导出' },
 voice: { action: '生成配音', summary: '写下文案，选择声音，试听并导出音频。', format: '文案 · 音色 · 音频' },
 subtitles: { action: '上传字幕', summary: '导入 SRT，让配音跟随字幕时间。', format: '字幕 · 时间轴 · 配音' },
 article: { action: '开始排版', summary: '编辑文章与标题样式，预览并复制排版。', format: '文章 · 标题模板 · HTML' },
}
function ToolArtwork({ id }: { id: string }) {
 return <div className={`tool-art tool-art-${id}`} aria-hidden="true">
  {id==='cover' && <div className="tool-cover-sheet"><span>日常记录</span><strong>把这一刻<br/>留在封面</strong><i>YOUR NEXT STORY</i></div>}
  {id==='voice' && <div className="tool-wave">{Array.from({length:29},(_,i)=><i key={i} style={{height:`${18+Math.abs(Math.sin(i*1.3))*64}%`}}/>)}</div>}
  {id==='subtitles' && <div className="tool-timeline"><span>00:00 <i/> 00:12</span><p>让声音，跟随画面</p><div><i/><i/><i/></div></div>}
  {id==='article' && <div className="tool-article-sheet"><small>创作笔记</small><strong>写下你的故事</strong><i/><i/><i/><blockquote>让内容被好好阅读。</blockquote></div>}
 </div>
}
export default function HomeStudio() {
 const [query,setQuery]=useState('')
 const tools=order.map(id=>toolRegistry.find(t=>t.id===id)!).filter(t=>`${t.name} ${t.description} ${details[t.id].format}`.includes(query.trim()))
 return <div className="creator-home home-hub">
  <header className="hub-heading"><div><span>我的创作空间</span><h1>开始一份新作品</h1><p>图片、声音、字幕和文章，选择你要用的工具。</p></div><Input className="hub-search" aria-label="搜索创作工具" placeholder="搜索工具：封面、配音、排版…" prefix={<Search size={18}/>} allowClear value={query} onChange={e=>setQuery(e.target.value)}/></header>
  <section className="hub-tools" aria-label="创作工具">{tools.map(tool=><a className="hub-tool" key={tool.id} href={`#${tool.route}`}>
   <ToolArtwork id={tool.id}/>
   <div className="hub-tool-copy"><div className="hub-tool-title"><tool.icon size={22}/><h2>{tool.name}</h2><ArrowUpRight size={22}/></div><p>{details[tool.id].summary}</p><div className="hub-tool-meta"><span>{details[tool.id].format}</span><strong>{details[tool.id].action} →</strong></div></div>
  </a>)}</section>
  {!tools.length&&<Empty description="没有找到匹配的工具"><Button onClick={()=>setQuery('')}>查看全部工具</Button></Empty>}
 </div>
}

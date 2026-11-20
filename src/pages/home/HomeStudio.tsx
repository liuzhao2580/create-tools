import { Button,Empty,Input } from 'antd'
import { ArrowUpRight,Search } from 'lucide-react'
import { useEffect,useState } from 'react'
import { toolRegistry } from '../../router/tools'
import './home.css'
import SiteHeader from './SiteHeader'

const order = ['cover', 'board', 'voice', 'subtitles', 'separation', 'article']
const details: Record<string, { action: string; summary: string; format: string }> = {
 cover: { action: '编辑封面', summary: '上传图片，添加副标题，调整字体、大小和位置后导出。', format: '封面 · 副标题 · PNG 导出' },
 separation: { action: '分离人声', summary: '比较不同模型，保留对白并准备替换配乐。', format: '视频 · 人声 · WAV 导出' },
 board: { action: '开始创作', summary: '从空白画板开始，自由编辑文字、图片和形状。', format: '图片 · 字体 · PNG 导出' },
 voice: { action: '生成配音', summary: '写下文案，选择声音，试听并导出音频。', format: '文案 · 音色 · 音频' },
 subtitles: { action: '上传字幕', summary: '导入 SRT，让配音跟随字幕时间。', format: '字幕 · 时间轴 · 配音' },
 article: { action: '开始排版', summary: '编辑文章与标题样式，预览并复制排版。', format: '文章 · 标题模板 · HTML' },
}
function ToolArtwork({ id }: { id: string }) {
 return <div className={`tool-art tool-art-${id==='board'?'cover':id}`} aria-hidden="true">
  {(id==='cover'||id==='board') && <div className="tool-cover-sheet"><span>日常记录</span><strong>{id==='board'?<>从空白开始<br/>自由创作</>:<>把这一刻<br/>留在封面</>}</strong><i>YOUR NEXT STORY</i></div>}
  {(id==='voice' || id==='separation') && <div className="tool-wave">{Array.from({length:29},(_,i)=><i key={i} style={{height:`${18+Math.abs(Math.sin(i*1.3))*64}%`}}/>)}</div>}
  {id==='subtitles' && <div className="tool-timeline"><span>00:00 <i/> 00:12</span><p>让声音，跟随画面</p><div><i/><i/><i/></div></div>}
  {id==='article' && <div className="tool-article-sheet"><small>创作笔记</small><strong>写下你的故事</strong><i/><i/><i/><blockquote>让内容被好好阅读。</blockquote></div>}
 </div>
}
export default function HomeStudio({ showTools = false }: { showTools?: boolean }) {
 const [query,setQuery]=useState('')
 const tools=order.map(id=>toolRegistry.find(t=>t.id===id)!).filter(t=>`${t.name} ${t.description} ${details[t.id].format}`.includes(query.trim()))
 useEffect(() => {
  setQuery('')
  if (showTools) document.getElementById('website-tools')?.scrollIntoView({behavior:'instant'})
  else window.scrollTo({top:0,behavior:'instant'})
 }, [showTools])
 const explore=()=>document.getElementById('website-tools')?.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'})
 return <div className="product-site">
  <SiteHeader />
  <main>
   <section className="site-hero">
    <div className="site-hero-copy"><span className="site-eyebrow">为每一个有想法的人</span><h1>你的灵感，<br/>值得被<span>好好表达。</span></h1><p>从第一张封面，到一段声音、一篇文章。<br/>把创作需要的工具，放在一起。</p><a className="site-primary" href="#/board">从空白开始创作 <ArrowUpRight size={18}/></a><button className="site-text-action" onClick={explore}>探索全部工具 ↓</button></div>
    <div className="site-showcase" aria-label="图片、声音与文章创作示意">
     <a href="#/cover" className="site-poster"><span>THE EVERYDAY EDIT</span><strong>把日常<br/>写成<span>诗。</span></strong><div className="poster-sun"/><small>封面设计 / 记录生活的另一种方式</small></a>
     <a href="#/subtitles" className="site-sound"><span>声音，让故事发生</span><div>{Array.from({length:28},(_,i)=><i key={i} style={{height:12+Math.abs(Math.sin(i*1.8))*38}}/>)}</div><small>字幕配音 · 让声音跟随画面</small></a>
     <a href="#/article" className="site-paper"><small>CREATIVE NOTES　/　01</small><strong>灵感不必等待。</strong><p>一个念头，一段文字，<br/>就是创作的开始。</p><span>文章排版 ↗</span></a>
    </div>
   </section>
   <section className="site-capabilities" aria-label="创作亮点"><span>设计你的画面</span><span>打磨你的声音</span><span>表达你的观点</span><p>六个工具，一段更顺手的创作旅程。</p></section>
   <section id="website-tools" className="site-tools"><header><div><span className="site-eyebrow">从想法到完成</span><h2>好作品，从顺手的工具开始。</h2><p>选择此刻需要的能力，直接进入创作。</p></div><Input aria-label="搜索创作工具" placeholder="搜索工具" prefix={<Search size={17}/>} allowClear value={query} onChange={e=>setQuery(e.target.value)}/></header>
    <div className="site-tool-grid">{tools.map(tool=><a className="site-tool" key={tool.id} href={`#${tool.route}`}><ToolArtwork id={tool.id}/><div><h3>{tool.name}<ArrowUpRight size={20}/></h3><p>{details[tool.id].summary}</p><span>{details[tool.id].action} →</span></div></a>)}</div>
    {!tools.length&&<Empty description="没有找到匹配的工具"><Button onClick={()=>setQuery('')}>查看全部工具</Button></Empty>}
   </section>
   <section className="site-closing"><span>下一份作品，从这里开始。</span><a className="site-primary" href="#/board">释放你的创意 <ArrowUpRight size={18}/></a></section>
  </main><footer className="site-footer"><strong>创作者工具</strong><span>图片 · 声音 · 文字</span><a href="#/settings">运行与设置</a></footer>
 </div>
}

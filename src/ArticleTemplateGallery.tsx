import { useState } from 'react'
import { Button, Empty, Input } from 'antd'
import { Search } from 'lucide-react'
import { referenceTemplates, type ReferenceTemplate } from './title-reference'
import { Preview } from './TitleStudio'

export default function ArticleTemplateGallery({ onSelect }: { onSelect: (template: ReferenceTemplate) => void }) {
 const [query,setQuery]=useState('')
 const [category,setCategory]=useState('全部模板')
 const categories=['全部模板',...new Set(referenceTemplates.map(t=>t.category))]
 const results=referenceTemplates.filter(t=>(category==='全部模板'||t.category===category)&&`${t.name} ${t.title} ${t.category}`.includes(query.trim()))
 return <section className="article-template-library">
  <header><div><h2>从一个标题模板开始</h2><p>选择样式，修改文字，再添加到文章。</p></div><Input aria-label="搜索公众号模板" placeholder="搜索模板：美食、开学、通知…" prefix={<Search size={18}/>} allowClear value={query} onChange={e=>setQuery(e.target.value)}/></header>
  <div className="article-template-filters">{categories.map(c=><Button key={c} type={category===c?'primary':'default'} aria-pressed={category===c} onClick={()=>setCategory(c)}>{c}</Button>)}<span>{results.length} 个模板</span></div>
  <div className="article-template-grid">{results.map(t=><button className="article-template-item" key={t.id} onClick={()=>onSelect(t)}><Preview value={t}/><strong>{t.name}</strong><span>{t.category}</span></button>)}</div>
  {!results.length&&<Empty description="没有找到匹配的模板"><Button onClick={()=>{setQuery('');setCategory('全部模板')}}>查看全部模板</Button></Empty>}
 </section>
}

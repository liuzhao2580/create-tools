import { ArrowUpRight } from 'lucide-react'
import './home.css'

export default function SiteHeader({ settings = false }: { settings?: boolean }) {
 return <header className="site-header">
  <a className="site-brand" href="#/">创作者工具<span>让想法成为作品</span></a>
  <nav aria-label="网站导航">
   <a href="#/tools">全部工具</a>
   <a href="#/settings" aria-current={settings ? 'page' : undefined}>设置</a>
   <a className="site-primary" href="#/board">开始创作 <ArrowUpRight size={16}/></a>
  </nav>
 </header>
}

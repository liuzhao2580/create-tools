import { ArrowLeft,CircleHelp,Square } from 'lucide-react'
import { useEffect,useState } from 'react'
import ArticleStudio from './pages/article/ArticleStudio'
import BlankBoard from './pages/board/BlankBoard'
import CoverStudio from './pages/cover/CoverStudio'
import HomeStudio from './pages/home/HomeStudio'
import SiteHeader from './pages/home/SiteHeader'
import './pages/settings/settings.css'
import './pages/home/tool-site.css'
import SeparationStudio from './pages/separation/SeparationStudio'
import SubtitleStudio from './pages/subtitles/SubtitleStudio'
import { toolRegistry } from './router/tools'
import { StudioAlert,StudioButton,StudioCard } from './shared/ui/antd'

import SettingsStudio from './pages/settings/SettingsStudio'
import { useVoiceStudio } from './pages/voice/useVoiceStudio'
import VoiceStudio from './pages/voice/VoiceStudio'
import { OperationProgress } from './shared/components/OperationProgress'
function getRoute() { return (window.location.hash.slice(1) === '/titles' ? '/article' : window.location.hash.slice(1)) || '/' }
export default function App() {
 const [route, setRoute] = useState(getRoute)
  useEffect(() => {
    const onHashChange = () => { setRoute(getRoute()) }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])


  const settingsRoute = route === '/settings'
  const articleRoute = route === '/article'
  const coverRoute = route === '/cover'
  const separationRoute = route === '/separation'
  const subtitlesRoute = route === '/subtitles'
  const homeRoute = route === '/' || route === '/tools'
  const knownRoute = homeRoute || settingsRoute || toolRegistry.some((tool) => tool.route === route)
 const studio = useVoiceStudio(route)
 const { progress, error, setError, notice, setNotice, cancel } = studio
  useEffect(() => { if (!homeRoute) window.scrollTo({top:0,behavior:'instant'}) }, [route,homeRoute])
  if (homeRoute) return <HomeStudio showTools={route === '/tools'} />
  if (settingsRoute) return <div className="product-site site-settings">
    <SiteHeader settings />
    <main id="main-content" tabIndex={-1}>
      <div className="site-settings-heading"><a href="#/">首页 /</a><h1>设置</h1><p>管理配音模型与本地存储，为下一次创作做好准备。</p></div>
      {error && <StudioAlert message={error} type="error" onClose={() => setError('')} />}
      {notice && <StudioAlert message={notice} type="success" onClose={() => setNotice('')} />}
      {progress && <div className="operation-panel"><OperationProgress progress={progress} /><StudioButton className="text-button" onClick={cancel}><Square size={12} />取消</StudioButton></div>}
      <SettingsStudio studio={studio} />
    </main>
    <footer className="site-footer"><strong>创作者工具</strong><span>图片 · 声音 · 文字</span><a href="#/">返回首页</a></footer>
  </div>
  if (route === '/board') return <div className="tool-site board-site"><SiteHeader /><BlankBoard /></div>
  const title = toolRegistry.find(tool => tool.route === route)?.name || '工具未找到'
  const description = articleRoute ? '编辑内容，预览排版，复制到公众号正文。' : coverRoute ? '给封面加一句话，调好字体，保存你的作品。' : separationRoute ? '提取人声，比较模型，为替换配乐准备音轨。' : subtitlesRoute ? '文字跟着画面，声音跟着时间。' : '写好文案，调好声音，生成你的下一段配音。'
  return <div className={`tool-site ${coverRoute ? 'cover-shell' : ''} ${separationRoute ? 'separation-shell' : ''}`}>
    <a className="skip-link" href="#main-content" onClick={event => { event.preventDefault(); document.getElementById('main-content')?.focus() }}>跳到主要内容</a>
    <SiteHeader />
    <div className="workspace">
      <main id="main-content" tabIndex={-1}>
        <div className="tool-page-heading"><div><h1>{title}</h1><p>{description}</p></div><a href="#/tools"><ArrowLeft size={15}/>全部工具</a></div>
        {error && <StudioAlert message={error} type="error" onClose={() => setError('')} />}
        {notice && <StudioAlert message={notice} type="success" onClose={() => setNotice('')} />}
        {!knownRoute ? <StudioCard className="card not-found"><CircleHelp size={35}/><h2>这个工具还不存在</h2><a href="#/tools">查看全部工具</a></StudioCard> : articleRoute ? <ArticleStudio /> : coverRoute ? <CoverStudio /> : separationRoute ? <SeparationStudio /> : subtitlesRoute ? <SubtitleStudio /> : <VoiceStudio studio={studio} />}
      </main>
    </div>
  </div>
}

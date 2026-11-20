import { ConfigProvider } from 'antd'
import 'antd/dist/reset.css'
import zhCN from 'antd/locale/zh_CN'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { prepareIsolation } from './shared/utils/isolation'
import './styles/styles.css'
import './styles/system.css'
import './styles/creator.css'
import { studioTheme } from './styles/theme'
void prepareIsolation()
createRoot(document.getElementById('root')!).render(<StrictMode><ConfigProvider locale={zhCN} theme={studioTheme}><App /></ConfigProvider></StrictMode>)

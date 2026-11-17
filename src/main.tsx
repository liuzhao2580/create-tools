import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { prepareIsolation } from './isolation'
void prepareIsolation()
import { ConfigProvider } from 'antd'
import { studioTheme } from './theme'
import zhCN from 'antd/locale/zh_CN'
import 'antd/dist/reset.css'
import './styles.css'
import './system.css'
import './creator.css'
createRoot(document.getElementById('root')!).render(<StrictMode><ConfigProvider locale={zhCN} theme={studioTheme}><App /></ConfigProvider></StrictMode>)

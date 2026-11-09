import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { prepareIsolation } from './isolation'
void prepareIsolation()
import { ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import 'antd/dist/reset.css'
import './styles.css'
import './system.css'
createRoot(document.getElementById('root')!).render(<StrictMode><ConfigProvider locale={zhCN} theme={{ token: { colorPrimary: '#1677ff', borderRadius: 7, colorText: '#202b3c', colorBorder: '#dce3ec', controlHeight: 36, controlHeightLG: 40, fontFamily: '-apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif' } }}><App /></ConfigProvider></StrictMode>)

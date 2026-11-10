import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { edgeSpeechPlugin } from './server/edge-plugin.ts'
import { subtitleSpeechPlugin } from './server/subtitle-plugin.ts'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // 本机配音 API；开发服务器和 preview 均需要这两个插件。
    edgeSpeechPlugin(),
    subtitleSpeechPlugin(),
  ],

  // 使用相对资源路径，兼容部署到子目录。
  base: './',

  server: {
    host: '127.0.0.1',
    port: 5174,
    strictPort: true,
  },

  preview: {
    host: '127.0.0.1',
    port: 4173,
    strictPort: true,
  },
})

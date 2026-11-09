import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { edgeSpeechPlugin } from './server/edge-plugin.ts'
export default defineConfig({ plugins: [react(), edgeSpeechPlugin()], base: './' })

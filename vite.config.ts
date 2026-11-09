import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { subtitleSpeechPlugin } from './server/subtitle-plugin.ts'
import { edgeSpeechPlugin } from './server/edge-plugin.ts'
export default defineConfig({ plugins: [react(), edgeSpeechPlugin(), subtitleSpeechPlugin()], base: './' })

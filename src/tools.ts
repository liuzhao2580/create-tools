import { AudioLines, Captions, Image } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export interface ToolDefinition {
  id: string
  route: string
  name: string
  description: string
  icon: LucideIcon
}

// Add future tools here, then register their view in App.tsx.
export const toolRegistry: ToolDefinition[] = [
  { id: 'cover', route: '/cover', name: '封面编辑', description: '调整副标题并导出封面', icon: Image },
  { id: 'subtitles', route: '/subtitles', name: '字幕配音', description: '上传字幕，配音对齐画面', icon: Captions },
  { id: 'voice', route: '/voice', name: '文案配音', description: '把文案变成自然的声音', icon: AudioLines },
]

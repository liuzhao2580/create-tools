import { AudioLines, Captions, Image, LayoutTemplate } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export interface ToolDefinition {
  id: string
  route: string
  name: string
  description: string
  group: string
  icon: LucideIcon
}

// Add future tools here, then register their view in App.tsx.
export const toolRegistry: ToolDefinition[] = [
  { id: 'article', group: '公众号', route: '/article', name: '公众号排版', description: '编辑文章并复制公众号排版', icon: LayoutTemplate },
  { id: 'cover', group: '图片创作', route: '/board', name: '自由画板', description: '从空白画布编辑文字与图片', icon: Image },
  { id: 'subtitles', group: '音频创作', route: '/subtitles', name: '字幕配音', description: '上传字幕，配音对齐画面', icon: Captions },
  { id: 'voice', group: '音频创作', route: '/voice', name: '文案配音', description: '把文案变成自然的声音', icon: AudioLines },
]

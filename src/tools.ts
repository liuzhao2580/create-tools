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
  { id: 'titles', group: '公众号', route: '/titles', name: '标题模板', description: '分类选模板，编辑文章标题', icon: LayoutTemplate },
  { id: 'cover', group: '图片创作', route: '/cover', name: '封面编辑', description: '调整副标题并导出封面', icon: Image },
  { id: 'subtitles', group: '音频创作', route: '/subtitles', name: '字幕配音', description: '上传字幕，配音对齐画面', icon: Captions },
  { id: 'voice', group: '音频创作', route: '/voice', name: '文案配音', description: '把文案变成自然的声音', icon: AudioLines },
]

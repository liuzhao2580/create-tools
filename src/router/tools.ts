import type { LucideIcon } from 'lucide-react'
import { AudioLines,Captions,Image,LayoutTemplate } from 'lucide-react'

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
  { id: 'separation', group: '音频创作', route: '/separation', name: '人声分离', description: '提取人声、对比模型并导出音轨', icon: AudioLines },
  { id: 'article', group: '公众号', route: '/article', name: '公众号排版', description: '编辑文章并复制公众号排版', icon: LayoutTemplate },
  { id: 'cover', group: '图片创作', route: '/cover', name: '封面编辑', description: '上传封面、添加副标题并调整字体和位置', icon: Image },
  { id: 'board', group: '图片创作', route: '/board', name: '自由画板', description: '从空白画布编辑文字与图片', icon: Image },
  { id: 'subtitles', group: '音频创作', route: '/subtitles', name: '字幕配音', description: '上传字幕，配音对齐画面', icon: Captions },
  { id: 'voice', group: '音频创作', route: '/voice', name: '文案配音', description: '把文案变成自然的声音', icon: AudioLines },
]

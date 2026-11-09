import { AudioLines } from 'lucide-react'
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
  { id: 'voice', route: '/voice', name: '文案配音', description: '把文案变成自然的声音', icon: AudioLines },
]

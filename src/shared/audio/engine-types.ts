export type EngineStatus = 'idle' | 'downloading' | 'loading' | 'ready' | 'generating' | 'error'

export interface SupportInfo {
  supported: boolean
  webgpu: boolean
  message: string
  engineName: string
  modelName: string
  downloadLabel: string
  supportsReferenceAudio: boolean
  supportsReferenceText: boolean
  supportsTempo: boolean
  maxTextChars: number
}

export interface EngineProgress {
  stage: 'download' | 'load' | 'generate'
  progress: number | null
  message: string
}

export interface VoiceOptions {
  text: string
  tempo: number
  pauseSeconds: number
  referenceAudio?: File
  referenceText?: string
  signal: AbortSignal
  onProgress: (progress: EngineProgress) => void
}

export interface VoiceResult {
  audio: Blob
  durationSeconds: number
  mimeType: string
}

export interface BrowserVoiceEngine {
  inspectSupport: () => Promise<SupportInfo>
  loadModel: (options: { signal: AbortSignal; onProgress: (progress: EngineProgress) => void }) => Promise<void>
  generate: (options: VoiceOptions) => Promise<VoiceResult>
  unloadModel: () => Promise<void>
  clearModelCache: () => Promise<void>
}

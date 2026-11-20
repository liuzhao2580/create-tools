import { LoaderCircle } from 'lucide-react'
import type { EngineProgress } from '../audio/engine-types'

export function OperationProgress({ progress }: { progress: EngineProgress }) {
  const percent = progress.progress == null ? null : Math.max(0, Math.min(100, progress.progress))
  const stage = progress.stage === 'download' ? '下载模型' : progress.stage === 'load' ? '初始化模型' : '生成配音'
  return <div className="model-progress">
    <div className="model-progress-heading"><span><LoaderCircle size={15} className="spin" />{stage}</span><strong>{percent === null ? '处理中…' : `${Math.round(percent)}%`}</strong></div>
    <div className={`progress-track ${percent === null ? 'is-indeterminate' : ''}`} role="progressbar" aria-label={stage} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent ?? undefined} aria-valuetext={percent === null ? progress.message : `${Math.round(percent)}%，${progress.message}`}><span style={percent === null ? undefined : { width: `${percent}%` }} /></div>
    <p>{progress.message}</p>
  </div>
}


import { Alert, Button, Card, Input, Segmented, Select, Slider } from 'antd'
import { Children, isValidElement } from 'react'
import type { ReactNode } from 'react'

export function StudioButton({ children, className = '', onClick, disabled }: { children?: ReactNode; className?: string; onClick?: () => void; disabled?: boolean }) {
  const classes = className.split(' ')
  return <Button className={classes.filter(c => !['button', 'primary', 'secondary', 'subtle', 'danger-text'].includes(c)).join(' ')} type={classes.includes('primary') ? 'primary' : classes.includes('text-button') || classes.includes('reset-button') ? 'text' : 'default'} danger={classes.includes('danger-text')} disabled={disabled} onClick={onClick} size="large">{children}</Button>
}
export function StudioCard({ children, className, ...rest }: { children?: ReactNode; className?: string; 'aria-label'?: string }) {
  const items = Children.toArray(children)
  const heading = items.find(child => isValidElement<{ className?: string }>(child) && ['editor-header', 'controls-heading', 'result-heading', 'card-heading'].includes(child.props.className || ''))
  return <Card {...rest} className={className} title={heading}>{items.filter(child => child !== heading)}</Card>
}
export function StudioInput({ value, onValueChange, maxlength, spellcheck, type, ...props }: { value: string; onValueChange: (value: string) => void; className?: string; id?: string; type?: string; disabled?: boolean; placeholder?: string; maxlength?: number; rows?: number; 'aria-label'?: string; 'aria-describedby'?: string; spellcheck?: boolean }) {
  return type === 'textarea' ? <Input.TextArea {...props} value={value} maxLength={maxlength} spellCheck={spellcheck} onChange={event => onValueChange(event.target.value)} /> : <Input {...props} value={value} maxLength={maxlength} onChange={event => onValueChange(event.target.value)} size="large" />
}
export function VoiceSelect({ value, onValueChange, ...props }: { value: string; onValueChange: (value: string) => void; options: { value: string; label: string }[]; id?: string; disabled?: boolean; 'aria-label'?: string }) {
  return <Select {...props} value={value} onChange={onValueChange} size="large" className="voice-select" optionFilterProp="label" />
}
export function VoiceMode({ value, onValueChange, disabled }: { value: string; onValueChange: (value: string) => void; disabled: boolean }) {
  return <Segmented block size="large" value={value} onChange={onValueChange} disabled={disabled} className="voice-mode-control" aria-label="配音方式" options={[{ value: 'preset', label: '预设音色' }, { value: 'clone', label: '克隆音色' }]} />
}
export function VoiceSlider({ value, onValueChange, 'aria-label': label, ...props }: { value: number; onValueChange: (value: number) => void; min: number; max: number; step: number; disabled?: boolean; 'aria-label': string; id?: string }) {
  return <Slider {...props} value={value} onChange={onValueChange} ariaLabelForHandle={label} />
}
export function StudioAlert({ message, type, onClose }: { message: string; type: 'success' | 'error'; onClose: () => void }) {
  return <Alert title={message} type={type} showIcon closable={{ onClose }} className="workspace-alert" />
}

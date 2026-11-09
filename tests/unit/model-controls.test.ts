import { afterEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { OperationProgress } from '../../src/App'
import { F5BrowserEngine } from '../../src/engine/f5-engine'

afterEach(() => vi.unstubAllGlobals())
describe('模型进度与删除', () => {
  it('下载开始的 0% 也显示进度条，随后显示真实下载百分比', () => {
    for (const progress of [0, 42, 100]) {
      const html = renderToStaticMarkup(createElement(OperationProgress, { progress: { stage: 'download', progress, message: '下载模型文件' } }))
      expect(html).toContain('role="progressbar"')
      expect(html).toContain(`aria-valuenow="${progress}"`)
      expect(html).toContain(`${progress}%`)
    }
  })
  it('初始化没有可测百分比时仍显示进度条，不伪造百分比', () => {
    const html = renderToStaticMarkup(createElement(OperationProgress, { progress: { stage: 'load', progress: null, message: '初始化模型 1 / 3' } }))
    expect(html).toContain('role="progressbar"')
    expect(html).toContain('is-indeterminate')
    expect(html).not.toContain('aria-valuenow=')
    expect(html).toContain('初始化模型 1 / 3')
  })
  it('删除模型会先卸载，再删除包含完整文件和分片的模型专用缓存', async () => {
    const engine = new F5BrowserEngine()
    const unload = vi.spyOn(engine, 'unloadModel')
    const remove = vi.fn(async (name: string) => {
      expect(unload).toHaveBeenCalledOnce()
      expect(name).toBe('creator-tools-f5-v1')
      return true
    })
    vi.stubGlobal('caches', { delete: remove })
    await engine.clearModelCache()
    expect(remove).toHaveBeenCalledOnce()
  })
  it('缓存删除失败会向界面报告错误', async () => {
    vi.stubGlobal('caches', { delete: vi.fn().mockRejectedValue(new Error('存储不可用')) })
    await expect(new F5BrowserEngine().clearModelCache()).rejects.toThrow('存储不可用')
  })
})

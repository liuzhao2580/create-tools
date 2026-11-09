import { afterEach, describe, expect, it, vi } from 'vitest'
import { downloadRanges } from '../../src/engine/download'
afterEach(() => vi.unstubAllGlobals())
describe('模型分段下载', () => {
  it('按范围拼接，完成块可从缓存恢复而不重新请求', async () => {
    const saved = new Map<string, Response>()
    const cache = {
      match: async (url: string) => saved.get(url)?.clone(),
      put: async (url: string, response: Response) => { saved.set(url, response.clone()) },
      delete: async (url: string) => saved.delete(url),
    } as unknown as Cache
    const source = Uint8Array.from([2, 3, 5, 7, 11, 13, 17, 19])
    const fetch = vi.fn(async (_url, options) => {
      expect(options.headers.Range).toBe('bytes=0-7')
      return new Response(source, { status: 206, headers: { 'Content-Range': 'bytes 0-7/8' } })
    })
    vi.stubGlobal('fetch', fetch)
    expect(new Uint8Array(await downloadRanges('https://example.test/model', 8, () => {}, cache))).toEqual(source)
    expect(new Uint8Array(await downloadRanges('https://example.test/model', 8, () => {}, cache))).toEqual(source)
    expect(fetch).toHaveBeenCalledTimes(1)
  })
  it('拒绝服务器忽略范围而返回整份文件，不能缓存损坏模型', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(new Uint8Array(16), { status: 200 })))
    await expect(downloadRanges('https://example.test/model', 8, () => {})).rejects.toThrow('分段下载失败')
  })
})

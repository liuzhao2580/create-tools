/** Download fixed immutable large assets with bounded parallel HTTP ranges. */
export async function downloadRanges(url: string, size: number, onBytes: (bytes: number) => void, cache?: Cache): Promise<ArrayBuffer> {
  const bytes = new Uint8Array(size)
  const block = 4 * 1024 * 1024
  const count = Math.ceil(size / block)
  const progress = new Array<number>(count).fill(0)
  let next = 0
  const controller = new AbortController()
  async function consume() {
    while (next < count) {
      const index = next++
      const start = index * block, end = Math.min(size - 1, start + block - 1)
      const address = new URL(url)
      address.searchParams.set('part', String(start))
      const cached = await cache?.match(address.href)
      if (cached) {
        const data = new Uint8Array(await cached.arrayBuffer())
        if (data.length === end - start + 1) {
          bytes.set(data, start); progress[index] = data.length
          onBytes(progress.reduce((total, part) => total + part, 0)); continue
        }
        await cache?.delete(address.href)
      }
      let completed = false
      for (let attempt = 0; attempt < 3 && !completed; attempt++) {
        if (controller.signal.aborted) throw new DOMException('下载已停止', 'AbortError')
        try {
          const response = await fetch(address, { headers: { Range: `bytes=${start}-${end}` }, credentials: 'omit', signal: controller.signal })
          if (response.status !== 206 || !response.body) {
            await response.body?.cancel()
            throw new Error(`模型分段下载失败（HTTP ${response.status}）`)
          }
          const range = response.headers.get('Content-Range')
          if (range && range !== `bytes ${start}-${end}/${size}`) {
            await response.body.cancel()
            throw new Error('模型下载分段位置不匹配')
          }
          const reader = response.body.getReader()
          progress[index] = 0
          while (true) {
            const {done, value} = await reader.read()
            if (done) break
            if (progress[index] + value.length > end - start + 1) {
              await reader.cancel()
              throw new Error('模型分段大小异常')
            }
            bytes.set(value, start + progress[index]); progress[index] += value.length
            onBytes(progress.reduce((total, part) => total + part, 0))
          }
          if (progress[index] !== end - start + 1) throw new Error('模型分段下载不完整')
          try { await cache?.put(address.href, new Response(bytes.slice(start, end + 1))) } catch { /* storage optional */ }
          completed = true
        } catch (error) {
          progress[index] = 0
          if (attempt === 2 || controller.signal.aborted) throw error
          await new Promise((resolve) => setTimeout(resolve, (attempt + 1) * 1000))
        }
      }
    }
  }
  try { await Promise.all(Array.from({ length: Math.min(8, count) }, consume)) }
  catch (error) { controller.abort(); throw error }
  return bytes.buffer
}

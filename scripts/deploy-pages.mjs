import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

function git(args, cwd = process.cwd(), quiet = false) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: quiet ? ['ignore', 'pipe', 'pipe'] : 'inherit' })?.trim()
}
let temporaryDirectory
let worktree
try {
  const root = git(['rev-parse', '--show-toplevel'], undefined, true)
  if (git(['branch', '--show-current'], root, true) !== 'dev-lll') throw new Error('请在 dev-lll 分支运行此命令。')
  if (git(['status', '--porcelain'], root, true)) throw new Error('存在未提交的改动，请先提交代码，再执行发布。')
  git(['fetch', 'origin', 'dev-lll', 'dev-pages'], root)
  git(['merge-base', '--is-ancestor', 'origin/dev-lll', 'dev-lll'], root)
  const source = git(['rev-parse', 'dev-lll'], root, true)
  console.log('\n正在推送 dev-lll…')
  git(['push', 'origin', `${source}:refs/heads/dev-lll`], root)
  temporaryDirectory = mkdtempSync(join(tmpdir(), 'creator-tools-pages-'))
  worktree = join(temporaryDirectory, 'release')
  git(['worktree', 'add', '--detach', worktree, 'origin/dev-pages'], root)
  console.log('\n正在将 dev-lll 合并到 dev-pages…')
  git(['merge', '--no-edit', source], worktree)
  const workflow = readFileSync(join(worktree, '.github/workflows/pages.yml'), 'utf8')
  if (!/branches:\s*\[dev-pages\]/.test(workflow) || !workflow.includes('--base=/create-tools/')) {
    throw new Error('合并后的 Pages 工作流缺少 dev-pages 触发配置或 /create-tools/ 路径，已停止发布。')
  }
  console.log('\n正在推送 dev-pages…')
  git(['push', 'origin', 'HEAD:refs/heads/dev-pages'], worktree)
  console.log('\n发布分支已同步。若有新提交，GitHub Actions 将自动部署。')
  console.log('查看进度：https://github.com/liuzhao2580/create-tools/actions')
  console.log('站点地址：https://liuzhao2580.github.io/create-tools/')
} catch (error) {
  console.error('\n发布未完成：', error.message)
  console.error('若分支落后，请先同步；若存在合并冲突，请处理后重试。未进行强制推送。')
  process.exitCode = 1
} finally {
  if (worktree) {
    try { git(['worktree', 'remove', '--force', worktree]) }
    catch { console.error(`临时工作区未自动清理：${worktree}`); temporaryDirectory = undefined }
  }
  if (temporaryDirectory) rmSync(temporaryDirectory, { recursive: true, force: true })
}

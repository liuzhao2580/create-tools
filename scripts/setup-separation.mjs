import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
const root = fileURLToPath(new URL('../', import.meta.url))
let modelDir = join(root, '.local/separation-models')
try { modelDir = JSON.parse(readFileSync(join(root, '.local/separation-config.json'), 'utf8')).modelDir || modelDir } catch {}
modelDir = process.env.SEPARATION_MODEL_DIR || modelDir
console.log('模型安装位置：' + modelDir)
const env = join(root, '.local/separation-venv')
function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit' })
  if (result.error || result.status !== 0) { console.error(result.error?.message || '安装失败，请检查上方错误。'); process.exit(1) }
}
if (spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' }).status !== 0) {
  if (spawnSync('brew', ['--version'], { stdio: 'ignore' }).status !== 0) {
    console.error('未找到 FFmpeg 或 Homebrew。请先安装 Homebrew，再点击重试安装。'); process.exit(1)
  }
  console.log('正在安装 FFmpeg…')
  run('brew', ['install', 'ffmpeg'])
}
const python = process.env.SEPARATION_PYTHON || join(env, 'bin/python')
console.log('正在准备本地 Python 环境…')
if (!process.env.SEPARATION_PYTHON) run(process.env.PYTHON || 'python3', ['-m', 'venv', env])
run(python, ['-m', 'pip', 'install', '-r', 'server/separation-requirements.txt'])
run(python, ['-m', 'pip', 'check'])
console.log('正在安装全部分离模型及配置，并验证模型可以加载（首次下载可能较久）…')
run(python, ['-u', 'server/separate_audio.py', '--prepare', '--models', modelDir])
const check = spawnSync(process.env.SEPARATION_PYTHON || join(env, 'bin/python'), ['server/separate_audio.py', '--check', '--models', modelDir], { cwd: root, encoding: 'utf8' })
try {
  if (check.status !== 0 || !JSON.parse(check.stdout).ready) throw new Error()
} catch { console.error(check.stderr || check.stdout || '依赖安装后检查未通过，请查看安装日志。'); process.exit(1) }
console.log('安装检查完成。运行 npm run dev，进入“人声分离”。全部依赖及两个模型已安装验证，处理时无需下载模型。')

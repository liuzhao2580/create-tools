import { spawn } from 'node:child_process'
import { mkdirSync, openSync, writeFileSync, renameSync, closeSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
const root = fileURLToPath(new URL('../', import.meta.url))
const directory = join(root, '.local')
mkdirSync(directory, { recursive: true })
const state = join(directory, 'separation-install.json')
function save(status, message) {
  writeFileSync(state + '.tmp', JSON.stringify({ state: status, message, pid: process.pid }))
  renameSync(state + '.tmp', state)
}
save('running', '正在安装环境与全部模型…')
const log = openSync(join(directory, 'separation-install.log'), 'w')
const child = spawn(process.execPath, [join(root, 'scripts/setup-separation.mjs')], { cwd: root, env: process.env, stdio: ['ignore', log, log] })
child.on('error', error => save('error', error.message))
child.on('close', code => { closeSync(log); save(code === 0 ? 'done' : 'error', code === 0 ? '环境与全部模型安装验证完成。' : '安装未完成，已下载的完整模型会保留，点击继续安装。') })

# 声作 · 创作工具箱

React + TypeScript + Vite 配音工具，提供微软在线预设音色和 F5 浏览器本地音色克隆两种模式。

**F5 克隆仍是研究原型。** 页面、中文处理及构建已完成；原参考音色的相似度和生成稳定性仍需实际试听验证。不要把“支持参考音频”当作“效果与原 Qwen 工具一致”。

## 微软预设音色（2026-10-20）

默认提供晓晓、晓伊、云希、云扬、云健、云夏六种中文音色，可直接选择、生成试听、生成文案并下载 WAV，无需参考录音或模型下载。在线模式通过开源 [edge-tts](https://github.com/rany2/edge-tts) 调用微软 Edge 服务，无需 API Key；这不是 Azure 官方付费 API，不承诺无限配额或服务稳定性。文案会发送到微软，参考录音不会随在线请求发送。

本机需要 Python 3 和 `server/requirements.txt` 的依赖：

```sh
python3 -m venv .local/edge-venv
.local/edge-venv/bin/python -m pip install -r server/requirements.txt
npm run dev
```

Vite 开发和预览服务器自动提供 `/api/edge/health`、`/api/edge/speech`，仅接受本机同源请求。默认使用项目 `.local/edge-venv/bin/python`，也可通过 `EDGE_TTS_PYTHON` 指定 Python。生成进程从 stdin 接收文案，不把文案放入命令行或落盘；取消请求会终止进程。客户端逐段合成，解码成 24 kHz WAV 并插入设定段落停顿。

`npm run build` 生成的纯静态文件不包含 Python 服务。GitHub Pages 仅能运行 F5 本地克隆，在线音色会明确提示服务不可用；不能仅上传 dist 就宣称支持微软音色。

## 2026-10-14 验证记录

- React 构建通过；11 项单元测试通过。
- 桌面和 390px 手机布局检查通过，无横向溢出；文案草稿及 hash 路由刷新正常，页面运行无 JavaScript 错误。
- Qwen v0.1.54 和 v0.1.60 在这台 Mac 的 Chrome 中完成 WebGPU/跨源隔离探测，但运行时停在后端初始化；可视浏览器和关闭桥接 Worker 的对照也未生成音频。不能据此断言其他电脑都不可用。
- F5 编码器约 68.5 MB 已下载到测试浏览器缓存，ONNX 会话初始化通过；后续大权重受当前下载速度影响未完成。因此尚无音色试听结果，也没有完成真实配音端到端验收。
- 模型下载增加了完整性检查、分段缓存和恢复能力；首次使用仍需要网络。官方断点续传下载器的尝试保留在 `.local/f5-models/`，没有改动原有 Python 配音工具。
- 项目尚未发布 GitHub / GitHub Pages。下一项验收是完成模型下载、生成相同文案，并与原工具的声音作实际对照。

## 本地开发

使用 Node.js 24：

```sh
npm ci
npm run dev
npm test
npm run build
npm run preview
```

F5 配音计算在浏览器 Worker 内进行；微软音色需要保留本机语音接口服务。

## 当前两条研究路线

- `src/engine/f5-*`：F5-TTS 浏览器参考音色实验，中文使用音节级拼音输入；首次模型下载约 792 MB，需要 WebGPU 与 FP16。当前网页入口接入该研究适配器，尚不代表音色验收通过。
- `public/runtime/qwen/`：固定的 Qwen3-TTS 浏览器运行时资产；真实设备测试脚本位于本地忽略目录 `.local/`，尚未作为网页默认引擎。Qwen 运行时需 Memory64 和跨源隔离，模型另下载约 1.48 GB。现有浏览器接口只有参考音频，不等价于原 MLX 的参考音频加原文条件。

模型由浏览器从 Hugging Face 下载并缓存，文案及参考录音不发送到推理服务。换电脑需要重新下载模型、重新选择参考录音；草稿和结果不会自动跨设备同步。浏览器可能回收缓存，音频生成后请下载保存。

## 参考音频

当前 F5 原型使用 5–10 秒的清晰完整人声，以及与录音完全对应的文字。默认语速只是实验起点，不意味着与旧引擎的 0.88 倍听感相同。输出为 24 kHz 单声道 WAV。

私人参考录音、实际配音、模型权重和本机绝对路径不放入公开仓库。`.local/` 已忽略。

## GitHub Pages

验收音色后，将项目推送到自己的 GitHub 仓库。在 Settings → Pages 中，将 Source 设为 GitHub Actions。仓库已有 `.github/workflows/pages.yml`，会运行测试和构建，再发布 `dist`。使用相对资源路径和 hash 导航，兼容 `用户名.github.io/仓库名/`。

Qwen 实验的同源 service worker 用于静态站点跨源隔离；首访可能刷新一次。它不缓存网页或上传内容。该机制仍需在实际 Pages 域名复核，不能用本地预览替代上线验收。

## 增加新工具

1. 在 `src/tools.ts` 注册工具的 id、路由、名称及图标。
2. 新工具放在独立模块，在 `src/App.tsx` 接入对应页面。
3. 推理引擎与 UI 通过 `src/engine-types.ts` 分离；新模型实现 `BrowserVoiceEngine`，保留真实进度、取消与错误反馈。
4. 为核心逻辑添加测试；禁止用模拟音频充当实际生成结果。

## 来源和许可

项目自有代码使用 MIT。第三方运行时各自保留许可证。F5 模型卡与上游权重许可存在差异，详见 `F5-NOTICE.md`；不要将项目代码的 MIT 许可当作模型的商业使用许可。

- React：https://react.dev/versions
- Qwen 浏览器桥接：https://github.com/leehack/llama-web-bridge
- F5 浏览器实现：https://github.com/nsarang/voice-cloning-f5-tts
- F5 官方模型：https://huggingface.co/SWivid/F5-TTS

## 界面组件

界面继续使用 React，控件由 Ant Design 提供：Input / TextArea、Select、Segmented、Slider、Button、Card、Alert。`src/ui/antd.tsx` 封装受控值和业务回调，`src/main.tsx` 的 ConfigProvider 统一中文语言与主题。CSS 负责工作区布局与间距；不使用 Vue 或 Element Plus 运行时。

## 字幕配音：导回剪映保持时间对应（2026-10-25）

在本机运行 `npm run dev`，打开左侧 **字幕配音**。点击 **上传 SRT 并生成配音**，选择从剪映导出的 UTF-8 SRT，上传后自动合成。这里只上传要朗读的解说字幕，不包含原片对白或标题。

- 使用本机 Qwen3-TTS 已确认音色及原始参考的末尾收束版本，正常语速（tempo=1.0）；不使用浏览器 F5 或微软音色替代。
- 逐条生成，按 SRT 起点放入一条从第 0 秒开始的 48 kHz / PCM24 单声道 WAV；开头、句间和末尾到最后字幕结束的空白保留。不会自动延长到视频总长，末尾无配音不影响导入对齐。
- 如果任何一句实际录音超过其字幕时间，列出超出秒数并提供分段试听，阻止完整 WAV 导出。修改文案或字幕时段后重新上传；不会截断、重叠或擅自加速。
- 下载完整 WAV 后，将左边缘对齐剪映时间轴 **00:00:00**，不要删除音轨空白。改动视频或字幕时间后需要重新生成。
- 支持取消、刷新后恢复最近任务、分段试听。最大 200 KB、1000 条、2 小时，每条不超过 110 字，重叠或乱序字幕会报错。
- 每次上传建立独立任务，重新上传会重新合成。任务和原始录音保存在本项目 `.local/subtitle-jobs/`；关闭浏览器不会停止服务端任务，需要在页面取消，或关闭本机服务。结果不会上传到外部服务。

### 本地配置

当前制作电脑已配置 `.local/subtitle-voice.json`（已忽略，不进入公开源码）。在另一台设备使用时，复制 `server/subtitle-voice.example.json` 到该路径，填写 Python 可执行文件、已下载的模型目录、已确认音色参数 JSON 的绝对路径。

Python 需有 `mlx-audio`、`mlx`、`numpy`、`soundfile`，系统需有 `ffmpeg`，并具有可用的 Apple Silicon / Metal GPU。模型和参考文件须提前准备；本功能离线加载，不自动下载模型。音色参数须含 `status: "用户已确认"`、`reference_audio`、`reference_text`；有参考哈希时会验证一致性。

功能由 Vite 本机服务提供，`npm run dev` 和 `npm run preview` 均可使用。只部署 `dist` 到静态网站不能运行此功能，页面会提示启动本机服务。接口仅允许本机同源访问，一次运行一个字幕配音任务。

校验命令：`npm test`、`npm run build`；使用具备 numpy/soundfile 的 Python 运行 `python3 -m unittest discover -s server -p 'test_subtitle_voice.py'` 检查精确时间轴和超长拒绝行为。


## 标题模板（2026-11-07）
导航入口：#/titles。独立分类侧栏：二十四节气、正常文章标题、医疗饮食科普、心理与生活。首批8种模板，支持编辑主标题（最多3行）、副标题、标签，草稿保存在当前浏览器，导出1800×766 PNG。节气选择提供24个名称，不自动填写公历与农历日期。霜降用原创水墨背景，其他节气使用四季留白版；橙色手绘模板保留用户确认样例。模板定义与渲染位于src/TitleStudio.tsx，素材位于public/title-templates。用户参考截图归档于.local/title-template-references。

## 配置文件怎么改

配置结构参照 Vite 官方 React + TypeScript 模板，保留本项目需要的本机配音插件。

| 文件 | 职责 / 常用修改 |
| --- | --- |
| `vite.config.ts` | Vite 插件、`base` 部署路径、`server` 开发端口、`preview` 预览端口 |
| `tsconfig.json` | 只引用 app / node 两份配置，通常不用改 |
| `tsconfig.app.json` | `src` 前端代码的 TypeScript 检查，包含 DOM 类型 |
| `tsconfig.node.json` | Vite / Vitest 配置与 `server` 插件的类型检查，使用 Node 类型 |
| `vitest.config.ts` | 单元测试文件范围、测试环境；与网页开发配置独立 |

- `npm run dev`：开发地址 `http://127.0.0.1:5174`。修改 `server.port` 更换端口；`strictPort: true` 表示占用时直接报错，避免静默换端口。
- `npm run build`：先执行两份 TypeScript 配置的检查，再构建到 `dist`。
- `npm run preview`：在 `http://127.0.0.1:4173` 查看已构建页面，不是开发服务器。
- `npm test`：执行独立的 Vitest 配置，不会启动配音服务。
- `base: './'` 是本项目的相对资源路径配置；不是所有 Vite 项目都必须设置。按部署需求修改。
- `edgeSpeechPlugin` 和 `subtitleSpeechPlugin` 是项目自带的本机 API 插件，不是 Vite 官方内置插件。移除后，微软配音和字幕配音的本机接口不可用。
- 两份 TypeScript 配置保留现有 ES2022、strict 和 bundler 模块解析策略，不为照抄模板改变运行目标。
- `*.tsbuildinfo` 是自动生成的增量检查缓存，不是需要编辑的配置；现统一放入 `node_modules/.tmp`，已被 Git 忽略。

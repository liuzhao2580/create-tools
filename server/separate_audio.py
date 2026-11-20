"""Local source separation worker. Progress is atomic JSON; stdout/stderr go to job log."""
import argparse
from importlib.metadata import version
import json
import re
import os
from pathlib import Path
import shutil
import subprocess
import sys

MODELS = {
    'melband': 'vocals_mel_band_roformer.ckpt',
    'bsroformer': 'model_bs_roformer_ep_317_sdr_12.9755.ckpt',
}

DEFAULT_MODELS = Path(__file__).resolve().parent.parent / '.local/separation-models'

def check_models(directory):
    try:
        manifest = json.loads((directory / 'ready.json').read_text())
        assert manifest['version'] == version('audio-separator')
        assert manifest['models'] == MODELS
        for name, info in manifest['files'].items():
            stat = (directory / name).stat()
            assert stat.st_size == info['size'] and stat.st_mtime_ns == info['mtime']
        assert all(name in manifest['files'] for name in MODELS.values())
    except Exception as exc:
        raise RuntimeError('模型尚未完整安装或文件已变化，请点击一键安装环境与模型') from exc

def local_separator(**kwargs):
    from audio_separator.separator import Separator
    class LocalSeparator(Separator):
        def setup_torch_device(self, system_info):
            # Current macOS/PyTorch combination aborts inside MPS ISTFT, outside
            # Python exception handling. Use CPU before allocating model tensors.
            if sys.platform == 'darwin':
                import torch
                self.torch_device_cpu = torch.device('cpu')
                self.torch_device = self.torch_device_cpu
                self.torch_device_mps = None
                self.onnx_execution_provider = ['CPUExecutionProvider']
                self.logger.info('macOS 使用 CPU 兼容模式，避免 MPS 原生调用崩溃')
            else:
                super().setup_torch_device(system_info)

        def download_file_if_not_exists(self, url, output_path, verify_checksum=False):
            if not Path(output_path).is_file():
                raise RuntimeError('本地模型文件缺失，请重新安装：' + Path(output_path).name)
            if verify_checksum and not self.verify_model_file_checksum(output_path):
                raise RuntimeError('模型校验失败，请重新安装：' + Path(output_path).name)
    return LocalSeparator(**kwargs)

def prepare(directory):
    directory.mkdir(parents=True, exist_ok=True)
    (directory / 'ready.json').unlink(missing_ok=True)
    # Separate processes release model memory between validation runs.
    for model in MODELS:
        print('正在下载并验证模型：' + model, flush=True)
        subprocess.run([sys.executable, __file__, '--prepare-model', model,
                        '--models', str(directory)], check=True)
    files = {}
    for path in directory.iterdir():
        if path.suffix not in ('.ckpt', '.yaml', '.json') or path.name == 'ready.json':
            continue
        stat = path.stat()
        files[path.name] = {'size': stat.st_size, 'mtime': stat.st_mtime_ns}
    manifest = {'version': version('audio-separator'), 'models': MODELS, 'files': files}
    tmp = directory / 'ready.tmp'
    tmp.write_text(json.dumps(manifest))
    tmp.replace(directory / 'ready.json')
    check_models(directory)


def status(folder, **data):
    target = folder / 'status.json'
    tmp = folder / 'status.tmp'
    tmp.write_text(json.dumps(data, ensure_ascii=False), encoding='utf-8')
    tmp.replace(target)

def collect_tracks(folder, files):
    results = [{'name': '原始音频', 'file': 'original.wav', 'kind': 'original'}]
    for name in files:
        path = Path(name)
        if not path.is_absolute():
            path = folder / path
        if not path.is_file() or path.parent.resolve() != folder.resolve():
            raise RuntimeError('模型返回了无效的输出文件。')
        # Read the stem label, not the model suffix (which can also contain vocals).
        match = re.match(r'^original_(?:\(([^)]+)\)|([^_]+))(?:_|$)', path.stem, re.I)
        label = (next((x for x in match.groups() if x), '') if match else '').casefold()
        if label == 'vocals':
            kind, title = 'vocals', '人声'
        elif label in ('other', 'instrumental', 'no vocals', 'no_vocals'):
            kind, title = 'background', '背景音（含音乐和音效）'
        else:
            raise RuntimeError('无法识别输出音轨：' + path.name)
        results.append({'name': title, 'file': path.name, 'kind': kind})
    if not any(x['kind'] == 'vocals' for x in results) or not any(x['kind'] == 'background' for x in results):
        raise RuntimeError('模型输出缺少人声或背景音轨，请查看日志。')
    return results


def run(folder, model, start, duration, model_dir):
    try:
        check_models(model_dir)
        status(folder, state='running', message='正在提取所选区间的原始音频…')
        ffmpeg = shutil.which('ffmpeg')
        if not ffmpeg:
            raise RuntimeError('未找到 FFmpeg，请先安装 FFmpeg。')
        original = folder / 'original.wav'
        subprocess.run([ffmpeg, '-nostdin', '-v', 'error', '-ss', str(start), '-i', str(folder / 'input'),
                        *(['-t', str(duration)] if duration > 0 else []), '-vn', '-map', '0:a:0', '-ac', '2', '-ar', '44100',
                        '-c:a', 'pcm_s24le', str(original)], check=True)
        if original.stat().st_size < 1000:
            raise ValueError('所选区间没有音频，请检查起始时间。')
        status(folder, state='running', message='正在加载已安装的本地模型…')
        separator = local_separator(model_file_dir=str(model_dir), output_dir=str(folder), output_format='WAV',
                              normalization_threshold=0.9)
        separator.load_model(model_filename=MODELS[model])
        status(folder, state='running', message='正在分离人声与背景音（macOS 使用 CPU 兼容模式），请保持本地服务运行…')
        files = separator.separate(str(original))
        results = collect_tracks(folder, files)
        status(folder, state='done', message='分离完成。请对比人声自然度和音乐残留。', tracks=results)
    except Exception as exc:
        import traceback
        traceback.print_exc()
        status(folder, state='error', message=f'处理失败：{exc}')
        return 1
    return 0

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--check', action='store_true')
    parser.add_argument('--job')
    parser.add_argument('--model', choices=MODELS)
    parser.add_argument('--start', type=float)
    parser.add_argument('--duration', type=float)
    parser.add_argument('--models', default=str(DEFAULT_MODELS))
    parser.add_argument('--prepare', action='store_true')
    parser.add_argument('--prepare-model', choices=MODELS)
    args = parser.parse_args()
    if args.prepare:
        prepare(Path(args.models))
    elif args.prepare_model:
        from audio_separator.separator import Separator
        separator = Separator(model_file_dir=args.models)
        separator.load_model(model_filename=MODELS[args.prepare_model])
        print('模型加载验证通过：' + args.prepare_model, flush=True)
    elif args.check:
        try:
            from contextlib import redirect_stdout
            with redirect_stdout(sys.stderr):
                from audio_separator.separator import Separator
            if not shutil.which('ffmpeg'):
                raise RuntimeError('未找到 FFmpeg')
            check_models(Path(args.models))
            result = {'ready': True, 'message': '本地服务已就绪'}
        except Exception as exc:
            result = {'ready': False, 'message': f'分离环境不完整：{exc}。请点击一键安装环境与模型。'}
        print(json.dumps(result, ensure_ascii=False))
    else:
        sys.exit(run(Path(args.job), args.model, args.start, args.duration, Path(args.models)))

"""Local approved voice synthesis. Stdout is NDJSON; model diagnostics go to stderr."""
import contextlib
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys

SR = 48000

def emit(**event):
    print(json.dumps(event, ensure_ascii=False), flush=True)

def load_config(config_path):
    config = json.loads(Path(config_path).read_text())
    profile = json.loads(Path(config['profile']).read_text())
    if profile.get('status') != '用户已确认':
        raise ValueError('音色尚未确认，请检查本地音色参数文件。')
    reference = Path(profile['reference_audio'])
    if not reference.is_file() or not Path(config['model']).is_dir():
        raise ValueError('找不到本地模型或已确认音色参考，请检查配置。')
    expected = profile.get('generation_reference_sha256') or profile.get('reference_audio_sha256')
    if expected and hashlib.sha256(reference.read_bytes()).hexdigest() != expected:
        raise ValueError('音色参考与已确认文件不一致，请恢复参考文件。')
    if not shutil.which('ffmpeg'):
        raise ValueError('未找到 ffmpeg，请安装后重启服务。')
    return config, profile

def write_timeline(cues, files, destination):
    """Stream silence to disk, never shift cues or cut speech to fit."""
    import numpy as np
    import soundfile as sf
    with sf.SoundFile(destination, 'w', samplerate=SR, channels=1, subtype='PCM_24') as output:
        cursor = 0
        def silence(count):
            while count > 0:
                size = min(count, SR)
                output.write(np.zeros(size, dtype=np.float32))
                count -= size
        for cue, file in zip(cues, files, strict=True):
            audio, rate = sf.read(file, dtype='float32')
            start, end = round(cue['start'] * SR), round(cue['end'] * SR)
            if rate != SR or audio.ndim != 1 or start < cursor or len(audio) > end - start:
                raise ValueError('配音超出字幕时间，不能导出同步音轨。')
            silence(start - cursor)
            output.write(audio)
            cursor = start + len(audio)
        silence(round(cues[-1]['end'] * SR) - cursor)

def run(config_path, out):
    config, profile = load_config(config_path)
    os.environ['HF_HUB_OFFLINE'] = '1'
    os.environ['TRANSFORMERS_OFFLINE'] = '1'
    with contextlib.redirect_stdout(sys.stderr):
        import numpy as np
        import soundfile as sf
        import mlx.core as mx
        from mlx_audio.tts.utils import load_model
    if out is None:
        emit(ready=True)
        return
    out = Path(out)
    cues = json.loads((out / 'input.json').read_text())['cues']
    emit(message='正在加载已确认音色…')
    with contextlib.redirect_stdout(sys.stderr):
        model = load_model(config['model'])
    def decode(codes):
        if codes.shape[1] >= 350:
            raise ValueError('本条生成过长，请将字幕按完整意思拆短。')
        wave = model.speech_tokenizer.decoder(mx.transpose(codes, (0, 2, 1))).squeeze(1)
        mx.eval(wave)
        return wave, mx.array([wave.shape[1]])
    model.speech_tokenizer.decode = decode
    files, results = [], []
    for i, cue in enumerate(cues):
        emit(message=f'正在生成第 {i + 1}/{len(cues)} 条…')
        mx.random.seed(profile.get('seed', 1021001) + i)
        with contextlib.redirect_stdout(sys.stderr):
            chunks = list(model.generate(text=cue['text'], ref_audio=profile['reference_audio'], ref_text=profile['reference_text'], lang_code='chinese', split_pattern='', temperature=profile.get('temperature', .7), top_p=profile.get('top_p', .95), repetition_penalty=profile.get('repetition_penalty_requested', 1.1), max_tokens=350, verbose=False))
        if len(chunks) != 1 or chunks[0].token_count >= 350:
            raise ValueError(f'第 {i + 1} 条生成不完整，请缩短文案后重试。')
        raw = np.asarray(chunks[0].audio).reshape(-1)
        if not len(raw) or not np.isfinite(raw).all() or np.max(abs(raw)) < .0001:
            raise ValueError(f'第 {i + 1} 条没有有效人声，请重试。')
        original, final = out / f'raw-{i + 1}.wav', out / f'cue-{i + 1}.wav'
        sf.write(original, raw, chunks[0].sample_rate, subtype='PCM_24')
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(original), '-af', 'loudnorm=I=-18:TP=-2:LRA=7', '-ar', str(SR), '-ac', '1', '-c:a', 'pcm_s24le', str(final)], check=True, timeout=60, stdout=sys.stderr)
        frames = sf.info(final).frames
        overflow = max(0, frames - (round(cue['end'] * SR) - round(cue['start'] * SR))) / SR
        item = dict(**cue, seconds=frames / SR, overflow=overflow, file=final.name)
        results.append(item); files.append(final)
        emit(result=item, completed=i + 1)
        mx.clear_cache()
    blocked = any(item['overflow'] > 0 for item in results)
    if not blocked:
        write_timeline(cues, files, out / 'timeline.wav')
    report = dict(state='needs-edit' if blocked else 'complete', results=results, profile=profile, tempo=1.0, start_seconds=0, duration=cues[-1]['end'], message='有配音超过字幕时长，请调整字幕后重新上传。' if blocked else '配音已完成，导入剪映后对齐第 0 秒。')
    (out / 'report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2))
    emit(state=report['state'], message=report['message'])

if __name__ == '__main__':
    try:
        run(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else None)
    except Exception as exc:
        emit(error=str(exc))
        sys.exit(1)

"""Single-request bridge. Text travels via stdin, audio via stdout; no files/logged text."""
import asyncio
import json
import sys
from pathlib import Path
import edge_tts

async def main():
    if '--check' in sys.argv:
        print('ready')
        return
    payload = json.load(sys.stdin)
    voices = json.loads((Path(__file__).parent.parent / 'src/voices.json').read_text())
    if payload.get('voice') not in {v['id'] for v in voices}:
        raise ValueError('不支持的音色')
    text = payload.get('text')
    tempo = payload.get('tempo', 1)
    if not isinstance(text, str) or not text.strip() or len(text) > 5000:
        raise ValueError('文案应为 1–5000 字')
    if not isinstance(tempo, (float, int)) or not 0.65 <= tempo <= 1.25:
        raise ValueError('语速超出范围')
    rate = f'{round((tempo - 1) * 100):+d}%'
    async for chunk in edge_tts.Communicate(text, payload['voice'], rate=rate).stream():
        if chunk['type'] == 'audio':
            sys.stdout.buffer.write(chunk['data'])
    sys.stdout.buffer.flush()

if __name__ == '__main__':
    try:
        asyncio.run(main())
    except Exception as error:
        # Do not include input text in errors or logs.
        print(type(error).__name__, file=sys.stderr)
        sys.exit(1)

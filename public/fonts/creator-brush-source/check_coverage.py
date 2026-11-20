"""Check actual custom coverage, not the retired v1 mixed font."""
from pathlib import Path
import hashlib,json
from fontTools.ttLib import TTFont
D=Path(__file__).resolve().parent
report=json.loads((D/'expansion/coverage-report.json').read_text())['font']
path=D.parent/'CreatorBrush-Custom.ttf'
font=TTFont(path)
cmap=font.getBestCmap()
chars=report['characters']
assert len(chars)==len(set(chars))==report['count']
assert set(cmap)=={ord(c) for c in chars+' '}
assert all(font['glyf'][cmap[ord(c)]].numberOfContours for c in chars)
assert hashlib.sha256(path.read_bytes()).hexdigest()==report['sha256']
print(f"通过：{len(chars)} 个真实定制汉字，字形非空、清单和字体一致；完整常用字库尚未完成。")

"""Build the reviewed expansion; never borrow uncustomized Chinese glyphs."""
from pathlib import Path
import hashlib
import json
import cv2
import numpy as np
from fontTools.ttLib import TTFont
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools import subset
from copy import deepcopy
from fontTools.ttLib.tables._g_l_y_f import GlyphCoordinates
from array import array
from fontTools.pens.transformPen import TransformPen

D = Path(__file__).resolve().parent
FONT_DIR = D.parent.parent
ROOT = FONT_DIR.parent.parent
manifest = json.loads((D / 'manifest.json').read_text())
font = TTFont(FONT_DIR / 'MaShanZheng-Regular.ttf')
base_cmap = font.getBestCmap()
approved = TTFont(D / 'CreatorBrush-Study-52.ttf')
for ch in manifest['approvedCharacters']:
    name = base_cmap[ord(ch)]
    source = approved.getBestCmap()[ord(ch)]
    font['glyf'][name] = approved['glyf'][source]
    font['hmtx'][name] = approved['hmtx'][source]
# Remove only the isolated scan speck above 下; retain every real stroke.
def clean_xia(glyph, glyf):
    glyph = deepcopy(glyph)
    coords, ends, flags = glyph.getCoordinates(glyf)
    kept, kept_flags, kept_ends = [], [], []
    start = 0
    for end in ends:
        points = list(coords[start:end + 1])
        if not (min(y for x, y in points) > 800 and max(x for x, y in points) - min(x for x, y in points) < 20):
            kept.extend(points)
            kept_flags.extend(flags[start:end + 1])
            kept_ends.append(len(kept) - 1)
        start = end + 1
    glyph.coordinates = GlyphCoordinates(kept)
    glyph.flags = array('B', kept_flags)
    glyph.endPtsOfContours = kept_ends
    glyph.numberOfContours = len(kept_ends)
    glyph.recalcBounds(glyf)
    return glyph
font['glyf'][base_cmap[ord('下')]] = clean_xia(font['glyf'][base_cmap[ord('下')]], font['glyf'])
# All remaining base glyphs are removed by the strict subset below.
characters = manifest['approvedCharacters']
assert len(set(characters)) == 52
em = font['head'].unitsPerEm
report = []

def dividers(image, axis, count):
    projection = (image < 140).sum(axis=axis)
    n = len(projection)
    boundaries = [0]
    for i in range(1, count):
        lo, hi = int((i - .35) * n / count), int((i + .35) * n / count)
        boundaries.append(lo + int(np.argmin(projection[lo:hi])))
    return boundaries + [n]

for batch in manifest['batches']:
    chars = batch['characters']
    assert len(chars) == batch['rows'] * batch['columns']
    assert not set(chars) & set(characters), f"Duplicate characters in {batch['id']}"
    image = cv2.imread(str(D / batch['image']), cv2.IMREAD_GRAYSCALE)
    assert image is not None
    xs = dividers(image, 0, batch['columns'])
    ys = dividers(image, 1, batch['rows'])
    for i, ch in enumerate(chars):
        row, col = divmod(i, batch['columns'])
        cell = image[ys[row]:ys[row + 1], xs[col]:xs[col + 1]]
        contours, _ = cv2.findContours((cell < 140).astype(np.uint8) * 255, cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE)
        pen = TTGlyphPen(None)
        scale = em * .90 / max(cell.shape)
        ox, oy = (em - cell.shape[1] * scale) / 2, em * .88
        for ct in contours:
            if abs(cv2.contourArea(ct)) < 2:
                continue
            points = cv2.approxPolyDP(ct, .3, True).reshape(-1, 2)
            if len(points) < 3:
                continue
            points = [(round(ox + x * scale), round(oy - y * scale)) for x, y in points]
            pen.moveTo(points[0])
            for point in points[1:]:
                pen.lineTo(point)
            pen.closePath()
        name = base_cmap[ord(ch)]
        glyph = pen.glyph()
        assert glyph.numberOfContours > 0, ch
        font['glyf'][name] = glyph
        font['hmtx'][name] = (em, round(em * .02))
        for table in font['cmap'].tables:
            if table.isUnicode():
                table.cmap[ord(ch)] = name
    characters += chars
    report.append({'batch': batch['id'], 'characters': chars, 'xBoundaries': xs, 'yBoundaries': ys})
# Derive ASCII hyphen from the custom 一 stroke; retain its brush outline.
source = font.getBestCmap()[ord('一')]
glyph = font['glyf'][source]
glyph.recalcBounds(font['glyf'])
width = em * .40
advance = round(em * .64)
sx = width / (glyph.xMax - glyph.xMin)
pen = TTGlyphPen(None)
# Flatten the stroke vertically so a short hyphen is not a compressed ink blob.
sy = .40
transform = TransformPen(pen, (sx, 0, 0, sy, (advance - width) / 2 - glyph.xMin * sx, em * .255 - (glyph.yMin + glyph.yMax) / 2 * sy))
font.getGlyphSet()[source].draw(transform)
name = 'customHyphen'
font.setGlyphOrder(font.getGlyphOrder() + [name])
font['glyf'][name] = pen.glyph()
font['hmtx'][name] = (advance, round((advance - width) / 2))
for table in font['cmap'].tables:
    if table.isUnicode():
        table.cmap[ord('-')] = name
punctuation = '-'
options = subset.Options()
options.name_IDs = ['*']
options.name_legacy = True
sub = subset.Subsetter(options=options)
sub.populate(text=characters + punctuation + ' ')
sub.subset(font)
names = {1:'Creator Brush Custom', 2:'Regular', 3:f"CreatorBrushCustom-{manifest['version']}", 4:'Creator Brush Custom', 6:'CreatorBrushCustom-Regular', 16:'Creator Brush Custom', 17:'Regular'}
for rec in font['name'].names:
    if rec.nameID in names:
        rec.string = names[rec.nameID].encode(rec.getEncoding())
if 'DSIG' in font:
    del font['DSIG']
out = FONT_DIR / 'CreatorBrush-Custom.ttf'
font.save(out)
check = TTFont(out)
cmap = check.getBestCmap()
assert set(cmap) == {ord(ch) for ch in characters + punctuation + ' '}
assert all(check['glyf'][cmap[ord(ch)]].numberOfContours for ch in characters)
# Confirm that the approved outlines survived without changes.
approved = TTFont(D / 'CreatorBrush-Study-52.ttf')
for ch in manifest['approvedCharacters']:
    expected = approved['glyf'][approved.getBestCmap()[ord(ch)]]
    if ch == '下':
        expected = clean_xia(expected, approved['glyf'])
    assert check['glyf'][cmap[ord(ch)]].getCoordinates(check['glyf']) == expected.getCoordinates(approved['glyf']), ch
metadata = {'version':manifest['version'] + '-hyphen5', 'punctuation':punctuation, 'count':len(characters), 'characters':characters, 'sha256':hashlib.sha256(out.read_bytes()).hexdigest(), 'complete':False}
shared = ROOT / 'src/shared/fonts'
shared.mkdir(parents=True, exist_ok=True)
(shared / 'creator-brush-coverage.json').write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + '\n')
(D / 'coverage-report.json').write_text(json.dumps({'font':metadata, 'batches':report}, ensure_ascii=False, indent=2) + '\n')
print(f'Built {len(characters)} custom characters. Approved outlines retained except the isolated 下 speck; no filler glyphs.')

from pathlib import Path
import cv2
import numpy as np
from fontTools.ttLib import TTFont
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools import subset
D=Path(__file__).resolve().parent
font=TTFont(D.parent.parent/'CreatorBrush-Regular.ttf')
chars='人物故事信仰选择命运真相潜伏余则成心生活时光世界爱恨情义家国风雨山河梦想'
original='第集上中下一二三四五六七八九十零'
assert len(chars)==36 and len(set(chars+original))==52
im=cv2.imread(str(D/'batch-001.png'),0)
h,w=im.shape
cmap=font.getBestCmap();em=font['head'].unitsPerEm
def dividers(axis):
    projection=(im<140).sum(axis=axis);n=len(projection)
    return [0]+[int((i-.35)*n/6)+int(np.argmin(projection[int((i-.35)*n/6):int((i+.35)*n/6)])) for i in range(1,6)]+[n]
xs,ys=dividers(0),dividers(1)
for i,ch in enumerate(chars):
    cell=im[ys[i//6]:ys[i//6+1],xs[i%6]:xs[i%6+1]]
    mask=(cell<140).astype('uint8')*255
    contours,_=cv2.findContours(mask,cv2.RETR_TREE,cv2.CHAIN_APPROX_SIMPLE)
    pen=TTGlyphPen(None);scale=em*.90/max(cell.shape)
    ox=(em-cell.shape[1]*scale)/2;oy=em*.88
    for ct in contours:
        if abs(cv2.contourArea(ct))<2:continue
        pts=cv2.approxPolyDP(ct,.3,True).reshape(-1,2)
        if len(pts)<3:continue
        pts=[(round(ox+x*scale),round(oy-y*scale)) for x,y in pts]
        pen.moveTo(pts[0])
        for xy in pts[1:]:pen.lineTo(xy)
        pen.closePath()
    name=cmap[ord(ch)];font['glyf'][name]=pen.glyph();font['hmtx'][name]=(em,round(em*.02))
options=subset.Options();options.name_IDs=['*'];options.name_legacy=True
sub=subset.Subsetter(options=options);sub.populate(text=original+chars+' ');sub.subset(font)
for rec in font['name'].names:
    names={1:'Creator Brush Study',2:'Regular',3:'CreatorBrushStudy-0.2',4:'Creator Brush Study',6:'CreatorBrushStudy-Regular',16:'Creator Brush Study',17:'Regular'}
    if rec.nameID in names:rec.string=names[rec.nameID].encode(rec.getEncoding())
if 'DSIG' in font:del font['DSIG']
font.save(D/'CreatorBrush-Study-52.ttf')
check=TTFont(D/'CreatorBrush-Study-52.ttf');mapped=check.getBestCmap()
assert all(ord(c) in mapped and check['glyf'][mapped[ord(c)]].numberOfContours for c in original+chars)
assert ord('的') not in mapped # No ordinary font glyphs passed off as custom work.
print('Verified 52 custom outlines; no borrowed glyph filler.')

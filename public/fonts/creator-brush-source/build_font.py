from pathlib import Path
import cv2, numpy as np, shutil
from fontTools.ttLib import TTFont
from fontTools.pens.ttGlyphPen import TTGlyphPen
from PIL import Image,ImageDraw,ImageFont
W=Path(__file__).resolve().parent;D=W.parent;R=D.parent.parent
src=W/'glyph-master.png'
f=TTFont(D/'MaShanZheng-Regular.ttf');cmap=f.getBestCmap();em=f['head'].unitsPerEm
im=cv2.imread(str(src),0);h,w=im.shape
chars='第集上中下一二三四五六七八九十零'
for i,ch in enumerate(chars):
 cell=im[round(i//4*h/4):round((i//4+1)*h/4),round(i%4*w/4):round((i%4+1)*w/4)]
 mask=(cell<140).astype(np.uint8)*255
 contours,_=cv2.findContours(mask,cv2.RETR_TREE,cv2.CHAIN_APPROX_SIMPLE)
 pen=TTGlyphPen(None);scale=em*.96/max(cell.shape)
 for ct in contours:
  if abs(cv2.contourArea(ct))<2:continue
  pts=cv2.approxPolyDP(ct,.35,True).reshape(-1,2)
  if len(pts)<3:continue
  pts=[(round(em*.02+x*scale),round(em*.88-y*scale)) for x,y in pts]
  pen.moveTo(pts[0])
  for xy in pts[1:]:pen.lineTo(xy)
  pen.closePath()
 name=cmap[ord(ch)];f['glyf'][name]=pen.glyph();f['hmtx'][name]=(em,round(em*.02))
for rec in f['name'].names:
 if rec.nameID in [1,2,3,4,6,16,17]:
  val={1:'Creator Brush',2:'Regular',3:'CreatorBrush-Regular-1.0',4:'Creator Brush Regular',6:'CreatorBrush-Regular',16:'Creator Brush',17:'Regular'}[rec.nameID];rec.string=val.encode(rec.getEncoding())
if 'DSIG' in f:del f['DSIG']
out=D/'CreatorBrush-Regular.ttf';f.save(out);check=TTFont(out);assert all(ord(x) in check.getBestCmap() for x in chars+'0123456789百')
shutil.copy2(D/'mashanzheng-OFL.txt',D/'creatorbrush-OFL.txt')

preview=Image.new('RGB',(1400,700),'#151515');draw=ImageDraw.Draw(preview);font=ImageFont.truetype(str(out),110)
for j,line in enumerate(['第十四集　上中下','第一集　第二十集','第1集　第30集']):draw.text((60,40+j*205),line,font=font,fill='white')
preview.save(W/'字体预览.png')
print(out)

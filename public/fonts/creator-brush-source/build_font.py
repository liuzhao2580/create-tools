from pathlib import Path
import cv2, numpy as np, shutil
from fontTools.ttLib import TTFont
from fontTools.pens.ttGlyphPen import TTGlyphPen
from PIL import Image,ImageDraw,ImageFont
R=Path('/Volumes/liu/MoviesClips/creator-tools');D=R/'public/fonts';W=D/'creator-brush-source';W.mkdir(exist_ok=True)
src=Path('/Users/lloyd/.codex/generated_images/01a15324-9de7-7f23-a5fb-d0e7134295ae/exec-83aca388-1f50-4d54-8de9-a631352eb832.png');shutil.copy2(src,W/'glyph-master.png')
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
(W/'说明.txt').write_text('Creator Brush v1\n定制字形：'+chars+'\n其余字符沿用 Ma Shan Zheng（OFL），并非全部字都已定制。使用内置图像生成制作16字母稿，再转换轮廓；不是从原封面恢复的完整原字体。白色和阴影通过编辑器设置。\n母稿提示：4×4等距格，按第集上中/下一二三/四五六七/八九十零排列，参考第十四集题字的粗笔飞白书法，纯黑字白底，无阴影，字形独立。\n')
preview=Image.new('RGB',(1400,700),'#151515');draw=ImageDraw.Draw(preview);font=ImageFont.truetype(str(out),110)
for j,line in enumerate(['第十四集　上中下','第一集　第二十集','第1集　第30集']):draw.text((60,40+j*205),line,font=font,fill='white')
preview.save(W/'字体预览.png')
p=R/'src/cover.css';s=p.read_text();s='@font-face{font-family:"Creator Brush";src:url("/fonts/CreatorBrush-Regular.ttf") format("truetype");font-display:swap;}\n'+s;p.write_text(s)
p=R/'src/CoverStudio.tsx';s=p.read_text().replace('const artFonts = [',"const artFonts = [{ value: 'Creator Brush', label: '定制毛笔体 · 集数常用字' }, ").replace('内置 4 款中文艺术字体','内置 5 款中文艺术字体').replace('无需安装。系统字体','无需安装。定制毛笔体已制作集数常用16字，其余字沿用马善政楷书。系统字体');p.write_text(s)
print(out)

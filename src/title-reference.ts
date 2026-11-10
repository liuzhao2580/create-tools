/** Coordinates are normalized to 1800px wide. Each reference owns its typography layout. */
export type TitleLayer = { text: 'title' | 'subtitle' | 'tag' | string; x: number; y: number; width: number; size: number; color: string; font?: string; weight?: number; align?: CanvasTextAlign; rotate?: number; italic?: boolean; stroke?: string; lineHeight?: number; lineColors?: string[]; highlights?: [string, string][] }
export type ReferenceTemplate = { id: string; category: string; name: string; style: string; color: string; title: string; subtitle: string; tag: string; font: string; background: string; height: number; layers: TitleLayer[]; html?: boolean }
const layer=(text:string,x:number,y:number,width:number,size:number,color:string,extra:Partial<TitleLayer>={}):TitleLayer=>({text,x,y,width,size,color,...extra})
const main=(x:number,y:number,width:number,size:number,color:string,extra:Partial<TitleLayer>={})=>layer('title',x,y,width,size,color,extra)
const sub=(x:number,y:number,width:number,size:number,color:string,extra:Partial<TitleLayer>={})=>layer('subtitle',x,y,width,size,color,extra)
const tag=(x:number,y:number,width:number,size:number,color:string,extra:Partial<TitleLayer>={})=>layer('tag',x,y,width,size,color,extra)
function make(group:string,n:number,name:string,title:string,subtitle:string,tagText:string,font:string,layers:TitleLayer[]):ReferenceTemplate {
 return {id:`${group}-${n}`,category:group==='life'?'生活与活动':group==='news'?'资讯与科普':'政务与庆典',name,title,subtitle,tag:tagText,font,layers,style:'reference',color:layers[0].color,background:`title-templates/reference/${group}-${String(n).padStart(2,'0')}.png`,height:group==='red'?540:766}
}
export const referenceTemplates:ReferenceTemplate[]=[
 make('life',1,'夏日美食市集','夏日美食市集','尝遍人间烟火气','好吃 / 好玩 / 好生活','思源黑体',[
 main(600,254,1050,150,'#f26a20',{weight:900}),sub(530,398,740,48,'#fff'),tag(570,118,1000,48,'#5f8f2f'),layer('时间：6月19日—6月22日  10:00—21:00',200,596,1000,32,'#333b20',{align:'left'}),layer('地点：市集生活中心广场',200,666,900,32,'#333b20',{align:'left'})]),
 make('life',2,'碳水狂欢节','碳水狂欢节','CARB CARNIVAL','可瓦碳尼快乐','站酷快乐体',[
 main(690,265,1200,177,'#8b231c',{weight:900,rotate:-2}),sub(860,398,700,32,'#9a6331'),tag(470,115,700,45,'#c77f38',{rotate:-8}),layer('5.30 — 5.31',800,113,400,39,'#fff')]),
 make('life',3,'被美食治愈的瞬间','被美食\n治愈的瞬间','FOOD','生活的小美好','站酷快乐体',[
 main(626,340,1130,176,'#a94929',{rotate:4,lineHeight:1.15,lineColors:['#fffbea','#a94929']}),sub(1020,208,340,61,'#be5930',{rotate:9}),tag(490,660,700,34,'#9d683e')]),
 make('life',4,'新生入学指南','新生入学指南','NEW STUDENT ORIENTATION GUIDE','点击领取开学攻略','思源黑体',[
 main(900,342,1290,168,'#fff',{weight:800,italic:true}),sub(900,510,1200,42,'#fff'),tag(900,624,600,38,'#2876ac')]),
 make('life',5,'每周营养食谱','每周营养食谱','健康美味全搭配','NUTRITION & HEALTH','站酷庆科黄油体',[
 main(907,329,1170,169,'#181b18',{weight:900}),sub(935,515,760,66,'#333414'),tag(900,182,850,25,'#477f4a')]),
 make('life',6,'夏日水果拼贴','SUMMER','你好！','夏','思源黑体',[
 main(940,185,1370,239,'#badff2',{weight:200}),sub(1350,460,620,200,'#d8b584',{font:'站酷庆科黄油体'}),tag(335,335,330,280,'#ed714d',{font:'站酷庆科黄油体'}),layer('THE SUN SHINES BRIGHTLY AND THE DAYS ARE LONG',770,680,1260,21,'#82b9cf')]),
 make('life',7,'告别放养式暑假','告别 放养式 暑假','作业有人管　　午餐有人做　　安全有保障','暑 期 托 管','站酷快乐体',[
 main(910,427,1540,152,'#65483b',{weight:900,highlights:[['放养式','#82b8e9']]}),sub(900,621,1470,49,'#76514c'),tag(970,165,900,100,'#705238')]),
 make('life',8,'低碳环保绿色生活','<低碳环保\n绿色生活>','践行绿色生活','低碳地球我守护','思源黑体',[
 main(920,364,1300,154,'#f7ffe6',{weight:800}),sub(349,621,520,46,'#75984e',{rotate:8}),tag(1478,280,490,38,'#75984e',{rotate:-12})]),
 make('life',9,'毕业音乐会','毕业　\n　音乐会','GRADUATION\nMUSIC FESTIVAL','青春不散场','站酷庆科黄油体',[
 main(666,387,1200,250,'#e9addb',{stroke:'#785b78',lineHeight:1.02}),sub(1370,157,750,66,'#69516b',{font:'站酷小薇'}),tag(1100,110,600,31,'#846377')]),
 make('life',10,'五一放假通知','放假通知','HOLIDAY NOTICE','5.1','思源黑体',[
 main(976,358,1270,243,'#3c671b',{weight:900,italic:true}),sub(1400,603,660,51,'#fff'),tag(695,188,260,76,'#fff',{rotate:-11}),layer('劳动节',235,367,150,70,'#5a7b28')]),
 make('news',1,'政策要点 · 红金挂历','政策要点','权威发布 深度解析 精准落实','政策解读','思源黑体',[
 main(900,366,1310,204,'#92371e',{weight:900}),sub(900,557,1020,48,'#fff'),tag(900,182,650,30,'#b85a30')]),
 make('news',2,'最新热点资讯 · 铆钉框','最新热点资讯','点击查看详细信息 >>>','NEWS UPDATE','思源黑体',[
 main(900,341,1500,211,'#cb0807',{weight:900}),sub(900,561,1120,70,'#fff'),tag(900,172,950,29,'#bd2321')]),
 make('news',3,'寒假放假通知 · 线圈本','寒假放假通知','点击查看详情','WINTER HOLIDAY','思源黑体',[
 main(900,361,1480,217,'#111b28',{weight:900}),sub(950,568,900,67,'#fff'),tag(920,200,900,25,'#364353')]),
 make('news',4,'政策周报 · 红绸流光','政策周报','—— 速览一周大事 ——','POLICY WEEKLY','思源黑体',[
 main(900,308,1300,257,'#ffe6a4',{weight:800}),sub(900,563,1270,79,'#b92a15'),tag(900,120,800,32,'#ffd697')]),
 make('news',5,'每日热点速递 · 冰蓝','每日热点速递','点击查看详情 >>','DAILY NEWS','思源黑体',[
 main(900,344,1480,208,'#557bd5',{weight:900}),sub(900,566,1030,74,'#fff'),tag(900,150,800,29,'#6c91bc')]),
 make('news',6,'守护钱袋全民反诈','守护钱袋\n全民反诈','谨防刷卡涉诈违法犯罪','守护每一份财产安全','思源黑体',[
 main(544,320,920,180,'#fff',{weight:900}),sub(571,598,850,44,'#fff'),tag(520,687,800,23,'#7497cb')]),
 make('news',7,'赋能科技智创未来','赋能科技 智创未来','2026 创新科技峰会论坛','中国 · 杭州','思源黑体',[
 main(900,343,1580,168,'#fff',{weight:800,italic:true}),sub(900,520,1030,47,'#e4f6ff'),tag(1580,93,350,33,'#d4e9ed')]),
 make('news',8,'全血与血小板','全血 vs 血小板','献血怎么选？一篇搞懂！','XIAN XUE ZEN ME XUAN YI PIAN GAO DONG','思源黑体',[
 main(900,340,1420,215,'#101010',{weight:900,highlights:[['vs','#d82425']]}),sub(923,558,1400,85,'#fff'),tag(900,174,1370,35,'#343434')]),
 make('news',9,'开学必备清单 · 手绘','开学\n必备清单','新的学期　新的开始','BACK TO SCHOOL','站酷快乐体',[
 main(975,364,1170,238,'#673a2e',{weight:900,rotate:-4,lineHeight:1.02,highlights:[['清单','#f16360']]}),sub(1510,236,320,27,'#714427'),tag(900,671,850,30,'#a26945')]),
 make('news',10,'热点新闻资讯 · 蓝色科技','热点新闻资讯','点击查看详细信息 >>','NEWS INFORMATION','思源黑体',[
 main(900,332,1450,210,'#fff',{weight:900}),sub(900,522,1080,54,'#fff'),tag(900,158,1000,27,'#bbdcff')]),
 make('red',1,'国庆节放假通知 · 长城','国庆节\n放假通知','国庆节放假调休共7天','国庆节\n放假通知','思源宋体',[
 main(880,242,740,134,'#ffe2a0',{weight:800}),sub(880,450,700,32,'#ffe0a0'),tag(1530,235,450,116,'#ffe0a0',{font:'思源宋体'})]),
 make('red',2,'踔厉奋发 · 政务速览','踔厉奋发 勇毅前行','政府工作报告要点速览','政务\n速览','思源黑体',[
 main(642,186,1110,120,'#ffe7ba',{weight:800}),sub(650,317,910,54,'#ffdfa8'),tag(1520,240,450,145,'#ffe7ba',{weight:800})]),
 make('red',3,'国庆 · 金色书法','国庆','山河披锦绣 · 盛世写华章','国庆','马善政毛笔',[
 main(620,262,980,300,'#ffe6a2'),sub(630,464,1030,43,'#a95726'),tag(1530,252,510,230,'#ffe6a2',{font:'马善政毛笔'}),layer('1949—20XX',390,64,730,63,'#da6f22',{font:'思源黑体',weight:900})]),
 make('red',4,'继续前行 · 金色纪念','87','岁月峥嵘\n山河锦绣','继续\n前行','思源黑体',[
 main(900,245,680,400,'#ffdc7c',{weight:900,stroke:'#bf6225'}),sub(350,215,630,115,'#fff0b4',{font:'马善政毛笔'}),tag(1530,257,490,187,'#ffe5a0',{font:'马善政毛笔'})]),
 make('red',5,'毕业典礼 · 青春序章','青春序章','毕业典礼邀请函','毕业\n典礼','思源宋体',[
 main(400,150,650,125,'#fff1d7',{weight:700}),sub(370,295,600,53,'#ffe9d9'),tag(1535,246,430,153,'#fff1d7',{font:'思源宋体',weight:800}),layer('06/20',180,458,260,53,'#ffe9d9')]),
 make('red',6,'社团纳新 · 书桌拼贴','招新啦','点击了解详情','社团\n纳新','站酷庆科黄油体',[
 main(690,241,790,223,'#70211c',{weight:900}),sub(670,455,710,47,'#fff'),tag(1530,268,440,204,'#70211c',{weight:900}),layer('可画大学〈文学社〉',720,90,830,41,'#fff')]),
 make('red',7,'倡议书 · 金色书页','倡议书','点击了解详细内容','倡议书','思源黑体',[
 main(641,255,1100,266,'#ffe6af',{weight:900}),sub(650,450,960,52,'#b8552c'),tag(1510,249,480,170,'#ffe6af',{weight:900})]),
 make('red',8,'业绩喜报 · 麦穗荣誉','业绩喜报','第四季度销售额突破8000万','业绩\n喜报','思源黑体',[
 main(640,205,1000,172,'#ffe2a0',{weight:800}),sub(650,404,1020,51,'#ad4321'),tag(1530,269,450,167,'#ffe2a0',{weight:800}),layer('GOOD NEWS',640,290,850,35,'#ffe8ac')]),
 make('red',9,'权威发布 · 红绸','权威发布','掌握最新政策动向','权威\n发布','思源黑体',[
 main(645,208,1070,188,'#ffe6ad',{weight:800}),sub(640,354,850,56,'#a83d1d'),tag(1535,250,445,177,'#ffe6ad',{weight:800})]),
 make('red',10,'政策新动态 · 发布会','政策新动态','20XX最新企业政策发布','最新\n政策','思源黑体',[
 main(650,223,1130,175,'#ffe6b2',{weight:800,italic:true}),sub(650,385,1020,65,'#ffe2ac',{font:'思源宋体',italic:true}),tag(1535,250,450,175,'#ffe6b2',{weight:800})]),
]

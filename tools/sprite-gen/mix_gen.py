# 混血版：第一版身形(12宽矮胖、1像素细腿细眼) + 第二版动画编排与节奏
# 32x32，站立时脚底在第20行；改颜色只需改下面三行
from PIL import Image
import json, math, os
from functools import reduce
O=(217,119,87,255)   # 身体（想换亮橙就改成 (255,144,107,255)）
E=(27,27,31,255)     # 眼睛
L=(244,168,137,255)  # 水母高光（第三色，只有水母和烟雾用）
class C:
  def __init__(s): s.im=Image.new('RGBA',(32,32),(0,0,0,0)); s.px=s.im.load()
  def p(s,x,y,c=O):
    if 0<=x<32 and 0<=y<32: s.px[x,y]=c
  def r(s,x0,y0,x1,y1,c=O):
    for x in range(x0,x1+1):
      for y in range(y0,y1+1): s.p(x,y,c)
def eyes(c,k,xl,xr,y):
  for x,m in((xl,1),(xr,-1)):
    if k=='open': c.p(x,y,E);c.p(x,y+1,E)
    elif k=='blink': c.p(x,y+1,E)
    elif k=='big': c.p(x,y-1,E);c.p(x,y,E);c.p(x,y+1,E)
    elif k=='><': c.p(x-m,y-1,E);c.p(x,y,E);c.p(x-m,y+1,E)
    elif k=='^': c.p(x,y,E);c.p(x-1,y+1,E);c.p(x+1,y+1,E)
    elif k=='-': c.p(x,y+1,E);c.p(x+m,y+1,E)
def legs(c,xs,y0,ls,sh=(0,0,0,0)):
  for x,l,d in zip(xs,ls,sh):
    for i in range(l): c.p(x+(d if i>0 else 0),y0+i)
def crab(top=11,bot=18,x0=10,x1=21,arm='side',ay=15,lx=(11,13,18,20),ll=(2,2,2,2),lsh=(0,0,0,0),ek='open',ey=13,ex=None):
  c=C(); c.r(x0,top,x1,bot)
  if arm=='side': c.r(x0-2,ay,x0-1,ay+1); c.r(x1+1,ay,x1+2,ay+1)
  elif arm=='up': c.r(x0-2,top-1,x0-1,top+2); c.r(x1+1,top-1,x1+2,top+2)
  legs(c,lx,bot+1,ll,lsh)
  ex=ex or (x0+2,x1-2); eyes(c,ek,ex[0],ex[1],ey); return c
PAT=[0,0,1,1,0,0,-1,-1]
def jelly(top=8,bot=14,x0=10,x1=21,ek='open',ten=None):
  c=C(); c.r(x0+2,top,x1-2,top); c.r(x0+1,top+1,x1-1,top+1); c.r(x0,top+2,x1,bot-1)
  for x in range(x0,x1+1):
    if (x-x0)%3!=2: c.p(x,bot)
  c.p(x0+2,top+1,L);c.p(x0+3,top+1,L);c.p(x0+1,top+2,L);c.p(x0+1,top+3,L)
  eyes(c,ek,x0+2,x1-2,bot-3)
  for x,l,ph,dr in ten:
    for i in range(l):
      d = dr*i//2 if dr else (PAT[(i+ph)%8] if ph is not None else 0)
      c.p(x+d,bot+1+i)
  return c
F={}
F['idle_0']=crab()
F['pick_squint']=crab(ek='-')
F['stretch']=crab(top=8,bot=17,x0=11,x1=20,arm='up',ll=(3,3,3,3),lx=(12,14,17,19),ey=10)
F['jump_top']=crab(top=6,bot=13,arm='up',lx=(10,12,19,21),ek='^',ey=8)
F['squash']=crab(top=13,bot=18,x0=9,x1=22,ay=16,lx=(10,12,19,21),ey=14)
F['squash_small']=crab(top=12,ay=16,ey=14)
a=crab(ek='big',ey=13); a.r(15,4,16,7,E); a.r(15,9,16,9,E); F['alert']=a
dg=dict(top=9,bot=16,arm='up',ek='><',ey=11,ex=(12,19))
F['drag']=crab(ll=(3,2,3,2),**dg)
F['drag_tilt']=crab(ll=(3,2,3,2),lsh=(1,1,1,1),**dg)
F['drag_tilt_mirror']=crab(ll=(3,2,3,2),lsh=(-1,-1,-1,-1),**dg)
F['drag_kick_a']=crab(ll=(3,1,3,1),lsh=(-1,0,1,0),**dg)
F['drag_kick_b']=crab(ll=(1,3,1,3),lsh=(0,-1,0,1),**dg)
T=lambda ph,l=6,xs=(11,14,17,20): [(x,l,ph+i*2,0) for i,x in enumerate(xs)]
F['j_relax']=jelly(ten=T(0))
F['j_blink']=jelly(ek='blink',ten=T(0))
F['j_contract']=jelly(top=6,bot=14,x0=11,x1=20,ten=[(x,5,None,0) for x in(12,14,17,19)])
F['j_push']=jelly(top=9,bot=13,x0=9,x1=22,ten=[(10,5,0,-1),(13,4,0,-1),(18,4,0,1),(21,5,0,1)])
F['j_glide']=jelly(top=5,bot=11,ten=[(x,9,None,0) for x in(11,14,17,20)])
F['j_sink1']=jelly(top=6,bot=12,ten=T(2,7))
F['j_sink2']=jelly(top=7,bot=13,ten=T(4,7))
p=C()
for cx,cy,rr in((12,14,3),(16,11,3),(20,14,3),(16,16,3),(13,18,2),(19,18,2)):
  for x in range(cx-rr,cx+rr+1):
    for y in range(cy-rr,cy+rr+1):
      if (x-cx)**2+(y-cy)**2<=rr*rr+1: p.p(x,y,L)
img=p.im.copy(); q=img.load()
for x in range(32):
  for y in range(32):
    if q[x,y][3] and any(not(0<=x+a<32 and 0<=y+b<32) or q[x+a,y+b][3]==0 for a,b in((1,0),(-1,0),(0,1),(0,-1))): p.p(x,y,O)
for sx,sy in((7,7),(25,8),(6,20),(25,21)):
  for a,b in((0,0),(1,0),(-1,0),(0,1),(0,-1)): p.p(sx+a,sy+b,O)
eyes(p,'blink',14,18,12); F['morph_poof']=p
m=crab(top=10,bot=17,arm=None,ey=13,lx=(11,14,17,20),ll=(0,0,0,0))
m.px[10,10]=m.px[21,10]=(0,0,0,0); m.p(9,14);m.p(22,14)
for i,x in enumerate((11,14,17,20)):
  for k in range(4): m.p(x+PAT[(k+i*2)%8],18+k)
m.p(12,11,L);m.p(13,11,L); F['morph_proto']=m
ANIMS={
 'poke':[('pick_squint',100),('stretch',100),('jump_top',160),('squash',80),('squash_small',60),('alert',500),('idle_0',400)],
 'pickup':[('pick_squint',60),('drag',100),('drag',400)],
 'drag_swing':[('drag',300),('drag_tilt',300),('drag',200),('drag_tilt_mirror',300)],
 'drag_kick':[('drag_kick_a',120),('drag_kick_b',120)]*4,
 'drop_soft':[('drag',300),('squash',80),('stretch',80),('squash_small',60),('idle_0',600)],
 'jelly_morph':[('idle_0',400),('squash',100),('stretch',100),('morph_poof',120),('morph_proto',150),('j_contract',120),('j_relax',300)],
 'jelly_swim':[('j_relax',300),('j_contract',160),('j_push',160),('j_glide',250),('j_sink1',300),('j_sink2',300),('j_relax',250),('j_blink',80),('j_relax',300)],
 'jelly_back':[('j_relax',300),('j_contract',120),('morph_poof',100),('stretch',80),('squash',60),('squash_small',60),('idle_0',500)],
}
ONCE={'poke','pickup','drop_soft','jelly_morph','jelly_back'}
if __name__=='__main__':
  D=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','..','clawd_pet','sprites')
  cfg=json.load(open(D+'/sprites.json'))
  for an,seq in ANIMS.items():
    ds=[m for _,m in seq]; g=max(20,reduce(math.gcd,ds))
    im=Image.new('RGBA',(32*len(seq),32),(0,0,0,0))
    for i,(f,_) in enumerate(seq): im.paste(F[f].im,(32*i,0))
    im.save(f'{D}/mix_{an}.png')
    c={'fps':1000//g if 1000%g==0 else round(1000/g,3)}
    h=[max(1,round(m/g)) for m in ds]
    if any(x!=1 for x in h): c['hold']=h
    if an in ONCE: c['loop']=False
    cfg['mix_'+an]=c
  json.dump(cfg,open(D+'/sprites.json','w'),ensure_ascii=False,indent=1)
  print('ok',len(F),'frames')

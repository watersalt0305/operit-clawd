# neo 版：第一版的画风+节奏（匀速 fps、帧数少、无 hold），移植第二版的点子
# 32x32，站立脚底第20行；配色全部沿用第一版已有颜色
from PIL import Image
import json, os
O=(217,119,87,255); E=(27,27,31,255); PK=(244,160,150,255)
Y=(246,214,120,255); B=(120,185,245,255); G=(220,220,228,255)
class C:
  def __init__(s): s.im=Image.new('RGBA',(32,32),(0,0,0,0)); s.px=s.im.load()
  def p(s,x,y,c=O):
    if 0<=x<32 and 0<=y<32: s.px[x,y]=c
  def r(s,x0,y0,x1,y1,c=O):
    for x in range(x0,x1+1):
      for y in range(y0,y1+1): s.p(x,y,c)
  def d(s,pts,c,ox=0,oy=0):
    for x,y in pts: s.p(x+ox,y+oy,c)
SPARK=[(0,-2),(0,-1),(-2,0),(-1,0),(1,0),(2,0),(0,1),(0,2)]   # 第一版 happy 的大星星
DIA=[(0,-1),(-1,0),(1,0),(0,1)]                             # 小星星
BUB=[(1,0),(0,1),(2,1),(1,2)]                               # 泡泡
def crab(c=None,dx=0,dy=0,w=12,h=8,eyes='open',arms='side',legs=2,ex=0,blush=False,ao=4):
  c=c or C(); x0=16-w//2+dx; x1=x0+w-1; t=11+dy; b=t+h-1
  c.r(x0,t,x1,b); ay=t+ao
  if arms=='side': c.r(x0-2,ay,x0-1,ay+1); c.r(x1+1,ay,x1+2,ay+1)
  elif arms=='up': c.r(x0-2,t,x1+2,t+2); c.r(x0-2,t-1,x0-1,t-1); c.r(x1+1,t-1,x1+2,t-1)
  elif arms=='left': c.r(x0-2,ay,x0-1,ay+1)
  L=x0+2+ex; R=x1-2+ex; y=t+2
  if eyes=='open': c.r(L,y,L,y+1,E); c.r(R,y,R,y+1,E)
  elif eyes=='big': c.r(L,y-1,L,y+1,E); c.r(R,y-1,R,y+1,E)
  elif eyes=='blink': c.r(L-1,y+1,L,y+1,E); c.r(R,y+1,R+1,y+1,E)
  elif eyes=='^':
    for X in(L,R): c.d([(X,y),(X-1,y+1),(X+1,y+1)],E)
  elif eyes=='><': c.d([(L-1,y-1),(L,y),(L-1,y+1)],E); c.d([(R+1,y-1),(R,y),(R+1,y+1)],E)
  elif eyes=='flat': c.r(L-1,y+1,L+1,y+1,E); c.r(R-1,y+1,R+1,y+1,E)
  elif eyes=='x':
    for X in(L,R): c.d([(X-1,y-1),(X+1,y-1),(X,y),(X-1,y+1),(X+1,y+1)],E)
  if blush: c.p(x0,t+4,PK); c.p(x1,t+4,PK)
  if isinstance(legs,int): legs=(legs,)*4
  for X,l in zip((x0+1,x0+3,x1-3,x1-1),legs):
    if l>0: c.r(X,b+1,X,b+l)
  return c
def dust(c,y=20):
  c.d([(4,y-2),(5,y-1),(6,y),(27,y-2),(26,y-1),(25,y)],G)
def speed(c,rows,x0=1,ln=4):
  for yy in rows: c.r(x0,yy,x0+ln-1,yy,G)
def hat(c,dy=0):   # 派对帽（v2 done 的点子）
  t=11+dy
  c.r(13,t-1,18,t-1,Y); c.r(14,t-2,17,t-2,PK); c.r(14,t-3,17,t-3,Y)
  c.r(15,t-4,16,t-4,PK); c.r(15,t-5,16,t-5,Y); c.r(15,t-6,16,t-6,PK)
ORB=[(9,7),(12,5),(20,5),(23,7),(20,9),(12,9)]
def dizzy(ph,sw=0):
  c=crab(eyes='x',dx=sw)
  for k in(0,2,4): c.d(DIA,Y,*ORB[(ph+k)%6])
  return c
def fly(dx,dy,lines=True):
  c=crab(dx=dx,dy=dy,eyes='><',arms='up',legs=(3,2,3,2))
  if lines: speed(c,(11+dy,15+dy,19+dy),x0=max(0,dx+2),ln=4)
  return c
W=[0,0,1,1,0,0,-1,-1]
def jelly(dy=0,w=14,h=4,eyes='open',ten='wave',ph=0,tl=5,blush=True):
  c=C(); x0=16-w//2; x1=x0+w-1; t=9+dy
  c.r(x0+3,t,x1-3,t); c.r(x0+1,t+1,x1-1,t+1); c.r(x0,t+2,x1,t+1+h)
  for x in range(x0,x1+1):
    if (x-x0)%3!=2: c.p(x,t+2+h)
  y=t+h-1; L=x0+3; R=x1-3
  if eyes=='open': c.r(L,y,L,y+1,E); c.r(R,y,R,y+1,E)
  elif eyes=='big': c.r(L,y-1,L,y+1,E); c.r(R,y-1,R,y+1,E)
  elif eyes=='blink': c.r(L-1,y+1,L,y+1,E); c.r(R,y+1,R+1,y+1,E)
  elif eyes=='^':
    for X in(L,R): c.d([(X,y),(X-1,y+1),(X+1,y+1)],E)
  if blush: c.p(x0+1,y+2,PK); c.p(x1-1,y+2,PK)
  ty=t+3+h
  if ten=='spread': xs=[(x0+1,-1),(x0+4,-1),(x1-4,1),(x1-1,1)]
  else: xs=[(x,0) for x in ((x0+2,x0+5,x1-5,x1-2) if ten=='wave' else (x0+2,x0+4,x1-4,x1-2))]
  for k,(x,dr) in enumerate(xs):
    for i in range(tl):
      off = W[(i+ph)%8] if ten=='wave' else (dr*(i//2) if ten=='spread' else 0)
      c.p(x+off,ty+i)
  return c
def poof(big=True):
  c=C(); r=3 if big else 2
  pts=((12,14),(16,11),(20,14),(16,16),(12,18),(20,18)) if big else ((14,15),(18,15),(16,13),(16,17))
  for cx,cy in pts:
    for x in range(cx-r,cx+r+1):
      for y in range(cy-r,cy+r+1):
        if (x-cx)**2+(y-cy)**2<=r*r+1: c.p(x,y,G)
  if big: c.d([(13,14),(14,14),(18,14),(19,14)],E); c.d(SPARK,Y,5,7); c.d(SPARK,Y,26,20); c.d(DIA,Y,26,7); c.d(DIA,Y,5,21)
  else: c.d(DIA,Y,8,9); c.d(DIA,Y,24,10); c.d(DIA,Y,9,21); c.d(DIA,Y,23,21)
  return c
def stars(c,ph=0):
  pts=[(5,6),(26,5),(4,17),(27,16),(9,2),(23,22)]
  for i,(x,y) in enumerate(pts):
    c.d(SPARK if (i+ph)%2==0 else DIA,Y,x,y)
  return c
def add(c,f): f(c); return c
F={}
F['idle']=crab()
F['pre']=crab(dy=1,h=7,eyes='blink')
F['up1']=crab(dy=-3,arms='up',eyes='^',blush=True)
F['up2']=add(crab(dy=-5,arms='up',eyes='^',blush=True),lambda c:(c.d(SPARK,Y,5,6),c.d(DIA,Y,26,4)))
F['down']=crab(dy=-2,arms='up',eyes='^',blush=True)
F['splat']=add(crab(dy=4,w=14,h=6,legs=0,eyes='blink',ao=3),dust)
F['squash']=crab(dy=2,legs=0,eyes='blink')
F['alert']=add(crab(eyes='big'),lambda c:(c.r(24,4,25,7,Y),c.r(24,9,25,9,Y)))
F['fly1']=fly(-5,-4); F['fly2']=fly(1,-6); F['fly3']=fly(5,-3)
for i in range(4): F['dz%d'%i]=dizzy(i,(0,1,0,-1)[i])
F['dk1']=fly(-2,-1); F['dk2']=fly(5,-1)
F['wall']=add(crab(dx=12,w=8,h=10,legs=0,eyes='><',arms='left',ao=5),lambda c:c.d([(23,6),(22,8),(23,22),(22,24)],G))
F['peek']=crab(dx=9,ex=-1,eyes='big',arms='left')
F['edge']=crab(dx=12,ex=-1,arms='left')
F['edge_b']=crab(dx=12,ex=-1,arms='left',eyes='blink')
F['edge_lean']=crab(dx=10,ex=-1,arms='left')
F['poof']=poof(); F['poof_s']=poof(False)
F['j_born']=jelly(dy=1,w=12,h=5,eyes='big',ten='straight',tl=4,blush=False)
F['j_happy']=jelly(eyes='^',ph=0)
for i in range(4): F['j%d'%i]=jelly(ph=i*2)
F['j_blink']=jelly(eyes='blink',ph=6)
F['j_con']=jelly(dy=1,w=12,h=5,ten='straight',tl=5)
F['j_push']=add(jelly(dy=-2,w=16,h=3,ten='spread',tl=6),lambda c:c.d(BUB,B,26,20))
F['j_glide']=add(jelly(dy=-3,ph=0,tl=7),lambda c:c.d(BUB,B,27,14))
F['j_sink']=add(jelly(dy=-2,ph=2,tl=6),lambda c:c.d(BUB,B,26,7))
F['j_sink2']=jelly(dy=-1,ph=4,tl=6)
F['sq_star']=stars(crab(dy=2,legs=0,eyes='blink'),1)
F['j_star']=stars(jelly(eyes='^',ph=0),0)
F['j_star2']=stars(jelly(eyes='^',ph=2),1)
F['pop_star']=stars(crab(dy=-3,arms='up',eyes='^',blush=True),0)
F['pop']=crab(dy=-3,arms='up',eyes='^',blush=True)
CF=lambda c,cols,pts:[c.p(x,y,cols[i%3]) for i,(x,y) in enumerate(pts)]
F['p0']=add(crab(dy=1,h=7,eyes='^',blush=True),lambda c:hat(c,1))
F['p1']=add(crab(dy=-3,arms='up',eyes='^',blush=True),lambda c:(hat(c,-3),CF(c,(Y,PK,B),[(4,4),(27,6),(6,12),(25,13),(3,18),(28,19)])))
F['p2']=add(crab(dy=-5,arms='up',eyes='^',blush=True),lambda c:(hat(c,-5),CF(c,(PK,B,Y),[(5,7),(26,9),(4,15),(27,16),(6,21),(25,22)])))
F['p3']=add(crab(dy=-2,arms='up',eyes='^',blush=True),lambda c:(hat(c,-2),CF(c,(B,Y,PK),[(5,10),(26,12),(3,19),(28,20),(7,24),(24,25)])))
F['p4']=add(crab(eyes='^',blush=True),lambda c:hat(c,0))
ANIMS={  # 名字: (fps, 帧序列, 循环)
 'poke':(8,['pre','up1','up2','down','splat','squash','alert','alert','idle'],False),
 'fling':(8,['fly1','fly2','fly3','splat','squash','dz0','dz1','dz2','dz3','dz0','dz1','idle'],False),
 'dock':(8,['dk1','dk2','wall','wall','edge_lean','edge'],False),
 'edge':(3,['edge','edge','edge_b','edge','edge_lean','peek'],True),
 'jelly_morph':(8,['idle','squash','sq_star','j_star','j_star2','j_happy','j0'],False),
 'jelly_swim':(5,['j0','j1','j_con','j_push','j_glide','j_sink','j_sink2','j_blink'],True),
 'jelly_back':(8,['j0','j_con','j_star','pop_star','pop','squash','idle'],False),
 'done':(7,['p0','p1','p2','p3','p4','p4'],True),
}
if __name__=='__main__':
  D=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','..','clawd_pet','sprites')
  cfg=json.load(open(D+'/sprites.json'))
  for an,(fps,seq,loop) in ANIMS.items():
    im=Image.new('RGBA',(32*len(seq),32),(0,0,0,0))
    for i,f in enumerate(seq): im.paste(F[f].im,(32*i,0))
    im.save(f'{D}/neo_{an}.png')
    cfg['neo_'+an]={'fps':fps} if loop else {'fps':fps,'loop':False}
  json.dump(cfg,open(D+'/sprites.json','w'),ensure_ascii=False,indent=1)
  print('ok',len(F),'frames',len(ANIMS),'anims')

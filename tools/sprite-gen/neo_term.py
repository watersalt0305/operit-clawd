# neo 终端/打印机/面包机系列：沿用 neo_gen 的身形与第一版配色
import sys, os, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from neo_gen import C, crab, O, E, PK, Y, B, G, SPARK, DIA
from PIL import Image
R = (232, 84, 72, 255)            # 第一版 ai_error 的红
FONT = {
 '>':['X..','.X.','..X','.X.','X..'], 'g':['.XX','X.X','.XX','..X','XX.'], 'i':['.X.','...','.X.','.X.','.X.'],
 't':['.X.','XXX','.X.','.X.','..X'], 'o':['...','.X.','X.X','X.X','.X.'], 'k':['X..','X.X','XX.','X.X','X.X'],
 'r':['...','X.X','XX.','X..','X..'], 'm':['...','XXX','XXX','X.X','X.X'], 'n':['...','XX.','X.X','X.X','X.X'],
 'p':['...','XX.','X.X','XX.','X..'], 'e':['...','.X.','XXX','X..','.XX'], 's':['.XX','X..','.X.','..X','XX.'],
 '!':['.X.','.X.','.X.','...','.X.'], '0':['.X.','X.X','X.X','X.X','.X.'], '1':['.X.','XX.','.X.','.X.','XXX'],
 'v':['...','..X','..X','X.X','.X.'], 'x':['...','X.X','.X.','X.X','...'], '.':['...','...','...','...','.X.'], ' ':['...']*5,
}
def text(c, s, x, y, col=G, cols=None):
  for n, ch in enumerate(s):
    k = cols[n] if cols else col
    for j, row in enumerate(FONT[ch]):
      for i, v in enumerate(row):
        if v == 'X': c.p(x+i, y+j, k)
    x += 4
  return x
def term(c, s, dy=0, cursor=False, col=G, cols=None, bar=None):
  """头顶小终端，跟着身体上下"""
  y = 1 + dy; x = 3
  c.r(x, y, x+26, y+7, E); c.r(x, y, x+26, y, G); c.p(x+24, y, R); c.p(x+22, y, Y)
  c.r(15, y+8, 16, y+8, E)                        # 小尾巴指向头
  end = text(c, s, x+2, y+2, col, cols)
  if cursor and end+2 <= x+25: c.r(end, y+2, end+2, y+6, Y)   # 放不下就不画光标
  if bar is not None:                             # 进度条
    c.r(x+6, y+2, x+24, y+6, G); c.r(x+7, y+3, x+23, y+5, E)
    if bar: c.r(x+7, y+3, x+6+bar, y+5, B)
def eyes_up(c, dy=0, dx=0):
  t = 11+dy; c.r(12+dx, t+1, 12+dx, t+2, E); c.r(19+dx, t+1, 19+dx, t+2, E)
def shades(c, dy=0):
  y = 13+dy; c.r(10, y, 21, y, E); c.r(11, y, 14, y+1, E); c.r(17, y, 20, y+1, E); c.p(12, y, G); c.p(18, y, G)
def sweat(c, x=24, y=11):
  c.d([(1,0),(0,1),(1,1),(0,2),(1,2)], B, x, y)
def base(dy=0, **k):
  c = crab(dy=dy, eyes='none', **k); eyes_up(c, dy); return c
# ---------- 打印机 / 面包机 ----------
def page(c, x, top, h, w=4):                       # 一张纸：浅灰底 + 深色字行
  c.r(x, top, x+w-1, top+h-1, G)
  for k in range(1, h, 2): c.r(x+1, top+k, x+[2,1,2,1][(k//2)%4], top+k, E)
def bread(c, x, top, h):
  c.r(x+1, top, x+2, top, Y); c.r(x, top+1, x+3, top+h-1, Y)
def slots(c, dy=0):
  t = 11+dy; c.r(11, t, 14, t, E); c.r(17, t, 20, t, E)
def toaster(kind, dy=0, ph=0, eyes='open', h=8, w=12, fly=False, spark=False, hs=(2,2), up=(0,0), **k):
  c = crab(dy=dy, eyes=eyes, h=h, w=w, **k); t = 11+dy
  item = page if kind == 'page' else bread
  for x, hh, u in zip((11, 17), hs, up):
    if hh: item(c, x, t-hh-u, hh+min(u,0) if u<0 else hh)
  if fly: item(c, 25, 1, 5)
  if spark: c.d(SPARK, Y, 5, 5); c.d(DIA, Y, 27, 10)
  return c
def printer(n, dx=0, eyes='><', tear=False):
  c = crab(dx=dx, eyes=eyes, blush=tear); t = 11
  if n: page(c, 13+dx, t-n, n, w=6)
  if tear: page(c, 23, 1, 6, w=6); c.d(SPARK, Y, 6, 6)
  return c
# ---------- 帧 ----------
F = {}
for i, s in enumerate(['>', '> g', '> gi', '> git']):
  F[f't{i}'] = (lambda s=s, i=i: (lambda c: (term(c, s, cursor=True), c)[1])(base(dy=i%2, h=8-i%2)))()
c = base(); term(c, '> git'); F['t_run'] = c
c = crab(eyes='blink'); term(c, '>git .'); F['t_run2'] = c
c = crab(dy=-2, arms='up', eyes='^', blush=True); term(c, '> ok', dy=-2, col=B); F['t_ok'] = c
# 出错
c = base(); term(c, '> rm', cursor=True); F['e0'] = c
c = base(dy=1, h=7); term(c, '> rm', dy=1); F['e1'] = c
c = crab(eyes='flat'); term(c, '!!', col=R); sweat(c); F['e2'] = c
c = crab(dx=1, eyes='><'); term(c, '!!', col=R); sweat(c, 25, 12); F['e3'] = c
c = crab(dx=-1, eyes='><'); term(c, '!!', col=R); sweat(c, 23, 13); F['e4'] = c
c = crab(eyes='flat', h=7, dy=1); term(c, '> x', dy=1, col=R); sweat(c, 24, 12); F['e5'] = c
# 装包 npm（进度条）
c = base(); term(c, '> npm', cursor=True); F['n0'] = c
for i, b in enumerate([0, 6, 12, 17]):
  c = crab(dy=i%2, h=8-i%2, eyes=('blink' if i == 2 else 'open')); term(c, '>', dy=i%2, bar=b); F[f'n{i+1}'] = c
c = crab(dy=-2, arms='up', eyes='^', blush=True); term(c, '> ok', dy=-2, col=B); F['n_ok'] = c
# 跑测试（一个个打勾）
c = base(); term(c, '>test', cursor=True); F['s0'] = c
for i in range(1, 4):
  c = crab(dy=1 if i%2 else 0, h=7 if i%2 else 8); term(c, 'v'*i, dy=1 if i%2 else 0, col=B); F[f's{i}'] = c
c = crab(dy=-2, arms='up', eyes='^', blush=True); term(c, 'vvv ok', dy=-2, col=B); F['s_ok'] = c
# 黑客模式（墨镜 + 刷屏）
for i, s in enumerate(['101 01', '011 10', '110 00', '001 11']):
  c = crab(dy=i%2, h=8-i%2, eyes='none'); shades(c, i%2); term(c, s, dy=i%2, col=B); F[f'h{i}'] = c
# 面包机吐文章
for kind, p in (('page', 'tp'), ('bread', 'tb')):
  F[p+'0'] = toaster(kind, eyes='blink')
  F[p+'1'] = toaster(kind, dy=1, h=7, w=14, eyes='><', hs=(1, 1))
  F[p+'2'] = toaster(kind, dy=-1, eyes='big', hs=(6, 6), up=(4, 6), spark=True)
  F[p+'3'] = toaster(kind, eyes='big', hs=(6, 6), up=(2, 0))
  F[p+'4'] = toaster(kind, eyes='^', blush=True, hs=(5, 0), fly=True)
  F[p+'5'] = toaster(kind, eyes='^', blush=True, hs=(4, 4))
# 打印机吐长纸
for i, n in enumerate([0, 2, 4, 6, 8, 10]):
  F[f'p{i}'] = printer(n, dx=(0 if i == 0 else (1 if i%2 else -1)), eyes=('open' if i == 0 else '><'))
F['p_tear'] = printer(0, eyes='^', tear=True)
ANIMS = {   # 名字: (fps, 帧, 循环)
 'bash':       (5, ['t0','t1','t2','t3','t_run','t_run2','t_run','t_ok','t_ok'], True),
 'bash_err':   (5, ['e0','e1','e2','e3','e4','e3','e4','e5'], False),
 'bash_npm':   (4, ['n0','n1','n2','n3','n4','n_ok','n_ok'], True),
 'bash_test':  (5, ['s0','s0','s1','s2','s3','s_ok','s_ok'], True),
 'bash_hack':  (8, ['h0','h1','h2','h3'], True),
 'write_toast':(6, ['tp0','tp0','tp1','tp2','tp3','tp4','tp5','tp0'], True),
 'toast':      (6, ['tb0','tb0','tb1','tb2','tb3','tb5','tb5','tb0'], True),
 'write_print':(5, ['p0','p1','p2','p3','p4','p5','p_tear','p_tear'], True),
}
if __name__ == '__main__':
  D = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'clawd_pet', 'sprites')
  cfg = json.load(open(D+'/sprites.json'))
  for an, (fps, seq, loop) in ANIMS.items():
    im = Image.new('RGBA', (32*len(seq), 32), (0,0,0,0))
    for i, f in enumerate(seq): im.paste(F[f].im, (32*i, 0))
    im.save(f'{D}/neo_{an}.png')
    cfg['neo_'+an] = {'fps': fps} if loop else {'fps': fps, 'loop': False}
  json.dump(cfg, open(D+'/sprites.json', 'w'), ensure_ascii=False, indent=1)
  print('ok', len(F), 'frames', len(ANIMS), 'anims')

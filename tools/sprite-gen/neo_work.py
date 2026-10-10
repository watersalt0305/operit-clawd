# neo 工作/睡觉差分：正面打字（笔记本/键盘）、冲浪、放大镜、耳机、三种睡觉
import sys, os, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from neo_gen import C, crab, jelly, O, E, PK, Y, B, G, SPARK, DIA
from PIL import Image
def rr(c, x, y, w, h, col=G, hollow=False):
  """圆角方块；hollow=只画边（泡泡）"""
  for i in range(w):
    for j in range(h):
      if w >= 4 and h >= 4 and i in (0, w-1) and j in (0, h-1): continue
      if hollow and 0 < i < w-1 and 0 < j < h-1: continue
      c.p(x+i, y+j, col)
  if hollow and w >= 6 and h >= 6:
    for a, b in ((1,1), (w-2,1), (1,h-2), (w-2,h-2)): c.p(x+a, y+b, col)
Z = ['####', '..#.', '.#..', '####']
def zz(c, x, y):
  for j, row in enumerate(Z):
    for i, v in enumerate(row):
      if v == '#': c.p(x+i, y+j, G)
NOTE = [(1,0),(2,0),(3,1),(1,1),(1,2),(0,3),(1,3)]
F = {}
# ---------- 正面打字：笔记本（盖子挡住下半身，眼睛从屏幕后面探出来） ----------
def laptop(c):
  c.r(8, 15, 23, 21, G); c.r(15, 17, 16, 18, PK)          # 盖子背面 + 小 logo
def tick(c, side):
  if side == 'L': c.d([(6,13),(5,12),(6,16),(5,17)], Y)
  if side == 'R': c.d([(25,13),(26,12),(25,16),(26,17)], Y)
def la(dy=0, eyes='open', side=None):
  c = crab(dy=dy, eyes=eyes, arms='none'); laptop(c); tick(c, side); return c
F['la0'] = la(); F['la1'] = la(1, side='L'); F['la2'] = la(0, side='R'); F['la3'] = la(1, side='L')
F['la4'] = la(0, 'blink')
# ---------- 正面打字：键盘 ----------
def kb(press=None, eyes='open'):
  c = crab(eyes=eyes, arms='none', dy=(1 if press else 0))
  c.r(6, 19, 25, 21, G)
  for x in range(8, 24, 2): c.p(x, 20, E)
  for X, s in ((8, 'L'), (22, 'R')):
    if press == s: c.r(X, 16, X+1, 19); c.r(X, 20, X+1, 20, Y)
    else: c.r(X, 15, X+1, 18)
  return c
F['kb0'] = kb(); F['kbL'] = kb('L'); F['kbR'] = kb('R'); F['kbB'] = kb(eyes='blink')
# ---------- 冲浪 ----------
def surf(ph, dy=0, arms='side', eyes='open', blush=False):
  c = C()
  for x in range(32):
    h = [0,1,1,2,2,1,1,0][(x//2+ph) % 8]; top = 23-h
    for y in range(top, 32):            # 往下用抖动点渐渐淡出，不用半透明
      k = y - 24
      if k < 1 or (k <= 2 and (x+y) % 4) or (k <= 4 and (x+y) % 2 == 0) or (k <= 6 and (x+2*y) % 4 == 0): c.p(x, y, B)
    if (x+ph*2) % 5 == 0: c.p(x, top, G)
  c.r(7, 21+dy, 24, 21+dy, Y); c.r(9, 22+dy, 22, 22+dy, PK)
  crab(c, dy=dy, arms=arms, eyes=eyes, blush=blush)
  for k, yy in enumerate((12+dy, 16+dy)): c.r((ph+k) % 3, yy, (ph+k) % 3 + 3, yy, G)
  return c
F['sf0'] = surf(0); F['sf1'] = surf(1, -1, 'up'); F['sf2'] = surf(2); F['sf3'] = surf(3, -1, 'up', '^', True)
# ---------- 放大镜 ----------
def lens(c, x, y, hx, hy, dx):
  rr(c, x, y, 6, 6, G, hollow=True); c.p(x+1, y+2, B); c.p(x+2, y+1, B)
  c.p(hx, hy, Y); c.p(hx+dx, hy+1, Y)
def search(where, eyes='open'):
  if where == 'L': c = crab(ex=-1, eyes=eyes); lens(c, 1, 8, 7, 14, 1)
  elif where == 'R': c = crab(ex=1, eyes=eyes); lens(c, 25, 8, 24, 14, -1)
  else:
    c = crab(eyes='none'); c.r(19, 13, 19, 14, E)
    c.r(10, 11, 13, 14, O); lens(c, 9, 10, 15, 16, 1); c.r(11, 11, 12, 14, E)   # 透过镜片的大眼睛
  return c
F['se_L'] = search('L'); F['se_Lb'] = search('L', 'blink'); F['se_R'] = search('R'); F['se_C'] = search('C')
c = search('C'); c.r(25, 5, 26, 8, Y); c.r(25, 10, 26, 10, Y); F['se_C!'] = c
# ---------- 耳机 ----------
def phones(dx=0, eyes='open', note=None):
  c = crab(dx=dx, eyes=eyes); t = 11
  c.r(10+dx, t-2, 21+dx, t-2, B); c.r(9+dx, t-1, 9+dx, t, B); c.r(22+dx, t-1, 22+dx, t, B)
  c.r(8+dx, t+1, 9+dx, t+3, PK); c.r(22+dx, t+1, 23+dx, t+3, PK)
  if note == 'L': c.d(NOTE, Y, 2, 4)
  if note == 'R': c.d(NOTE, Y, 26, 2)
  return c
F['hp0'] = phones(-1, note='L'); F['hp1'] = phones(0, '^'); F['hp2'] = phones(1, note='R'); F['hp3'] = phones(0, '^')
# ---------- 睡觉：睡帽 ----------
def cap_sleep(i, z=True):
  d = 2 + i % 2; c = crab(dy=d, h=10-d, legs=0, eyes='blink'); t = 11+d
  c.r(10, t-1, 21, t-1, G); c.r(11, t-2, 20, t-2, B); c.r(13, t-3, 21, t-3, B)
  c.r(17, t-4, 22, t-4, B); c.r(21, t-5, 23, t-5, B); c.r(24, t-6, 25, t-5, Y)
  if z: zz(c, 6-i, 8-i*2)
  return c
for i in range(4): F[f'cs{i}'] = cap_sleep(i)
# ---------- 睡觉：鼻涕泡 ----------
def bub_sleep(size, eyes='blink'):
  c = crab(dy=2, h=8, legs=0, eyes=eyes)
  if size == 2: c.r(22, 14, 23, 15, G)
  elif size: y = {4: 12, 6: 9}[size]; rr(c, 22, y, size, size, G, hollow=True); c.p(23, y+1, B)
  return c
F['bs0'] = bub_sleep(0); F['bs1'] = bub_sleep(2); F['bs2'] = bub_sleep(4); F['bs3'] = bub_sleep(6)
c = bub_sleep(0, 'big'); [c.d(DIA, Y, x, y) for x, y in ((23, 9), (28, 12), (25, 16))]; F['bs_pop'] = c
F['bs_wake'] = bub_sleep(0, 'open')
# ---------- 睡觉：水母 ----------
for i in range(4):
  c = jelly(dy=i % 2, eyes='blink', ph=i); zz(c, 23+i % 2, 4-i); F[f'js{i}'] = c
ANIMS = {   # 名字: (fps, 帧, 循环)
 'type':         (6, ['la0','la1','la2','la3','la2','la1','la4','la0'], True),
 'type_kb':      (6, ['kb0','kbL','kb0','kbR','kbL','kbR','kbB','kb0'], True),
 'surf':         (6, ['sf0','sf1','sf2','sf1','sf0','sf3'], True),
 'search':       (4, ['se_L','se_Lb','se_L','se_C','se_R','se_R','se_C','se_C!'], True),
 'listen':       (4, ['hp0','hp1','hp2','hp3'], True),
 'sleep_cap':    (2, ['cs0','cs1','cs2','cs3'], True),
 'sleep_bubble': (3, ['bs0','bs1','bs2','bs3','bs3','bs_pop','bs_wake','bs0','bs0'], True),
 'sleep_jelly':  (2, ['js0','js1','js2','js3'], True),
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

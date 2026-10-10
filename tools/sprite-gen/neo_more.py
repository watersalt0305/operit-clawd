# neo 转身 / 背身画画 / 贴边工具差分
import sys, os, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from neo_gen import C, crab, O, E, PK, Y, B, G, SPARK, DIA
from neo_work import rr, NOTE
from PIL import Image
F = {}
# ---------- 转身：正面 → 3/4 → 侧面 → 背面 → 侧面 → 3/4 ----------
def side(face, dy=0):
  c = crab(w=10, eyes='none', arms='none', dy=dy, legs=(2,0,0,2)); t = 11+dy
  if face == 'R': c.r(18, t+2, 18, t+3, E); c.r(21, t+4, 22, t+5)
  else:           c.r(13, t+2, 13, t+3, E); c.r(9, t+4, 10, t+5)
  return c
F['front'] = crab()
F['q_r'] = crab(ex=2)
F['side_r'] = side('R')
F['back'] = crab(eyes='none')
F['side_l'] = side('L')
F['q_l'] = crab(ex=-2)
# ---------- 背身画画 ----------
def easel(c, step):
  c.r(7, 13, 7, 20, G); c.r(24, 13, 24, 20, G)        # 画架腿
  c.r(7, 2, 24, 12, G)                                # 画布
  if step >= 1:                                       # 太阳
    c.r(10, 4, 12, 6, Y); c.p(11, 3, Y); c.p(9, 5, Y); c.p(13, 5, Y)
  if step >= 2:                                       # 小浪
    for x in range(8, 24): c.p(x, 10 + (x // 2) % 2, B)
  if step >= 3:                                       # 画里的自己
    c.r(16, 5, 21, 8, O); c.p(17, 6, E); c.p(20, 6, E); c.p(15, 7, O); c.p(22, 7, O)
  if step >= 4: c.p(14, 4, PK); c.p(22, 3, PK)        # 点两下腮红色
def paint(step, bx, by, col, dy=0):
  c = C(); easel(c, step)
  crab(c, dy=dy, eyes='none', arms='none')
  c.r(8, 15+dy, 9, 16+dy)                             # 左手垂着
  c.r(22, by+1, 23, 16+dy)                            # 右手举起
  c.r(bx, by-1, bx, by, col)                          # 笔尖
  return c
F['pa0'] = paint(0, 22, 12, G)
F['pa1'] = paint(0, 22, 8, Y)
F['pa2'] = paint(1, 22, 9, Y, dy=1)
F['pa3'] = paint(1, 22, 10, B)
F['pa4'] = paint(2, 22, 9, B, dy=1)
F['pa5'] = paint(2, 22, 7, O)
F['pa6'] = paint(3, 22, 6, O, dy=1)
F['pa7'] = paint(3, 22, 5, PK)
F['pa8'] = paint(4, 22, 12, G)
c = C(); easel(c, 4); crab(c, ex=-2); F['pa_peek'] = c
c = C(); easel(c, 4); crab(c, eyes='^', blush=True, arms='up', dy=-1); c.d(SPARK, Y, 3, 4); c.d(DIA, Y, 28, 7); F['pa_proud'] = c
# ---------- 贴边工具差分（贴右边，跟 neo_edge 同姿势） ----------
def eb(eyes='open', arms='left', dy=0, h=8, ex=-1, blush=False):
  return crab(dx=12, dy=dy, h=h, ex=ex, eyes=eyes, arms=arms, blush=blush)
# 放大镜
def elens(c, x, y, hand):
  rr(c, x, y, 6, 6, G, hollow=True); c.p(x+1, y+2, B); c.p(x+2, y+1, B)
  c.d(hand, Y)
c = eb(ex=-2); elens(c, 12, 12, [(18, 17), (19, 16)]); F['es0'] = c
c = eb(ex=-2, eyes='blink'); elens(c, 12, 12, [(18, 17), (19, 16)]); F['es1'] = c
c = eb(ex=-2); elens(c, 13, 5, [(18, 11), (19, 12)]); F['es2'] = c
c = eb(ex=-2, eyes='big'); elens(c, 13, 5, [(18, 11), (19, 12)]); c.r(26, 3, 27, 6, Y); c.r(26, 8, 27, 8, Y); F['es3'] = c
# 耳机
def ephones(c, dy=0):
  t = 11+dy; c.r(22, t-2, 31, t-2, B); c.r(21, t-1, 21, t, B); c.r(20, t+1, 21, t+3, PK)
for i in range(4):
  dy = i % 2; c = eb(eyes=('^' if i % 2 else 'open'), arms='none', dy=dy, h=8-dy); ephones(c, dy)
  c.r(18, 15, 19, 16)                                # 手搭在耳罩下
  c.d(NOTE, Y, 12 - i, 6 - i)
  F[f'el{i}'] = c
# 笔记本（侧面放在左边）
def elap(c, hit=False):
  c.r(10, 20, 19, 20, G); c.r(10, 13, 10, 19, G); c.r(11, 14, 11, 18, B)   # 底座 + 屏幕（亮着）
  c.r(20, 16, 21, 17)                                                       # 手
  if hit: c.r(17, 18, 19, 19); c.p(16, 17, Y); c.p(15, 16, Y)
  else: c.r(18, 18, 19, 18)
c = eb(arms='none', ex=-2); elap(c); F['ep0'] = c
c = eb(arms='none', ex=-2, dy=1, h=7); elap(c, True); F['ep1'] = c
c = eb(arms='none', ex=-2, eyes='blink'); elap(c); F['ep2'] = c
ANIMS = {   # 名字: (fps, 帧, 循环)
 'spin':        (8, ['front','q_r','side_r','back','side_l','q_l'], True),
 'turn_back':   (8, ['front','q_r','side_r','back'], False),
 'turn_front':  (8, ['back','side_l','q_l','front'], False),
 'paint':       (4, ['pa0','pa1','pa1','pa2','pa3','pa4','pa5','pa6','pa7','pa8','pa_peek','pa_proud','pa_proud'], True),
 'edge_search': (3, ['es0','es1','es0','es2','es2','es3'], True),
 'edge_listen': (4, ['el0','el1','el2','el3'], True),
 'edge_laptop': (6, ['ep0','ep1','ep0','ep1','ep0','ep1','ep2','ep0'], True),
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

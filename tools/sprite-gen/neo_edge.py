# neo 贴边工作差分：贴右边、身子竖直只露半边（跟 neo_edge 同一个姿势）
import sys, os, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from neo_gen import C, crab, O, E, PK, Y, B, G, SPARK, DIA
from neo_term import text, page, R
from PIL import Image
DX = 12                       # 身子 x22~31，左手 x20~21
def body(dy=0, h=8, eyes='open', arms='left', blush=False):
  c = crab(dx=DX, dy=dy, h=h, ex=-1, eyes=eyes, arms=arms, blush=blush)
  return c
def look_up(c, dy=0):
  t = 11+dy; c.r(23, t+1, 23, t+2, E); c.r(30, t+1, 30, t+2, E)
def blob(c, x, y, r):
  for i in range(x-r, x+r+1):
    for j in range(y-r, y+r+1):
      if (i-x)**2+(j-y)**2 <= r*r: c.p(i, j, G)
def box(c, s, col=G, cursor=False, y=4):
  c.r(1, y, 18, y+8, E); c.r(1, y, 18, y, G); c.p(16, y, R); c.p(14, y, Y)
  c.p(19, y+5, E)                                   # 尾巴朝右指向身子
  end = text(c, s, 3, y+3, col)
  if cursor: c.r(end, y+3, end+2, y+7, Y)
Z = ['####', '..#.', '.#..', '####']
def zz(c, x, y):
  for j, row in enumerate(Z):
    for i, v in enumerate(row):
      if v == '#': c.p(x+i, y+j, G)
def hat(c, dy=0, cx=26):
  t = 11+dy
  for k, (hw, col) in enumerate([(3,Y),(2,PK),(2,Y),(1,PK),(1,Y),(1,PK)]):
    c.r(cx-hw, t-1-k, cx+hw-1, t-1-k, col)
F = {}
# 打字：左手敲地上的小键盘
KB = lambda c, hit=None: (c.r(10, 19, 19, 20, G), [c.p(x, 19, E) for x in (11, 13, 15, 17)], hit is not None and c.p(hit, 19, Y))
c = body(arms='none'); c.r(20, 15, 21, 16); KB(c); F['ty0'] = c
c = body(arms='none', dy=1, h=7); c.r(20, 16, 21, 16); c.r(18, 17, 19, 18); KB(c, 17); F['ty1'] = c
c = body(arms='none'); c.r(20, 15, 21, 16); KB(c); F['ty2'] = c
c = body(arms='none', dy=1, h=7); c.r(20, 16, 21, 16); c.r(18, 17, 19, 18); KB(c, 13); F['ty3'] = c
c = body(arms='none', eyes='blink'); c.r(20, 15, 21, 16); KB(c); F['ty4'] = c
# 思考：抬眼 + 小泡泡一个比一个大，最大的里面「…」
from neo_work import rr
for i in range(4):
  c = body(eyes='none'); look_up(c)
  if i >= 1: c.r(19, 9, 20, 10, G)
  if i >= 2: rr(c, 14, 5, 4, 4, G)
  if i >= 3: rr(c, 1, 1, 11, 6, G); c.d([(3,4),(6,4),(9,4)], E)
  F[f'th{i}'] = c
c = body(eyes='blink'); c.r(19, 9, 20, 10, G); rr(c, 14, 5, 4, 4, G); rr(c, 1, 1, 11, 6, G); c.d([(3,4),(6,4),(9,4)], E); F['th_b'] = c
# 命令行：左边飘一个小终端
c = body(eyes='none'); look_up(c); box(c, '>', cursor=True); F['ba0'] = c
c = body(eyes='none'); look_up(c); box(c, '>'); F['ba1'] = c
c = body(eyes='none', dy=1, h=7); look_up(c, 1); box(c, '>.'); F['ba2'] = c
c = body(eyes='none'); look_up(c); box(c, '>..'); F['ba3'] = c
c = body(eyes='^', blush=True, dy=-1); box(c, 'ok', col=B); F['ba_ok'] = c
c = body(eyes='flat'); box(c, '!!', col=R); c.d([(1,0),(0,1),(1,1),(0,2),(1,2)], B, 20, 9); F['ba_err'] = c
# 吐纸：头顶弹出一张纸，飞到左边
F['to0'] = body(eyes='blink')
F['to1'] = body(dy=1, h=7, eyes='><')
c = body(eyes='big', dy=-1); page(c, 25, 2, 7, w=5); c.d(SPARK, Y, 17, 5); F['to2'] = c
c = body(eyes='^', blush=True); page(c, 12, 1, 6, w=5); c.d(DIA, Y, 19, 9); F['to3'] = c
c = body(eyes='^', blush=True); page(c, 4, 3, 6, w=5); F['to4'] = c
# 完成：派对帽 + 左边撒彩纸
CONF = [[(6,4),(14,8),(4,13),(16,15),(9,20)], [(8,6),(16,10),(5,16),(14,18),(11,2)], [(5,9),(13,13),(7,19),(17,4),(10,11)]]
for i in range(3):
  c = body(eyes='^', blush=True, dy=(-2 if i == 1 else 0)); hat(c, dy=(-2 if i == 1 else 0))
  for k, (x, y) in enumerate(CONF[i]): c.p(x, y, (Y, PK, B)[(k+i) % 3])
  F[f'dn{i}'] = c
# 睡觉：闭眼，Z 往左上飘
for i in range(4):
  c = body(eyes='blink', dy=(1 if i % 2 else 0), h=(7 if i % 2 else 8))
  zz(c, 16-i*2, 8-i*2)
  F[f'sl{i}'] = c
ANIMS = {   # 名字: (fps, 帧, 循环)
 'edge_type':  (6, ['ty0','ty1','ty2','ty3','ty0','ty1','ty2','ty3','ty4','ty0'], True),
 'edge_think': (3, ['th0','th1','th2','th3','th3','th_b','th3','th3'], True),
 'edge_bash':  (4, ['ba0','ba1','ba0','ba1','ba2','ba3','ba2','ba3','ba_ok','ba_ok'], True),
 'edge_err':   (4, ['ba0','ba2','ba3','ba_err','ba_err','ba_err'], False),
 'edge_toast': (5, ['to0','to0','to1','to2','to3','to4','to0'], True),
 'edge_done':  (6, ['dn0','dn1','dn2','dn1','dn0','dn0'], True),
 'edge_sleep': (2, ['sl0','sl1','sl2','sl3'], True),
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

# neo 情绪 + 贴边版（贴边 = 全身版整体右移 11 格，特效挪到左边）
import sys, os, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from neo_gen import C, crab, O, E, PK, Y, B, G, SPARK, DIA
import neo_work
from PIL import Image
R = (232, 84, 72, 255)
SH = 11                                   # 贴边右移格数
HEART = [(1,0),(3,0),(0,1),(1,1),(2,1),(3,1),(4,1),(1,2),(2,2),(3,2),(2,3)]
Q = [(1,0),(2,0),(0,1),(3,1),(3,2),(2,3),(2,4),(2,6)]
VEIN = [(1,0),(3,0),(0,1),(1,1),(3,1),(4,1),(0,3),(1,3),(3,3),(4,3),(1,4),(3,4)]
BANG = [(0,0),(0,1),(0,2),(0,3),(0,5)]
def shift(src):
  c = C(); c.im.paste(src.im, (SH, 0)); c.px = c.im.load(); return c
def emo(edge):
  F = {}
  X = lambda full, side: side if edge else full          # 特效 x：全身放右边，贴边放左边
  def body(dx=0, **k):
    return crab(dx=dx + (SH if edge else 0), **k)
  def eye_xy(c_dx=0, dy=0):
    x0 = 10 + c_dx + (SH if edge else 0); return x0+2, x0+9, 13+dy
  # 开心：^^ 眼、脸红、左右晃、跳一下、冒星星
  c = body(-1, eyes='^', blush=True); c.d(DIA, Y, X(26, 15), 8); F['ha0'] = c
  c = body(0, eyes='^', blush=True, dy=-3, arms='up'); c.d(SPARK, Y, X(26, 14), 5); c.d(DIA, Y, 5, 9); F['ha1'] = c
  c = body(1, eyes='^', blush=True); c.d(DIA, Y, 5, 7); F['ha2'] = c
  c = body(0, eyes='^', blush=True, dy=-3, arms='up'); c.d(SPARK, Y, 5, 4); c.d(DIA, Y, X(27, 15), 10); F['ha3'] = c
  # 难过：闭眼、头顶小乌云下雨、眼泪越流越长
  def cloud(c, drop):
    cx = X(13, 20)
    c.r(cx+1, 3, cx+5, 3, G); c.r(cx, 4, cx+6, 5, G)
    for k, x in enumerate((cx+1, cx+3, cx+5)):
      y = 7 + (drop + k) % 3; c.p(x, y, B)
  for i in range(4):
    c = body(0, eyes='blink', dy=1, h=7, ao=5); L, Rr, y = eye_xy(0, 1)
    n = min(i + 1, 3)
    for x in (L, Rr): c.r(x, y+2, x, y+1+n, B)
    if i == 3: c.p(L, y+6, B)
    cloud(c, i); F[f'sa{i}'] = c
  # 疑问：眼睛左右看、头顶冒问号
  c = body(0, ex=-1); c.d(Q, Y, X(24, 15), 2); F['qu0'] = c
  c = body(0, ex=-1); c.d(Q, Y, X(24, 15), 1); F['qu1'] = c
  c = body(0, ex=1, eyes='big'); c.d(Q, Y, X(24, 15), 2); c.d(Q, Y, X(5, 8), 4); F['qu2'] = c
  c = body(0, ex=1, eyes='blink'); c.d(Q, Y, X(24, 15), 2); F['qu3'] = c
  # 生气：斜眉怒视、红色青筋、头顶冒烟、抖 + 跺脚
  def glare(c, dx=0):
    L, Rr, y = eye_xy(dx)
    for X0, s in ((L, -1), (Rr, 1)):
      c.p(X0+s, y-1, E); c.p(X0, y, E); c.p(X0, y+1, E)
  def steam(c, ph):
    for x in ((7, 23) if not edge else (17,)):
      yy = 7 - ph; c.r(x, yy, x+1, yy+1, G); c.p(x+ph % 2, yy-2, G)
  for i in range(4):
    dx = (-1, 1, -1, 1)[i]
    c = body(dx, eyes='><', legs=((2,1,2,1) if i % 2 else (1,2,1,2)))
    c.d(VEIN, R, X(23, 15), 6); steam(c, i % 2); F[f'an{i}'] = c
  # 害羞：>< 闭眼 + 脸红，左右扭一扭，飘小爱心
  c = body(0, eyes='><', blush=True); F['sh0'] = c
  c = body(0, eyes='><', blush=True); c.d(HEART, PK, X(24, 14), 6); F['sh1'] = c
  c = body(-1, eyes='><', blush=True); c.d(HEART, PK, X(25, 15), 4); F['sh2'] = c
  c = body(0, eyes='><', blush=True, dy=1, h=7); c.d(HEART, PK, X(26, 16), 2); F['sh3'] = c
  # 震惊：缩一下 → 瞪眼弹起来冒 !! → 落地冒汗
  F['sk0'] = body(0, eyes='blink', dy=1, h=7)
  c = body(0, eyes='big', dy=-4, arms='up', legs=3); c.d(BANG, Y, X(24, 15), 1); c.d(BANG, Y, X(27, 18), 1); F['sk1'] = c
  c = body(0, eyes='big', dy=-2, arms='up'); c.d(BANG, Y, X(24, 15), 2); c.d(BANG, Y, X(27, 18), 2); F['sk2'] = c
  c = body(0, eyes='flat'); c.d([(1,0),(0,1),(1,1),(0,2),(1,2)], B, X(23, 18), 10); F['sk3'] = c
  c = body(0, eyes='flat', h=8); c.d([(1,0),(0,1),(1,1),(0,2),(1,2)], B, X(23, 18), 12); F['sk4'] = c
  return F
ANIMS = {   # 名字: (fps, 帧, 循环)
 'happy':    (6, ['ha0','ha1','ha2','ha3'], True),
 'sad':      (3, ['sa0','sa1','sa2','sa3'], True),
 'confused': (3, ['qu0','qu1','qu0','qu1','qu2','qu3'], True),
 'angry':    (8, ['an0','an1','an2','an3'], True),
 'shy':      (4, ['sh0','sh1','sh0','sh2','sh3','sh2'], True),
 'shock':    (8, ['sk0','sk1','sk2','sk3','sk4','sk3','sk4','sk3'], False),
}
# 直接从全身版平移过来的贴边版（会覆盖之前手画的 edge_type / edge_listen / edge_search）
FROM_FULL = ['type', 'type_kb', 'listen', 'search']
# 睡帽、鼻涕泡：贴边时左右翻转，帽尖和泡泡朝屏幕内侧
def flip_shift(src):
  c = C(); c.im.paste(src.im.transpose(Image.FLIP_LEFT_RIGHT), (SH, 0)); c.px = c.im.load(); return c
def edge_sleep_frames():
  cap = []
  for i in range(4):
    c = flip_shift(neo_work.cap_sleep(i, z=False)); neo_work.zz(c, 11-i*2, 8-i*2); cap.append(c)
  fps, seq, loop = neo_work.ANIMS['sleep_bubble']
  bub = [flip_shift(neo_work.F[f]) for f in seq]
  return cap, bub
if __name__ == '__main__':
  D = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'clawd_pet', 'sprites')
  cfg = json.load(open(D+'/sprites.json'))
  def save(name, frames, fps, loop):
    im = Image.new('RGBA', (32*len(frames), 32), (0,0,0,0))
    for i, f in enumerate(frames): im.paste(f.im, (32*i, 0))
    im.save(f'{D}/neo_{name}.png')
    cfg['neo_'+name] = {'fps': fps} if loop else {'fps': fps, 'loop': False}
  for edge in (False, True):
    F = emo(edge)
    for an, (fps, seq, loop) in ANIMS.items():
      save(('edge_' if edge else '') + an, [F[f] for f in seq], fps, loop)
  for an in FROM_FULL:
    fps, seq, loop = neo_work.ANIMS[an]
    save('edge_' + an, [shift(neo_work.F[f]) for f in seq], fps, loop)
  cap, bub = edge_sleep_frames()
  save('edge_sleep_cap', cap, neo_work.ANIMS['sleep_cap'][0], True)
  save('edge_sleep_bubble', bub, neo_work.ANIMS['sleep_bubble'][0], True)
  json.dump(cfg, open(D+'/sprites.json', 'w'), ensure_ascii=False, indent=1)
  print('ok', len(ANIMS)*2 + len(FROM_FULL), 'anims')

# 斜靠贴边：把贴边素材按行错位，变成「脚在外、头靠墙」的斜靠姿势
# 另外生成：贴边落定 lean_enter、贴边被戳 lean_poke、扯出来落地 drop、水母全套 jelly_full
import os, sys, json, glob
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from PIL import Image
from neo_gen import crab, O, G
D = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'clawd_pet', 'sprites')
cfg = json.load(open(f'{D}/sprites.json'))
T = (0, 0, 0, 0)
def body_top(src):        # 身体顶行：贴墙那一列第一个橙色像素
  for y in range(32):
    if src[31, y] == O: return y
  return 11
def lean(f, k=3):
  """斜靠：以「身体顶行」为基准，每 2 行一档往屏幕里挪 1 格，最多 k 格。
  按身体自己的行来分档，所以眼睛（2 行高）永远在同一档里、不会被拆歪；
  呼吸上下动时整只一起动，台阶也不会跳来跳去。"""
  src = f.load(); out = Image.new('RGBA', (32, 32), T); px = out.load()
  top = body_top(src)
  for y in range(32):
    r = y - top                       # 按身体部位分三段整体挪，眼睛永远不被拆开
    d = 0 if r < 4 else (-1 if r < 6 else -2)   # 头+眼睛 / 胳膊 / 屁股+腿
    d = max(d, -k)
    for x in range(32):
      nx = x + d
      if 0 <= nx < 32 and src[x, y][3]: px[nx, y] = src[x, y]
    if d < 0 and r < 8 and src[31, y] == O and src[30, y] == O:   # 只给身体补墙边，腿不补
      for nx in range(32 + d, 32): px[nx, y] = O
  return out
lean_edge = lean
def shift11(c):
  f = Image.new('RGBA', (32, 32), T); f.paste(c, (11, 0)); return f
def lean_full(f, s=1.0, S=None):   # 全身帧 → 平移成贴边 → 斜 round(3*s) 档
  return lean(shift11(f), max(0, min(4, int(round(3 * s)))))
def frames(name):
  im = Image.open(f'{D}/{name}.png').convert('RGBA'); n = im.width // 32
  return [im.crop((i*32, 0, i*32+32, 32)) for i in range(n)]
def save(name, fr, fps, loop=True, hold=None):
  s = Image.new('RGBA', (32*len(fr), 32), T)
  for i, f in enumerate(fr): s.paste(f, (i*32, 0))
  s.save(f'{D}/{name}.png')
  c = {'fps': fps}
  if not loop: c['loop'] = False
  if hold: c['hold'] = hold
  cfg[name] = c
n = 0
for p in sorted(glob.glob(f'{D}/neo_edge_*.png')):
  nm = os.path.basename(p)[:-4]
  if nm in ('neo_edge_laptop',): continue
  c = cfg.get(nm, {})
  save(nm.replace('neo_edge_', 'neo_lean_'), [lean_edge(f) for f in frames(nm)],
       c.get('fps', 4), c.get('loop', True), c.get('hold')); n += 1
# 贴边落定：直着贴上去 → 压一下（眯眼、墙上冒两点灰）→ 回弹 → 靠好
def im(c): return c.im
up, bl, big = im(crab()), im(crab(eyes='blink')), im(crab(eyes='big'))
sq = lean_full(bl, 1.4); sq.load()
for y in (7, 9): sq.putpixel((30, y), G)
save('neo_lean_enter', [lean_full(up, 0), lean_full(up, 0.5), sq, lean_full(bl, 0.8), lean_full(up, 1), frames('neo_lean_idle')[0]], 8, False)
# 贴边被戳：被推离墙一点、瞪眼 → 弹回 → 眨眼靠好
save('neo_lean_poke', [lean_full(big, 0.3), lean_full(big, 0.6), lean_full(up, 1.3), lean_full(up, 0.9), frames('neo_lean_idle')[2], frames('neo_lean_idle')[0]], 8, False)
# 从边上扯出来、松手：掉下来 → 落地
save('neo_drop', frames('ai_fall') + frames('ai_land'), 8, False)
# 水母全套：变身 → 游几圈 → 变回来（游的帧放慢一点）
m, sw, bk = frames('neo_jelly_morph'), frames('neo_jelly_swim'), frames('neo_jelly_back')
save('neo_jelly_full', m + sw * 3 + bk, 8, False, [1]*len(m) + [1.6]*(len(sw)*3) + [1]*len(bk))
json.dump(cfg, open(f'{D}/sprites.json', 'w'), ensure_ascii=False, indent=1)
print('ok lean', n)

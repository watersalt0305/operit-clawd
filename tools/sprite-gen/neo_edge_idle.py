# 贴边待机：直接拿第一版 ai_idle / ai_look 整体右移 11 格（和其它 edge_ 素材同一个位置）
import os, json
from PIL import Image
D = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'clawd_pet', 'sprites')
SH = 11
def frames(name):
  im = Image.open(f'{D}/{name}.png').convert('RGBA'); n = im.width // 32
  out = []
  for i in range(n):
    f = Image.new('RGBA', (32, 32), (0, 0, 0, 0))
    f.paste(im.crop((i*32, 0, i*32+32, 32)), (SH, 0)); out.append(f)
  return out
def save(name, fr, fps):
  s = Image.new('RGBA', (32*len(fr), 32), (0, 0, 0, 0))
  for i, f in enumerate(fr): s.paste(f, (i*32, 0))
  s.save(f'{D}/{name}.png'); cfg[name] = {'fps': fps}
cfg = json.load(open(f'{D}/sprites.json'))
idle, look = frames('ai_idle'), frames('ai_look')
# 待机：呼吸两轮，再往屏幕里瞄一圈，循环
save('neo_edge_idle', idle + idle + look, 3.6)
save('neo_edge_look', look, 3.33)
json.dump(cfg, open(f'{D}/sprites.json', 'w'), ensure_ascii=False, indent=1)
print('ok')

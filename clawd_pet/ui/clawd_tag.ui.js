"use strict";
// 主对话里 <clawd anim="...">话</clawd> 的小卡片
// 点一下 = 让桌面上的 Clawd 再做一次（并把话再说一遍）
Object.defineProperty(exports, "__esModule", { value: true });

var ANIM_ZH = {
  happy: "开心", love: "比心", shy: "害羞", dizzy: "晕乎乎", annoyed: "哼", error: "呜呜",
  wake: "伸懒腰", notify: "注意！", left: "往左躲", right: "往右躲", double_jump: "蹦起来",
  idle: "发呆", look: "东张西望", reading: "看书", yawn: "打哈欠", doze: "打盹", bubble: "吹泡泡",
  sweeping: "扫地", carrying: "搬东西", designing: "画图", coffee: "喝咖啡", headphones: "听歌",
  low_battery: "没电了", collapse: "瘫倒", sleep: "睡觉", think: "思考", typing: "打字",
  juggling: "手忙脚乱", ultrathink: "脑子冒烟", building: "搭积木", debugger: "调试",
  wizard: "施法", outlaw: "耍酷", surf: "冲浪", toast: "烤吐司", jelly: "变水母", talk: "说话", spin: "转圈", walk: "散步", wave: "挥手"
};
var C = { primary: "#D97757", text: "#3D2B22", sub: "#8C7266" };

function Screen(ctx) {
  var UI = ctx.UI, M = ctx.Modifier;
  var cs = (ctx.MaterialTheme && ctx.MaterialTheme.colorScheme) || {};
  var anim = ctx.useState("_anim", "")[0];
  var animRaw = ctx.useState("_animRaw", "")[0];
  var text = ctx.useState("_text", "")[0];
  var st = ctx.useState("sent", 0), sent = st[0], setSent = st[1];

  var label = anim ? (ANIM_ZH[anim] || anim) : (animRaw ? "不认识的动作：" + animRaw : "");
  var cardBg = (cs.surfaceVariant && typeof cs.surfaceVariant.copy === "function")
    ? cs.surfaceVariant.copy({ alpha: 0.4 }) : "#33D97757";
  var textColor = cs.onSurface || C.text;
  var subColor = cs.onSurfaceVariant || C.sub;

  function replay() {
    var name = text ? "clawd:clawd_say" : "clawd:clawd_play";
    var params = text ? { text: text, anim: anim || undefined } : { name: anim || "happy" };
    setSent(1);
    try {
      Promise.resolve(ctx.callTool(name, params)).then(function () { setSent(2); }, function () { setSent(3); });
    } catch (e) { setSent(3); }
  }

  var right = [];
  if (text) right.push(UI.Text({ text: text, fontSize: 14, color: textColor }));
  var meta = "🦀 Clawd" + (label ? " · " + label : "");
  var hint = sent === 1 ? "  ·  发送中…" : sent === 2 ? "  ·  已重播" : sent === 3 ? "  ·  桌宠没响应" : "  ·  点我重播";
  right.push(UI.Text({ text: meta + hint, fontSize: 11, color: subColor }));

  return UI.Card({
    containerColor: cardBg,
    shape: { cornerRadius: 14 },
    elevation: 0,
    modifier: M.clickable(replay)
  }, [
    UI.Row({ padding: { horizontal: 12, vertical: 9 }, spacing: 10, verticalAlignment: "center" }, [
      UI.Icon({ name: "pets", tint: C.primary, size: 20 }),
      UI.Column({ spacing: 2 }, right)
    ])
  ]);
}
exports.default = Screen;

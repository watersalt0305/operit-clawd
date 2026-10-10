"use strict";
// Clawd 设置页（侧边栏）
// 通过 ctx.callTool('clawd:clawd_xxx') 调子包工具；串行调用 + 超时，参考 DS 桌宠控制台的经验
var SUB = "clawd", PKG = "clawd_pet", TIMEOUT = 8000;

var C = {
  bg: "#FBF6F2", card: "#FFFFFF", accentSoft: "#F7E3D9",
  text: "#3D2B22", sub: "#8C7266", primary: "#D97757", ok: "#4E9A6B", err: "#B65450"
};

function candidates(name) { return [SUB + ":" + name, PKG + ":" + SUB + ":" + name, PKG + ":" + name]; }
function withTimeout(p, ms, label) {
  return new Promise(function (res, rej) {
    var t = setTimeout(function () { rej(new Error("timeout: " + label)); }, ms);
    p.then(function (v) { clearTimeout(t); res(v); }, function (e) { clearTimeout(t); rej(e); });
  });
}
function call(ctx, name, params) {
  var cs = candidates(name), lastErr = "unknown";
  function tryAt(i) {
    if (i >= cs.length) return Promise.reject(new Error(String(lastErr)));
    return withTimeout(ctx.callTool(cs[i], params || {}), TIMEOUT, cs[i]).then(function (raw) {
      if (typeof raw === "string") { var t = raw.trim(); if (!t) return {}; try { return JSON.parse(t); } catch (e) { return { ok: true, raw: t }; } }
      return raw;
    }, function (e) { lastErr = e; return tryAt(i + 1); });
  }
  return tryAt(0);
}
function s(v) { return v === null || v === undefined ? "" : String(v); }
function noop() { }

// ---------- 小组件 ----------
function card(ctx, title, kids) {
  var all = [];
  if (title) all.push(ctx.UI.Text({ text: title, style: "titleSmall", fontWeight: "bold", color: C.text }));
  all.push(ctx.UI.Spacer({ height: 4 }));
  return ctx.UI.Surface({ fillMaxWidth: true, containerColor: C.card, shape: { cornerRadius: 16 } }, [
    ctx.UI.Column({ fillMaxWidth: true, padding: 14, spacing: 8 }, all.concat(kids))
  ]);
}
function hint(ctx, text) { return ctx.UI.Text({ text: text, style: "labelSmall", color: C.sub }); }
function switchRow(ctx, label, desc, checked, onCh) {
  var col = [ctx.UI.Text({ text: label, style: "bodyMedium", color: C.text })];
  if (desc) col.push(hint(ctx, desc));
  return ctx.UI.Row({ fillMaxWidth: true, verticalAlignment: "center", spacing: 8 }, [
    ctx.UI.Column({ weight: 1, spacing: 0 }, col),
    ctx.UI.Switch({ checked: !!checked, onCheckedChange: onCh,
      checkedThumbColor: "#FFFFFF", checkedTrackColor: C.primary,
      uncheckedThumbColor: C.sub, uncheckedTrackColor: C.accentSoft })
  ]);
}
// desc 不传时显示取值范围
function stepper(ctx, label, value, unit, step, min, max, onSet, desc) {
  var v = Number(value) || 0;
  function set(n) { n = Math.max(min, Math.min(max, Math.round(n * 100) / 100)); if (n !== v) onSet(n); }
  var sub = desc ? desc + "（" + min + "~" + max + (unit ? " " + unit : "") + "）" : min + " ~ " + max + (unit ? " " + unit : "");
  // Button 不支持自定义底色（会用主题色），这里用 Surface 画按钮
  function pm(text, on, fn) {
    return ctx.UI.Surface({ onClick: on ? fn : noop, containerColor: on ? C.accentSoft : "#F3ECE7", shape: { cornerRadius: 10 },
      width: 44, height: 36 }, [
      ctx.UI.Box({ fillMaxSize: true, contentAlignment: "center" }, [
        ctx.UI.Text({ text: text, style: "titleMedium", fontWeight: "bold", color: on ? C.primary : C.sub })
      ])
    ]);
  }
  return ctx.UI.Row({ fillMaxWidth: true, verticalAlignment: "center", spacing: 6 }, [
    ctx.UI.Column({ weight: 1, spacing: 0 }, [
      ctx.UI.Text({ text: label, style: "bodyMedium", color: C.text }),
      hint(ctx, sub)
    ]),
    pm("−", v > min, function () { set(v - step); }),
    ctx.UI.Text({ text: s(v) + (unit ? unit : ""), style: "labelLarge", fontWeight: "bold", color: C.text }),
    pm("＋", v < max, function () { set(v + step); })
  ]);
}
function btn(ctx, label, icon, onClick, color) {
  var kids = [];
  if (icon) kids.push(ctx.UI.Icon({ name: icon, tint: color || C.primary, size: 18 }));
  kids.push(ctx.UI.Text({ text: label, style: "labelLarge", color: color || C.primary }));
  return ctx.UI.Surface({ onClick: onClick, shape: { cornerRadius: 12 }, containerColor: C.accentSoft }, [
    ctx.UI.Row({ verticalAlignment: "center", spacing: 4, padding: { left: 14, right: 14, top: 9, bottom: 9 } }, kids)
  ]);
}

// ---------- 页面 ----------
function Screen(ctx) {
  var cfgP = ctx.useState("cfg", null), cfg = cfgP[0], setCfg = cfgP[1];
  var stP = ctx.useState("st", null), st = stP[0], setSt = stP[1];
  var chatsP = ctx.useState("chats", null), chats = chatsP[0], setChats = chatsP[1];
  var msgP = ctx.useState("msg", ""), msg = msgP[0], setMsg = msgP[1];
  var showPickP = ctx.useState("pick", false), showPick = showPickP[0], setShowPick = showPickP[1];
  var testP = ctx.useState("testText", ""), testText = testP[0], setTestText = testP[1];
  var titleP = ctx.useState("newTitle", ""), newTitle = titleP[0], setNewTitle = titleP[1];
  var loadedRef = ctx.useRef("loaded", false);
  var arcP = ctx.useState("arc", null), arc = arcP[0], setArc = arcP[1];
  function loadArchive() {
    return call(ctx, "clawd_archive").then(function (r) { if (r && r.ok) setArc(r); }, noop);
  }
  function refresh() {
    return call(ctx, "clawd_get_config").then(function (r) { if (r && r.settings) setCfg(r.settings); })
      .then(function () { return call(ctx, "clawd_status"); })
      .then(function (r) { if (r) setSt(r); })
      .then(loadArchive)
      .catch(function (e) { setMsg("读取失败：" + s(e && e.message || e)); });
  }
  function patch(p, okText) {
    // 乐观更新
    if (cfg) {
      var next = JSON.parse(JSON.stringify(cfg));
      for (var sec in p) { next[sec] = next[sec] || {}; for (var k in p[sec]) next[sec][k] = p[sec][k]; }
      setCfg(next);
    }
    return call(ctx, "clawd_set_config", { patch: p }).then(function (r) {
      if (r && r.ok === false) setMsg("保存失败：" + s(r.error)); else if (okText) setMsg(okText);
    }, function (e) { setMsg("保存失败：" + s(e && e.message || e)); });
  }
  function loadChats() {
    setShowPick(true);
    return call(ctx, "clawd_list_chats").then(function (r) { setChats((r && r.chats) || []); },
      function (e) { setMsg("读取对话失败：" + s(e && e.message || e)); });
  }
  function bind(id) {
    return call(ctx, "clawd_bind_chat", { chatId: id }).then(function () {
      setShowPick(false); setMsg("已绑定"); return refresh();
    });
  }
  function createBind() {
    return call(ctx, "clawd_bind_chat", { create: true, title: newTitle || "" }).then(function (r) {
      setShowPick(false); setMsg(r && r.ok ? "已新建并绑定" : "新建失败：" + s(r && r.error)); return refresh();
    });
  }

  var kids = [];
  // 头部
  kids.push(ctx.UI.Row({ fillMaxWidth: true, verticalAlignment: "center", spacing: 8, padding: { bottom: 4 } }, [
    ctx.UI.Icon({ name: "pets", tint: C.primary, size: 26 }),
    ctx.UI.Column({ weight: 1, spacing: 0 }, [
      ctx.UI.Text({ text: "Clawd 桌宠", style: "titleLarge", fontWeight: "bold", color: C.text }),
      hint(ctx, "双击聊天 · 轻戳互动 · 长按看亲密度 · 拖到屏幕边缘可贴边")
    ])
  ]));
  if (msg) kids.push(ctx.UI.Text({ text: msg, style: "labelMedium", color: C.primary }));

  if (!cfg) {
    kids.push(card(ctx, "", [hint(ctx, "加载中…")]));
  } else {
    var nat = (st && st.native) || {};
    var stLine = !st ? "…" : (!st.hostReady ? "宿主未就绪：" + s(st.hostError)
      : (nat.visible ? "运行中 · " + (nat.mode === "mini" ? "贴" + (nat.side === "left" ? "左" : "右") + "边" : "自由悬浮") : "已隐藏"));
    if (nat.canOverlay === false) stLine = "⚠ 没有悬浮窗权限";
    // 养成摘要（完整档案在侧边栏「Clawd 小档案」）
    if (arc && arc.level) {
      var lvl = arc.level;
      kids.push(card(ctx, "亲密度", [
        ctx.UI.Text({ text: "Lv" + lvl.lv + " · " + lvl.name + "   XP " + lvl.xp + (lvl.hi ? " / " + lvl.hi : "（满级）"), style: "bodyMedium", color: C.text }),
        // 进度条自己画，保证是橙色
        ctx.UI.Row({ fillMaxWidth: true, spacing: 3 }, (function () {
          var cells = [], on = Math.round((lvl.pct || 0) / 10);
          for (var i = 0; i < 10; i++) cells.push(ctx.UI.Surface({ weight: 1, height: 10, shape: { cornerRadius: 2 },
            containerColor: i < on ? C.primary : C.accentSoft }, []));
          return cells;
        })()),
        hint(ctx, "图鉴 " + arc.unlocked + "/" + arc.total + (arc.next ? " · 下个：" + arc.next.name + "（" + arc.next.gap + "）" : "")),
        hint(ctx, "完整档案和动作图鉴见侧边栏「Clawd 小档案」")
      ]));
    }

    // 运行
    kids.push(card(ctx, "运行状态", [
      ctx.UI.Text({ text: stLine, style: "bodyMedium", color: (st && st.hostReady) ? C.ok : C.err }),
      (st && st.hostError) ? hint(ctx, "错误：" + s(st.hostError)) : ctx.UI.Spacer({ height: 0 }),
      ctx.UI.Row({ fillMaxWidth: true, spacing: 8 }, [
        btn(ctx, "显示", "visibility", function () { return call(ctx, "clawd_show").then(refresh); }),
        btn(ctx, "隐藏", "visibility_off", function () { return call(ctx, "clawd_hide").then(refresh); }),
        btn(ctx, "重载", "refresh", function () { setMsg("重载中…"); return call(ctx, "clawd_reload").then(function () { setMsg("已重载"); return refresh(); }); })
      ]),
      ctx.UI.Row({ fillMaxWidth: true, spacing: 8 }, [
        btn(ctx, "贴左", "first_page", function () { return call(ctx, "clawd_mode", { mode: "left" }); }),
        btn(ctx, "自由", "open_with", function () { return call(ctx, "clawd_mode", { mode: "free" }); }),
        btn(ctx, "贴右", "last_page", function () { return call(ctx, "clawd_mode", { mode: "right" }); })
      ])
    ]));

    // 对话
    var ch = cfg.chat || {};
    var pickKids = [];
    if (showPick) {
      pickKids.push(ctx.UI.Text({ text: "选择要绑定的对话", style: "labelLarge", color: C.text }));
      if (!chats) pickKids.push(hint(ctx, "加载中…"));
      else {
        for (var i = 0; i < Math.min(chats.length, 20); i++) {
          (function (c) {
            var on = c.id === ch.chatId;
            pickKids.push(ctx.UI.Surface({ onClick: function () { return bind(c.id); }, shape: { cornerRadius: 10 },
              containerColor: on ? C.accentSoft : C.bg, fillMaxWidth: true }, [
              ctx.UI.Column({ fillMaxWidth: true, spacing: 0, padding: { left: 12, right: 12, top: 8, bottom: 8 } }, [
                ctx.UI.Text({ text: (on ? "✓ " : "") + (c.title || "(无标题)"), style: "bodyMedium", color: C.text }),
                ctx.UI.Text({ text: (c.messageCount || 0) + " 条消息", style: "labelSmall", color: C.sub })
              ])
            ]));
          })(chats[i]);
        }
      }
      pickKids.push(ctx.UI.Row({ fillMaxWidth: true, verticalAlignment: "center", spacing: 6 }, [
        ctx.UI.TextField({ value: newTitle, onValueChange: setNewTitle, singleLine: true, placeholder: "新对话标题（默认 🦀 Clawd）", weight: 1 }),
        btn(ctx, "新建", "add", createBind)
      ]));
      pickKids.push(btn(ctx, "收起", "expand_less", function () { setShowPick(false); }));
    }
    kids.push(card(ctx, "绑定对话", [
      ctx.UI.Text({ text: ch.chatId ? "当前：" + s(ch.chatTitle) : "尚未绑定，首次发消息时将自动新建「" + s(ch.chatTitle || "🦀 Clawd") + "」",
        style: "bodyMedium", color: C.text }),
      ch.chatId ? hint(ctx, "ID " + s(ch.chatId)) : ctx.UI.Spacer({ height: 0 }),
      btn(ctx, showPick ? "刷新列表" : "选择或新建对话", "forum", loadChats),
    ].concat(pickKids).concat([
      switchRow(ctx, "隐藏我发出的消息", "绑定对话中只保留 Clawd 的回复", ch.hideUserMessage, function (v) { return patch({ chat: { hideUserMessage: v } }); }),
      switchRow(ctx, "回复完成后通知", "在其他应用里也能知道回复已就绪", ch.notifyReply, function (v) { return patch({ chat: { notifyReply: v } }); }),
      switchRow(ctx, "自动创建对话", "未绑定时，首次发消息会新建一个专用对话", ch.autoCreate !== false, function (v) { return patch({ chat: { autoCreate: v } }); })
    ])));

    // 气泡显示
    var b = cfg.bubble || {}, f = cfg.filter || {};
    kids.push(card(ctx, "气泡显示", [
      switchRow(ctx, "隐藏标签内容", "工具调用、卡片、情绪徽章等不在气泡中显示", f.stripTags !== false, function (v) { return patch({ filter: { stripTags: v } }); }),
      switchRow(ctx, "折叠代码块", "以「（代码已省略）」代替", f.stripCodeBlocks !== false, function (v) { return patch({ filter: { stripCodeBlocks: v } }); }),
      switchRow(ctx, "清除 Markdown 格式", "去掉加粗、标题、列表等排版符号", f.stripMarkdown !== false, function (v) { return patch({ filter: { stripMarkdown: v } }); }),
      stepper(ctx, "单条字数上限", b.maxSegmentChars, "字", 10, 20, 150, function (n) { return patch({ bubble: { maxSegmentChars: n } }); }, "超出后在逗号处断开"),
      stepper(ctx, "同时显示条数", b.maxVisible, "条", 1, 1, 5, function (n) { return patch({ bubble: { maxVisible: n } }); }, "超出时最早的一条淡出"),
      stepper(ctx, "基础间隔", (b.gapMs || 0) / 1000, "秒", 0.1, 0.3, 3, function (n) { return patch({ bubble: { gapMs: Math.round(n * 1000) } }); }, "两条气泡之间的固定等待"),
      stepper(ctx, "每字阅读时间", b.typeCharMs, "ms", 10, 0, 300, function (n) { return patch({ bubble: { typeCharMs: n } }); }, "按字数追加等待，越大越慢"),
      stepper(ctx, "显示完后停留", (b.segmentMs || 0) / 1000, "秒", 0.5, 1, 10, function (n) { return patch({ bubble: { segmentMs: Math.round(n * 1000) } }); }, "最后一条出现后多久收起"),
      stepper(ctx, "气泡宽度", b.widthDp, "dp", 10, 160, 360, function (n) { return patch({ bubble: { widthDp: n } }); }),
      stepper(ctx, "气泡位置", b.anchorTop, "", 0.02, 0.2, 0.8, function (n) { return patch({ bubble: { anchorTop: n } }); }, "越大越贴近 Clawd 头顶"),
      hint(ctx, "点击气泡或轻戳 Clawd 可跳到下一条；全部显示完后再点一下即收起"),
      ctx.UI.Row({ fillMaxWidth: true, verticalAlignment: "center", spacing: 6 }, [
        ctx.UI.TextField({ value: testText, onValueChange: setTestText, singleLine: true, placeholder: "输入一句话，预览气泡效果", weight: 1 }),
        btn(ctx, "预览", "chat_bubble", function () { if (!testText) return; return call(ctx, "clawd_say", { text: testText, anim: "happy" }); })
      ])
    ]));

    // 动作与状态
    var w = cfg.watch || {}, id = cfg.idle || {};
    kids.push(card(ctx, "动作与状态", [
      switchRow(ctx, "同步对话状态", "AI 思考、输出或调用工具时，Clawd 做出对应动作", w.enabled !== false, function (v) { return patch({ watch: { enabled: v } }); }),
      switchRow(ctx, "同步所有对话", "关闭时仅同步绑定的对话", w.scope === "all", function (v) { return patch({ watch: { scope: v ? "all" : "bound" } }); }),
      switchRow(ctx, "按工具类型区分动作", "终端→调试，搜索→看书，绘图→画画，写文件→搭积木", w.toolDetail !== false, function (v) { return patch({ watch: { toolDetail: v } }); }),
      stepper(ctx, "忙碌阈值", w.busyAt, "次", 1, 2, 30, function (n) { return patch({ watch: { busyAt: n } }); }, "一轮内调用工具达到此数，切换为忙碌"),
      stepper(ctx, "过载阈值", w.crazyAt, "次", 1, 3, 60, function (n) { return patch({ watch: { crazyAt: n } }); }, "达到此数，切换为过载"),
      switchRow(ctx, "回复完成时庆祝", "一轮回复结束后，Clawd 开心一下", w.celebrate !== false, function (v) { return patch({ watch: { celebrate: v } }); }),
      switchRow(ctx, "空闲小动作", "空闲时随机做些小事；更多动作可在小档案中解锁", id.variety !== false, function (v) { return patch({ idle: { variety: v } }); }),
      stepper(ctx, "小动作间隔", id.gapSec, "秒", 5, 10, 300, function (n) { return patch({ idle: { gapSec: n } }); }, "实际间隔会随机浮动"),
      switchRow(ctx, "低电量状态", "电量低于 20% 且未充电时，显得没精打采", id.lowBattery !== false, function (v) { return patch({ idle: { lowBattery: v } }); }),
      switchRow(ctx, "多听歌", "提高戴耳机摇摆的出现频率（需先解锁）", !!id.music, function (v) { return patch({ idle: { music: v } }); })
    ]));

    // 标签联动
    var lk = cfg.link || {};
    var tagOn = lk.tag !== false;
    kids.push(card(ctx, "标签联动", [
      switchRow(ctx, "响应情绪徽章", "回复带有 moodlet 情绪徽章时，结束后做出对应表情", lk.moodlet !== false,
        function (v) { return patch({ link: { moodlet: v } }); }),
      switchRow(ctx, "识别 <clawd> 标签", "在对话中显示为小卡片，并触发 Clawd 的动作", tagOn,
        function (v) { return patch({ link: { tag: v } }); }),
      tagOn ? switchRow(ctx, "显示标签内文字", "关闭后只做动作，不弹出气泡", lk.tagSay !== false,
        function (v) { return patch({ link: { tagSay: v } }); }) : ctx.UI.Spacer({ height: 0 }),
      tagOn ? switchRow(ctx, "向 AI 说明标签用法", "与输入菜单中的「🦀 Clawd 标签」开关同步", lk.tagPrompt !== false,
        function (v) { return patch({ link: { tagPrompt: v } }); }) : ctx.UI.Spacer({ height: 0 }),
      (tagOn && lk.tagPrompt !== false) ? switchRow(ctx, "保存说明到聊天记录",
        lk.promptMode === "system" ? "当前：每次请求时临时加入系统提示词，不保存" : "当前：作为附件随消息保存，每个对话仅添加一次，有利于缓存命中",
        lk.promptMode !== "system",
        function (v) { return patch({ link: { promptMode: v ? "attach" : "system" } }); }) : ctx.UI.Spacer({ height: 0 }),
      stepper(ctx, "联动动作时长", (lk.animMs || 3500) / 1000, "秒", 0.5, 1, 10,
        function (n) { return patch({ link: { animMs: Math.round(n * 1000) } }); }, "连播时也按此时长切换"),
      hint(ctx, "情绪徽章的用法说明由 moodlet 插件负责，这里只控制 Clawd 是否响应")
    ]));

    // 外观与手势
    var p = cfg.pet || {};
    kids.push(card(ctx, "外观与手势", [
      stepper(ctx, "大小", p.sizeDp, "dp", 10, 60, 200, function (n) { return patch({ pet: { sizeDp: n } }); }),
      stepper(ctx, "触摸范围", p.hitScale == null ? 1 : p.hitScale, "倍", 0.1, 0.6, 1.6, function (n) { return patch({ pet: { hitScale: Math.round(n * 10) / 10 } }); }, "只有点到 Clawd 身上才算；嫌难点就调大，老误触就调小"),
      stepper(ctx, "贴边隐藏比例", p.miniHide, "", 0.05, 0.2, 0.7, function (n) { return patch({ pet: { miniHide: n } }); }, "越大藏得越多"),
      stepper(ctx, "双击间隔", p.doubleTapMs, "ms", 25, 150, 500, function (n) { return patch({ pet: { doubleTapMs: n } }); }, "两次点击在此时间内算双击"),
      stepper(ctx, "长按时长", p.longPressMs, "ms", 50, 300, 1500, function (n) { return patch({ pet: { longPressMs: n } }); }, "按住超过此时长算长按"),
      stepper(ctx, "自动入睡", p.sleepAfterMin, "分钟", 1, 1, 60, function (n) { return patch({ pet: { sleepAfterMin: n } }); }, "无互动超过此时长后睡觉")
    ]));
  }

  var list = ctx.UI.LazyColumn({ fillMaxSize: true, padding: 16, spacing: 12 }, kids);
  return ctx.UI.Box({
    fillMaxSize: true, contentAlignment: "topStart",
    onLoad: function () {
      if (loadedRef.current) return;
      loadedRef.current = true;
      return new Promise(function (r) { setTimeout(r, 400); }).then(refresh);
    }
  }, [list]);
}

exports.default = Screen;
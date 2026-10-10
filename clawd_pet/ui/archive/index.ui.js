"use strict";
// Clawd 小档案（侧边栏）：整页 WebView 显示像素风档案
var SUB = "clawd", PKG = "clawd_pet", TIMEOUT = 8000;
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

function ArchiveScreen(ctx) {
  var arcP = ctx.useState("arc", null), arc = arcP[0], setArc = arcP[1];
  var msgP = ctx.useState("msg", ""), msg = msgP[0], setMsg = msgP[1];
  var loadedRef = ctx.useRef("loaded", false);
  function load() {
    setMsg("");
    return call(ctx, "clawd_archive").then(function (r) {
      if (r && r.ok) setArc(r); else setMsg("读取失败：" + String((r && r.error) || "未知"));
    }, function (e) { setMsg("读取失败：" + String(e && e.message || e)); });
  }
  var kids = [];
  kids.push(ctx.UI.Row({ fillMaxWidth: true, verticalAlignment: "center", spacing: 8, padding: { left: 12, right: 8, top: 6, bottom: 2 } }, [
    ctx.UI.Icon({ name: "pets", tint: "#D97757", size: 22 }),
    ctx.UI.Text({ text: "Clawd 小档案", style: "titleMedium", fontWeight: "bold", color: "#3D2B22", weight: 1 }),
    ctx.UI.IconButton({ onClick: load }, [ctx.UI.Icon({ name: "refresh", tint: "#D97757" })])
  ]));
  if (msg) kids.push(ctx.UI.Text({ text: msg, style: "labelMedium", color: "#B65450", padding: { left: 12 } }));
  if (arc) {
    kids.push(ctx.UI.WebView({ key: "arc_" + arc.url, url: arc.url, weight: 1, fillMaxWidth: true,
      javaScriptEnabled: true, allowFileAccess: true }));
  } else if (!msg) {
    kids.push(ctx.UI.Text({ text: "加载中…", style: "labelSmall", color: "#8C7266", padding: { left: 12 } }));
  }
  return ctx.UI.Column({
    fillMaxSize: true, spacing: 0,
    onLoad: function () {
      if (loadedRef.current) return;
      loadedRef.current = true;
      return new Promise(function (r) { setTimeout(r, 300); }).then(load);
    }
  }, kids);
}
exports.default = ArchiveScreen;

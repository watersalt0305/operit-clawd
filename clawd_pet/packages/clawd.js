/* METADATA
{
  "name": "clawd",
  "description": {
    "zh": "Clawd 桌宠：让桌面上的 Clawd 冒气泡说话、播放动作、贴边/出来，以及查看与修改设置。用户在桌宠上双击即可输入，消息会发到绑定的对话里，回复会以分段气泡显示。",
    "en": "Clawd desk pet: make Clawd speak in bubbles, play animations, dock to edges, and manage settings."
  },
  "enabledByDefault": true,
  "tools": [
    { "name": "clawd_say",
      "description": { "zh": "让桌面上的 Clawd 用气泡对用户说话。文本会自动去掉标签/Markdown 并按句分段逐段显示。适合主动提醒、打招呼、把对话里的要点同步到桌面。", "en": "Make Clawd say something via speech bubbles (auto-cleaned and segmented)." },
      "parameters": [
        { "name": "text", "type": "string", "description": "要说的话", "required": true },
        { "name": "anim", "type": "string", "description": "可选，同时播放的动作，名称同 clawd_play（如 happy / shy / love / think / error）", "required": false }
      ] },
    { "name": "clawd_play",
      "description": { "zh": "让 Clawd 播放一个动作，一段时间后回到待机。动作（贴边时自动换成对应 mini 版）：反应 happy love shy dizzy annoyed error wake notify left right double_jump；日常 idle look reading yawn doze bubble sweeping carrying designing coffee headphones low_battery collapse sleep；工作 think typing juggling ultrathink building debugger wizard outlaw；贴边专用 mini_idle mini_peek mini_alert mini_happy mini_sleep mini_enter mini_typing mini_crabwalk", "en": "Play an animation on Clawd." },
      "parameters": [
        { "name": "name", "type": "string", "description": "动作名", "required": true },
        { "name": "durationMs", "type": "number", "description": "可选，持续毫秒，默认 3000", "required": false }
      ] },
    { "name": "clawd_mode",
      "description": { "zh": "切换 Clawd 位置模式：left / right = 贴到屏幕左/右边缘（极简模式），free = 回到屏幕内自由悬浮", "en": "Dock Clawd to left/right edge, or free." },
      "parameters": [ { "name": "mode", "type": "string", "description": "left / right / free", "required": true } ] },
    { "name": "clawd_show", "description": { "zh": "显示 Clawd 桌宠", "en": "Show Clawd" }, "parameters": [] },
    { "name": "clawd_hide", "description": { "zh": "隐藏 Clawd 桌宠", "en": "Hide Clawd" }, "parameters": [] },
    { "name": "clawd_reload", "description": { "zh": "重载 Clawd（重新加载配置与界面，排障用）", "en": "Reload Clawd" }, "parameters": [] },
    { "name": "clawd_status", "description": { "zh": "读取 Clawd 运行状态：是否显示、位置、模式、绑定对话、最近事件、错误信息", "en": "Read Clawd status" }, "parameters": [] },
    { "name": "clawd_get_config", "description": { "zh": "读取 Clawd 完整配置", "en": "Get Clawd config" }, "parameters": [] },
    { "name": "clawd_set_config",
      "description": { "zh": "合并修改 Clawd 配置（只改提供的字段）。分区：pet{sizeDp,miniHide,longPressMs,doubleTapMs,sleepAfterMin} chat{chatId,chatTitle,autoCreate,hideUserMessage,notifyReply,roleCardId,timeoutMs} bubble{widthDp,maxHeightDp,segmentMs,perCharMs,maxSegmentChars} filter{stripTags,stripCodeBlocks,stripMarkdown} poke{lines,rapidLines,rapidCount}", "en": "Merge-patch Clawd config" },
      "parameters": [ { "name": "patch", "type": "object", "description": "要合并的配置片段，例：{\"pet\":{\"sizeDp\":130}}", "required": true } ] },
    { "name": "clawd_list_chats", "description": { "zh": "列出最近的对话（用于选择要绑定的对话）", "en": "List recent chats" }, "parameters": [] },
    { "name": "clawd_bind_chat",
      "description": { "zh": "绑定 Clawd 的对话：传 chatId 绑定已有对话；或 create=true 新建一个专属对话并绑定", "en": "Bind Clawd to a chat" },
      "parameters": [
        { "name": "chatId", "type": "string", "description": "要绑定的对话 ID", "required": false },
        { "name": "create", "type": "boolean", "description": "true = 新建一个对话并绑定", "required": false },
        { "name": "title", "type": "string", "description": "新建时的标题，默认「🦀 Clawd」", "required": false }
      ] },
    { "name": "clawd_archive", "description": { "zh": "读取 Clawd 养成档案：亲密度等级、今天/累计互动次数、已解锁动作与下一个解锁条件；同时生成像素风档案页文件", "en": "Read Clawd growth archive" }, "parameters": [] },
    { "name": "clawd_test_filter",
      "description": { "zh": "调试：查看一段文本经过 Clawd 过滤与分段后的结果（不显示）", "en": "Debug: preview filter + segmentation" },
      "parameters": [ { "name": "text", "type": "string", "description": "原始文本", "required": true } ] }
  ]
}
*/
'use strict';

function go(channel, payload) {
  try {
    return Promise.resolve(ToolPkg.ipc.call(channel, payload || {})).then(function (r) {
      complete(r);
    }).catch(function (e) {
      complete({ ok: false, error: String(e) });
    });
  } catch (e) {
    complete({ ok: false, error: String(e) });
    return null;
  }
}

exports.clawd_say = function (p) { p = p || {}; return go('clawd.say', { text: p.text, anim: p.anim }); };
exports.clawd_play = function (p) { p = p || {}; return go('clawd.play', { name: p.name, durationMs: p.durationMs }); };
exports.clawd_mode = function (p) { p = p || {}; return go('clawd.mode', { mode: p.mode }); };
exports.clawd_show = function () { return go('clawd.show'); };
exports.clawd_hide = function () { return go('clawd.hide'); };
exports.clawd_reload = function () { return go('clawd.reload'); };
exports.clawd_status = function () { return go('clawd.status'); };
exports.clawd_get_config = function () { return go('clawd.get_config'); };
exports.clawd_archive = function () { return go('clawd.archive'); };
exports.clawd_set_config = function (p) { p = p || {}; return go('clawd.set_config', { patch: p.patch || {} }); };
exports.clawd_list_chats = function () { return go('clawd.list_chats'); };
exports.clawd_bind_chat = function (p) { p = p || {}; return go('clawd.bind_chat', { chatId: p.chatId, create: !!p.create, title: p.title }); };
exports.clawd_test_filter = function (p) { p = p || {}; return go('clawd.test_filter', { text: p.text }); };
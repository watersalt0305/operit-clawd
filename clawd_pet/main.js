/*
 * Clawd on Phone — ToolPkg 主控（包级上下文，常驻）
 *
 *   · 加载原生宿主 ClawdHost（dex）
 *   · 轮询事件：戳 / 双击 / 长按 / 拖动 / 输入提交
 *   · 双击 → 输入框 → 发到绑定对话 → 过滤标签 → 分段气泡
 *   · 对子包 / UI 暴露 IPC：clawd.say / clawd.play / clawd.status / clawd.config ...
 *
 * 设计原则沿用 DS 桌宠：dex 只做 JS 做不到的事，业务全在这里。
 */
'use strict';

const PKG_ID = 'clawd_pet';
const HOST_CLASS = 'clawd_pet.ClawdHost';
const DEX_KEY = 'clawd_host_dex';
const CFG_DIR = '/sdcard/Download/Operit/plugins/clawd_pet';
const LEGACY_DIR = '/sdcard/Download/Operit/plugins/com.clawd.desk';   // 改名前的配置目录
const SETTINGS_PATH = CFG_DIR + '/settings.json';
const TICK_MS = 250;

// 旧版 SVG 皮肤已移除，只保留像素皮肤（sprites/ 下的序列帧）
// ===== 像素皮肤（sprites/ 下的 neo_ 序列帧）=====
// 状态名 → 素材名；数组 = 每次随机挑一个；edge_xxx = 贴边时 xxx 用的版本
const NEO_MAP = {
  idle: 'ai_idle', drag: 'ai_drag', look: 'ai_look', think: 'ai_talk', wake: 'ai_wave',
  poke_hit: ['neo_poke', 'neo_poke', 'neo_poke', 'ai_tap'], poke_huh: 'neo_confused', edge_poke_huh: 'neo_edge_confused',
  talk: 'ai_talk', idle_read: 'ai_read', idle_reading: 'ai_read', idle_sweeping: 'ai_walk', idle_carrying: 'ai_wave', idle_outlaw: 'neo_spin', spin: 'neo_spin', walk: 'ai_walk', wave: 'ai_wave', bash_err: 'neo_bash_err', edge_bash_err: 'neo_edge_err',
  yawn: 'ai_sleep', coffee: 'ai_charge', low_battery: 'ai_charge',
  happy: ['neo_happy', 'neo_happy', 'ai_happy', 'neo_done'], love: 'neo_shy', shy: 'neo_shy', dizzy: 'neo_spin', annoyed: 'neo_angry',
  error: ['neo_sad', 'neo_sad', 'ai_error'], notify: 'neo_shock', left: 'neo_poke', right: 'neo_poke', double_jump: 'neo_done',
  sleep: 'neo_sleep_cap', doze: 'neo_sleep_bubble', bubble: 'neo_sleep_bubble', collapse: 'neo_sleep_jelly',
  reading: ['neo_search', 'neo_search', 'ai_search', 'ai_read'], designing: 'neo_paint', headphones: 'neo_listen', wizard: 'neo_jelly_full', jelly: 'neo_jelly_full', drop: ['neo_drop', 'neo_drop', 'neo_drop', 'ai_land'],
  sweeping: 'neo_write_print', carrying: 'neo_write_toast', outlaw: 'neo_bash_hack',
  typing: ['neo_type_kb', 'neo_type_kb', 'neo_type', 'ai_type'], building: ['neo_type', 'neo_type', 'neo_type_kb', 'ai_write', 'ai_type', 'neo_write_toast'],
  debugger: ['neo_type_kb', 'neo_type', 'neo_type_kb', 'ai_type', 'ai_tool', 'neo_bash', 'neo_bash_test', 'neo_bash_npm'], juggling: ['neo_type_kb', 'neo_type_kb', 'neo_type'], ultrathink: ['neo_type_kb', 'neo_type', 'neo_bash_hack'],
  surf: 'neo_surf', toast: 'neo_toast',
  mini_idle: 'neo_edge_idle', mini_crabwalk: 'neo_edge_look', edge_look: 'neo_edge_look', edge_idle: 'neo_edge_idle', mini_peek: 'neo_edge_look', mini_alert: 'neo_edge_shock',
  mini_happy: 'neo_edge_happy', mini_enter: 'neo_dock', mini_sleep: 'neo_edge_sleep_cap',
  mini_enter_sleep: 'neo_edge_sleep', mini_typing: ['neo_edge_type_kb', 'neo_edge_type_kb', 'neo_edge_type'],
  edge_happy: 'neo_edge_happy', edge_wake: 'neo_edge_happy', edge_left: 'neo_edge_happy', edge_right: 'neo_edge_happy',
  edge_love: 'neo_edge_shy', edge_shy: 'neo_edge_shy', edge_dizzy: 'neo_edge_confused', edge_annoyed: 'neo_edge_angry',
  edge_error: ['neo_edge_sad', 'neo_edge_sad', 'neo_edge_err'], edge_notify: 'neo_edge_shock', edge_think: 'neo_edge_think', edge_double_jump: 'neo_edge_done',
  edge_typing: ['neo_edge_type_kb', 'neo_edge_type_kb', 'neo_edge_type'], edge_building: ['neo_edge_type', 'neo_edge_type', 'neo_edge_type_kb', 'neo_edge_toast'],
  edge_debugger: ['neo_edge_type_kb', 'neo_edge_type', 'neo_edge_bash'], edge_ultrathink: ['neo_edge_type_kb', 'neo_edge_type', 'neo_edge_bash'], edge_juggling: ['neo_edge_type_kb', 'neo_edge_type_kb', 'neo_edge_type'],
  edge_reading: 'neo_edge_search', edge_surf: 'neo_edge_search', edge_headphones: 'neo_edge_listen',
  edge_sleep: 'neo_edge_sleep_cap', edge_doze: 'neo_edge_sleep_bubble', edge_bubble: 'neo_edge_sleep_bubble',
  edge_carrying: 'neo_edge_toast', edge_sweeping: 'neo_edge_toast', edge_toast: 'neo_edge_toast',
  fling: 'neo_fling', mini_slide: 'neo_edge'
};
function skinNeo() { return true; }   // 只剩像素皮肤
async function buildSpr() {
  if (!skinNeo()) return {};
  const dir = CFG_DIR + '/sprites';
  let names = {};
  try { const r = await Tools.Files.list(dir); ((r && r.entries) || []).forEach(function (e) { names[e.name] = 1; }); } catch (e) { }
  let cfg = {};
  try { cfg = JSON.parse(await readText(dir + '/sprites.json')) || {}; } catch (e) { cfg = {}; }
  const v = Date.now(), out = {};
  for (const k in NEO_MAP) {
    const arr = [].concat(NEO_MAP[k]).filter(function (f) { return names[f + '.png']; }).map(function (f) {
      const c = cfg[f] || {};
      return { src: 'sprites/' + f + '.png?v=' + v, fps: +c.fps || 4, loop: c.loop !== false, hold: c.hold || null };
    });
    if (arr.length) out[k] = arr;
  }
  return out;
}

const DEFAULTS = {
  formatVersion: 1,
  pet: { visible: true, sizeDp: 110, x: -1, y: -1, startMode: 'mini:right', skin: 'neo', hitScale: 1,
         miniHide: 0.42, miniTrigger: 0.18, longPressMs: 600, doubleTapMs: 300,
         sleepAfterMin: 5 },
  chat: {
    chatId: '',                 // 绑定的对话 ID；空 = 首次发消息时自动新建
    chatTitle: '🦀 Clawd',      // 自动新建时用的标题
    autoCreate: true,
    hideUserMessage: false,     // 在对话里隐藏用户这条消息
    notifyReply: false,         // 回复完成发系统通知
    roleCardId: '',             // 可选：指定角色卡
    senderName: '',             // 可选：发送者显示名
    timeoutMs: 180000
  },
  bubble: {
    widthDp: 240, maxHeightDp: 320,
    anchorTop: 0.54,           // 气泡贴到 Clawd 头顶：头顶在画布里的高度比例（越大越往下贴）
    anchorBottom: 0.88,        // 放到下方时：脚底在画布里的高度比例
    maxVisible: 2,             // 同时最多显示几条
    gapMs: 1200,               // 下一条冒出前的基础间隔
    typeCharMs: 130,           // 按当前这条字数追加的阅读时间（每字）
    maxGapMs: 8000,
    segmentMs: 2500,           // 全部冒完后的停留：基础
    perCharMs: 60,             //                  + 每字
    maxSegmentMs: 12000,
    maxSegmentChars: 40,       // 单条过长再切（聊天感：短一点）
    lingerMs: 1000
  },
  filter: {
    stripTags: true,           // 去掉 <xxx>...</xxx> 及自闭合标签
    stripCodeBlocks: true,     // 代码块替换成「（代码已省略）」
    stripMarkdown: true        // 去掉 ** __ # > 等标记
  },
  watch: {
    enabled: true,             // 跟随 Operit 对话状态（思考/打字/调工具/完成/出错）
    scope: 'bound',            // 'bound' 只看绑定的对话；'all' 所有对话
    toolDetail: true,          // 按工具类型换动作（终端=调试、搜索=看书…）
    busyAt: 5,                 // 一轮调用工具达到几次 → 手忙脚乱
    crazyAt: 12,               // 达到几次 → 脑子冒烟
    celebrate: true,           // 回复完成时开心一下
    minDwellMs: 1500           // 每个工作动作至少停留多久再换
  },
  link: {
    moodlet: true,             // 读到 <silent mood="..."> 就做对应动作
    tag: true,                 // 读到 <clawd anim="...">话</clawd> 就做动作并冒气泡
    tagSay: true,              // <clawd> 里的话要不要在桌面说出来
    tagPrompt: true,           // 告诉 AI 有 <clawd> 标签可用（范围同 watch.scope）
    promptMode: 'attach',      // attach = 附件挂在用户消息上并落盘（只挂一次）；system = 每次临时拼进系统提示词（不落盘）
    animMs: 3500               // 联动动作播放多久
  },
  idle: {
    variety: true,             // 发呆时随机换小动作
    gapSec: 60,                // 大约多久换一次（实际 0.7~1.5 倍随机）
    lowBattery: true,          // 电量 ≤ 20% 且没充电时变没电样
    music: false               // 发呆动作里加入戴耳机摇摆
  },
  poke: {
    lines: ['干嘛戳我！', '哼。', '嗯？', '在呢在呢', '再戳就生气了…', '🦀'],
    rapidLines: ['别戳了别戳了！', '头好晕…', '我要报警了'],
    rapidCount: 4
  }
};

// ==================== 状态 ====================
let Host = null, ctx = null, hostReady = false, hostError = '';
let settings = null;
let pollTimer = null, initPromise = null, started = false;
let lastTickError = '';
let lastEvent = null;

let speech = { queue: [], timer: null, current: null };   // 气泡分段播放
let busy = false;           // 正在等 AI 回复
let pokeWindow = [];        // 最近戳的时间戳
let lastReply = { text: '', segments: [], at: 0 };
let draft = '';

// ==================== 小工具 ====================
function deepMerge(a, b) {
  if (!b || typeof b !== 'object' || Array.isArray(b)) return b === undefined ? a : b;
  const out = (a && typeof a === 'object' && !Array.isArray(a)) ? Object.assign({}, a) : {};
  for (const k in b) out[k] = deepMerge(out[k], b[k]);
  return out;
}
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

async function readText(p) {
  try {
    const r = await Tools.Files.read(p);
    return typeof r === 'string' ? r : (r && r.content) || '';
  } catch (e) { return ''; }
}
async function writeText(p, s) {
  try { await Tools.Files.write(p, s, false); return true; } catch (e) { return false; }
}
async function ensureDir(p) { try { await Tools.Files.mkdir(p, true); } catch (e) { } }

// 旧版（com.clawd.desk）的设置、养成数据、素材：新目录还没有设置时整份搬过来，旧目录原样保留
let migrateInfo = '';
async function migrateLegacy() {
  if (await readText(SETTINGS_PATH)) return;
  if (!(await readText(LEGACY_DIR + '/settings.json'))) return;
  const done = [];
  for (const f of ['settings.json', 'stats.json', 'stats.backup.json']) {
    const t = await readText(LEGACY_DIR + '/' + f);
    if (t && await writeText(CFG_DIR + '/' + f, t)) done.push(f);
  }
  try { await Tools.Files.copy(LEGACY_DIR + '/sprites', CFG_DIR + '/sprites', true); done.push('sprites'); } catch (e) { }
  migrateInfo = 'migrated: ' + done.join(',');
}
async function loadSettings() {
  await ensureDir(CFG_DIR);
  try { await migrateLegacy(); } catch (e) { migrateInfo = 'migrate error: ' + e; }
  let user = {};
  const raw = await readText(SETTINGS_PATH);
  if (raw) { try { user = JSON.parse(raw); } catch (e) { user = {}; } }
  settings = deepMerge(DEFAULTS, user);
  return settings;
}
// ==================== 像素素材：首次运行（或升级）时从包里释放到 CFG_DIR/sprites ====================
const SPRITE_VER = '1.0.0';
const SHIP_SPRITES = ["ai_charge", "ai_drag", "ai_error", "ai_happy", "ai_idle", "ai_land", "ai_look", "ai_read", "ai_search", "ai_sleep", "ai_talk", "ai_tap", "ai_tool", "ai_type", "ai_walk", "ai_wave", "ai_write", "neo_angry", "neo_bash", "neo_bash_err", "neo_bash_hack", "neo_bash_npm", "neo_bash_test", "neo_confused", "neo_dock", "neo_done", "neo_drop", "neo_edge", "neo_edge_angry", "neo_edge_bash", "neo_edge_confused", "neo_edge_done", "neo_edge_err", "neo_edge_happy", "neo_edge_idle", "neo_edge_listen", "neo_edge_look", "neo_edge_sad", "neo_edge_search", "neo_edge_shock", "neo_edge_shy", "neo_edge_sleep", "neo_edge_sleep_bubble", "neo_edge_sleep_cap", "neo_edge_think", "neo_edge_toast", "neo_edge_type", "neo_edge_type_kb", "neo_fling", "neo_happy", "neo_jelly_full", "neo_listen", "neo_paint", "neo_poke", "neo_sad", "neo_search", "neo_shock", "neo_shy", "neo_sleep_bubble", "neo_sleep_cap", "neo_sleep_jelly", "neo_spin", "neo_surf", "neo_toast", "neo_type", "neo_type_kb", "neo_write_print", "neo_write_toast"];
let spriteInfo = '';
async function copyOver(src, dst) {
  try { const r = await Tools.Files.copy(src, dst); if (!(r && r.success === false)) return; } catch (e) { }
  try { await Tools.Files.deleteFile(dst); } catch (e) { }
  await Tools.Files.copy(src, dst);
}
async function ensureSprites(force) {
  const dir = CFG_DIR + '/sprites';
  await ensureDir(dir);
  if (!force && String(await readText(dir + '/.pkgver')).trim() === SPRITE_VER) { spriteInfo = 'ok ' + SPRITE_VER; return; }
  let n = 0; const fail = [];
  for (const f of SHIP_SPRITES) {
    try { await copyOver(await ToolPkg.readResource('spr_' + f, f + '.png', true), dir + '/' + f + '.png'); n++; }
    catch (e) { fail.push(f); }
  }
  try {   // 合并而不是覆盖：保留用户自己加的素材配置
    const ship = JSON.parse(await readText(await ToolPkg.readResource('spr_json', 'sprites.json', true))) || {};
    let cur = {}; try { cur = JSON.parse(await readText(dir + '/sprites.json')) || {}; } catch (e) { cur = {}; }
    for (const k in ship) cur[k] = ship[k];
    await writeText(dir + '/sprites.json', JSON.stringify(cur, null, 1));
  } catch (e) { fail.push('sprites.json'); }
  if (!fail.length) await writeText(dir + '/.pkgver', SPRITE_VER);
  spriteInfo = 'copied ' + n + '/' + SHIP_SPRITES.length + (fail.length ? ' fail: ' + fail.join(',') : '');
}
async function saveSettings() {
  await writeText(SETTINGS_PATH, JSON.stringify(settings, null, 2));
}

// ==================== 宿主 ====================
async function ensureHost(force) {
  if (hostReady && !force) {
    try { Host.callStatic('version'); return true; } catch (e) { hostReady = false; }
  }
  try {
    const src = await ToolPkg.readResource(DEX_KEY, 'clawd_host.dex', true);
    // 用带时间戳的副本加载，避开引擎对同一路径 loadDex 的去重（热更新 dex 时必要）
    let loadPath = src;
    if (force) {
      try {   // 热更新留下的旧 dex 副本：只留最新一个（可能正在用），其余删掉
        const r = await Tools.Files.list(CFG_DIR);
        const old = ((r && r.entries) || []).map(function (e) { return e.name; }).filter(function (n) { return /^\.host\.\d+\.dex$/.test(n); }).sort();
        for (const n of old.slice(0, -1)) { try { await Tools.Files.deleteFile(CFG_DIR + '/' + n); } catch (e) { } }
      } catch (e) { }
      const stamp = CFG_DIR + '/.host.' + Date.now() + '.dex';
      try { await Tools.Files.copy(src, stamp); loadPath = stamp; } catch (e) { loadPath = src; }
    }
    Java.loadDex(loadPath, { childFirstPrefixes: ['clawd_pet.'] });
    Host = Java.type(HOST_CLASS);
    ctx = Java.getApplicationContext();
    hostReady = true; hostError = '';
    return true;
  } catch (e) {
    hostReady = false; hostError = 'ensureHost: ' + String(e);
    return false;
  }
}
function nativeState() {
  try { return JSON.parse(String(Host.callStatic('getState', ctx))); } catch (e) { return { error: String(e) }; }
}
function evalPet(js) { try { Host.callStatic('evalPet', ctx, js); } catch (e) { hostError = 'evalPet: ' + e; } }
function evalBubble(js) { try { Host.callStatic('evalBubble', ctx, js); } catch (e) { hostError = 'evalBubble: ' + e; } }
function bubbleCall(evt, data) { evalBubble('window.bubble&&window.bubble(' + JSON.stringify(evt) + ',' + JSON.stringify(data || {}) + ')'); }
function petPlay(name, ms) { evalPet('window.clawdPlay&&window.clawdPlay(' + JSON.stringify(name) + ',' + (ms | 0) + ')'); }

// ==================== 跟随对话状态 ====================
// 「工作」是一个持续状态：设了就一直播，直到 setWork(null)
let curWork = null, workSince = 0, lastRuntimeAt = 0;
let watchInfo = { events: 0, last: null, ignored: 0 };
function setWork(name) {
  if (!name && typeof pendingTimer !== 'undefined' && pendingTimer) { clearTimeout(pendingTimer); pendingTimer = null; pendingWork = null; }
  // 收工（null）总是推给页面：重装后 JS 这边是 null，但页面可能还停在上一次的动作上
  if (name === curWork && name) return;
  curWork = name || null;
  workSince = curWork ? Date.now() : 0;
  if (hostReady) evalPet('window.clawdWork&&window.clawdWork(' + JSON.stringify(curWork) + ')');
}
// 带最短停留的切换：同一个动作至少播 minDwellMs，避免状态来回闪
let pendingWork = null, pendingTimer = null;
function setWorkSoft(name) {
  const dwell = (settings.watch && settings.watch.minDwellMs) | 0 || 1500;
  if (pendingTimer) { clearTimeout(pendingTimer); pendingTimer = null; }
  pendingWork = null;
  if (name === curWork) return;
  const left = curWork ? dwell - (Date.now() - workSince) : 0;
  if (left <= 0) { setWork(name); return; }
  pendingWork = name;
  pendingTimer = setTimeout(function () {
    pendingTimer = null;
    if (pendingWork && curWork) setWork(pendingWork);   // 期间若已结束（curWork=null）就不再补
    pendingWork = null;
  }, left);
}
function toolAnim(tool) {
  const t = String(tool || '').toLowerCase();
  if (/terminal|shell|exec|run_|code_runner|adb|ffmpeg/.test(t)) return 'debugger';
  if (skinNeo() && /visit|tavily|web|fetch|crawl|http|download/.test(t)) return 'surf';
  if (/search|visit|tavily|web|grep|find|query|read|list|get_|fetch|crawl/.test(t)) return 'reading';
  if (/draw|image|svg|paint|canvas|render/.test(t)) return 'designing';
  if (/write|create|edit|apply|delete|make_|move|copy|install|build|zip/.test(t)) return 'building';
  if (/workflow|package|skill|memory/.test(t)) return 'wizard';
  return 'typing';
}
function inScope(p) {
  const W = settings.watch || {};
  if (W.scope === 'all') return true;
  const bound = settings.chat && settings.chat.chatId;
  if (!bound) return p.slot === 'main';
  return p.chatId === bound;
}
function onChatRuntime(event) {
  try {
    let p = (event && (event.eventPayload || event.payload)) || event || {};
    watchInfo.events++;
    watchInfo.last = { at: Date.now(), chatId: p.chatId, slot: p.slot, state: p.state, tool: p.toolName || '',
                       n: p.currentTurnToolInvocationCount | 0 };
    if (!settings || !(settings.watch && settings.watch.enabled !== false)) return;
    if (!inScope(p)) { watchInfo.ignored++; return; }
    lastRuntimeAt = Date.now();
    watchInfo.hist = (watchInfo.hist || []).concat([String(p.state) + (p.isActive === false ? '/off' : '')]).slice(-12);
    const W = settings.watch, n = p.currentTurnToolInvocationCount | 0;
    // 有些情况下不会单独发 completed，而是 isActive=false：当作这一轮结束
    if (p.isActive === false && !/^(completed|idle|error)$/.test(String(p.state || ''))) p = Object.assign({}, p, { state: 'completed' });
    // 进入工具循环后（本轮已调过工具），不再切回「思考」，保持手上的活
    const inLoop = n > 0;
    const loopAnim = n >= W.crazyAt ? 'ultrathink' : n >= W.busyAt ? 'juggling' : null;
    switch (String(p.state || '')) {
      case 'processing': case 'connecting': case 'processing_tool_result':
        if (loopAnim) setWorkSoft(loopAnim);
        else if (!inLoop) setWorkSoft('think');
        // 循环中：保持当前工作动画不变
        break;
      case 'receiving':
        if (loopAnim) setWorkSoft(loopAnim);
        else if (!inLoop) setWorkSoft('think');   // 输出文字时只是在想/说，不打字（打字留给工具）
        // 工具循环里输出文字：保持手上的活不变
        break;
      case 'executing_tool': case 'tool_progress':
        if (loopAnim) setWorkSoft(loopAnim);
        else setWorkSoft(W.toolDetail !== false ? toolAnim(p.toolName) : 'typing');
        break;
      case 'summarizing': setWork('sweeping'); break;
      case 'executing_plan': setWork('building'); break;
      case 'error': {
        const wasBash = curWork === 'debugger';
        setWork(null);
        if (hostReady) petPlay(wasBash && skinNeo() ? 'bash_err' : 'error', 3200);
        break;
      }
      case 'completed': case 'idle': {
        const was = curWork, longEnough = workSince && Date.now() - workSince > 1500;
        setWork(null);
        if (pendingLink) { flushLink(); break; }   // 本条回复带了联动标签：只播它
        // Clawd 自己发的消息由 sendToChat 负责「开心 + 念回复」，这里不重复
        // 稍等一下：如果这条回复带了 <clawd>/moodlet 联动，就让联动动作说了算
        if (was && longEnough && !busy && W.celebrate !== false && hostReady) {
          setTimeout(function () {
            if (Date.now() - lastLinkAt > 2500 && !curWork) petPlay('happy', 2200);
          }, 700);
        }
        break;
      }
    }
  } catch (e) { lastTickError = 'runtime: ' + e; }
}
// 页面重建后把持续状态补发回去
function resyncPet() {
  if (!hostReady) return;
  if (curWork) evalPet('window.clawdWork&&window.clawdWork(' + JSON.stringify(curWork) + ')');
  lastBatteryAt = 0;
}
// ==================== 标签联动（moodlet / <clawd>） ====================
// moodlet 的心情 → Clawd 动作
const MOOD_ANIM = {
  sleep: 'sleep', coldwar: 'annoyed', read: 'look', thinking: 'think', speechless: 'dizzy',
  shy: 'shy', busy: 'juggling', typing: 'typing', tsundere: 'annoyed', happy: 'happy',
  eating: 'coffee', slacking: 'bubble', music: 'headphones', coffee: 'coffee', peeking: 'look',
  waiting: 'look', sleepy: 'yawn', cry: 'error', sick: 'low_battery', proud: 'double_jump',
  bored: 'yawn', tipsy: 'dizzy', heartbroken: 'collapse', celebrate: 'double_jump', shocked: 'notify',
  thumbsup: 'happy', surrender: 'collapse', confused: 'dizzy', stop: 'annoyed', sweet: 'love',
  secret: 'shy', dislike: 'annoyed', chill: 'coffee', moody: 'annoyed', lyingflat: 'doze',
  precious: 'love', caught: 'notify', announce: 'notify', qrcode: 'designing', working: 'typing',
  letter: 'carrying', whisper: 'shy', boba: 'coffee', deadline: 'ultrathink'
};
const ANIM_NAMES = ('happy love shy dizzy annoyed error wake notify left right double_jump ' +
  'idle look reading yawn doze bubble sweeping carrying designing coffee headphones low_battery collapse sleep ' +
  'think typing juggling ultrathink building debugger wizard outlaw surf toast jelly talk spin walk wave').split(' ');
// 一些顺手的别名，AI 写错也能认
const ANIM_ALIAS = { jump: 'double_jump', sad: 'error', angry: 'annoyed', thinking: 'think', heart: 'love',
  surprised: 'notify', shocked: 'notify', tired: 'yawn', sleepy: 'yawn', read: 'reading', work: 'typing',
  music: 'headphones', cry: 'error', proud: 'double_jump', celebrate: 'double_jump' };
function normAnim(a) {
  a = String(a || '').trim().toLowerCase().replace(/-/g, '_');
  if (!a) return '';
  if (ANIM_NAMES.indexOf(a) >= 0) return a;
  return ANIM_ALIAS[a] || MOOD_ANIM[a] || '';
}
function attrOf(tag, name) {
  const m = new RegExp('\\b' + name + '\\s*=\\s*("([^"]*)"|\'([^\']*)\')', 'i').exec(tag);
  return m ? (m[2] !== undefined ? m[2] : m[3]) : '';
}
// 从一条 AI 消息里找联动标签：<clawd> 优先，其次 moodlet
// 另外按出现顺序生成 seq（组合拳）：[{anim, say, src}]，最多 COMBO_MAX 步
const COMBO_MAX = 3;
function parseLinkTags(raw) {
  const L = (settings && settings.link) || {};
  const out = { anim: '', say: [], source: '', seq: [] };
  let t = String(raw || '').replace(/<think(ing)?>[\s\S]*?<\/think(ing)?>/gi, '');
  t = t.replace(/```[\s\S]*?```/g, '');   // 代码块里的示例不算
  // 工具调用 / 工具结果里的内容不算（比如改代码时写到的 <clawd> 示例）
  t = t.replace(/\x3c(tool(?:_result)?(?:_[A-Za-z0-9]+)?)\b[^>]*>[\s\S]*?\x3c\/\1\s*>/g, '')
       .replace(/<status\b[\s\S]*?<\/status\s*>/gi, '').replace(/`[^`\n]*`/g, '');
  if (L.tag !== false) {
    // 只认独占一行开头的标签
    const re = /^[ \t]*<clawd\b([^>]*?)(\/>|>([\s\S]*?)<\/clawd\s*>)/gim;
    let m;
    while ((m = re.exec(t))) {
      const a = normAnim(attrOf(m[1], 'anim') || attrOf(m[1], 'mood'));
      if (a) { out.anim = a; out.source = 'clawd'; }
      const s = String(m[3] || '').trim();
      if (s && out.say.length < 3) out.say.push(s.slice(0, 200));
    }
  }
  if (!out.anim && L.moodlet !== false) {
    const m = /^[ \t]*<silent\b([^>]*)>/im.exec(t);
    if (m) {
      const a = MOOD_ANIM[String(attrOf(m[1], 'mood')).trim().toLowerCase()];
      if (a) { out.anim = a; out.source = 'moodlet'; }
    }
  }
  // 组合拳：两种标签混在一起，按在正文里出现的位置排序
  const steps = [];
  if (L.tag !== false) {
    const re2 = /^[ \t]*<clawd\b([^>]*?)(\/>|>([\s\S]*?)<\/clawd\s*>)/gim;
    let m2;
    while ((m2 = re2.exec(t))) {
      const a = normAnim(attrOf(m2[1], 'anim') || attrOf(m2[1], 'mood'));
      const s = String(m2[3] || '').trim().slice(0, 200);
      if (a || s) steps.push({ pos: m2.index, anim: a, say: s, src: 'clawd' });
    }
  }
  if (L.moodlet !== false) {
    const re3 = /^[ \t]*<silent\b([^>]*)>/gim;
    let m3;
    while ((m3 = re3.exec(t))) {
      const a = MOOD_ANIM[String(attrOf(m3[1], 'mood')).trim().toLowerCase()];
      if (a) steps.push({ pos: m3.index, anim: a, say: '', src: 'moodlet' });
    }
  }
  steps.sort(function (x, y) { return x.pos - y.pos; });
  // 相邻重复动作（比如 moodlet 和 <clawd> 表达同一个情绪）合并成一步
  for (let i = 0; i < steps.length && out.seq.length < COMBO_MAX; i++) {
    const s = steps[i], prev = out.seq[out.seq.length - 1];
    if (prev && s.anim && prev.anim === s.anim && !s.say) continue;
    if (prev && s.anim && prev.anim === s.anim && !prev.say) { prev.say = s.say; prev.src = s.src; continue; }
    out.seq.push({ anim: s.anim, say: s.say, src: s.src });
  }
  return out;
}
let linkInfo = { events: 0, last: null };
let lastLinkAt = 0, seenMsgKeys = [];
function onChatMessage(event) {
  try {
    const p = (event && (event.eventPayload || event.payload)) || {};
    linkInfo.events++;
    if (!settings) return;
    const sender = String(p.sender || '').toLowerCase();
    if (sender && sender !== 'ai' && sender !== 'assistant') return;
    if (!linkScope(p.chatId)) return;
    if (busy) return;                       // Clawd 自己发的，sendToChat 会处理
    // 桌宠发的消息：回复落库的事件常在 sendToChat 返回后才到，别让它把完整回复换成只念标签
    if (selfReplyAt && Date.now() - selfReplyAt < 30000 && (!p.chatId || p.chatId === selfReplyChat)) return;
    // 养成：在 Operit 里和绑定对话聊也算（按 对话+时间戳 去重，流式更新不重复记）
    const ck = (p.chatId || '') + '|' + (p.timestamp || '');
    if (p.timestamp && countedMsgKeys.indexOf(ck) < 0) {
      countedMsgKeys.push(ck); if (countedMsgKeys.length > 30) countedMsgKeys.shift();
      bump('chat');
    }
    const key = (p.chatId || '') + '|' + (p.timestamp || '') + '|' + String(p.content || '').length;
    if (seenMsgKeys.indexOf(key) >= 0) return;
    seenMsgKeys.push(key); if (seenMsgKeys.length > 30) seenMsgKeys.shift();
    const r = parseLinkTags(p.content);
    const tagSet = {};
    String(p.content || '').replace(/<([a-zA-Z_][\w:-]*)/g, function (_, n) { tagSet[n] = (tagSet[n] || 0) + 1; return _; });
    linkInfo.last = { at: Date.now(), chatId: p.chatId, sender: sender, anim: r.anim, source: r.source, say: r.say.length,
                      tags: Object.keys(tagSet).slice(0, 12).map(function (k) { return k + 'x' + tagSet[k]; }).join(' ') };
    if (!hostReady || (!r.anim && !r.say.length)) return;
    lastLinkAt = Date.now();
    // 消息落库时这一轮往往还没结束（还在 executing/receiving），直接播会被工作动画盖掉。
    // 先存着，等 completed/idle 再播；4 秒兜底。
    pendingLink = r;
    if (pendingLinkTimer) clearTimeout(pendingLinkTimer);
    pendingLinkTimer = setTimeout(flushLink, curWork ? 4000 : 300);
  } catch (e) { lastTickError = 'link: ' + e; }
}
let pendingLink = null, pendingLinkTimer = null;
let selfReplyAt = 0, selfReplyChat = '';
// 桌宠里聊天：念完整回复，把连播的动作挂到对应的那句话上
function comboOverReply(segs, seq) {
  const items = (segs || []).map(function (s) { return { anim: '', text: s }; });
  if (!items.length) return items;
  let cur = 0;
  (seq || []).forEach(function (st) {
    if (!st.anim) return;
    let idx = -1;
    if (st.say) {
      const first = (splitSegments(cleanReply(st.say))[0] || '').trim();
      for (let i = cur; i < items.length && first; i++) {
        const t = items[i].text.trim();
        if (t.indexOf(first) >= 0 || first.indexOf(t) >= 0) { idx = i; break; }
      }
    }
    if (idx < 0) { idx = Math.min(cur, items.length - 1); while (idx < items.length - 1 && items[idx].anim) idx++; }
    if (items[idx].anim) return;            // 没地方挂了，丢掉这一招
    items[idx].anim = st.anim;
    cur = idx + 1;
  });
  if (!items[0].anim && !(seq && seq.length)) items[0].anim = 'happy';
  return items;
}
function flushLink() {
  if (pendingLinkTimer) { clearTimeout(pendingLinkTimer); pendingLinkTimer = null; }
  const r = pendingLink; pendingLink = null;
  if (!r || !hostReady) return false;
  const L = settings.link || {};
  setWork(null);
  lastLinkAt = Date.now();
  if (r.seq && r.seq.length) {
    playCombo(r.seq);
    linkInfo.played = { at: Date.now(), anim: r.seq.map(function (s) { return s.anim || '-'; }).join('>'), say: r.say.length, combo: r.seq.length };
    return true;
  }
  if (r.say.length && L.tagSay !== false) sayText(cleanReply(r.say.join('\n')), { anim: r.anim });
  else if (r.anim) petPlay(r.anim, L.animMs | 0 || 3500);
  linkInfo.played = { at: Date.now(), anim: r.anim, say: r.say.length };
  return true;
}
// 组合拳：每一步先做动作，再冒这一步自己的话；步与步之间至少留够一个动作的时间
function playCombo(seq) {
  const L = settings.link || {};
  const items = [];
  seq.forEach(function (st) {
    const segs = (st.say && L.tagSay !== false) ? splitSegments(cleanReply(st.say)) : [];
    if (!segs.length) { if (st.anim) items.push({ anim: st.anim, text: '' }); return; }
    segs.forEach(function (sg, k) { items.push({ anim: k === 0 ? st.anim : '', text: sg }); });
  });
  if (!items.length) return;
  if (items.length === 1 && !items[0].text) { petPlay(items[0].anim, L.animMs | 0 || 3500); return; }
  speak(items, {});
}
function linkScope(chatId) {
  const W = (settings && settings.watch) || {};
  if (W.scope === 'all') return true;
  const bound = settings.chat && settings.chat.chatId;
  return !!bound && chatId === bound;
}
// ==================== 输入菜单开关：标签提示词 ====================
const PROMPT_ENV = 'CLAWD_TAG_PROMPT';
const PROMPT_TOGGLE_ID = 'clawd_tag_prompt';
// 读开关：优先已加载的 settings.json，没加载时读环境变量镜像（提示词钩子可能跑在未初始化的上下文里）
function promptEnabled() {
  if (settings && settings.link) return settings.link.tag !== false && settings.link.tagPrompt !== false;
  try {
    if (typeof getEnv === 'function') {
      const v = String(getEnv(PROMPT_ENV) || '').trim().toLowerCase();
      if (v) return v === 'true' || v === '1';
    }
  } catch (e) { }
  return DEFAULTS.link.tagPrompt !== false;
}
async function setPromptEnabled(on) {
  if (!settings) { try { await loadSettings(); } catch (e) { } }
  if (settings) {
    settings.link = settings.link || {};
    settings.link.tagPrompt = !!on;
    await saveSettings();
  }
  try { await Tools.SoftwareSettings.writeEnvironmentVariable(PROMPT_ENV, on ? 'true' : 'false'); } catch (e) { }
  // 重新打开时清掉「已挂过」记录，下一条消息重新挂一次说明
  if (on) { try { await Tools.SoftwareSettings.writeEnvironmentVariable(GUIDED_ENV, '{}'); } catch (e) { } }
}
async function onInputMenuToggle(event) {
  const p = (event && event.eventPayload) || {};
  if (!settings) { try { await loadSettings(); } catch (e) { } }
  const on = promptEnabled();
  if (p.action === 'create') {
    return {
      toggles: [{
        id: PROMPT_TOGGLE_ID,
        title: '🦀 Clawd 标签',
        description: '开：告诉 AI 可以用 <clawd> 标签让桌宠做动作、说话；关：不注入（标签照样能识别）',
        isChecked: on,
        slot: 'general'
      }]
    };
  }
  if (p.action === 'toggle' && p.toggleId === PROMPT_TOGGLE_ID) {
    await setPromptEnabled(!on);
    return null;
  }
  return null;
}
// 标签用法说明正文（两种注入方式共用）
const GUIDE_ID = 'clawd_tag_guide';
function tagGuideText() {
  return '【Clawd 桌宠】用户桌面上有一只小螃蟹 Clawd。想让它做动作或替你在桌面说句话时，在回复里写（独占一行）：\n' +
    '<clawd anim="动作">一句简短的话（可留空）</clawd>\n' +
    '动作：happy love shy dizzy annoyed error notify double_jump look reading yawn doze bubble coffee headphones collapse sleep think typing juggling ultrathink building wizard surf toast jelly。' +
    '一条回复最多 3 个，会按出现顺序连播（每句话跟着自己的动作出来）；只在情绪或场景合适时用，不要每句都加。';
}
function promptMode() {
  const m = settings && settings.link && settings.link.promptMode;
  if (m) return m;
  try { if (typeof getEnv === 'function') { const v = String(getEnv('CLAWD_TAG_PROMPT_MODE') || '').trim(); if (v) return v; } } catch (e) { }
  return 'attach';
}
// 已挂过说明的对话：存在环境变量里（钩子可能跑在没加载 settings 的上下文，环境变量两边都读得到）
const GUIDED_ENV = 'CLAWD_TAG_GUIDED';
function guidedChats() {
  try {
    if (typeof getEnv === 'function') { const o = JSON.parse(String(getEnv(GUIDED_ENV) || '{}')); if (o && typeof o === 'object') return o; }
  } catch (e) { }
  return {};
}
function saveGuidedChats(o) {
  try { Tools.SoftwareSettings.writeEnvironmentVariable(GUIDED_ENV, JSON.stringify(o)); } catch (e) { }
}
// 落盘注入：作为附件挂在用户消息后面，随消息存进聊天记录。
// 历史里已经有这份说明就不重复挂（被上下文总结截掉后会自动补回来）。
function onPromptInput(event) {
  try {
    const p = (event && event.eventPayload) || {};
    const stage = String(p.stage || event.eventName || '');
    if (stage !== 'before_process') return null;
    if (!promptEnabled() || promptMode() !== 'attach') return null;
    if (settings && !linkScope(p.chatId)) return null;
    const input = String(p.processedInput || p.rawInput || '');
    if (!input.trim() || input.indexOf(GUIDE_ID) >= 0) return null;
    const hist = p.chatHistory || p.preparedHistory || [];
    // 调试：记下 payload 里有什么，便于确认历史是否可用
    linkInfo.guideProbe = { keys: Object.keys(p).join(','), hist: hist.length,
      hasGuide: hist.some(function (t) { return String((t && t.content) || '').indexOf(GUIDE_ID) >= 0; }) };
    try { Tools.SoftwareSettings.writeEnvironmentVariable('CLAWD_GUIDE_PROBE', JSON.stringify(linkInfo.guideProbe)); } catch (e) { }
    for (let i = 0; i < hist.length; i++) {
      if (String((hist[i] && hist[i].content) || '').indexOf(GUIDE_ID) >= 0) return null;
    }
    // 历史里拿不到（钩子阶段可能不带历史）：按对话记一笔，挂过就不再挂
    const cid = String(p.chatId || '');
    const done = guidedChats();
    if (cid && done[cid]) return null;
    if (cid) { done[cid] = Date.now(); saveGuidedChats(done); }
    const c = tagGuideText();
    const esc = c.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    linkInfo.guideAt = Date.now();
    return input + '\n\n<attachment id="' + GUIDE_ID + '" filename="🦀 Clawd 标签说明" type="text/plain" size="' + c.length + '">' + esc + '</attachment>';
  } catch (e) { return null; }
}
// 告诉 AI 可以用 <clawd> 标签（不落盘：每次请求临时拼进系统提示词）
function onSystemPrompt(event) {
  try {
    const name = String((event && event.eventName) || '');
    if (name && name !== 'after_compose_system_prompt') return;
    if (!promptEnabled() || promptMode() !== 'system') return;
    const p = (event && event.eventPayload) || {};
    if (settings && !linkScope(p.chatId)) return;
    const original = String(p.systemPrompt || '');
    if (original.indexOf('<clawd') >= 0) return;
    return original + '\n\n' + tagGuideText();
  } catch (e) { return; }
}
// 主对话里把 <clawd> 渲染成小卡片
function onXmlRender(event) {
  const p = (event && event.eventPayload) || {};
  if (String(p.tagName || '').toLowerCase() !== 'clawd') return { handled: false };
  const xml = String(p.xmlContent || '');
  const head = (/<clawd\b([^>]*)>/i.exec(xml) || [])[1] || '';
  const animRaw = attrOf(head, 'anim') || attrOf(head, 'mood');
  const anim = normAnim(animRaw) || '';
  const text = xml.replace(/^<clawd\b[^>]*>/i, '').replace(/<\/clawd\s*>$/i, '').trim();
  let h = 0; for (let i = 0; i < xml.length; i++) h = (h * 31 + xml.charCodeAt(i)) | 0;
  const fp = (h >>> 0).toString(36);
  try {
    const ui = require('./ui/clawd_tag.ui.js');
    return {
      handled: true,
      composeDsl: {
        screen: ui.default || ui,
        state: { _anim: anim, _animRaw: animRaw, _text: text },
        memo: { fingerprint: fp },
        moduleSpec: { id: 'clawd_tag_' + fp, runtime: 'compose_dsl' }
      }
    };
  } catch (e) {
    return { handled: true, text: '🦀 ' + (anim ? '[' + anim + '] ' : '') + text };
  }
}

// 兜底：长时间没有状态事件就别一直干活
function watchdog() {
  // 有时收不到 completed：20 秒没有任何状态变化就当这一轮结束了
  if (curWork && !busy && Date.now() - lastRuntimeAt > 20000) {
    watchInfo.watchdogAt = Date.now();
    setWork(null);
    if (pendingLink) flushLink();
  }
}
// 电量
let batteryInfo = null, lastBatteryAt = 0;
async function checkBattery() {
  if (!hostReady || !(settings.idle && settings.idle.lowBattery !== false)) return;
  if (Date.now() - lastBatteryAt < 120000) return;
  lastBatteryAt = Date.now();
  try {
    const d = await Tools.System.getDeviceInfo();
    const lv = +(d && d.batteryLevel), ch = !!(d && d.batteryCharging);
    batteryInfo = { level: lv, charging: ch };
    evalPet('window.clawdSet&&window.clawdSet(' + JSON.stringify({ lowBattery: lv > 0 && lv <= 20 && !ch }) + ')');
  } catch (e) { batteryInfo = { error: String(e) }; }
}

// ==================== 页面拼装 ====================
async function buildPetHtml() {
  const tpl = await readText(await ToolPkg.readResource('pet_html', 'pet.html', true));
  const imgs = {};
  const spr = await buildSpr();
  const I = settings.idle || {};
  const cfg = { sleepAfterMs: Math.max(1, settings.pet.sleepAfterMin) * 60000,
                idleVariety: I.variety !== false, idleGapSec: +I.gapSec || 60, musicIdle: !!I.music, leanDeg: settings.pet.leanDeg == null ? 12 : +settings.pet.leanDeg, leanShift: settings.pet.leanShift == null ? 6 : +settings.pet.leanShift,
                locked: lockedAnims() };
  const sm = String(settings.pet.startMode || 'mini:right');
  const init = sm.indexOf('mini:') === 0
    ? "clawdInit('mini'," + JSON.stringify(sm.slice(5)) + ");"
    : "clawdInit('free');";
  return tpl.replace('/*__IMGS__*/{}', JSON.stringify(imgs))
            .replace('/*__SPR__*/{}', JSON.stringify(spr))
            .replace('/*__CFG__*/{ sleepAfterMs: 300000 }', JSON.stringify(cfg))
            .replace('/*__INIT__*/', init);
}
async function buildBubbleHtml() {
  return await readText(await ToolPkg.readResource('bubble_html', 'bubble.html', true));
}

function pushConfig() {
  const p = settings.pet, b = settings.bubble;
  try {
    const neo = skinNeo();   // 像素贴边素材自己已经「藏」了半截身子，画布不用再往外推
    Host.callStatic('configure', ctx, p.sizeDp | 0, neo ? 0 : +p.miniHide, +p.miniTrigger,
      p.longPressMs | 0, p.doubleTapMs | 0, b.widthDp | 0, b.maxHeightDp | 0);
    Host.callStatic('setBubbleAnchor', ctx, neo ? 0.34 : +b.anchorTop, neo ? 0.68 : +b.anchorBottom);
  } catch (e) { hostError = 'configure: ' + e; }
  try { Host.callStatic('setHitScale', ctx, +p.hitScale || 1); } catch (e) { }
}

async function showPet() {
  if (!(await ensureHost())) return { ok: false, error: hostError };
  const st0 = nativeState();
  if (st0 && st0.canOverlay === false) return { ok: false, error: 'no_overlay_permission' };
  const petHtml = await buildPetHtml();
  const bubbleHtml = await buildBubbleHtml();
  const p = settings.pet;
  try {
    Host.callStatic('show', ctx, petHtml, bubbleHtml, 'file://' + CFG_DIR + '/',
      p.sizeDp | 0, p.x | 0, p.y | 0, String(p.startMode || ''));
  } catch (e) { return { ok: false, error: 'show: ' + e }; }
  await sleep(300);
  pushConfig();
  resyncPet();
  return { ok: true, state: nativeState() };
}
function hidePet() {
  stopSpeech();
  try { Host.callStatic('hide', ctx); } catch (e) { }
}

// ==================== 文本清洗 & 分段 ====================
function cleanReply(text) {
  let t = String(text || '');
  const f = settings.filter;
  // 思考过程永远不要
  t = t.replace(/<think(ing)?>[\s\S]*?<\/think(ing)?>/gi, '');
  // <clawd>话</clawd> 保留里面的话（就是说给桌面听的）
  t = t.replace(/<clawd\b[^>]*>([\s\S]*?)<\/clawd\s*>/gi, '\n$1\n').replace(/<clawd\b[^>]*\/>/gi, '');
  if (f.stripCodeBlocks) t = t.replace(/```[\s\S]*?```/g, '（代码已省略）');
  if (f.stripTags) {
    // 成对标签整个去掉（工具调用、卡片、moodlet 等）
    for (let i = 0; i < 4; i++) {
      t = t.replace(/<([a-zA-Z][\w:-]*)\b[^>]*>[\s\S]*?<\/\1\s*>/g, '');
    }
    t = t.replace(/<\/?[a-zA-Z][\w:-]*\b[^>]*\/?>/g, '');   // 残留单标签
  }
  if (f.stripMarkdown) {
    t = t.replace(/!\[[^\]]*\]\([^)]*\)/g, '')            // 图片
         .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')          // 链接
         .replace(/`([^`]+)`/g, '$1')
         .replace(/^\s{0,3}#{1,6}\s+/gm, '')
         .replace(/^\s{0,3}>\s?/gm, '')
         .replace(/^\s*[-*+]\s+/gm, '· ')
         .replace(/(\*\*|__)(.+?)\1/g, '$2')
         .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1$2')
         .replace(/^\s*([-*_]\s*){3,}$/gm, '')
         .replace(/^\|.*\|$/gm, '');                       // 表格行
  }
  return t.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

// waifu 风格分段：先按空行/换行，再按句末标点；短句合并，长句再切
function splitSegments(text) {
  const maxC = settings.bubble.maxSegmentChars | 0 || 90;
  const out = [];
  const paras = String(text).split(/\n+/).map(function (s) { return s.trim(); }).filter(Boolean);
  for (const para of paras) {
    const sentences = para.match(/[^。！？!?…~～]+[。！？!?…~～]*[」』”"）)]*|[^。！？!?…~～]+$/g) || [para];
    let buf = '';
    for (let s of sentences) {
      s = s.trim(); if (!s) continue;
      if ((buf + s).length <= maxC) { buf += s; continue; }
      if (buf) out.push(buf);
      while (s.length > maxC) {
        // 尽量在逗号处切
        let cut = Math.max(s.lastIndexOf('，', maxC), s.lastIndexOf(',', maxC), s.lastIndexOf('、', maxC));
        if (cut < maxC * 0.4) cut = maxC;
        out.push(s.slice(0, cut + 1).trim());
        s = s.slice(cut + 1).trim();
      }
      buf = s;
    }
    if (buf) out.push(buf);
  }
  // 只合并「极碎」的段（列表项、几个字的感叹），保持一条一条的聊天感
  const merged = [];
  for (const seg of out) {
    const prev = merged[merged.length - 1];
    const tiny = function (s) { return s.length <= 6 || /^·/.test(s); };
    // 列表头（以冒号结尾）后面跟着的列表项、以及相邻的列表项，都并进同一条
    const prevOpen = /[：:]$/.test(prev || '') || /(^|\n)·/.test(prev || '');
    if (prev !== undefined && tiny(seg) && (tiny(prev) || prevOpen) && prev.length + seg.length + 1 <= maxC) {
      merged[merged.length - 1] = prev + '\n' + seg;
    } else {
      merged.push(seg);
    }
  }
  return merged;
}

// ==================== 说话（分段队列） ====================
function stopSpeech() {
  if (speech.timer) clearTimeout(speech.timer);
  speech = { queue: [], shown: [], timer: null, current: null, done: false };
}
// （旧的翻页时长函数已移除，见下方 typeDelay / lingerMs）
// 一条一条冒出来（像聊天消息）：
//   · 下一条的出现间隔 = 模拟「打字」时间（按上一条长度算），比阅读时长短
//   · 最多同时显示 bubble.maxVisible 条，旧的变淡、最旧的飘走
//   · 全部冒完后整组停留 linger，再一起收起
//   · 戳 / 点气泡 = 立刻冒下一条；已经冒完时 = 立刻收起
function typeDelay(seg) {
  const b = settings.bubble;
  const ms = (b.gapMs | 0) + seg.length * (b.typeCharMs | 0);
  return Math.max(500, Math.min(ms, b.maxGapMs | 0 || 4000));
}
function lingerMs() {
  // 收起前的停留：按最后几条的总字数估阅读时间
  const b = settings.bubble;
  const shown = speech.shown.slice(-(b.maxVisible | 0 || 3));
  const chars = shown.reduce(function (n, s) { return n + s.length; }, 0);
  return Math.min(b.segmentMs + chars * b.perCharMs, b.maxSegmentMs) + b.lingerMs;
}
// segments: string[]；opts: {anim}
function speak(segments, opts) {
  opts = opts || {};
  stopSpeech();
  if (!segments || !segments.length) return;
  speech.queue = segments.slice();
  speech.shown = [];
  speech.opts = opts;
  if (opts.anim) petPlay(opts.anim, 2600);
  else if (!curWork && !opts.quiet) {
    const first = typeof segments[0] === 'string' ? segments[0] : String((segments[0] && segments[0].text) || '');
    const mood = segments.length <= 2 ? lineMood(first) : '';
    if (mood) petPlay(mood, 2600);
    else if (skinNeo()) petPlay('talk', Math.min(6000, 1800 + segments.length * 1200));
  }
  bubbleCall('reset', {});
  nextSegment();
}
function nextSegment() {
  if (speech.timer) { clearTimeout(speech.timer); speech.timer = null; }
  if (!speech.queue.length) {
    // 冒完了：再被催一下就直接收起
    closeSpeech();
    return;
  }
  // 队列项可以是字符串，也可以是组合拳的 {anim, text}
  const item = speech.queue.shift();
  const seg = typeof item === 'string' ? item : String((item && item.text) || '');
  const hold = (settings.link && settings.link.animMs) | 0 || 3500;
  if (item && typeof item === 'object' && item.anim) { petPlay(item.anim, hold); speech.stepAt = Date.now(); }
  if (seg) {
    speech.shown.push(seg);
    speech.current = seg;
    bubbleCall('push', { text: seg, max: settings.bubble.maxVisible | 0 || 2, maxH: ((settings.bubble.maxHeightDp | 0) || 320) - 6 });
    try { Host.callStatic('showBubble', ctx); } catch (e) { }
  }
  if (speech.queue.length) {
    const nx = speech.queue[0];
    const nxText = typeof nx === 'string' ? nx : String((nx && nx.text) || '');
    let d = typeDelay(seg || nxText || 'x');   // 按刚冒出来这条的字数留阅读时间
    // 下一项是新的一招：等当前动作差不多播完再换
    if (nx && typeof nx === 'object' && nx.anim) d = Math.max(d, Math.max(0, hold - 400 - (Date.now() - (speech.stepAt || 0))));
    speech.timer = setTimeout(nextSegment, d);
  } else {
    speech.done = true;
    speech.timer = setTimeout(closeSpeech, lingerMs());
  }
}
function closeSpeech() {
  if (speech.timer) { clearTimeout(speech.timer); speech.timer = null; }
  try { Host.callStatic('hideBubble', ctx); } catch (e) { }
  speech.current = null;
  speech.done = false;
}
// 短句看情绪配动作：没写 anim 的气泡用它；认不出来返回 ''
const LINE_MOODS = [
  ['dizzy',   /晕|转圈圈|眼冒金星|@_@/],
  ['annoyed', /哼|干嘛|生气|气死|烦|别戳|报警|讨厌|不理你|凶|💢|😠|😤/],
  ['error',   /呜|哭|难过|伤心|委屈|疼|痛|555|😢|😭|心碎/],
  ['shy',     /喜欢|爱你|贴贴|在呢|嘿嘿|害羞|摸摸|抱抱|❤|♥|💕|🥰|😳|♡/],
  ['notify',  /吓|啊！|诶！|哇！|！！|😱|天哪/],
  ['happy',   /开心|哈哈|好耶|耶|太好了|嘻嘻|😆|😄|🎉/]
];
function lineMood(text) {
  const s = String(text || '');
  if (!s || s.length > 30) return '';
  for (let i = 0; i < LINE_MOODS.length; i++) if (LINE_MOODS[i][1].test(s)) return LINE_MOODS[i][0];
  return '';
}
function sayText(text, opts) {
  speak(splitSegments(String(text || '')), opts);
}

// ==================== 对话 ====================
async function ensureChatId() {
  const c = settings.chat;
  if (c.chatId) {
    // 校验还存在
    try {
      const r = await Tools.Chat.findChat({ query: c.chatId, match: 'exact' });
      if (r && r.chat && r.chat.id) return c.chatId;
    } catch (e) { }
    try {
      const all = await Tools.Chat.listAll();
      if (all && all.chats && all.chats.some(function (x) { return x.id === c.chatId; })) return c.chatId;
    } catch (e) { }
  }
  if (!c.autoCreate) throw new Error('未绑定对话，请在 Clawd 设置里选择一个对话');
  const created = await Tools.Chat.createNew(undefined, false, c.roleCardId || undefined);
  const id = created && created.chatId;
  if (!id) throw new Error('新建对话失败');
  try { await Tools.Chat.updateTitle(id, c.chatTitle || '🦀 Clawd'); } catch (e) { }
  settings.chat.chatId = id;
  await saveSettings();
  return id;
}

async function sendToChat(text) {
  if (busy) { sayText('等我说完这句…'); return { ok: false, error: 'busy' }; }
  busy = true;
  stopSpeech();
  bubbleCall('typing', { hint: '' });
  try { Host.callStatic('showBubble', ctx); } catch (e) { }
  setWork('think');
  try {
    const chatId = await ensureChatId();
    const c = settings.chat;
    const res = await Tools.Chat.sendMessage(
      text, chatId, c.roleCardId || undefined, c.senderName || undefined,
      { persist_turn: true, notify_reply: !!c.notifyReply, hide_user_message: !!c.hideUserMessage,
        disable_warning: true, timeout_ms: c.timeoutMs | 0 }
    );
    const raw = (res && res.aiResponse) || '';
    const clean = cleanReply(raw);
    const segs = splitSegments(clean || '（Clawd 收到了，但回复里没有可以说的文字）');
    lastReply = { text: clean, segments: segs, at: Date.now() };
    busy = false;
    setWork(null);
    selfReplyAt = Date.now(); selfReplyChat = chatId;
    bump('chat');
    if (pendingLinkTimer) { clearTimeout(pendingLinkTimer); pendingLinkTimer = null; }
    pendingLink = null;
    const tagged = parseLinkTags(raw);
    speak(comboOverReply(segs, tagged.seq), {});
    return { ok: true, chatId: chatId, segments: segs.length };
  } catch (e) {
    busy = false;
    setWork(null);
    petPlay('error', 3000);
    sayText('呜，没发出去：' + String(e && e.message || e).slice(0, 60));
    return { ok: false, error: String(e) };
  }
}

// ==================== 养成 ====================
const STATS_PATH = CFG_DIR + '/stats.json';
const LEVELS = [0, 30, 80, 160, 300, 500, 800, 1200];
const LEVEL_NAMES = ['陌生蟹', '点头之交', '熟蟹', '好朋友', '老朋友', '挚友', '灵魂伙伴', '命中注定'];
// 动作图鉴：need 为空 = 一开始就有
const UNLOCKS = [
  { anim: 'look', name: '东张西望', need: null },
  { anim: 'reading', name: '看书', need: null },
  { anim: 'yawn', name: '打哈欠', need: null },
  { anim: 'bubble', name: '吹泡泡', need: { chats: 10 } },
  { anim: 'coffee', name: '喝咖啡', need: { days: 2 }, how: '早上发呆' },
  { anim: 'sweeping', name: '扫地', need: { pokes: 30 } },
  { anim: 'carrying', name: '搬箱子', need: { chats: 30 } },
  { anim: 'designing', name: '画画', need: { days: 5 } },
  { anim: 'love', name: '爱心眼', need: { level: 2 }, how: '长按' },
  { anim: 'headphones', name: '听歌', need: { level: 3 } },
  { anim: 'outlaw', name: '牛仔', need: { nights: 3 }, how: '深夜发呆' },
  { anim: 'wizard', name: '魔法', need: { level: 5 } }
];
// 像素皮肤：图鉴显示的名字跟着素材走（解锁条件不变）
const UNLOCK_NEO = {
  bubble: { name: '打盹冒泡' }, coffee: { name: '充电' }, sweeping: { name: '散步' },
  carrying: { name: '挥手' }, love: { name: '害羞' }, outlaw: { name: '转圈圈' }, wizard: { name: '变水母' }
};
function unlockName(u) { return (skinNeo() && UNLOCK_NEO[u.anim] && UNLOCK_NEO[u.anim].name) || u.name; }
let stats = null, pendingCheer = [], countedMsgKeys = [];
function today() {
  const d = new Date(), p = function (n) { return (n < 10 ? '0' : '') + n; };
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}
function newDay() { return { date: today(), chats: 0, pokes: 0, longPress: 0, pokeXp: 0, lpXp: 0 }; }
function normStats(s) {
  const o = Object.assign({ since: Date.now(), xp: 0, chats: 0, pokes: 0, longPress: 0, nights: 0,
    activeDays: 0, lastDay: '', nightDay: '', unlocked: [] }, s || {});
  if (!o.day) o.day = newDay();
  if (!Array.isArray(o.unlocked)) o.unlocked = [];
  return o;
}
async function readStatsFile() {
  const raw = await readText(STATS_PATH);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch (e) { return null; }
}
async function loadStats() {
  const s = await readStatsFile();
  stats = normStats(s);
  if (!s || !stats.unlocked.length) { stats.unlocked = computeUnlocked(); touchDay(); await writeText(STATS_PATH, JSON.stringify(stats)); }
  return stats;
}
// 钩子可能跑在另一个 JS 环境里，各有一份内存。所以每次都以文件为准：读 → 改 → 立刻写，串行执行
let statsChain = Promise.resolve(), lastStatsSync = 0;
function adoptStats(d) {          // 换成文件里的最新数据；别处带来的升级/解锁在这里补播
  const beforeLv = levelOf(stats.xp), old = stats.unlocked.slice();
  stats = normStats(d);
  const lv = levelOf(stats.xp);
  if (lv > beforeLv) pendingCheer.push('亲密度升级！Lv' + (lv + 1) + ' ' + LEVEL_NAMES[lv]);
  const fresh = stats.unlocked.filter(function (a) { return old.indexOf(a) < 0; });
  fresh.forEach(function (a) {
    const u = UNLOCKS.filter(function (x) { return x.anim === a; })[0];
    if (u) pendingCheer.push('解锁新动作：' + unlockName(u) + (u.how ? '（' + u.how + '）' : ''));
  });
  if (fresh.length && hostReady) evalPet('window.clawdSetLocked&&window.clawdSetLocked(' + JSON.stringify(lockedAnims()) + ')');
}
function syncStats() {
  if (!stats) return statsChain;
  statsChain = statsChain.then(async function () {
    const d = await readStatsFile();
    if (d) adoptStats(d);
    lastStatsSync = Date.now();
  }).catch(function (e) { lastTickError = 'stats sync: ' + e; });
  return statsChain;
}
function levelOf(xp) { let i = 0; while (i + 1 < LEVELS.length && xp >= LEVELS[i + 1]) i++; return i; }
function daysKnown() { return Math.floor((Date.now() - stats.since) / 86400000) + 1; }
function needGap(n) {   // 还差多少：返回文字，满足返回 ''
  if (!n) return '';
  if (n.chats && stats.chats < n.chats) return '再聊 ' + (n.chats - stats.chats) + ' 次';
  if (n.pokes && stats.pokes < n.pokes) return '再戳 ' + (n.pokes - stats.pokes) + ' 下';
  if (n.days && daysKnown() < n.days) return '认识第 ' + n.days + ' 天';
  if (n.level && levelOf(stats.xp) + 1 < n.level) return '亲密度 Lv' + n.level;
  if (n.nights && stats.nights < n.nights) return '再熬夜 ' + (n.nights - stats.nights) + ' 次';
  return '';
}
function computeUnlocked() { return UNLOCKS.filter(function (u) { return !needGap(u.need); }).map(function (u) { return u.anim; }); }
function lockedAnims() {
  if (!stats) return [];
  return UNLOCKS.map(function (u) { return u.anim; }).filter(function (a) { return stats.unlocked.indexOf(a) < 0; });
}
function touchDay() {
  const t = today();
  if (!stats.day || stats.day.date !== t) stats.day = newDay();
  if (stats.lastDay !== t) { stats.lastDay = t; stats.activeDays++; stats.xp += 10; }
}
function bump(kind, n) {
  statsChain = statsChain.then(async function () {
    const d = await readStatsFile();
    if (!stats) { await loadStats(); }         // 钩子环境里可能还没加载过
    else if (d) adoptStats(d);
    applyBump(kind, n);
    await writeText(STATS_PATH, JSON.stringify(stats));
    lastStatsSync = Date.now();
  }).catch(function (e) { lastTickError = 'stats: ' + e; });
  return statsChain;
}
function applyBump(kind, n) {
  n = n || 1;
  const before = levelOf(stats.xp);
  touchDay();
  if (kind === 'chat') {
    stats.chats += n; stats.day.chats += n; stats.xp += 3 * n;
    const h = new Date().getHours();
    if (h < 5 && stats.nightDay !== today()) { stats.nightDay = today(); stats.nights++; }
  } else if (kind === 'poke') {
    stats.pokes += n; stats.day.pokes += n;
    const g = Math.min(n, 20 - stats.day.pokeXp);      // 戳每天最多加 20
    if (g > 0) { stats.day.pokeXp += g; stats.xp += g; }
  } else if (kind === 'longPress') {
    stats.longPress++; stats.day.longPress++;
    if (stats.day.lpXp < 10) { stats.day.lpXp += 2; stats.xp += 2; }   // 摸摸每天最多加 10
  }
  checkUnlocks(before);
}
function checkUnlocks(beforeLv) {
  const now = computeUnlocked();
  const fresh = now.filter(function (a) { return stats.unlocked.indexOf(a) < 0; });
  fresh.forEach(function (a) { stats.unlocked.push(a); });
  const lv = levelOf(stats.xp);
  if (lv > beforeLv) pendingCheer.push('亲密度升级！Lv' + (lv + 1) + ' ' + LEVEL_NAMES[lv]);
  fresh.forEach(function (a) {
    const u = UNLOCKS.filter(function (x) { return x.anim === a; })[0];
    pendingCheer.push('解锁新动作：' + unlockName(u) + (u.how ? '（' + u.how + '）' : ''));
  });
  if (fresh.length && hostReady) evalPet('window.clawdSetLocked&&window.clawdSetLocked(' + JSON.stringify(lockedAnims()) + ')');
}
function levelInfo() {
  const lv = levelOf(stats.xp), lo = LEVELS[lv], hi = LEVELS[lv + 1];
  return { lv: lv + 1, name: LEVEL_NAMES[lv], xp: stats.xp, lo: lo, hi: hi || null,
           pct: hi ? Math.round((stats.xp - lo) * 100 / (hi - lo)) : 100 };
}
function nextUnlock() {
  for (const u of UNLOCKS) { if (stats.unlocked.indexOf(u.anim) < 0) return { name: unlockName(u), gap: needGap(u.need) }; }
  return null;
}
// 桌面长按：气泡里弹一张像素小卡
function showStatusCard() {
  if (!stats || busy) return;
  const L = levelInfo(), nx = nextUnlock(), cells = 10, on = Math.round(L.pct / 100 * cells);
  let bar = '';
  for (let i = 0; i < cells; i++) bar += '<b' + (i < on ? ' class="on"' : '') + '></b>';
  const html = '<div class="px">' +
    '<div class="px-h">♥ Lv' + L.lv + ' ' + L.name + '</div>' +
    '<div class="px-bar">' + bar + '</div>' +
    '<div class="px-s">' + (L.hi ? 'XP ' + L.xp + ' / ' + L.hi : 'XP ' + L.xp + ' · 满级') + ' · 认识第 ' + daysKnown() + ' 天</div>' +
    '<div class="px-s">今天 聊' + stats.day.chats + ' · 戳' + stats.day.pokes + ' · 摸' + stats.day.longPress + '</div>' +
    (nx ? '<div class="px-s px-n">下个解锁：' + nx.name + '（' + nx.gap + '）</div>' : '<div class="px-s px-n">图鉴全开啦</div>') +
    '</div>';
  stopSpeech();
  bubbleCall('card', { html: html });
  try { Host.callStatic('showBubble', ctx); } catch (e) { }
  speech.current = '__card__';
  speech.timer = setTimeout(closeSpeech, 7000);
}
function flushCheer() {
  if (!pendingCheer.length || busy || curWork || speech.current || pendingLink) return;
  if (Date.now() - lastLinkAt < 4000) return;
  const t = pendingCheer.join('\n'); pendingCheer = [];
  sayText(t, { anim: 'double_jump' });
}
// 小档案页（像素风），写成文件给设置页的 WebView 读
// 档案页用的素材：PNG 序列帧（canvas 逐帧画）
async function arcPic(anim, cls) {
  if (skinNeo()) {
    let f = NEO_MAP['idle_' + anim] || NEO_MAP[anim];
    if (Array.isArray(f)) f = f[0];
    if (f) {
      let cfg = arcPic.cfg;
      if (!cfg) { try { cfg = JSON.parse(await readText(CFG_DIR + '/sprites/sprites.json')) || {}; } catch (e) { cfg = {}; } arcPic.cfg = cfg; }
      const c = cfg[f] || {};
      return '<canvas class="spr ' + (cls || '') + '" width="32" height="32" data-src="sprites/' + f + '.png?v=' + Date.now() +
        '" data-fps="' + (+c.fps || 4) + '" data-loop="' + (c.loop !== false ? 1 : 0) + '" data-hold="' + (c.hold ? c.hold.join(',') : '') + '"></canvas>';
    }
  }
  return '<canvas class="spr ' + (cls || '') + '" width="32" height="32"></canvas>';
}
const ARC_JS = '<script>(function(){var L=[].slice.call(document.querySelectorAll("canvas.spr"));' +
  'L.forEach(function(c){var im=new Image();im.onload=function(){var x=c.getContext("2d");x.imageSmoothingEnabled=false;' +
  'var n=Math.max(1,Math.round(im.naturalWidth/32)),fps=+c.dataset.fps||4,loop=c.dataset.loop==="1",' +
  'h=(c.dataset.hold||"").split(",").filter(Boolean).map(Number),i=0;' +
  'function d(){x.clearRect(0,0,32,32);x.drawImage(im,i*32,0,32,32,0,0,32,32);}' +
  'function s(){d();var w=1000/fps*(h[i]||1);if(i<n-1){i++;}else if(loop){i=0;}else{setTimeout(function(){i=0;s();},2500);return;}setTimeout(s,w);}' +
  'if(c.classList.contains("locked")){d();return;}s();};im.src=c.dataset.src;});})();</script>';

async function buildArchive() {
  touchDay();
  const L = levelInfo(), cells = 16, on = Math.round(L.pct / 100 * cells);
  let bar = '';
  for (let i = 0; i < cells; i++) bar += '<b' + (i < on ? ' class="on"' : '') + '></b>';
  arcPic.cfg = null;
  const face = await arcPic(L.lv >= 3 ? 'love' : 'idle', '');
  let tiles = '';
  for (const u of UNLOCKS) {
    const got = stats.unlocked.indexOf(u.anim) >= 0;
    const img = await arcPic(u.anim, got ? '' : 'locked');
    tiles += '<div class="tile' + (got ? '' : ' lock') + '"><div class="pic">' + img + '</div>' +
      '<div class="nm">' + (got ? unlockName(u) : '？？？') + '</div>' +
      '<div class="hw">' + (got ? (u.how || '发呆时') : needGap(u.need)) + '</div></div>';
  }
  const stat = function (k, v) { return '<div class="st"><div class="v">' + v + '</div><div class="k">' + k + '</div></div>'; };
  const html = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<style>' +
    '*{box-sizing:border-box}body{margin:0;padding:6px;background:#FBF6F2;color:#3D2B22;font:13px/1.4 "Courier New",ui-monospace,monospace;letter-spacing:.5px}' +
    '.box{background:#FFFBF7;border:3px solid #3D2B22;box-shadow:4px 4px 0 #E9C8B8;padding:10px;margin-bottom:12px}' +
    '.hd{display:flex;gap:12px;align-items:center}' +
    '.face{width:76px;height:76px;border:3px solid #3D2B22;background:#F7E3D9;display:flex;align-items:center;justify-content:center}' +
    '.face img,.face canvas{width:70px;height:70px;image-rendering:pixelated}' +
    '.t1{font-size:18px;font-weight:bold}.t2{color:#D97757;font-weight:bold}.t3{color:#8C7266;font-size:12px}' +
    '.bar{display:flex;gap:2px;margin:8px 0 4px}.bar b{flex:1;height:12px;background:#F2E2D9;border:2px solid #3D2B22}.bar b.on{background:#D97757}' +
    '.sec{font-weight:bold;margin:0 0 8px}.sec:before{content:"▶ ";color:#D97757}' +
    '.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}' +
    '.st{border:2px solid #3D2B22;background:#fff;padding:6px 4px;text-align:center}.st .v{font-size:18px;font-weight:bold;color:#D97757}.st .k{font-size:11px;color:#8C7266}' +
    '.tile{border:2px solid #3D2B22;background:#fff;padding:4px;text-align:center}' +
    '.pic{height:64px;display:flex;align-items:center;justify-content:center;background:#F7E3D9}' +
    '.pic img{height:62px;width:62px}.pic canvas{height:62px;width:62px;image-rendering:pixelated}' +
    '.lock .pic{background:#EDE6E1}.lock img,.lock canvas{filter:brightness(0);opacity:.18}' +
    '.nm{font-weight:bold;font-size:12px;margin-top:3px}.hw{font-size:10px;color:#8C7266}.lock .nm{color:#A88B7D}' +
    '</style></head><body>' +
    '<div class="box"><div class="hd"><div class="face">' + face + '</div><div>' +
    '<div class="t1">CLAWD</div><div class="t2">Lv' + L.lv + ' · ' + L.name + '</div>' +
    '<div class="t3">认识第 ' + daysKnown() + ' 天 · 来过 ' + stats.activeDays + ' 天</div></div></div>' +
    '<div class="bar">' + bar + '</div><div class="t3">' + (L.hi ? 'XP ' + L.xp + ' / ' + L.hi : 'XP ' + L.xp + ' · 已满级') + '</div></div>' +
    '<div class="box"><div class="sec">今天</div><div class="grid">' +
    stat('聊天', stats.day.chats) + stat('被戳', stats.day.pokes) + stat('摸摸', stats.day.longPress) + '</div></div>' +
    '<div class="box"><div class="sec">一共</div><div class="grid">' +
    stat('聊天', stats.chats) + stat('被戳', stats.pokes) + stat('摸摸', stats.longPress) + '</div><div style="height:8px"></div><div class="grid">' +
    stat('熬夜', stats.nights) + stat('图鉴', stats.unlocked.length + '/' + UNLOCKS.length) + stat('认识', daysKnown() + '天') + '</div></div>' +
    '<div class="box"><div class="sec">动作图鉴</div><div class="grid">' + tiles + '</div></div>' +
    ARC_JS + '</body></html>';
  const path = CFG_DIR + '/archive.html';
  await writeText(path, html);
  return { path: path, level: L, unlocked: stats.unlocked.length, total: UNLOCKS.length, next: nextUnlock() };
}

// ==================== 交互 ====================
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function openInput() {
  stopSpeech();
  bubbleCall('input', { title: busy ? 'Clawd 还在想上一句…' : '跟 Clawd 说点什么', draft: draft });
  try { Host.callStatic('setInputMode', ctx, true); } catch (e) { hostError = 'setInputMode: ' + e; }
}

function onPoke(n) {
  const now = Date.now();
  for (let i = 0; i < n; i++) pokeWindow.push(now);
  pokeWindow = pokeWindow.filter(function (t) { return now - t < 3000; });
  // 正在说话时，戳 = 催下一条 / 已说完则收起
  if (speech.current) { nextSegment(); return; }
  if (busy) return;
  const P = settings.poke;
  if (pokeWindow.length >= P.rapidCount) {
    pokeWindow = [];
    const rl = pick(P.rapidLines);   // 连戳：按台词情绪来（别戳了=生气，头好晕=转晕），默认生气
    sayText(rl, { anim: lineMood(rl) || 'annoyed' });
  } else if (pokeWindow.length === 2) {
    // 戳第二下：不再撒花，继续疑惑就好
  } else if (Math.random() < 0.45) {
    const line = pick(P.lines);
    const m = lineMood(line);   // 台词有情绪就换成对应动作，没有就让疑惑接着播
    setTimeout(function () { if (!speech.current && !busy) sayText(line, m ? { anim: m } : { quiet: true }); }, 1100);
  }
}

function onTick() {
  if (!hostReady) return;
  let ev;
  try { ev = JSON.parse(String(Host.callStatic('consumeEvent', ctx))); }
  catch (e) { lastTickError = 'consumeEvent: ' + e; return; }
  if (ev.poke || ev.doubleTap || ev.longPress || ev.dragEnd || (ev.submits && ev.submits.length) || ev.bubbleTap || ev.inputClosed) {
    lastEvent = { at: Date.now(), ev: ev };
  }
  if (ev.submits && ev.submits.length) {
    try { Host.callStatic('setInputMode', ctx, false); } catch (e) { }
    draft = '';
    const text = ev.submits.join('\n');
    sendToChat(text);
  }
  if (ev.doubleTap) openInput();
  if (ev.poke) { bump('poke', ev.poke); onPoke(ev.poke); }
  if (ev.longPress) { bump('longPress').then(function () { showStatusCard(); flushCheer(); }); }
  if (Date.now() - lastStatsSync > 15000) syncStats();
  flushCheer();
  if (ev.bubbleTap) {
    if (speech.current) nextSegment();
  }
  if (ev.inputClosed && !busy && !(ev.submits && ev.submits.length)) {
    try { Host.callStatic('hideBubble', ctx); } catch (e) { }
  }
  watchdog();
  checkBattery();
  if (ev.dragEnd) {
    settings.pet.x = ev.dragEnd.x; settings.pet.y = ev.dragEnd.y;
    settings.pet.startMode = ev.dragEnd.mode === 'mini' ? 'mini:' + ev.dragEnd.side : 'free';
    saveSettings();
  }
}

// ==================== 初始化 ====================
async function init() {
  await loadSettings();
  try { await ensureSprites(); } catch (e) { spriteInfo = 'error: ' + e; }
  try { await loadStats(); } catch (e) { lastTickError = 'stats: ' + e; }
  await ensureHost();
  if (settings.pet.visible !== false) {
    const r = await showPet();
    if (!r.ok) throw new Error(r.error || 'show failed');
  }
  if (!pollTimer) {
    pollTimer = setInterval(function () {
      try { onTick(); } catch (e) { lastTickError = String(e); }
    }, TICK_MS);
  }
}
function ensureInit() {
  if (!initPromise) {
    initPromise = init().catch(function (e) { initPromise = null; hostError = String(e); throw e; });
  }
  return initPromise;
}

// ==================== IPC ====================
function reg(name, fn) {
  ToolPkg.ipc.on('clawd.' + name, function (payload, meta) {
    return ensureInit().catch(function () { }).then(function () {
      return fn(payload || {}, meta);
    }).catch(function (e) { return { ok: false, error: String(e) }; });
  });
}

reg('status', async function () {
  return {
    ok: true, version: '1.0.0', hostReady: hostReady, hostError: hostError, lastTickError: lastTickError,
    native: hostReady ? nativeState() : null, busy: busy,
    speaking: speech.current, queue: speech.queue.length,
    chat: settings.chat, lastReplyAt: lastReply.at, lastEvent: lastEvent,
    work: curWork, watch: watchInfo, link: linkInfo, battery: batteryInfo, sprites: spriteInfo, migrate: migrateInfo, runtimeHook: watchInfo.events > 0 ? 'receiving' : 'no_events_yet'
  };
});
reg('get_config', async function () { return { ok: true, settings: settings }; });
reg('archive', async function () {
  if (!stats) await loadStats(); else await syncStats();
  const a = await buildArchive();
  return { ok: true, url: 'file://' + a.path + '?t=' + Date.now(), level: a.level, unlocked: a.unlocked, total: a.total,
           next: a.next, today: stats.day, totals: { chats: stats.chats, pokes: stats.pokes, longPress: stats.longPress,
           nights: stats.nights, days: daysKnown(), activeDays: stats.activeDays } };
});
reg('set_config', async function (p) {
  const pageCfg = function () { return JSON.stringify([settings.pet, settings.idle]); };
  const before = pageCfg();
  settings = deepMerge(settings, p.patch || {});
  await saveSettings();
  // 设置页改了标签提示词：同步环境变量镜像，和输入菜单开关保持一致
  const pl = (p.patch && p.patch.link) || null;
  if (pl && ('tagPrompt' in pl || 'tag' in pl)) {
    try { await Tools.SoftwareSettings.writeEnvironmentVariable(PROMPT_ENV, promptEnabled() ? 'true' : 'false'); } catch (e) { }
  }
  if (pl && 'promptMode' in pl) {
    try { await Tools.SoftwareSettings.writeEnvironmentVariable('CLAWD_TAG_PROMPT_MODE', promptMode()); } catch (e) { }
  }
  if (hostReady) pushConfig();
  // 睡眠时间等写进页面的配置需要重建页面
  if (pageCfg() !== before && settings.pet.visible !== false && hostReady) {
    try { Host.callStatic('setPetHtml', ctx, await buildPetHtml(), 'file://' + CFG_DIR + '/'); } catch (e) { }
    setTimeout(resyncPet, 600);
  }
  return { ok: true, settings: settings };
});
reg('show', async function () {
  settings.pet.visible = true; await saveSettings();
  return await showPet();
});
reg('hide', async function () {
  settings.pet.visible = false; await saveSettings();
  hidePet();
  return { ok: true };
});
reg('reload', async function () {
  hidePet();
  await sleep(300);
  await loadSettings();
  try { await ensureSprites(); } catch (e) { spriteInfo = 'error: ' + e; }
  await ensureHost(true);
  return await showPet();
});
reg('say', async function (p) {
  if (!hostReady) return { ok: false, error: 'host not ready' };
  const segs = p.segments && p.segments.length ? p.segments : splitSegments(cleanReply(p.text || ''));
  if (!segs.length) return { ok: false, error: 'empty' };
  speak(segs, { anim: p.anim || '' });
  return { ok: true, segments: segs.length };
});
reg('play', async function (p) {
  petPlay(String(p.name || 'happy'), p.durationMs | 0 || 3000);
  return { ok: true };
});
reg('mode', async function (p) {
  try { Host.callStatic('setMode', ctx, String(p.mode || 'free')); } catch (e) { return { ok: false, error: String(e) }; }
  return { ok: true };
});
reg('send', async function (p) {
  if (!p.text) return { ok: false, error: 'empty' };
  return await sendToChat(String(p.text));
});
reg('open_input', async function () { openInput(); return { ok: true }; });
reg('list_chats', async function () {
  const r = await Tools.Chat.listChats({ limit: 50, sort_by: 'updatedAt', sort_order: 'desc' });
  return { ok: true, currentChatId: r.currentChatId,
    chats: (r.chats || []).map(function (c) { return { id: c.id, title: c.title, messageCount: c.messageCount, updatedAt: c.updatedAt }; }) };
});
reg('bind_chat', async function (p) {
  if (p.create) {
    const created = await Tools.Chat.createNew(undefined, false, settings.chat.roleCardId || undefined);
    if (!created || !created.chatId) return { ok: false, error: 'create failed' };
    try { await Tools.Chat.updateTitle(created.chatId, p.title || settings.chat.chatTitle); } catch (e) { }
    settings.chat.chatId = created.chatId;
  } else {
    settings.chat.chatId = String(p.chatId || '');
  }
  await saveSettings();
  return { ok: true, chatId: settings.chat.chatId };
});
reg('last_reply', async function () { return { ok: true, reply: lastReply }; });
reg('test_filter', async function (p) {
  const c = cleanReply(p.text || '');
  return { ok: true, clean: c, segments: splitSegments(c) };
});

// ==================== 入口 ====================
function registerToolPkg() {
  const hooks = [
    ['clawd_app_create', 'application_on_create'],
    ['clawd_app_foreground', 'application_on_foreground'],
    ['clawd_activity_resume', 'activity_on_resume']
  ];
  for (const h of hooks) {
    try { ToolPkg.registerAppLifecycleHook({ id: h[0], event: h[1], function: onLifecycle }); }
    catch (e) { hostError = 'hook ' + h[1] + ': ' + e; }
  }
  // 跟随对话状态（需要 ToolPkg API 1.0.1）
  try {
    ToolPkg.registerChatRuntimeHook({ id: 'clawd_chat_runtime', function: onChatRuntimeHook });
    runtimeHookStatus = 'registered';
  } catch (e) { runtimeHookStatus = 'failed: ' + e; }
  // 标签联动：消息落库 → 读 <clawd>/moodlet；系统提示词 → 告诉 AI 有 <clawd>；渲染 → 主对话卡片
  try { ToolPkg.registerChatMessageHook({ id: 'clawd_chat_message', function: onChatMessageHook }); }
  catch (e) { linkInfo.hookError = 'message: ' + e; }
  try { ToolPkg.registerSystemPromptComposeHook({ id: 'clawd_system_prompt', function: onSystemPromptHook }); }
  catch (e) { linkInfo.hookError = 'prompt: ' + e; }
  try { ToolPkg.registerXmlRenderPlugin({ id: 'clawd_xml_tag', tag: 'clawd', function: onXmlRender }); }
  catch (e) { linkInfo.hookError = 'xml: ' + e; }
  try { ToolPkg.registerInputMenuTogglePlugin({ id: 'clawd_prompt_menu', function: onInputMenuToggle }); }
  catch (e) { linkInfo.hookError = 'menu: ' + e; }
  try { ToolPkg.registerPromptInputHook({ id: 'clawd_prompt_input', function: onPromptInput }); }
  catch (e) { linkInfo.hookError = 'input: ' + e; }
  try {
    const ui = require('./ui/settings/index.ui.js');
    const Screen = ui && (ui.default || ui);
    // 设置 → 工具箱
    ToolPkg.registerToolboxUiModule({
      id: 'clawd_settings', runtime: 'compose_dsl', screen: Screen, params: {},
      title: { zh: 'Clawd 桌宠设置', en: 'Clawd Settings' }
    });
  } catch (e) { hostError = 'registerUi: ' + e; }
  try {
    // 小档案 → 侧边栏
    const au = require('./ui/archive/index.ui.js');
    const Archive = au && (au.default || au);
    ToolPkg.registerUiRoute({
      id: 'clawd_archive', route: 'toolpkg:clawd_pet:ui:clawd_archive',
      runtime: 'compose_dsl', screen: Archive, params: {},
      title: { zh: 'Clawd 小档案', en: 'Clawd Archive' }
    });
    ToolPkg.registerNavigationEntry({
      id: 'clawd_archive_entry', route: 'toolpkg:clawd_pet:ui:clawd_archive',
      surface: 'main_sidebar_plugins', title: { zh: 'Clawd 小档案', en: 'Clawd' },
      icon: 'pets', order: 31
    });
  } catch (e) { hostError = 'registerArchive: ' + e; }

  if (!started) {
    started = true;
    setTimeout(function () { tryBoot(0); }, 1200);
  }
  return true;
}

let bootTimer = null;
function tryBoot(attempt) {
  ensureInit().then(function () {
    if (settings.pet.visible === false) return;
    const st = nativeState();
    if (!st || !st.visible) return showPet();
  }).catch(function () {
    if (attempt >= 24 || bootTimer) return;
    bootTimer = setTimeout(function () { bootTimer = null; tryBoot(attempt + 1); }, 5000);
  });
}
function onLifecycle() { try { tryBoot(0); } catch (e) { } return { ok: true }; }
let runtimeHookStatus = 'not_registered';
function onChatRuntimeHook(event) {
  // 钩子可能在桌宠初始化前就来，先确保启动，但不阻塞
  if (!settings) { try { tryBoot(0); } catch (e) { } return { ok: true }; }
  onChatRuntime(event);
  return { ok: true };
}

function onChatMessageHook(event) {
  if (!settings) { try { tryBoot(0); } catch (e) { } return { ok: true }; }
  onChatMessage(event);
  return { ok: true };
}
function onSystemPromptHook(event) {
  return onSystemPrompt(event);
}

exports.registerToolPkg = registerToolPkg;
exports.onChatMessageHook = onChatMessageHook;
exports.onSystemPromptHook = onSystemPromptHook;
exports.onXmlRender = onXmlRender;
exports.onInputMenuToggle = onInputMenuToggle;
exports.onPromptInput = onPromptInput;
exports.onLifecycle = onLifecycle;
exports.onChatRuntimeHook = onChatRuntimeHook;
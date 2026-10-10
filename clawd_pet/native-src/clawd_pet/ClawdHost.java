package clawd_pet;

import android.annotation.SuppressLint;
import android.content.Context;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.graphics.Rect;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.provider.Settings;
import android.util.DisplayMetrics;
import android.view.Gravity;
import android.view.KeyEvent;
import android.view.MotionEvent;
import android.view.VelocityTracker;
import android.view.animation.DecelerateInterpolator;
import android.animation.Animator;
import android.animation.AnimatorListenerAdapter;
import android.animation.ValueAnimator;
import android.view.View;
import android.view.WindowManager;
import android.view.inputmethod.InputMethodManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * Clawd 桌宠原生宿主 v3 —— 纯管道，不含业务逻辑。
 *
 * 窗口：
 *   pet    —— 桌宠本体（可触摸、不抢焦点）
 *   bubble —— 对话气泡 + 输入框（平时不可触摸；输入模式下可触摸、可聚焦、弹键盘）
 *
 * 模式：free 自由悬浮 / mini 贴边极简
 *
 * 事件（JS 轮询 consumeEvent 取走）：
 *   poke(次数) / doubleTap / longPress / dragStart / dragEnd / submit(文本) / inputClosed / bubbleTap
 *
 * 页面回调：
 *   pet    页 window.clawd(evt)
 *   bubble 页 window.bubble(evt, json)
 *   bubble 页可调用 ClawdBridge.submit(text) / ClawdBridge.close() / ClawdBridge.resize(h) / ClawdBridge.tap()
 */
public final class ClawdHost {

    public static final String TAG = "clawd_pet";
    public static final String TAG_BUBBLE = "clawd_bubble";

    // 有效触摸范围：只有按在 Clawd 身体上才算（画布比例 l,t,r,b）
    private static final float[] HIT_FREE = {0.19f, 0.28f, 0.81f, 0.72f};   // 自由模式：身体 8..24 x 11..21（/32）+ 余量
    private static final float[] HIT_EDGE = {0.53f, 0.28f, 1.00f, 0.72f};   // 贴右边：身体 19..32；贴左边时镜像
    private static float hitScale = 1f;

    private static final Handler UI = new Handler(Looper.getMainLooper());
    private static final Object LOCK = new Object();

    private static WindowManager wm;
    private static Context appCtx;

    private static WebView petView;
    private static WindowManager.LayoutParams lp;

    private static WebView bubbleView;
    private static WindowManager.LayoutParams blp;
    private static boolean bubbleVisible = false;
    private static boolean inputMode = false;
    private static int bubbleHeightPx = 0;   // 由页面上报的内容高度
    private static int bubbleWidthDp = 240;
    private static int bubbleMaxHeightDp = 260;
    /** Clawd 头顶在画布中的位置（占画布高度的比例）；气泡底部贴到这里 */
    private static float bubbleTopRatio = 0.50f;
    /** Clawd 脚底在画布中的位置；气泡放到下方时从这里开始 */
    private static float bubbleBottomRatio = 0.90f;

    private static int sizePx = 300;
    private static float density = 3f;
    private static float miniHide = 0.42f;
    private static float miniTrigger = 0.18f;
    private static int longPressMs = 600;
    private static int doubleTapMs = 300;

    private static String mode = "free";
    private static String side = "none";

    // 事件
    private static int pokeCount = 0;
    private static boolean doubleTap = false;
    private static boolean longPress = false;
    private static boolean dragStart = false;
    private static String dragEnd = null;
    private static final ArrayList<String> submits = new ArrayList<String>();
    private static boolean inputClosed = false;
    private static boolean bubbleTap = false;

    private static String lastError = "";
    private static String cleanupInfo = "";
    private static boolean dragging = false;

    private ClawdHost() {}

    public static String version() { return "clawd-host-7"; }

    public static boolean canOverlay(Context ctx) {
        return Build.VERSION.SDK_INT < 23 || Settings.canDrawOverlays(ctx);
    }

    private static int[] screen() {
        DisplayMetrics dm = appCtx.getResources().getDisplayMetrics();
        return new int[]{dm.widthPixels, dm.heightPixels};
    }

    private static String esc(String s) {
        if (s == null) return "";
        StringBuilder b = new StringBuilder();
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            switch (c) {
                case '\\': b.append("\\\\"); break;
                case '"': b.append("\\\""); break;
                case '\n': b.append("\\n"); break;
                case '\r': b.append("\\r"); break;
                case '\t': b.append("\\t"); break;
                default:
                    if (c < 0x20) b.append(String.format("\\u%04x", (int) c));
                    else b.append(c);
            }
        }
        return b.toString();
    }

    private static int overlayType() {
        return Build.VERSION.SDK_INT >= 26
                ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
                : WindowManager.LayoutParams.TYPE_PHONE;
    }

    // ================= 生命周期 =================

    /**
     * 显示桌宠和（隐藏状态的）气泡窗口。
     * startMode: "free" / "mini:left" / "mini:right"；x/y < 0 用默认位置
     */
    public static void show(final Context ctx, final String petHtml, final String bubbleHtml,
                            final String baseUrl, final int sizeDp, final int x, final int y,
                            final String startMode) {
        appCtx = ctx.getApplicationContext();
        UI.post(new Runnable() {
            @Override public void run() {
                try {
                    density = appCtx.getResources().getDisplayMetrics().density;
                    sizePx = Math.round(sizeDp * density);
                    if (wm == null) wm = (WindowManager) appCtx.getSystemService(Context.WINDOW_SERVICE);
                    cleanupInfo = cleanupOrphans();

                    if (petView == null) {
                        petView = createPetView();
                        lp = new WindowManager.LayoutParams(sizePx, sizePx, overlayType(),
                                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
                                        | WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS
                                        | WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED,
                                PixelFormat.TRANSLUCENT);
                        lp.gravity = Gravity.TOP | Gravity.START;
                        lp.setTitle(TAG);
                        int[] sc = screen();
                        lp.y = y >= 0 ? y : sc[1] / 2 - sizePx / 2;
                        String sm = startMode == null ? "" : startMode;
                        if (x < 0 && sm.isEmpty()) sm = "mini:right";
                        if (sm.startsWith("mini:")) {
                            enterMini(sm.substring(5), false);
                        } else {
                            mode = "free"; side = "none";
                            lp.x = x >= 0 ? x : sc[0] - sizePx;
                            clampFree();
                        }
                        wm.addView(petView, lp);
                        applyGestureExclusion();
                    }
                    petView.loadDataWithBaseURL(baseUrl, petHtml, "text/html", "utf-8", null);

                    if (bubbleView == null) {
                        bubbleView = createBubbleView();
                        blp = new WindowManager.LayoutParams(
                                dp(bubbleWidthDp), dp(60), overlayType(),
                                bubbleFlags(false),
                                PixelFormat.TRANSLUCENT);
                        blp.gravity = Gravity.TOP | Gravity.START;
                        blp.setTitle(TAG_BUBBLE);
                        blp.softInputMode = WindowManager.LayoutParams.SOFT_INPUT_ADJUST_NOTHING;
                        blp.x = -10000; blp.y = -10000;   // 先藏起来
                        bubbleView.setVisibility(View.GONE);
                        wm.addView(bubbleView, blp);
                    }
                    bubbleView.loadDataWithBaseURL(baseUrl, bubbleHtml, "text/html", "utf-8", null);
                    lastError = "";
                } catch (Throwable t) {
                    lastError = "show: " + t;
                }
            }
        });
    }

    public static void hide(Context ctx) {
        UI.post(new Runnable() {
            @Override public void run() {
                try {
                    if (bubbleView != null && wm != null) {
                        hideKeyboard();
                        wm.removeViewImmediate(bubbleView);
                        bubbleView.destroy();
                    }
                } catch (Throwable t) { lastError = "hide-bubble: " + t; }
                bubbleView = null; bubbleVisible = false; inputMode = false;
                try {
                    if (petView != null && wm != null) {
                        wm.removeViewImmediate(petView);
                        petView.destroy();
                    }
                } catch (Throwable t) { lastError = "hide: " + t; }
                petView = null;
                cleanupInfo = cleanupOrphans();
            }
        });
    }

    public static void setPetHtml(Context ctx, final String html, final String baseUrl) {
        UI.post(new Runnable() {
            @Override public void run() {
                if (petView != null) petView.loadDataWithBaseURL(baseUrl, html, "text/html", "utf-8", null);
            }
        });
    }

    public static void evalPet(Context ctx, final String js) {
        UI.post(new Runnable() {
            @Override public void run() {
                try { if (petView != null) petView.evaluateJavascript(js, null); }
                catch (Throwable t) { lastError = "evalPet: " + t; }
            }
        });
    }

    public static void evalBubble(Context ctx, final String js) {
        UI.post(new Runnable() {
            @Override public void run() {
                try { if (bubbleView != null) bubbleView.evaluateJavascript(js, null); }
                catch (Throwable t) { lastError = "evalBubble: " + t; }
            }
        });
    }

    public static void configure(final Context ctx, final int sizeDp, final float hideRatio,
                                 final float triggerRatio, final int lpMs, final int dtMs,
                                 final int bubbleWDp, final int bubbleMaxHDp) {
        appCtx = ctx.getApplicationContext();
        UI.post(new Runnable() {
            @Override public void run() {
                miniHide = Math.max(0f, Math.min(0.8f, hideRatio));
                miniTrigger = Math.max(0.05f, Math.min(0.6f, triggerRatio));
                longPressMs = Math.max(250, lpMs);
                doubleTapMs = Math.max(150, Math.min(600, dtMs));
                bubbleWidthDp = Math.max(140, Math.min(400, bubbleWDp));
                bubbleMaxHeightDp = Math.max(100, Math.min(600, bubbleMaxHDp));
                density = appCtx.getResources().getDisplayMetrics().density;
                sizePx = Math.round(sizeDp * density);
                if (petView != null && lp != null) {
                    lp.width = sizePx;
                    lp.height = sizePx;
                    if ("mini".equals(mode)) enterMini(side, false); else clampFree();
                    updatePet();
                    applyGestureExclusion();
                }
                layoutBubble();
            }
        });
    }

    /** 气泡锚点：top = 头顶在画布中的比例，bottom = 脚底在画布中的比例 */
    public static void setBubbleAnchor(Context ctx, final float top, final float bottom) {
        UI.post(new Runnable() {
            @Override public void run() {
                bubbleTopRatio = Math.max(0f, Math.min(1f, top));
                bubbleBottomRatio = Math.max(0f, Math.min(1.2f, bottom));
                layoutBubble();
            }
        });
    }

    public static void setMode(final Context ctx, final String m) {
        UI.post(new Runnable() {
            @Override public void run() {
                if (petView == null) return;
                if ("left".equals(m) || "right".equals(m)) enterMini(m, true);
                else leaveMini(true);
                updatePet();
                layoutBubble();
            }
        });
    }

    public static void moveTo(final Context ctx, final int x, final int y) {
        UI.post(new Runnable() {
            @Override public void run() {
                if (petView == null || lp == null) return;
                lp.x = x; lp.y = y;
                mode = "free"; side = "none";
                clampFree();
                updatePet();
                layoutBubble();
                callPet("free");
            }
        });
    }

    // ================= 气泡 =================

    /** 显示气泡（不改变输入模式）。具体内容由 evalBubble 推给页面 */
    public static void showBubble(Context ctx) {
        UI.post(new Runnable() {
            @Override public void run() {
                if (bubbleView == null) return;
                bubbleVisible = true;
                bubbleView.setVisibility(View.VISIBLE);
                layoutBubble();
            }
        });
    }

    public static void hideBubble(Context ctx) {
        UI.post(new Runnable() {
            @Override public void run() {
                if (bubbleView == null) return;
                if (inputMode) setInputModeInternal(false, false);
                bubbleVisible = false;
                bubbleView.setVisibility(View.GONE);
                blp.x = -10000; blp.y = -10000;
                updateBubble();
            }
        });
    }

    /** 进入/退出输入模式：可聚焦 + 弹键盘 */
    public static void setInputMode(Context ctx, final boolean on) {
        UI.post(new Runnable() {
            @Override public void run() { setInputModeInternal(on, true); }
        });
    }

    private static void setInputModeInternal(boolean on, boolean notifyPage) {
        if (bubbleView == null || blp == null) return;
        inputMode = on;
        blp.flags = bubbleFlags(on);
        blp.softInputMode = on
                ? (WindowManager.LayoutParams.SOFT_INPUT_STATE_VISIBLE | WindowManager.LayoutParams.SOFT_INPUT_ADJUST_NOTHING)
                : WindowManager.LayoutParams.SOFT_INPUT_ADJUST_NOTHING;
        if (on) {
            bubbleVisible = true;
            bubbleView.setVisibility(View.VISIBLE);
        }
        layoutBubble();
        if (on) {
            bubbleView.setFocusable(true);
            bubbleView.setFocusableInTouchMode(true);
            bubbleView.requestFocus();
            UI.postDelayed(new Runnable() {
                @Override public void run() {
                    if (!inputMode || bubbleView == null) return;
                    bubbleView.evaluateJavascript("window.bubble&&window.bubble('focus')", null);
                    try {
                        InputMethodManager imm = (InputMethodManager) appCtx.getSystemService(Context.INPUT_METHOD_SERVICE);
                        imm.showSoftInput(bubbleView, InputMethodManager.SHOW_IMPLICIT);
                    } catch (Throwable ignored) {}
                }
            }, 120);
        } else {
            hideKeyboard();
            bubbleView.clearFocus();
            if (notifyPage) bubbleView.evaluateJavascript("window.bubble&&window.bubble('blur')", null);
        }
    }

    private static int bubbleFlags(boolean input) {
        int f = WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS
                | WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED;
        if (input) {
            // 可聚焦；点窗口外面时收到 ACTION_OUTSIDE
            f |= WindowManager.LayoutParams.FLAG_WATCH_OUTSIDE_TOUCH
                    | WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL;
        } else {
            // 平时：不抢焦点；但允许点击（点气泡可展开/关闭）
            f |= WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE;
        }
        return f;
    }

    private static void hideKeyboard() {
        try {
            if (bubbleView == null) return;
            InputMethodManager imm = (InputMethodManager) appCtx.getSystemService(Context.INPUT_METHOD_SERVICE);
            imm.hideSoftInputFromWindow(bubbleView.getWindowToken(), 0);
        } catch (Throwable ignored) {}
    }

    /** 气泡放在桌宠上方；空间不够放下方。贴边模式下往屏幕内侧偏 */
    private static void layoutBubble() {
        if (bubbleView == null || blp == null || lp == null || !bubbleVisible) return;
        int[] sc = screen();
        int w = dp(bubbleWidthDp);
        int maxH = dp(bubbleMaxHeightDp);
        int h = bubbleHeightPx > 0 ? Math.min(bubbleHeightPx, maxH) : dp(60);
        blp.width = w;
        blp.height = h;

        // 桌宠可见部分的中心
        int visL = Math.max(lp.x, 0), visR = Math.min(lp.x + sizePx, sc[0]);
        int cx = (visL + visR) / 2;
        int bx = cx - w / 2;
        int margin = dp(6);
        if (bx < margin) bx = margin;
        if (bx + w > sc[0] - margin) bx = sc[0] - margin - w;

        // 画布上方留了动画用的空白（思考泡泡、星星等），Clawd 本体头顶大约在一半高度
        int top = lp.y + (int) (sizePx * bubbleTopRatio);
        int by = top - h;
        boolean below = false;
        if (by < dp(24)) {                          // 上面放不下：放到脚下
            by = lp.y + (int) (sizePx * bubbleBottomRatio);
            below = true;
        }
        if (inputMode) {
            // 输入时尽量放在屏幕上半部，避开键盘
            int limit = (int) (sc[1] * 0.45f) - h;
            if (by > limit) { by = Math.max(dp(24), limit); }
        }
        blp.x = bx;
        blp.y = by;
        updateBubble();
        // 告诉页面尾巴朝哪、指向哪
        int tailX = Math.max(dp(16), Math.min(w - dp(16), cx - bx));
        try {
            bubbleView.evaluateJavascript("window.bubble&&window.bubble('layout',{tailX:" + tailX
                    + ",below:" + below + ",density:" + density + "})", null);
        } catch (Throwable ignored) {}
    }

    // ================= 事件 =================

    public static String consumeEvent(Context ctx) {
        synchronized (LOCK) {
            StringBuilder sb = new StringBuilder("{");
            sb.append("\"poke\":").append(pokeCount);
            sb.append(",\"doubleTap\":").append(doubleTap);
            sb.append(",\"longPress\":").append(longPress);
            sb.append(",\"dragStart\":").append(dragStart);
            sb.append(",\"dragEnd\":").append(dragEnd == null ? "null" : dragEnd);
            sb.append(",\"dragging\":").append(dragging);
            sb.append(",\"inputClosed\":").append(inputClosed);
            sb.append(",\"bubbleTap\":").append(bubbleTap);
            sb.append(",\"submits\":[");
            for (int i = 0; i < submits.size(); i++) {
                if (i > 0) sb.append(',');
                sb.append('"').append(esc(submits.get(i))).append('"');
            }
            sb.append("]");
            sb.append(",\"mode\":\"").append(mode).append("\",\"side\":\"").append(side).append("\"");
            sb.append(",\"inputMode\":").append(inputMode);
            sb.append("}");
            pokeCount = 0; doubleTap = false; longPress = false; dragStart = false;
            dragEnd = null; submits.clear(); inputClosed = false; bubbleTap = false;
            return sb.toString();
        }
    }

    public static String getState(Context ctx) {
        if (appCtx == null) appCtx = ctx.getApplicationContext();
        int[] sc = screen();
        return "{\"visible\":" + (petView != null)
                + ",\"canOverlay\":" + canOverlay(appCtx)
                + ",\"x\":" + (lp == null ? -1 : lp.x)
                + ",\"y\":" + (lp == null ? -1 : lp.y)
                + ",\"size\":" + sizePx
                + ",\"hit\":\"" + (lp == null ? "" : hitRect().toShortString()) + "\""
                + ",\"sw\":" + sc[0] + ",\"sh\":" + sc[1]
                + ",\"mode\":\"" + mode + "\",\"side\":\"" + side + "\""
                + ",\"bubble\":" + bubbleVisible
                + ",\"inputMode\":" + inputMode
                + ",\"cleanup\":\"" + esc(cleanupInfo) + "\""
                + ",\"error\":\"" + esc(lastError) + "\"}";
    }

    // ================= 桌宠窗口 =================

    @SuppressLint({"SetJavaScriptEnabled", "ClickableViewAccessibility"})
    private static WebView createPetView() {
        WebView wv = baseWebView(TAG);
        wv.addOnLayoutChangeListener(new View.OnLayoutChangeListener() {
            @Override public void onLayoutChange(View v, int l, int t, int r, int b,
                                                 int ol, int ot, int or, int ob) {
                applyGestureExclusion();
            }
        });

        wv.setOnTouchListener(new View.OnTouchListener() {
            float downRawX, downRawY;
            int startX, startY;
            boolean consumed;
            Runnable lpRunnable;
            long lastUpAt = 0;
            Runnable pendingPoke;
            VelocityTracker vt;
            boolean edgeHold, edgeSlid;   // 贴边时按住：先只沿边上下滑，往屏幕里拉够远才「扯下来」
            boolean ignoring;             // 这一下按在身体外面：整段手势都不理

            @Override public boolean onTouch(View v, MotionEvent e) {
                int act = e.getActionMasked();
                if (act == MotionEvent.ACTION_DOWN) ignoring = !hitRect().contains((int) e.getX(), (int) e.getY());
                if (ignoring) {
                    if (act == MotionEvent.ACTION_UP || act == MotionEvent.ACTION_CANCEL) ignoring = false;
                    return true;
                }
                if (e.getActionMasked() == MotionEvent.ACTION_DOWN) { if (vt != null) vt.recycle(); vt = VelocityTracker.obtain(); }
                if (vt != null) {
                    MotionEvent me = MotionEvent.obtain(e);
                    me.setLocation(e.getRawX(), e.getRawY()); vt.addMovement(me); me.recycle();
                }
                switch (e.getActionMasked()) {
                    case MotionEvent.ACTION_DOWN:
                        downRawX = e.getRawX(); downRawY = e.getRawY();
                        if (glide != null) { glide.cancel(); glide = null; }
                        startX = lp.x; startY = lp.y;
                        consumed = false;
                        dragging = false;
                        edgeHold = "mini".equals(mode); edgeSlid = false;
                        callPet("press");
                        lpRunnable = new Runnable() {
                            @Override public void run() {
                                if (!dragging) {
                                    consumed = true;
                                    if (pendingPoke != null) { UI.removeCallbacks(pendingPoke); pendingPoke = null; }
                                    synchronized (LOCK) { longPress = true; }
                                    callPet("longpress");
                                }
                            }
                        };
                        UI.postDelayed(lpRunnable, longPressMs);
                        return true;

                    case MotionEvent.ACTION_MOVE: {
                        float dx = e.getRawX() - downRawX, dy = e.getRawY() - downRawY;
                        float slop = 8 * density;
                        if (!dragging && dx * dx + dy * dy > slop * slop) {
                            dragging = true;
                            UI.removeCallbacks(lpRunnable);
                            synchronized (LOCK) { dragStart = true; }
                            if (!edgeHold) callPet("drag");
                        }
                        if (dragging && edgeHold) {
                            // 往屏幕里拉的距离（贴右边时往左拉为正）
                            float pull = "left".equals(side) ? dx : -dx;
                            if (pull > sizePx * 0.45f) {          // 拉够远：扯下来
                                edgeHold = false;
                                mode = "free"; side = "none";
                                callPet("drag");
                            } else {                              // 没拉够：沿边上下滑，横向带一点橡皮筋
                                if (!edgeSlid) { edgeSlid = true; callPet("edgeslide"); }
                                int rb = (int) (Math.max(0f, pull) * 0.3f);
                                lp.x = startX + ("left".equals(side) ? rb : -rb);
                                lp.y = startY + (int) dy;
                                clampY(); updatePet(); layoutBubble();
                                return true;
                            }
                        }
                        if (dragging) {
                            lp.x = startX + (int) dx;
                            lp.y = startY + (int) dy;
                            clampDrag();
                            updatePet();
                            layoutBubble();
                        }
                        return true;
                    }

                    case MotionEvent.ACTION_UP:
                    case MotionEvent.ACTION_CANCEL: {
                        boolean cancel = e.getActionMasked() == MotionEvent.ACTION_CANCEL;
                        UI.removeCallbacks(lpRunnable);
                        float vx = 0;
                        if (vt != null) { vt.computeCurrentVelocity(1000); vx = vt.getXVelocity(); vt.recycle(); vt = null; }
                        if (dragging && edgeHold) {               // 没扯下来：吸回墙上
                            dragging = false;
                            snapBack(startX);
                        } else if (dragging) {
                            dragging = false;
                            if (!cancel && Math.abs(vx) > 800 * density) flingTo(vx > 0 ? "right" : "left");
                            else { finishDrag(); layoutBubble(); }
                        } else if (!cancel && !consumed) {
                            long now = SystemClock.uptimeMillis();
                            if (pendingPoke != null && now - lastUpAt <= doubleTapMs) {
                                // 双击：取消待定的单击
                                UI.removeCallbacks(pendingPoke);
                                pendingPoke = null;
                                lastUpAt = 0;
                                synchronized (LOCK) { doubleTap = true; }
                                callPet("doubletap");
                            } else {
                                lastUpAt = now;
                                pendingPoke = new Runnable() {
                                    @Override public void run() {
                                        pendingPoke = null;
                                        synchronized (LOCK) { pokeCount++; }
                                        callPet("poke");
                                    }
                                };
                                UI.postDelayed(pendingPoke, doubleTapMs);
                            }
                        }
                        callPet("release");
                        return true;
                    }
                }
                return false;
            }
        });
        return wv;
    }

    // ================= 气泡窗口 =================

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface", "ClickableViewAccessibility"})
    private static WebView createBubbleView() {
        final WebView wv = baseWebView(TAG_BUBBLE);
        wv.addJavascriptInterface(new BubbleBridge(), "ClawdBridge");
        wv.setOnTouchListener(new View.OnTouchListener() {
            @Override public boolean onTouch(View v, MotionEvent e) {
                if (e.getActionMasked() == MotionEvent.ACTION_OUTSIDE && inputMode) {
                    // 点到气泡外：收起输入
                    setInputModeInternal(false, true);
                    synchronized (LOCK) { inputClosed = true; }
                    return true;
                }
                return false;   // 其余交给 WebView（输入框、按钮）
            }
        });
        wv.setOnKeyListener(new View.OnKeyListener() {
            @Override public boolean onKey(View v, int keyCode, KeyEvent ev) {
                if (keyCode == KeyEvent.KEYCODE_BACK && ev.getAction() == KeyEvent.ACTION_UP && inputMode) {
                    setInputModeInternal(false, true);
                    synchronized (LOCK) { inputClosed = true; }
                    return true;
                }
                return false;
            }
        });
        return wv;
    }

    /** 气泡页 → 原生 */
    public static final class BubbleBridge {
        @JavascriptInterface
        public void submit(String text) {
            if (text == null) return;
            synchronized (LOCK) { submits.add(text); }
        }

        @JavascriptInterface
        public void close() {
            UI.post(new Runnable() {
                @Override public void run() {
                    setInputModeInternal(false, false);
                    synchronized (LOCK) { inputClosed = true; }
                }
            });
        }

        @JavascriptInterface
        public void tap() {
            synchronized (LOCK) { bubbleTap = true; }
        }

        @JavascriptInterface
        public void resize(final int cssHeight) {
            UI.post(new Runnable() {
                @Override public void run() {
                    int h = Math.round(cssHeight * density);
                    if (Math.abs(h - bubbleHeightPx) < 2) return;
                    bubbleHeightPx = h;
                    layoutBubble();
                }
            });
        }
    }

    // ================= 通用 =================

    @SuppressLint("SetJavaScriptEnabled")
    private static WebView baseWebView(String tag) {
        WebView wv = new WebView(appCtx);
        wv.setTag(tag);
        wv.setBackgroundColor(Color.TRANSPARENT);
        wv.setVerticalScrollBarEnabled(false);
        wv.setHorizontalScrollBarEnabled(false);
        wv.setOverScrollMode(View.OVER_SCROLL_NEVER);
        wv.setLongClickable(false);
        wv.setHapticFeedbackEnabled(false);
        wv.getSettings().setJavaScriptEnabled(true);
        wv.getSettings().setDomStorageEnabled(true);
        wv.getSettings().setAllowFileAccess(true);
        wv.getSettings().setAllowFileAccessFromFileURLs(false);
        wv.getSettings().setAllowUniversalAccessFromFileURLs(false);
        wv.getSettings().setMediaPlaybackRequiresUserGesture(false);
        return wv;
    }

    private static int dp(int v) { return Math.round(v * density); }

    private static void finishDrag() {
        int[] sc = screen();
        int trig = (int) (sizePx * miniTrigger);
        if (lp.x < -trig) enterMini("left", true);
        else if (lp.x + sizePx > sc[0] + trig) enterMini("right", true);
        else leaveMini(true);
        updatePet();
        synchronized (LOCK) {
            dragEnd = "{\"x\":" + lp.x + ",\"y\":" + lp.y
                    + ",\"mode\":\"" + mode + "\",\"side\":\"" + side + "\"}";
        }
    }

    private static ValueAnimator glide;
    private static void writeDragEnd() {
        synchronized (LOCK) {
            dragEnd = "{\"x\":" + lp.x + ",\"y\":" + lp.y
                    + ",\"mode\":\"" + mode + "\",\"side\":\"" + side + "\"}";
        }
    }
    /** 贴边上下滑完松手：横向弹回墙上 */
    private static void snapBack(final int toX) {
        final int fromX = lp.x;
        callPet("edgeback");
        glide = ValueAnimator.ofFloat(0f, 1f);
        glide.setDuration(220);
        glide.setInterpolator(new DecelerateInterpolator());
        glide.addUpdateListener(new ValueAnimator.AnimatorUpdateListener() {
            @Override public void onAnimationUpdate(ValueAnimator a) {
                float f = (Float) a.getAnimatedValue();
                lp.x = fromX + Math.round((toX - fromX) * f); updatePet(); layoutBubble();
            }
        });
        glide.start();
        lp.x = fromX;
        int keep = lp.x; lp.x = toX; writeDragEnd(); lp.x = keep;
    }
    /** 甩出去：飞向那一侧的墙，撞上就贴边 */
    private static void flingTo(final String s) {
        final int[] sc = screen();
        final int fromX = lp.x;
        final int hide = (int) (sizePx * miniHide);
        final int toX = "left".equals(s) ? -hide : sc[0] - sizePx + hide;
        mode = "free"; side = "none";
        callPet("fling:" + s);
        final ValueAnimator g = ValueAnimator.ofFloat(0f, 1f);
        glide = g;
        g.setDuration(Math.min(520, 180 + Math.abs(toX - fromX) / 3));
        g.setInterpolator(new DecelerateInterpolator(0.8f));
        g.addUpdateListener(new ValueAnimator.AnimatorUpdateListener() {
            @Override public void onAnimationUpdate(ValueAnimator a) {
                float f = (Float) a.getAnimatedValue();
                lp.x = fromX + Math.round((toX - fromX) * f); updatePet(); layoutBubble();
            }
        });
        g.addListener(new AnimatorListenerAdapter() {
            boolean canceled;
            @Override public void onAnimationCancel(Animator a) { canceled = true; }
            @Override public void onAnimationEnd(Animator a) {
                if (glide == g) glide = null;
                if (canceled) return;
                enterMini(s, true); updatePet(); layoutBubble(); writeDragEnd();
            }
        });
        g.start();
    }
    private static void enterMini(String s, boolean notify) {
        int[] sc = screen();
        int hide = (int) (sizePx * miniHide);
        side = "left".equals(s) ? "left" : "right";
        mode = "mini";
        lp.x = "left".equals(side) ? -hide : sc[0] - sizePx + hide;
        clampY();
        applyGestureExclusion();
        if (notify) callPet("mini:" + side);
    }

    private static void leaveMini(boolean notify) {
        mode = "free"; side = "none";
        clampFree();
        applyGestureExclusion();
        if (notify) callPet("free");
    }

    private static void clampDrag() {
        int[] sc = screen();
        int allow = (int) (sizePx * 0.6f);
        if (lp.x < -allow) lp.x = -allow;
        if (lp.x > sc[0] - sizePx + allow) lp.x = sc[0] - sizePx + allow;
        clampY();
    }

    private static void clampFree() {
        int[] sc = screen();
        if (lp.x < 0) lp.x = 0;
        if (lp.x > sc[0] - sizePx) lp.x = sc[0] - sizePx;
        clampY();
    }

    private static void clampY() {
        int[] sc = screen();
        if (lp.y < 0) lp.y = 0;
        if (lp.y > sc[1] - sizePx) lp.y = sc[1] - sizePx;
    }

    private static void updatePet() {
        try { if (petView != null) wm.updateViewLayout(petView, lp); } catch (Throwable ignored) {}
    }

    private static void updateBubble() {
        try { if (bubbleView != null) wm.updateViewLayout(bubbleView, blp); } catch (Throwable ignored) {}
    }

    private static void callPet(String evt) {
        if (petView == null) return;
        try { petView.evaluateJavascript("window.clawd&&window.clawd('" + evt + "')", null); }
        catch (Throwable ignored) {}
    }

    /** 当前模式下 Clawd 身体在画布里的矩形（像素） */
    private static Rect hitRect() {
        float[] h = "mini".equals(mode) ? HIT_EDGE : HIT_FREE;
        float l = h[0], t = h[1], r = h[2], b = h[3];
        if ("mini".equals(mode) && "left".equals(side)) { float nl = 1f - r; r = 1f - l; l = nl; }
        float cx = (l + r) / 2f, cy = (t + b) / 2f, hw = (r - l) / 2f * hitScale, hh = (b - t) / 2f * hitScale;
        l = Math.max(0f, cx - hw); r = Math.min(1f, cx + hw); t = Math.max(0f, cy - hh); b = Math.min(1f, cy + hh);
        return new Rect(Math.round(l * sizePx), Math.round(t * sizePx), Math.round(r * sizePx), Math.round(b * sizePx));
    }

    /** 触摸范围倍率：1 = 刚好盖住身体（带一点余量），越大越好点 */
    public static void setHitScale(Context ctx, final float s) {
        UI.post(new Runnable() {
            @Override public void run() {
                hitScale = Math.max(0.5f, Math.min(2f, s));
                applyGestureExclusion();
            }
        });
    }

    private static void applyGestureExclusion() {
        if (petView == null || Build.VERSION.SDK_INT < 29) return;
        try {
            Method m = View.class.getMethod("setSystemGestureExclusionRects", List.class);
            List<Rect> rects = Collections.singletonList(hitRect());
            m.invoke(petView, rects);
        } catch (Throwable t) {
            lastError = "exclusion: " + t;
        }
    }

    /** 清理旧引擎/旧版本 dex 遗留的窗口 */
    @SuppressWarnings("unchecked")
    private static String cleanupOrphans() {
        int removed = 0, scanned = 0;
        try {
            Class<?> g = Class.forName("android.view.WindowManagerGlobal");
            Object inst = g.getMethod("getInstance").invoke(null);
            Field f = g.getDeclaredField("mViews");
            f.setAccessible(true);
            ArrayList<View> views = new ArrayList<View>((List<View>) f.get(inst));
            for (View v : views) {
                scanned++;
                if (v == petView || v == bubbleView || !(v instanceof WebView)) continue;
                Object tag = v.getTag();
                boolean ours = TAG.equals(tag) || TAG_BUBBLE.equals(tag);
                if (!ours && tag == null && v.getLayoutParams() instanceof WindowManager.LayoutParams) {
                    WindowManager.LayoutParams p = (WindowManager.LayoutParams) v.getLayoutParams();
                    ours = p.type == WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
                            && p.width == p.height && p.width > 0
                            && "".equals(String.valueOf(p.getTitle()));
                }
                if (ours) {
                    try { wm.removeViewImmediate(v); ((WebView) v).destroy(); removed++; } catch (Throwable ignored) {}
                }
            }
        } catch (Throwable t) {
            return "fail:" + t;
        }
        return "scanned=" + scanned + " removed=" + removed;
    }
}
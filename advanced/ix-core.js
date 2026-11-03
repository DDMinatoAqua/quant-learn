/* 量化交易进阶 · 互动学习核心:XP/等级、组件外壳、预测题、步进动画、图表工具 */
(function () {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  function load(k, d) { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }
  function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

  /* ---------------- 数值工具 ---------------- */
  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function gaussFactory(rnd) { let spare = null; return function () { if (spare !== null) { const s = spare; spare = null; return s; } let u, v, s; do { u = 2 * rnd() - 1; v = 2 * rnd() - 1; s = u * u + v * v; } while (s >= 1 || s === 0); const m = Math.sqrt(-2 * Math.log(s) / s); spare = v * m; return u * m; }; }
  function rng(seed) { const r = mulberry32(seed >>> 0 || 1); const g = gaussFactory(r); return { u: r, g, int: (a, b) => a + Math.floor(r() * (b - a + 1)), pick: arr => arr[Math.floor(r() * arr.length)] }; }
  const sum = a => a.reduce((x, y) => x + y, 0);
  const mean = a => a.length ? sum(a) / a.length : 0;
  const std = a => { if (a.length < 2) return 0; const m = mean(a); return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / (a.length - 1)); };
  const pct = (x, d = 1) => (x * 100).toFixed(d) + "%";
  const fx = (x, d = 2) => (x == null || !isFinite(x)) ? "—" : (+x).toFixed(d);
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  function css(v) { return getComputedStyle(document.documentElement).getPropertyValue(v).trim(); }
  function normCdf(x) { const t = 1 / (1 + 0.3275911 * Math.abs(x) / Math.SQRT2); const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x / 2); return x >= 0 ? 0.5 * (1 + y) : 0.5 * (1 - y); }
  function normInv(p) {
    const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.3577518672690, -30.66479806614716, 2.506628277459239], b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572], c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783], d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
    const pl = 0.02425; let q, r;
    if (p < pl) { q = Math.sqrt(-2 * Math.log(p)); return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
    if (p > 1 - pl) { q = Math.sqrt(-2 * Math.log(1 - p)); return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
    q = p - 0.5; r = q * q; return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  }
  function ranks(a) { const idx = a.map((v, i) => [v, i]).sort((x, y) => x[0] - y[0]); const r = new Array(a.length); idx.forEach((p, k) => { r[p[1]] = k; }); return r; }
  function corr(a, b) { const ma = mean(a), mb = mean(b); let sab = 0, saa = 0, sbb = 0; for (let i = 0; i < a.length; i++) { const x = a[i] - ma, y = b[i] - mb; sab += x * y; saa += x * x; sbb += y * y; } return sab / Math.sqrt(saa * sbb || 1e-300); }
  const rankCorr = (a, b) => corr(ranks(a), ranks(b));
  const matVec = (M, v) => M.map(row => row.reduce((s, x, j) => s + x * v[j], 0));
  const dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0);
  function cholesky(A) { const n = A.length, L = A.map(() => new Array(n).fill(0)); for (let i = 0; i < n; i++) for (let j = 0; j <= i; j++) { let s = A[i][j]; for (let k = 0; k < j; k++) s -= L[i][k] * L[j][k]; L[i][j] = i === j ? Math.sqrt(Math.max(s, 1e-14)) : s / L[j][j]; } return L; }
  function solve(A, b) { const n = A.length, M = A.map((r, i) => [...r, b[i]]); for (let c = 0; c < n; c++) { let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r; [M[c], M[p]] = [M[p], M[c]]; for (let r = 0; r < n; r++) if (r !== c) { const f = M[r][c] / M[c][c]; for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k]; } } return M.map((r, i) => r[n] / r[i]); }
  function inv(A) { const n = A.length; const cols = A.map((_, j) => solve(A, A.map((_, i) => i === j ? 1 : 0))); return A.map((_, i) => cols.map(c => c[i])); }
  function projSimplex(v) { const u = [...v].sort((a, b) => b - a); let cs = 0, theta = 0; for (let i = 0; i < u.length; i++) { cs += u[i]; const t = (cs - 1) / (i + 1); if (u[i] - t > 0) theta = t; } return v.map(x => Math.max(x - theta, 0)); }
  function ols(X, y) { // X: n×k(调用方自行加截距列);返回 beta、t 值、残差、R²
    const n = X.length, k = X[0].length;
    const XtX = Array.from({ length: k }, (_, i) => Array.from({ length: k }, (_, j) => X.reduce((s, r) => s + r[i] * r[j], 0)));
    const Xty = Array.from({ length: k }, (_, i) => X.reduce((s, r, t) => s + r[i] * y[t], 0));
    const beta = solve(XtX, Xty), res = y.map((v, t) => v - dot(X[t], beta));
    const s2 = sum(res.map(e => e * e)) / Math.max(n - k, 1), Inv = inv(XtX);
    const se = beta.map((_, i) => Math.sqrt(Math.max(s2 * Inv[i][i], 0)));
    const my = mean(y), sst = sum(y.map(v => (v - my) ** 2));
    return { beta, se, t: beta.map((b, i) => b / se[i]), res, r2: 1 - sum(res.map(e => e * e)) / sst };
  }
  function cumprod(a, start = 1) { let v = start; return a.map(x => (v *= 1 + x)); }
  function sharpe(a, k = 252) { const s = std(a); return s > 0 ? mean(a) / s * Math.sqrt(k) : 0; }
  function maxDD(eq) { let pk = -Infinity, m = 0; eq.forEach(v => { pk = Math.max(pk, v); m = Math.min(m, v / pk - 1); }); return m; }
  function hist(arr, lo, hi, bins) { const w = (hi - lo) / bins, h = new Array(bins).fill(0); arr.forEach(x => { const i = Math.floor((x - lo) / w); if (i >= 0 && i < bins) h[i]++; else if (i >= bins) h[bins - 1]++; else h[0]++; }); return { h, labels: h.map((_, i) => lo + (i + 0.5) * w), w }; }
  const U = { mulberry32, gaussFactory, rng, sum, mean, std, pct, fx, clamp, css, normCdf, normInv, ranks, corr, rankCorr, matVec, dot, cholesky, solve, inv, projSimplex, ols, cumprod, sharpe, maxDD, hist };
  const PALETTE = ["#2563eb", "#f59e0b", "#16a34a", "#dc2626", "#8b5cf6", "#0891b2", "#db2777", "#65a30d", "#ea580c", "#475569"];
  U.PALETTE = PALETTE;

  /* ---------------- XP / 等级 ---------------- */
  const LS_XP = "qa-xp", LS_PRED = "qa-pred";
  const LEVELS = [[0, "量化新手"], [60, "数据清洁工"], [150, "因子猎人"], [270, "时序侦探"], [420, "组合工程师"], [600, "模型驯兽师"], [800, "回测架构师"], [1020, "稳健性审稿人"], [1260, "执行交易员"], [1520, "实盘操盘手"]];
  let XP = load(LS_XP, { xp: 0, done: {} });
  if (!XP || typeof XP.xp !== "number") XP = { xp: 0, done: {} };
  function levelOf(x) { let i = 0; LEVELS.forEach((l, k) => { if (x >= l[0]) i = k; }); return i; }
  function renderXP() {
    const b = $("#xpBadge"); if (!b) return;
    const i = levelOf(XP.xp), next = LEVELS[i + 1];
    b.innerHTML = '⭐ <b>Lv.' + (i + 1) + '</b><span class="xp-title"> ' + LEVELS[i][1] + '</span> <span class="xp-num">' + XP.xp + ' XP</span>';
    b.title = next ? "距离「" + next[1] + "」还差 " + (next[0] - XP.xp) + " XP · 点击进入闯关中心" : "已达最高等级 · 点击进入闯关中心";
    $$("[data-ixdone]").forEach(e => e.classList.toggle("on", !!XP.done[e.dataset.ixdone]));
    const ac = $("#arcadeCount"); if (ac) { const all = $$("[data-ix]"); ac.textContent = all.filter(e => XP.done["ix:" + e.dataset.ix]).length + "/" + all.length; }
  }
  function toast(html, cls) {
    let box = $("#toastBox"); if (!box) { box = document.createElement("div"); box.id = "toastBox"; document.body.appendChild(box); }
    const t = document.createElement("div"); t.className = "toast " + (cls || ""); t.innerHTML = html; box.appendChild(t);
    setTimeout(() => t.classList.add("out"), 2600); setTimeout(() => t.remove(), 3200);
  }
  function award(id, pts, msg) {
    if (XP.done[id]) return false;
    const before = levelOf(XP.xp);
    XP.done[id] = pts; XP.xp += pts; save(LS_XP, XP); renderXP();
    toast("✨ +" + pts + " XP · " + msg);
    const after = levelOf(XP.xp);
    if (after > before) setTimeout(() => toast("🎉 升级到 Lv." + (after + 1) + "「" + LEVELS[after][1] + "」!", "big"), 600);
    document.dispatchEvent(new CustomEvent("qa:xp"));
    return true;
  }
  function installBadge() {
    const theme = $("#themeBtn"); if (!theme || $("#xpBadge")) return;
    const a = document.createElement("a"); a.id = "xpBadge"; a.className = "xp-badge"; a.href = "#arcade";
    theme.parentNode.insertBefore(a, theme); renderXP();
  }

  /* ---------------- 图表 ---------------- */
  function chartOpts(o) {
    o = o || {};
    const text = css("--text"), grid = css("--border"), muted = css("--muted");
    if (window.Chart) { Chart.defaults.color = muted; Chart.defaults.borderColor = grid; Chart.defaults.font.family = getComputedStyle(document.body).fontFamily; }
    const ax = (t, extra) => Object.assign({ ticks: { color: muted, maxTicksLimit: 8 }, grid: { color: grid }, title: t ? { display: true, text: t, color: muted } : undefined }, extra || {});
    const scales = {
      x: ax(o.xTitle, Object.assign(o.xType ? { type: o.xType } : {}, o.stacked ? { stacked: true } : {}, o.xMin != null ? { min: o.xMin } : {}, o.xMax != null ? { max: o.xMax } : {}, o.xTicks || {})),
      y: ax(o.yTitle, Object.assign(o.stacked ? { stacked: true } : {}, o.yMin != null ? { min: o.yMin } : {}, o.yMax != null ? { max: o.yMax } : {}, o.yType ? { type: o.yType } : {}))
    };
    if (o.y1) scales.y1 = ax(o.y1, { position: "right", grid: { drawOnChartArea: false } });
    if (o.noX) scales.x.display = false;
    return Object.assign({
      responsive: true, maintainAspectRatio: false, animation: false, normalized: true,
      interaction: o.interaction || { mode: "nearest", intersect: false },
      plugins: { legend: { display: o.legend !== false, labels: { color: text, boxWidth: 12, font: { size: 12 } } }, tooltip: { enabled: o.tooltip !== false } },
      scales
    }, o.extra || {});
  }
  function draw(canvas, cfg) {
    if (!window.Chart) return null;
    if (canvas._chart) { canvas._chart.destroy(); }
    canvas._chart = new Chart(canvas, cfg); return canvas._chart;
  }
  const line = (label, data, color, extra) => Object.assign({ label, data, borderColor: color, backgroundColor: color, pointRadius: 0, borderWidth: 2, tension: 0 }, extra || {});

  /* ---------------- 组件注册与外壳 ---------------- */
  const DEFS = {}, LIVE = [];
  function def(id, spec) { DEFS[id] = spec; }
  const KIND = { play: ["🎛️", "动手实验"], walk: ["🎬", "动画演示"], game: ["🎮", "闯关挑战"] };
  function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]); }

  function makeApi(el, id, spec) {
    const body = $(".ix-body", el), expl = $(".ix-exp-text", el);
    let touches = 0;
    const api = {
      el, body, id, spec, U,
      render: null, timers: [],
      win(msg, pts) { return award("ix:" + id, pts || spec.xp || 20, msg || ("完成「" + spec.title + "」")); },
      bonus(key, pts, msg) { return award("ix:" + id + ":" + key, pts, msg); },
      touch() { touches++; if (spec.kind === "play" && touches === (spec.touchGoal || 4)) api.win("探索了「" + spec.title + "」"); },
      explain(html) { expl.innerHTML = html; },
      div(parent, cls, html) { const d = document.createElement("div"); if (cls) d.className = cls; if (html != null) d.innerHTML = html; (parent || body).appendChild(d); return d; },
      btn(parent, label, fn, cls) { const b = document.createElement("button"); b.type = "button"; b.className = "btn " + (cls || ""); b.innerHTML = label; b.addEventListener("click", fn); (parent || body).appendChild(b); return b; },
      canvas(parent, h) { const box = api.div(parent || body, "chart-box ix-chart"); if (h) box.style.height = h + "px"; const c = document.createElement("canvas"); box.appendChild(c); return c; },
      draw, chartOpts, line,
      stats(div, pairs) { div.classList.add("stats"); div.innerHTML = pairs.map(p => '<div class="stat' + (p[2] ? " " + p[2] : "") + '"><div class="k">' + p[0] + '</div><div class="v">' + p[1] + "</div></div>").join(""); },
      controls(parent, items, onChange) {
        const box = api.div(parent || body, "controls ix-controls"), v = {};
        let raf = 0;
        const fire = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => { onChange && onChange(v); }); };
        items.forEach(it => {
          const lab = document.createElement("label"); box.appendChild(lab);
          if (it.type === "select") {
            v[it.k] = it.v != null ? it.v : it.opts[0][0];
            lab.innerHTML = it.label + '<select data-k="' + it.k + '">' + it.opts.map(o => '<option value="' + o[0] + '"' + (String(o[0]) === String(v[it.k]) ? " selected" : "") + ">" + o[1] + "</option>").join("") + "</select>";
            $("select", lab).addEventListener("change", e => { v[it.k] = isNaN(+e.target.value) ? e.target.value : +e.target.value; api.touch(); fire(); });
          } else if (it.type === "check") {
            v[it.k] = !!it.v; lab.className = "chk";
            lab.innerHTML = '<input type="checkbox" data-k="' + it.k + '"' + (it.v ? " checked" : "") + "> " + it.label;
            $("input", lab).addEventListener("change", e => { v[it.k] = e.target.checked; api.touch(); fire(); });
          } else {
            v[it.k] = it.v; const fmt = it.fmt || (x => x);
            lab.innerHTML = it.label + ':<span class="val">' + fmt(it.v) + '</span><input type="range" data-k="' + it.k + '" min="' + it.min + '" max="' + it.max + '" step="' + (it.step || 1) + '" value="' + it.v + '">';
            const inp = $("input", lab), val = $(".val", lab);
            inp.addEventListener("input", () => { v[it.k] = +inp.value; val.textContent = fmt(v[it.k]); fire(); });
            inp.addEventListener("change", () => api.touch());
          }
        });
        v._set = (k, val) => { const inp = $('[data-k="' + k + '"]', box); if (!inp) return; if (inp.type === "checkbox") inp.checked = !!val; else inp.value = val; inp.dispatchEvent(new Event(inp.tagName === "SELECT" || inp.type === "checkbox" ? "change" : "input")); };
        return v;
      },
      stepper(parent, opt) {
        const bar = api.div(parent || body, "stepper");
        bar.innerHTML = '<button type="button" class="icon-btn s-first" title="回到开头">⏮</button><button type="button" class="icon-btn s-prev" title="上一步">◀</button>' +
          '<button type="button" class="btn s-play">▶ 播放</button><button type="button" class="icon-btn s-next" title="下一步">▶|</button>' +
          '<input type="range" class="s-range" min="0" value="0"><span class="s-count"></span>' +
          '<select class="s-speed" title="速度"><option value="1400">慢速</option><option value="700" selected>中速</option><option value="250">快速</option></select>';
        const cap = api.div(parent || body, "step-caption");
        let n = opt.n, i = 0, timer = null;
        const rg = $(".s-range", bar), cnt = $(".s-count", bar), play = $(".s-play", bar);
        function go(k) {
          i = clamp(k, 0, n - 1); rg.max = n - 1; rg.value = i;
          cnt.textContent = (opt.label || "第") + " " + (i + 1) + " / " + n + " 步";
          const c = opt.onStep(i); if (c != null) { cap.innerHTML = c; if (c.indexOf("\\(") >= 0 && window.renderMathInElement) renderMathInElement(cap, { delimiters: [{ left: "\\(", right: "\\)", display: false }], throwOnError: false }); }
          if (i === n - 1) { stop(); if (opt.onEnd) opt.onEnd(); else if (spec.kind === "walk") api.win("看完了「" + spec.title + "」"); }
        }
        function stop() { if (timer) { clearInterval(timer); timer = null; } play.textContent = "▶ 播放"; }
        function start() { if (i >= n - 1) go(0); play.textContent = "⏸ 暂停"; timer = setInterval(() => { if (i >= n - 1) stop(); else go(i + 1); }, +$(".s-speed", bar).value); api.timers.push(stop); }
        play.addEventListener("click", () => timer ? stop() : start());
        $(".s-first", bar).addEventListener("click", () => { stop(); go(0); });
        $(".s-prev", bar).addEventListener("click", () => { stop(); go(i - 1); });
        $(".s-next", bar).addEventListener("click", () => { stop(); go(i + 1); });
        rg.addEventListener("input", () => { stop(); go(+rg.value); });
        $(".s-speed", bar).addEventListener("change", () => { if (timer) { stop(); start(); } });
        const ctl = { go, stop, start, get i() { return i; }, reset(newN, keep) { stop(); n = Math.max(1, newN); go(keep ? Math.min(i, n - 1) : 0); }, bar, cap };
        api.timers.push(stop);
        return ctl;
      }
    };
    return api;
  }

  function predictHTML(id, p) {
    return '<div class="predict" data-pid="' + id + '"><div class="pq">🤔 <b>你来预测</b>:' + p.q + '</div><div class="po">' +
      p.o.map((o, i) => '<button type="button" class="p-opt" data-i="' + i + '">' + o + "</button>").join("") +
      '</div><div class="pe" hidden></div></div>';
  }
  function bindPredict(el, id, spec) {
    const box = $(".predict", el); if (!box) return;
    const p = spec.predict, pred = load(LS_PRED, {}), body = $(".ix-wrap", el);
    function reveal(choice, fresh) {
      $$(".p-opt", box).forEach((b, i) => { b.disabled = true; b.classList.toggle("correct", i === p.a); b.classList.toggle("wrong", i === choice && i !== p.a); });
      const ok = choice === p.a, pe = $(".pe", box); pe.hidden = false;
      pe.innerHTML = (choice == null ? "👀 你跳过了预测。正确答案是「" + p.o[p.a] + "」。" : ok ? "✅ 猜对了!" : "❌ 不对,正确答案是「" + p.o[p.a] + "」。") + " " + p.e + ' <span class="muted">下面动手验证一下 👇</span>';
      body.classList.remove("locked");
      if (fresh && ok) award("pred:" + id, 5, "预测正确");
    }
    if (id in pred) reveal(pred[id], false);
    $$(".p-opt", box).forEach(b => b.addEventListener("click", () => { const c = +b.dataset.i; const all = load(LS_PRED, {}); all[id] = c; save(LS_PRED, all); reveal(c, true); }));
    const skip = $(".unlock", el); if (skip) skip.addEventListener("click", () => { const all = load(LS_PRED, {}); all[id] = null; save(LS_PRED, all); reveal(null, false); });
  }

  function initWidget(el) {
    if (el._ix) return; el._ix = true;
    const id = el.dataset.ix, spec = DEFS[id];
    el.id = el.id || "ix-" + id;
    if (!spec) { el.innerHTML = '<div class="callout bad">互动组件缺失:' + esc(id) + "</div>"; return; }
    const k = KIND[spec.kind || "play"];
    el.classList.add("ix", "ix-" + (spec.kind || "play"));
    el.innerHTML = '<div class="ix-head"><span class="ix-kind">' + k[0] + " " + k[1] + '</span><span class="ix-title">' + spec.title +
      '</span><span class="ix-xp" data-ixdone="ix:' + id + '">+' + (spec.xp || 20) + " XP</span></div>" +
      (spec.predict ? predictHTML(id, spec.predict) : "") +
      '<div class="ix-wrap' + (spec.predict ? " locked" : "") + '">' + (spec.predict ? '<div class="lock-mask"><button type="button" class="btn secondary unlock">先在上面做个预测 👆 &nbsp;或&nbsp; 跳过,直接动手</button></div>' : "") +
      '<div class="ix-try"><b>🧪 试试看</b>' + spec.tryit + '</div><div class="ix-body"></div>' +
      '<div class="ix-explain"><b>💡 发生了什么</b><div class="ix-exp-text"></div></div></div>';
    if (!window.Chart && spec.needsChart !== false) { $(".ix-body", el).innerHTML = '<div class="callout bad">图表库加载失败,互动组件无法显示。</div>'; return; }
    const api = makeApi(el, id, spec);
    try { spec.build(api.body, api); if (api.render) api.render(); }
    catch (e) { console.error("互动组件 " + id + " 出错:", e); $(".ix-body", el).insertAdjacentHTML("beforeend", '<div class="callout bad">组件出错:' + esc(e.message) + "</div>"); }
    bindPredict(el, id, spec);
    LIVE.push(api);
    renderXP();
  }
  function initPage(pid) {
    LIVE.forEach(a => a.timers.forEach(f => f()));       // 离开页面时停止所有动画
    const sec = document.getElementById(pid); if (!sec) return;
    $$("[data-ix]", sec).forEach(initWidget);
    if (pid === "arcade") renderArcade();
  }
  document.addEventListener("qa:page", e => initPage(e.detail));
  document.addEventListener("qa:theme", () => {
    const act = $("section.page.active"); if (!act) return;
    LIVE.forEach(a => { if (a.render && act.contains(a.el)) { try { a.render(); } catch (e) { console.error(e); } } });
  });

  /* ---------------- 闯关中心 ---------------- */
  function renderArcade() {
    const box = $("#arcadeBody"); if (!box) return;
    const i = levelOf(XP.xp), next = LEVELS[i + 1];
    const all = $$("[data-ix]"), done = all.filter(e => XP.done["ix:" + e.dataset.ix]).length;
    let html = '<div class="stats"><div class="stat"><div class="k">当前等级</div><div class="v">Lv.' + (i + 1) + " " + LEVELS[i][1] + '</div></div><div class="stat"><div class="k">经验值</div><div class="v">' + XP.xp + ' XP</div></div><div class="stat"><div class="k">完成的互动</div><div class="v">' + done + " / " + all.length + "</div></div>" +
      '<div class="stat"><div class="k">下一级</div><div class="v">' + (next ? next[1] + "(还差 " + (next[0] - XP.xp) + ")" : "已满级 🏆") + "</div></div></div>";
    html += '<div class="lvl-track">' + LEVELS.map((l, k) => '<span class="lvl' + (k <= i ? " on" : "") + '" title="' + l[0] + ' XP">Lv.' + (k + 1) + " " + l[1] + "</span>").join("") + "</div>";
    const groups = {};
    all.forEach(e => { const sec = e.closest("section.page"); (groups[sec.id] = groups[sec.id] || []).push(e); });
    Object.keys(groups).forEach(pid => {
      const h1 = $("h1", document.getElementById(pid));
      html += "<h3>" + (h1 ? h1.textContent : pid) + "</h3><div class=\"arcade-list\">";
      groups[pid].forEach(e => {
        const sp = DEFS[e.dataset.ix] || { title: e.dataset.ix, kind: "play" }, k = KIND[sp.kind || "play"], ok = XP.done["ix:" + e.dataset.ix];
        html += '<a class="arcade-item' + (ok ? " ok" : "") + '" href="#' + pid + '" data-goix="' + e.id + '"><span class="ai-k">' + k[0] + '</span><span class="ai-t">' + sp.title + '<small>' + k[1] + " · +" + (sp.xp || 20) + ' XP</small></span><span class="ai-s">' + (ok ? "✔ 已完成" : "去挑战 →") + "</span></a>";
      });
      html += "</div>";
    });
    box.innerHTML = html;
  }
  document.addEventListener("click", e => {
    const a = e.target.closest("a[data-goix]"); if (!a) return;
    e.preventDefault(); const target = a.dataset.goix, pid = a.getAttribute("href").slice(1);
    if (location.hash !== "#" + pid) location.hash = pid;
    setTimeout(() => { const t = document.getElementById(target); if (t) t.scrollIntoView({ behavior: "smooth", block: "start" }); }, 120);
  });
  document.addEventListener("qa:xp", () => { if ($("#arcade.active")) renderArcade(); });

  window.QX = { def, U, award, toast, initPage, levelOf, LEVELS, get xp() { return XP; }, $, $$, load, save };
  function boot() {
    installBadge(); renderXP();
    // 组件初始化由 app.js 的路由在切换页面时触发(qa:page 事件),app.js 最后加载
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();

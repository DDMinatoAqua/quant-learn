(function () {
  "use strict";
  const CHAPTERS = ["ch1", "ch2", "ch3", "ch4", "ch5", "ch6", "ch7", "ch8", "ch9"];
  const DEMOS = ["demo-frontier", "demo-factor", "demo-multi"];
  const PAGES = ["home", "prereq", ...CHAPTERS, ...DEMOS, "glossary"];
  const TITLES = {};
  // 与入门站(ql-*)不同的存储前缀,两个站的进度互不干扰
  const LS_PROGRESS = "qa-progress", LS_THEME = "qa-theme", LS_QUIZ = "qa-quiz";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  function load(key, def) { try { return JSON.parse(localStorage.getItem(key)) || def; } catch (e) { return def; } }
  function save(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) {} }

  /* ---------- theme ---------- */
  function applyTheme(t) {
    document.documentElement.setAttribute("data-theme", t);
    $("#themeBtn").textContent = t === "dark" ? "☀️" : "🌙";
    $("#hljsLight").disabled = t === "dark";
    $("#hljsDark").disabled = t !== "dark";
  }
  applyTheme(document.documentElement.getAttribute("data-theme") || "light");
  $("#themeBtn").addEventListener("click", () => {
    const t = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    try { localStorage.setItem(LS_THEME, t); } catch (e) {}
    applyTheme(t);
    rerenderActiveDemo();
  });

  /* ---------- progress ---------- */
  let progress = load(LS_PROGRESS, {});
  function renderProgress() {
    const done = CHAPTERS.filter(c => progress[c]).length;
    const pct = Math.round(done / CHAPTERS.length * 100);
    $("#progressFill").style.width = pct + "%";
    $("#progressText").innerHTML = pct + "%<span class=\"pcount\"> (" + done + "/" + CHAPTERS.length + ")</span>";
    $$("nav.sidebar a[data-page]").forEach(a => a.classList.toggle("done", !!progress[a.dataset.page]));
    $$(".mark-btn").forEach(b => {
      const c = b.dataset.ch;
      b.textContent = progress[c] ? "✔ 已完成(点击取消)" : "标记本章为已完成";
      b.classList.toggle("secondary", !!progress[c]);
    });
  }
  function setDone(ch, v) { progress[ch] = v; if (!v) delete progress[ch]; save(LS_PROGRESS, progress); renderProgress(); }
  $("#resetProgress").addEventListener("click", e => {
    e.preventDefault();
    if (confirm("确定要清空本站(进阶)的学习进度和测验记录吗?入门站的进度不受影响。")) {
      progress = {}; save(LS_PROGRESS, progress); save(LS_QUIZ, {});
      $$(".quiz").forEach(buildQuiz); renderProgress();
    }
  });

  /* ---------- chapter TOC + footer ---------- */
  $$("section.page").forEach(sec => {
    const h = $("h1", sec);
    if (!h) { TITLES[sec.id] = sec.id; return; }
    const c = h.cloneNode(true); $$(".sim-tag", c).forEach(t => t.remove());
    TITLES[sec.id] = c.textContent.trim();
  });
  $$("section.page[data-chapter]").forEach(sec => {
    const hs = $$("h2", sec);
    if (hs.length < 3) return;
    const toc = document.createElement("div");
    toc.className = "toc";
    let html = "<b>📑 本章目录</b><ol>";
    hs.forEach((h, i) => {
      if (!h.id) h.id = sec.id + "-s" + (i + 1);
      html += '<li><a href="#' + sec.id + '" data-jump="' + h.id + '">' + h.textContent + "</a></li>";
    });
    toc.innerHTML = html + "</ol>";
    const anchor = $(".objectives", sec) || $(".lead", sec);
    anchor.after(toc);
  });
  document.addEventListener("click", e => {
    const a = e.target.closest("a[data-jump]");
    if (a) { e.preventDefault(); const t = document.getElementById(a.dataset.jump); if (t) t.scrollIntoView({ behavior: "smooth", block: "start" }); }
  });
  const ORDER = ["prereq", ...CHAPTERS];
  CHAPTERS.forEach(c => {
    const i = ORDER.indexOf(c);
    const sec = document.getElementById(c);
    const foot = document.createElement("div");
    foot.className = "page-foot";
    const prev = ORDER[i - 1];
    const next = i < ORDER.length - 1 ? ORDER[i + 1] : "glossary";
    foot.innerHTML =
      '<a class="btn secondary" href="#' + prev + '">← ' + TITLES[prev] + '</a>' +
      '<button class="btn mark-btn" data-ch="' + c + '"></button>' +
      '<a class="btn secondary" href="#' + next + '">' + TITLES[next] + ' →</a>';
    sec.appendChild(foot);
  });
  document.addEventListener("click", e => {
    const b = e.target.closest(".mark-btn");
    if (b) setDone(b.dataset.ch, !progress[b.dataset.ch]);
  });

  /* ---------- quiz ---------- */
  function buildQuiz(box) {
    const ch = box.dataset.quiz, qs = (window.QUIZZES || {})[ch];
    if (!qs) return;
    const saved = load(LS_QUIZ, {})[ch];
    box.classList.remove("submitted");
    let html = '<h2>📝 本章小测验</h2><p class="disclaimer">全部答对会自动把本章标记为已完成。提交后会显示每题解析。</p>';
    qs.forEach((item, qi) => {
      html += '<div class="q"><div class="qt">' + (qi + 1) + ". " + item.q + "</div>";
      item.o.forEach((opt, oi) => {
        html += '<label><input type="radio" name="' + ch + "-q" + qi + '" value="' + oi + '"> ' + opt + "</label>";
      });
      html += '<div class="explain">💡 ' + item.e + "</div></div>";
    });
    html += '<button class="btn quiz-submit">提交答案</button> <button class="btn secondary quiz-reset">重做</button><span class="quiz-result"></span>';
    box.innerHTML = html;
    $(".quiz-submit", box).addEventListener("click", () => grade(box, ch, qs, true));
    $(".quiz-reset", box).addEventListener("click", () => {
      const all = load(LS_QUIZ, {}); delete all[ch]; save(LS_QUIZ, all); buildQuiz(box);
    });
    if (saved) {
      saved.forEach((v, qi) => { if (v != null) { const r = $('input[name="' + ch + "-q" + qi + '"][value="' + v + '"]', box); if (r) r.checked = true; } });
      grade(box, ch, qs, false);
    }
  }
  function grade(box, ch, qs, fresh) {
    let correct = 0; const answers = [];
    qs.forEach((item, qi) => {
      const sel = $('input[name="' + ch + "-q" + qi + '"]:checked', box);
      answers.push(sel ? +sel.value : null);
      $$('input[name="' + ch + "-q" + qi + '"]', box).forEach(inp => {
        const lab = inp.parentElement; lab.classList.remove("correct", "wrong");
        if (+inp.value === item.a) lab.classList.add("correct");
        else if (inp.checked) lab.classList.add("wrong");
      });
      if (sel && +sel.value === item.a) correct++;
    });
    box.classList.add("submitted");
    const res = $(".quiz-result", box);
    const all = correct === qs.length;
    res.textContent = "得分:" + correct + " / " + qs.length + (all ? " 🎉 全对,本章已完成!" : " —— 看看解析,再试一次吧");
    res.style.color = all ? "var(--good)" : "var(--warn)";
    const store = load(LS_QUIZ, {}); store[ch] = answers; save(LS_QUIZ, store);
    if (all && fresh) setDone(ch, true);
  }
  $$(".quiz").forEach(buildQuiz);

  /* ---------- code: highlight + copy ---------- */
  if (window.hljs) $$("pre code").forEach(el => hljs.highlightElement(el));
  $$("pre").forEach(pre => {
    const b = document.createElement("button");
    b.className = "copy-btn"; b.textContent = "复制";
    b.addEventListener("click", () => {
      const txt = $("code", pre).innerText;
      const done = () => { b.textContent = "已复制 ✔"; setTimeout(() => (b.textContent = "复制"), 1500); };
      if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(txt).then(done, () => fallbackCopy(txt, done));
      else fallbackCopy(txt, done);
    });
    pre.appendChild(b);
  });
  function fallbackCopy(txt, cb) {
    const ta = document.createElement("textarea"); ta.value = txt; document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); cb(); } catch (e) {} ta.remove();
  }

  /* ---------- math ---------- */
  if (window.renderMathInElement) {
    renderMathInElement(document.getElementById("main"), {
      delimiters: [{ left: "$$", right: "$$", display: true }, { left: "\\(", right: "\\)", display: false }],
      throwOnError: false
    });
  }

  /* ---------- glossary ---------- */
  const CHNAME = { pre: "前置", ch1: "第1章", ch2: "第2章", ch3: "第3章", ch4: "第4章", ch5: "第5章", ch6: "第6章", ch7: "第7章", ch8: "第8章", ch9: "第9章" };
  function renderGloss(filter) {
    const f = (filter || "").trim().toLowerCase();
    const list = (window.GLOSSARY || []).filter(g => !f || g.join(" ").toLowerCase().includes(f));
    $("#glossCount").textContent = "共 " + (window.GLOSSARY || []).length + " 个术语" + (f ? ",匹配 " + list.length + " 个" : "");
    $("#glossList").innerHTML = list.length ? list.map(g =>
      "<dt>" + g[0] + (g[3] ? ' <a class="chap-tag" href="#' + (g[3] === "pre" ? "prereq" : g[3]) + '">' + CHNAME[g[3]] + "</a>" : "") +
      "</dt><dd>" + g[2] + ' <span class="en">(' + g[1] + ")</span></dd>").join("") : "<p>没有匹配的术语。</p>";
  }
  renderGloss("");
  $("#glossSearch").addEventListener("input", e => renderGloss(e.target.value));

  /* ---------- router + mobile menu ---------- */
  const sidebar = $("#sidebar"), backdrop = $("#backdrop");
  function closeMenu() { sidebar.classList.remove("open"); backdrop.classList.remove("show"); }
  $("#menuBtn").addEventListener("click", () => { sidebar.classList.toggle("open"); backdrop.classList.toggle("show"); });
  backdrop.addEventListener("click", closeMenu);
  let current = "home";
  function route() {
    let id = (location.hash || "#home").slice(1);
    if (!PAGES.includes(id)) id = "home";
    current = id;
    $$("section.page").forEach(s => s.classList.toggle("active", s.id === id));
    $$("nav.sidebar a[data-page]").forEach(a => a.classList.toggle("active", a.dataset.page === id));
    document.title = (id === "home" ? "" : TITLES[id] + " · ") + "量化交易进阶";
    closeMenu(); const top = () => window.scrollTo({ top: 0, behavior: "instant" });
    top(); setTimeout(top, 0); requestAnimationFrame(() => requestAnimationFrame(top));
    if (DEMO_INIT[id]) DEMO_INIT[id]();
  }
  window.addEventListener("hashchange", route);
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  window.addEventListener("load", () => { window.scrollTo(0, 0); setTimeout(() => window.scrollTo(0, 0), 50); });

  /* =====================================================================
     公共数值工具
     ===================================================================== */
  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function gaussFactory(rnd) { let spare = null; return function () { if (spare !== null) { const s = spare; spare = null; return s; } let u, v, s; do { u = 2 * rnd() - 1; v = 2 * rnd() - 1; s = u * u + v * v; } while (s >= 1 || s === 0); const m = Math.sqrt(-2 * Math.log(s) / s); spare = v * m; return u * m; }; }
  const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
  const std = a => { const m = mean(a); return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / (a.length - 1)); };
  const pct = (x, d = 1) => (x * 100).toFixed(d) + "%";
  function css(v) { return getComputedStyle(document.documentElement).getPropertyValue(v).trim(); }
  function normCdf(x) { // Abramowitz-Stegun 7.1.26
    const t = 1 / (1 + 0.3275911 * Math.abs(x) / Math.SQRT2);
    const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x / 2);
    return x >= 0 ? 0.5 * (1 + y) : 0.5 * (1 - y);
  }
  function normInv(p) { // Acklam
    const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.3577518672690, -30.66479806614716, 2.506628277459239];
    const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
    const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
    const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
    const pl = 0.02425; let q, r;
    if (p < pl) { q = Math.sqrt(-2 * Math.log(p)); return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
    if (p > 1 - pl) { q = Math.sqrt(-2 * Math.log(1 - p)); return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
    q = p - 0.5; r = q * q;
    return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  }
  // 线性代数(小矩阵)
  const matVec = (M, v) => M.map(row => row.reduce((s, x, j) => s + x * v[j], 0));
  const dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0);
  function cholesky(A) { const n = A.length, L = A.map(() => new Array(n).fill(0)); for (let i = 0; i < n; i++) for (let j = 0; j <= i; j++) { let s = A[i][j]; for (let k = 0; k < j; k++) s -= L[i][k] * L[j][k]; L[i][j] = i === j ? Math.sqrt(Math.max(s, 1e-14)) : s / L[j][j]; } return L; }
  function solve(A, b) { const n = A.length, M = A.map((r, i) => [...r, b[i]]); for (let c = 0; c < n; c++) { let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;[M[c], M[p]] = [M[p], M[c]]; for (let r = 0; r < n; r++) if (r !== c) { const f = M[r][c] / M[c][c]; for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k]; } } return M.map((r, i) => r[n] / r[i]); }
  function projSimplex(v) { // 投影到 {w ≥ 0, Σw = 1}
    const u = [...v].sort((a, b) => b - a); let css = 0, rho = 0, theta = 0;
    for (let i = 0; i < u.length; i++) { css += u[i]; const t = (css - 1) / (i + 1); if (u[i] - t > 0) { rho = i; theta = t; } }
    return v.map(x => Math.max(x - theta, 0));
  }
  const charts = {};
  function mk(id, cfg) { if (charts[id]) charts[id].destroy(); charts[id] = new Chart(document.getElementById(id), cfg); }
  function baseOpts(extra) {
    const text = css("--text"), grid = css("--border"), muted = css("--muted");
    Chart.defaults.color = muted; Chart.defaults.borderColor = grid;
    return Object.assign({
      responsive: true, maintainAspectRatio: false, animation: false,
      plugins: { legend: { labels: { color: text, boxWidth: 14 } } },
      scales: { x: { ticks: { color: muted, maxTicksLimit: 10 }, grid: { color: grid } }, y: { ticks: { color: muted }, grid: { color: grid } } }
    }, extra || {});
  }
  const PALETTE = ["#2563eb", "#f59e0b", "#16a34a", "#dc2626", "#8b5cf6", "#0891b2", "#db2777", "#65a30d", "#ea580c", "#475569"];
  function bindControls(rootSel, fn) {
    let timer; const deb = () => { clearTimeout(timer); timer = setTimeout(fn, 60); };
    $$(rootSel + " input, " + rootSel + " select").forEach(inp => inp.addEventListener("input", deb));
  }

  /* =====================================================================
     演示 1:有效前沿与估计误差
     ===================================================================== */
  const ASSETS = ["大盘股票", "小盘股票", "国债", "信用债", "商品"];
  const MU_TRUE = [0.07, 0.09, 0.03, 0.04, 0.05];      // 假设的年化预期收益(教学设定)
  const VOL_TRUE = [0.18, 0.26, 0.04, 0.06, 0.20];     // 假设的年化波动率(教学设定)
  function trueSigma(rhoEq, rhoSB) {
    const C = [[1, rhoEq, rhoSB, rhoSB * 0.8, 0.3], [rhoEq, 1, rhoSB, rhoSB * 0.8, 0.3], [rhoSB, rhoSB, 1, 0.6, 0.0], [rhoSB * 0.8, rhoSB * 0.8, 0.6, 1, 0.1], [0.3, 0.3, 0.0, 0.1, 1]];
    return C.map((r, i) => r.map((c, j) => c * VOL_TRUE[i] * VOL_TRUE[j]));
  }
  function isPD(S) { try { const L = cholesky(S); return L.every((r, i) => isFinite(r[i]) && r[i] > 1e-7); } catch (e) { return false; } }
  function portStats(w, mu, S, rf) { const r = dot(w, mu), v = Math.sqrt(Math.max(dot(w, matVec(S, w)), 0)); return { r, v, sr: (r - rf) / v }; }
  function mvLongOnly(mu, S, lam, w0) { // min wᵀΣw − λ μᵀw, s.t. w∈simplex(投影梯度法)
    const n = mu.length; let w = w0 ? [...w0] : new Array(n).fill(1 / n);
    let tr = 0; for (let i = 0; i < n; i++) tr += S[i][i]; const step = 1 / (2 * tr + 1e-12);
    for (let it = 0; it < 800; it++) { const g = matVec(S, w).map((x, i) => 2 * x - lam * mu[i]); w = projSimplex(w.map((x, i) => x - step * g[i])); }
    return w;
  }
  function mvShort(mu, S, target) { // 允许做空:给定目标收益的最小方差(解析解)
    const n = mu.length, one = new Array(n).fill(1), Si1 = solve(S, one), Sim = solve(S, mu);
    const A = dot(one, Si1), B = dot(one, Sim), C = dot(mu, Sim), D = A * C - B * B;
    const l1 = (C - B * target) / D, l2 = (A * target - B) / D;
    return Si1.map((x, i) => l1 * x + l2 * Sim[i]);
  }
  function riskParity(S) { // 等风险贡献:乘法迭代 w_i ← w_i·(目标占比/当前占比)^0.5
    const n = S.length; let w = new Array(n).fill(1 / n);
    for (let it = 0; it < 2000; it++) {
      const rc = riskContrib(w, S);
      w = w.map((x, i) => x * Math.sqrt((1 / n) / Math.max(rc[i], 1e-12)));
      const s = w.reduce((a, b) => a + b); w = w.map(x => x / s);
    }
    return w;
  }
  function riskContrib(w, S) { const Sw = matVec(S, w), v = dot(w, Sw); return w.map((x, i) => x * Sw[i] / v); }

  function runFrontier() {
    const rhoEq = +$("#efRhoEq").value / 100, rhoSB = +$("#efRhoSB").value / 100, rf = +$("#efRf").value / 1000;
    const T = +$("#efT").value, delta = +$("#efShrink").value / 100, seed = +$("#efSeed").value, allowShort = $("#efShort").checked;
    $("#efRhoEqV").textContent = rhoEq.toFixed(2); $("#efRhoSBV").textContent = rhoSB.toFixed(2); $("#efRfV").textContent = pct(rf);
    $("#efTV").textContent = T + " 个月(≈" + (T / 12).toFixed(1) + " 年)"; $("#efShrinkV").textContent = delta.toFixed(2); $("#efSeedV").textContent = seed;
    const St = trueSigma(rhoEq, rhoSB);
    if (!isPD(St)) { $("#efStats").innerHTML = '<div class="callout bad" style="grid-column:1/-1">这组相关系数构成的矩阵不是正定的(数学上不可能存在),请调整滑块。</div>'; return; }
    // 1) 从“真实”分布中模拟 T 个月的收益,再用样本去估计 μ、Σ
    const g = gaussFactory(mulberry32(seed)), L = cholesky(St), n = ASSETS.length;
    const R = []; for (let t = 0; t < T; t++) { const z = ASSETS.map(() => g()); const e = matVec(L, z); R.push(MU_TRUE.map((m, i) => m / 12 + e[i] / Math.sqrt(12))); }
    const muHat = ASSETS.map((_, i) => mean(R.map(r => r[i])) * 12);
    const Shat = ASSETS.map((_, i) => ASSETS.map((_, j) => { const mi = muHat[i] / 12, mj = muHat[j] / 12; return R.reduce((s, r) => s + (r[i] - mi) * (r[j] - mj), 0) / (T - 1) * 12; }));
    const Sest = Shat.map((r, i) => r.map((x, j) => (1 - delta) * x + (i === j ? delta * x : 0)));  // 向对角阵收缩
    // 2) 前沿曲线
    function frontier(mu, S) {
      const pts = [];
      if (allowShort) { const lo = Math.min(...mu) - 0.01, hi = Math.max(...mu) + 0.03; for (let k = 0; k <= 60; k++) { const tr = lo + (hi - lo) * k / 60; const w = mvShort(mu, S, tr); const st = portStats(w, mu, S, rf); pts.push({ x: st.v, y: st.r, w }); } }
      else { let w0 = null; [0, 0.01, 0.02, 0.04, 0.07, 0.1, 0.15, 0.2, 0.3, 0.45, 0.6, 0.8, 1, 1.3, 1.7, 2.2, 3, 4, 6, 9, 14, 25, 50].forEach(l => { const w = mvLongOnly(mu, S, l, w0); w0 = w; const st = portStats(w, mu, S, rf); pts.push({ x: st.v, y: st.r, w }); }); }
      pts.sort((a, b) => a.y - b.y); return pts;
    }
    const fEst = frontier(muHat, Sest), fTrue = frontier(MU_TRUE, St);
    const bestSR = pts => pts.reduce((b, p) => ((p.y - rf) / p.x > (b.y - rf) / b.x ? p : b));
    const gmvOf = pts => pts.reduce((b, p) => (p.x < b.x ? p : b));
    const wMS = bestSR(fEst).w, wGMV = gmvOf(fEst).w, wEW = new Array(n).fill(1 / n), wRP = riskParity(Sest), wMSTrue = bestSR(fTrue).w;
    const ports = [["等权", wEW], ["最小方差(估计)", wGMV], ["最大夏普(估计)", wMS], ["风险平价(估计)", wRP], ["最大夏普(若知道真实参数)", wMSTrue]];
    // 3) 统计表:每个组合“你以为的表现” vs “真实表现”
    let html = '<table class="weights-table"><tr><th>组合</th>' + ASSETS.map(a => "<th>" + a + "</th>").join("") + "<th>估计收益</th><th>估计波动</th><th>估计夏普</th><th>真实收益</th><th>真实波动</th><th>真实夏普</th></tr>";
    ports.forEach(([name, w]) => { const e = portStats(w, muHat, Sest, rf), t = portStats(w, MU_TRUE, St, rf); html += "<tr><td>" + name + "</td>" + w.map(x => "<td>" + pct(x, 0) + "</td>").join("") + "<td>" + pct(e.r) + "</td><td>" + pct(e.v) + "</td><td>" + e.sr.toFixed(2) + "</td><td>" + pct(t.r) + "</td><td>" + pct(t.v) + "</td><td><b>" + t.sr.toFixed(2) + "</b></td></tr>"; });
    html += "</table>";
    $("#efTable").innerHTML = html;
    const eMS = portStats(wMS, muHat, Sest, rf), tMS = portStats(wMS, MU_TRUE, St, rf), best = portStats(wMSTrue, MU_TRUE, St, rf);
    $("#efStats").innerHTML = [["估计的最大夏普", eMS.sr.toFixed(2)], ["它的真实夏普", tMS.sr.toFixed(2)], ["真实可达的最大夏普", best.sr.toFixed(2)], ["“乐观偏差”", (eMS.sr - tMS.sr).toFixed(2)]]
      .map(it => '<div class="stat"><div class="k">' + it[0] + '</div><div class="v">' + it[1] + "</div></div>").join("");
    // 4) 图
    const xy = pts => pts.map(p => ({ x: p.x * 100, y: p.y * 100 }));
    const pt = (label, w, mu, S, color, style) => ({ label, data: [{ x: portStats(w, mu, S, rf).v * 100, y: portStats(w, mu, S, rf).r * 100 }], type: "scatter", pointRadius: 8, pointStyle: style || "circle", backgroundColor: color, borderColor: color });
    const opts = baseOpts({ scales: { x: { type: "linear", title: { display: true, text: "年化波动率 %" }, ticks: { color: css("--muted") }, grid: { color: css("--border") } }, y: { title: { display: true, text: "年化收益 %" }, ticks: { color: css("--muted") }, grid: { color: css("--border") } } } });
    mk("efChart", { type: "line", data: { datasets: [
      { label: "估计前沿(你以为的)", data: xy(fEst), borderColor: "#f59e0b", backgroundColor: "#f59e0b", pointRadius: 0, borderWidth: 2, showLine: true },
      { label: "真实前沿", data: xy(fTrue), borderColor: "#2563eb", backgroundColor: "#2563eb", pointRadius: 0, borderWidth: 2, borderDash: [6, 4], showLine: true },
      pt("最大夏普:估计位置", wMS, muHat, Sest, "#f59e0b", "triangle"),
      pt("最大夏普:真实位置", wMS, MU_TRUE, St, "#dc2626", "triangle"),
      pt("风险平价(真实位置)", wRP, MU_TRUE, St, "#16a34a", "rectRot"),
      pt("等权(真实位置)", wEW, MU_TRUE, St, "#8b5cf6", "rect"),
      { label: "单个资产(真实)", type: "scatter", data: ASSETS.map((_, i) => ({ x: VOL_TRUE[i] * 100, y: MU_TRUE[i] * 100 })), pointRadius: 5, backgroundColor: "#64748b", borderColor: "#64748b" }
    ] }, options: opts });
    mk("efWeights", { type: "bar", data: { labels: ports.slice(0, 4).map(p => p[0]), datasets: ASSETS.map((a, i) => ({ label: a, data: ports.slice(0, 4).map(p => p[1][i] * 100), backgroundColor: PALETTE[i] })) },
      options: baseOpts({ scales: { x: { stacked: true, ticks: { color: css("--muted") }, grid: { color: css("--border") } }, y: { stacked: true, title: { display: true, text: "权重 %" }, ticks: { color: css("--muted") }, grid: { color: css("--border") } } } }) });
    const rc = riskContrib(wRP, Sest), rcEW = riskContrib(wEW, Sest);
    mk("efRC", { type: "bar", data: { labels: ASSETS, datasets: [{ label: "等权:风险贡献占比 %", data: rcEW.map(x => x * 100), backgroundColor: "#8b5cf6" }, { label: "风险平价:风险贡献占比 %", data: rc.map(x => x * 100), backgroundColor: "#16a34a" }] }, options: baseOpts() });
  }

  /* =====================================================================
     演示 2:因子 IC 与分层回测
     ===================================================================== */
  function ranks(a) { const idx = a.map((v, i) => [v, i]).sort((x, y) => x[0] - y[0]); const r = new Array(a.length); idx.forEach((p, k) => { r[p[1]] = k; }); return r; }
  function corr(a, b) { const ma = mean(a), mb = mean(b); let sab = 0, saa = 0, sbb = 0; for (let i = 0; i < a.length; i++) { const x = a[i] - ma, y = b[i] - mb; sab += x * y; saa += x * x; sbb += y * y; } return sab / Math.sqrt(saa * sbb); }
  function runFactor() {
    const N = +$("#fcN").value, T = +$("#fcT").value, ic = +$("#fcIC").value / 100, rho = +$("#fcRho").value / 100;
    const Q = +$("#fcQ").value, cost = +$("#fcCost").value / 10000, seed = +$("#fcSeed").value;
    $("#fcNV").textContent = N; $("#fcTV").textContent = T + " 个月"; $("#fcICV").textContent = ic.toFixed(2); $("#fcRhoV").textContent = rho.toFixed(2);
    $("#fcCostV").textContent = (cost * 1e4).toFixed(0) + " bp"; $("#fcSeedV").textContent = seed;
    const g = gaussFactory(mulberry32(seed)), monthlyVol = 0.08;
    let f = Array.from({ length: N }, () => g());
    const ics = [], qret = Array.from({ length: Q }, () => []), memberPrev = { top: null, bot: null }, turnTop = [], turnBot = [];
    for (let t = 0; t < T; t++) {
      if (t > 0) f = f.map(x => rho * x + Math.sqrt(1 - rho * rho) * g());       // 因子随时间演化
      const r = f.map(x => monthlyVol * (ic * x + Math.sqrt(1 - ic * ic) * g())); // 下期收益 = IC·因子 + 噪声
      ics.push(corr(ranks(f), ranks(r)));                                          // RankIC
      const rk = ranks(f), grp = rk.map(k => Math.min(Q - 1, Math.floor(k * Q / N)));
      for (let q = 0; q < Q; q++) { const m = r.filter((_, i) => grp[i] === q); qret[q].push(mean(m)); }
      const top = new Set(), bot = new Set(); grp.forEach((q, i) => { if (q === Q - 1) top.add(i); if (q === 0) bot.add(i); });
      if (memberPrev.top) { let s = 0; top.forEach(i => { if (!memberPrev.top.has(i)) s++; }); turnTop.push(s / top.size); let b = 0; bot.forEach(i => { if (!memberPrev.bot.has(i)) b++; }); turnBot.push(b / bot.size); }
      else { turnTop.push(1); turnBot.push(1); }                                    // 第一期建仓
      memberPrev.top = top; memberPrev.bot = bot;
    }
    const icM = mean(ics), icS = std(ics), icir = icM / icS, tstat = icM / (icS / Math.sqrt(T)), pos = ics.filter(x => x > 0).length / T;
    const lsGross = qret[Q - 1].map((x, t) => x - qret[0][t]);
    const lsNet = lsGross.map((x, t) => x - 2 * cost * (turnTop[t] + turnBot[t]));  // 每条腿:卖出旧的 + 买入新的
    const ann = a => ({ r: mean(a) * 12, sr: mean(a) / std(a) * Math.sqrt(12) });
    const g1 = ann(lsGross), n1 = ann(lsNet);
    $("#fcStats").innerHTML = [["RankIC 均值", icM.toFixed(4)], ["RankIC 标准差", icS.toFixed(4)], ["ICIR(月)", icir.toFixed(2)], ["IC 的 t 值", tstat.toFixed(2)], ["IC>0 占比", pct(pos, 0)],
      ["多空年化(毛)", pct(g1.r)], ["多空夏普(毛)", g1.sr.toFixed(2)], ["多空年化(扣成本)", pct(n1.r)], ["多空夏普(扣成本)", n1.sr.toFixed(2)], ["头部组月均换手", pct(mean(turnTop.slice(1)), 0)]]
      .map(it => '<div class="stat"><div class="k">' + it[0] + '</div><div class="v">' + it[1] + "</div></div>").join("");
    const labels = ics.map((_, i) => "第" + (i + 1) + "月");
    let c = 0; const cum = ics.map(x => (c += x));
    mk("fcICChart", { type: "bar", data: { labels, datasets: [
      { label: "每月 RankIC", data: ics, backgroundColor: ics.map(x => x >= 0 ? "rgba(37,99,235,.65)" : "rgba(220,38,38,.65)"), yAxisID: "y" },
      { label: "累计 RankIC(右轴)", data: cum, type: "line", borderColor: "#f59e0b", backgroundColor: "#f59e0b", pointRadius: 0, borderWidth: 2, yAxisID: "y1" }] },
      options: baseOpts({ scales: { x: { ticks: { color: css("--muted"), maxTicksLimit: 10 }, grid: { color: css("--border") } }, y: { position: "left", ticks: { color: css("--muted") }, grid: { color: css("--border") } }, y1: { position: "right", ticks: { color: css("--muted") }, grid: { drawOnChartArea: false } } } }) });
    mk("fcQbar", { type: "bar", data: { labels: qret.map((_, q) => "第" + (q + 1) + "组"), datasets: [{ label: "月均收益 %(组1=因子最小,组" + Q + "=最大)", data: qret.map(a => mean(a) * 100), backgroundColor: qret.map((_, q) => PALETTE[q % PALETTE.length]) }] }, options: baseOpts() });
    const cumc = a => { let v = 1; return a.map(x => (v *= 1 + x)); };
    mk("fcCum", { type: "line", data: { labels, datasets: [
      ...qret.map((a, q) => ({ label: "组" + (q + 1), data: cumc(a), borderColor: PALETTE[q % PALETTE.length], backgroundColor: PALETTE[q % PALETTE.length], pointRadius: 0, borderWidth: 1.4 })),
      { label: "多空(毛)", data: cumc(lsGross), borderColor: css("--text"), backgroundColor: css("--text"), borderDash: [6, 3], pointRadius: 0, borderWidth: 2 },
      { label: "多空(扣成本)", data: cumc(lsNet), borderColor: "#dc2626", backgroundColor: "#dc2626", pointRadius: 0, borderWidth: 2 }] }, options: baseOpts() });
  }

  /* =====================================================================
     演示 3:多重检验与 Deflated Sharpe
     ===================================================================== */
  function runMulti() {
    const N = +$("#mtN").value, Y = +$("#mtY").value, srTrue = +$("#mtSR").value / 100, seed = +$("#mtSeed").value;
    $("#mtNV").textContent = N; $("#mtYV").textContent = Y + " 年"; $("#mtSRV").textContent = srTrue.toFixed(2); $("#mtSeedV").textContent = seed;
    const T = Y * 252, g = gaussFactory(mulberry32(seed));
    // 夏普的抽样分布:年化样本夏普 ≈ 真实夏普 + N(0, 1/年数)(正态收益近似)
    const srs = []; for (let k = 0; k < N; k++) srs.push(g() / Math.sqrt(Y));
    const real = srTrue + g() / Math.sqrt(Y);
    const best = Math.max(...srs), above1 = srs.filter(x => x > 1).length;
    const gam = 0.5772156649, sd = 1 / Math.sqrt(Y);
    const eMax = N > 1 ? sd * ((1 - gam) * normInv(1 - 1 / N) + gam * normInv(1 - 1 / (N * Math.E))) : 0;
    const psr = (srA, bench) => { const sp = srA / Math.sqrt(252); return normCdf((sp - bench / Math.sqrt(252)) * Math.sqrt(T - 1) / Math.sqrt(1 + 0.5 * sp * sp)); }; // 正态收益下的 PSR(换算成每日夏普口径)
    const pBest = 2 * (1 - normCdf(best * Math.sqrt(Y)));
    $("#mtStats").innerHTML = [["噪声策略中最高夏普", best.toFixed(2)], ["夏普>1 的噪声策略数", above1 + " / " + N], ["纯运气最大夏普期望 E[max]", eMax.toFixed(2)],
      ["最高者未校正 p 值", pBest < 1e-4 ? "<0.0001" : pBest.toFixed(4)], ["最高者 Bonferroni 校正后", Math.min(1, pBest * N).toFixed(3)], ["最高者 DSR", psr(best, eMax).toFixed(2)],
      ["真实策略样本夏普", real.toFixed(2)], ["真实策略 PSR(0)", psr(real, 0).toFixed(3)], ["真实策略 DSR", psr(real, eMax).toFixed(2)]]
      .map(it => '<div class="stat"><div class="k">' + it[0] + '</div><div class="v">' + it[1] + "</div></div>").join("");
    const lo = Math.min(-3, ...srs, real) , hi = Math.max(3, ...srs, real), bins = 40, w = (hi - lo) / bins, h = new Array(bins).fill(0);
    srs.forEach(x => { h[Math.min(bins - 1, Math.floor((x - lo) / w))]++; });
    const labels = h.map((_, i) => (lo + (i + 0.5) * w).toFixed(2));
    const mark = v => h.map((_, i) => (v >= lo + i * w && v < lo + (i + 1) * w) ? Math.max(...h) * 1.05 : null);
    mk("mtHist", { type: "bar", data: { labels, datasets: [
      { label: "噪声策略的年化夏普分布(个数)", data: h, backgroundColor: "rgba(100,116,139,.6)" },
      { label: "运气最大值期望 E[max]", data: mark(eMax), backgroundColor: "#f59e0b" },
      { label: "真实策略的样本夏普", data: mark(real), backgroundColor: "#16a34a" }] },
      options: baseOpts({ scales: { x: { stacked: true, title: { display: true, text: "年化夏普" }, ticks: { color: css("--muted"), maxTicksLimit: 12 }, grid: { color: css("--border") } }, y: { stacked: false, ticks: { color: css("--muted") }, grid: { color: css("--border") } } } }) });
  }

  /* ---------- demo 注册 ---------- */
  const ready = {};
  const DEMO_RUN = { "demo-frontier": runFrontier, "demo-factor": runFactor, "demo-multi": runMulti };
  const DEMO_INIT = {};
  Object.keys(DEMO_RUN).forEach(id => {
    DEMO_INIT[id] = () => {
      if (!window.Chart) { $("#" + id + " .stats").innerHTML = '<div class="callout bad">图表库加载失败。</div>'; return; }
      if (!ready[id]) {
        ready[id] = true; bindControls("#" + id, DEMO_RUN[id]);
        const b = $("#" + id + " .reseed"); if (b) b.addEventListener("click", () => { const s = $("#" + id + " input.seed"); s.value = 1 + Math.floor(Math.random() * 999); DEMO_RUN[id](); });
      }
      DEMO_RUN[id]();
    };
  });
  function rerenderActiveDemo() { if (ready[current]) DEMO_RUN[current](); }

  renderProgress();
  route();
})();

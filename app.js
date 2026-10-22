(function () {
  "use strict";
  const CHAPTERS = ["ch1", "ch2", "ch3", "ch4", "ch5", "ch6", "ch7", "ch8"];
  const PAGES = ["home", ...CHAPTERS, "demo", "glossary"];
  const TITLES = {};
  const LS_PROGRESS = "ql-progress", LS_THEME = "ql-theme", LS_QUIZ = "ql-quiz";
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
    if (demoReady) runDemo();
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
    if (confirm("确定要清空学习进度和测验记录吗?")) {
      progress = {}; save(LS_PROGRESS, progress); save(LS_QUIZ, {});
      $$(".quiz").forEach(buildQuiz); renderProgress();
    }
  });

  /* ---------- page footer (prev/next + mark) ---------- */
  $$("section.page").forEach(sec => { const h = $("h1", sec); TITLES[sec.id] = h ? h.textContent : sec.id; });
  CHAPTERS.forEach((c, i) => {
    const sec = document.getElementById(c);
    const foot = document.createElement("div");
    foot.className = "page-foot";
    const prev = i > 0 ? CHAPTERS[i - 1] : "home";
    const next = i < CHAPTERS.length - 1 ? CHAPTERS[i + 1] : "demo";
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
    let html = '<h2>📝 本章小测验</h2>';
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
  function renderGloss(filter) {
    const f = (filter || "").trim().toLowerCase();
    const list = (window.GLOSSARY || []).filter(g => !f || g.join(" ").toLowerCase().includes(f));
    $("#glossList").innerHTML = list.length ? list.map(g =>
      "<dt>" + g[0] + "</dt><dd>" + g[2] + ' <span class="en">(' + g[1] + ")</span></dd>").join("") : "<p>没有匹配的术语。</p>";
  }
  renderGloss("");
  $("#glossSearch").addEventListener("input", e => renderGloss(e.target.value));

  /* ---------- router + mobile menu ---------- */
  const sidebar = $("#sidebar"), backdrop = $("#backdrop");
  function closeMenu() { sidebar.classList.remove("open"); backdrop.classList.remove("show"); }
  $("#menuBtn").addEventListener("click", () => { sidebar.classList.toggle("open"); backdrop.classList.toggle("show"); });
  backdrop.addEventListener("click", closeMenu);
  function route() {
    let id = (location.hash || "#home").slice(1);
    if (!PAGES.includes(id)) id = "home";
    $$("section.page").forEach(s => s.classList.toggle("active", s.id === id));
    $$("nav.sidebar a[data-page]").forEach(a => a.classList.toggle("active", a.dataset.page === id));
    document.title = (id === "home" ? "" : TITLES[id] + " · ") + "量化交易入门";
    closeMenu(); window.scrollTo({ top: 0, behavior: "instant" }); setTimeout(() => window.scrollTo({ top: 0, behavior: "instant" }), 0);
    if (id === "demo") initDemo();
  }
  window.addEventListener("hashchange", route);

  /* ---------- demo: MA crossover on simulated GBM ---------- */
  let demoReady = false, charts = {};
  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function genPrices(n, mu, sigma, seed) {
    const rnd = mulberry32(seed), dt = 1 / 252, p = [100];
    for (let i = 1; i < n; i++) {
      const u1 = Math.max(rnd(), 1e-12), u2 = rnd();
      const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      p.push(p[i - 1] * Math.exp((mu - 0.5 * sigma * sigma) * dt + sigma * Math.sqrt(dt) * z));
    }
    return p;
  }
  function sma(arr, n) { const out = new Array(arr.length).fill(null); let s = 0; for (let i = 0; i < arr.length; i++) { s += arr[i]; if (i >= n) s -= arr[i - n]; if (i >= n - 1) out[i] = s / n; } return out; }
  function stats(rets, equity) {
    const n = rets.length, mean = rets.reduce((a, b) => a + b, 0) / n;
    const sd = Math.sqrt(rets.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1));
    let peak = -Infinity, mdd = 0; const dd = equity.map(v => { peak = Math.max(peak, v); const d = v / peak - 1; mdd = Math.min(mdd, d); return d; });
    const total = equity[equity.length - 1] - 1;
    return { total, cagr: Math.pow(equity[equity.length - 1], 252 / n) - 1, vol: sd * Math.sqrt(252), sharpe: sd > 0 ? mean / sd * Math.sqrt(252) : 0, mdd, dd };
  }
  const pct = (x, d = 1) => (x * 100).toFixed(d) + "%";
  function css(v) { return getComputedStyle(document.documentElement).getPropertyValue(v).trim(); }

  function runDemo() {
    const fast = +$("#inFast").value, slow = +$("#inSlow").value, cost = +$("#inCost").value / 10000;
    const mu = +$("#inDrift").value / 100, vol = +$("#inVol").value / 100, seed = +$("#inSeed").value;
    $("#vFast").textContent = fast; $("#vSlow").textContent = slow; $("#vCost").textContent = (cost * 100).toFixed(2) + "%";
    $("#vDrift").textContent = $("#inDrift").value + "%"; $("#vVol").textContent = $("#inVol").value + "%"; $("#vSeed").textContent = seed;
    const N = 756, P = genPrices(N, mu, vol, seed), F = sma(P, fast), S = sma(P, slow);
    const sig = P.map((_, i) => (F[i] != null && S[i] != null && F[i] > S[i]) ? 1 : 0);
    const sRet = [], bRet = [], eqS = [1], eqB = [1], buys = new Array(N).fill(null), sells = new Array(N).fill(null);
    let trades = 0, inMkt = 0;
    for (let i = 1; i < N; i++) {
      const r = P[i] / P[i - 1] - 1, pos = sig[i - 1], prevPos = i >= 2 ? sig[i - 2] : 0;
      const tc = Math.abs(pos - prevPos) * cost;
      if (pos !== prevPos) { trades++; if (pos > prevPos) buys[i - 1] = P[i - 1]; else sells[i - 1] = P[i - 1]; }
      inMkt += pos;
      const sr = pos * r - tc; sRet.push(sr); bRet.push(r);
      eqS.push(eqS[i - 1] * (1 + sr)); eqB.push(eqB[i - 1] * (1 + r));
    }
    const st = stats(sRet, eqS), bt = stats(bRet, eqB);
    const cls = x => x >= 0 ? "pos" : "neg";
    const items = [
      ["策略总收益", pct(st.total), cls(st.total)], ["买入持有总收益", pct(bt.total), cls(bt.total)],
      ["策略年化收益", pct(st.cagr), cls(st.cagr)], ["策略年化波动", pct(st.vol), ""],
      ["策略夏普", st.sharpe.toFixed(2), cls(st.sharpe)], ["买入持有夏普", bt.sharpe.toFixed(2), cls(bt.sharpe)],
      ["策略最大回撤", pct(st.mdd), "neg"], ["买入持有最大回撤", pct(bt.mdd), "neg"],
      ["交易次数(买+卖)", String(trades), ""], ["持仓时间占比", pct(inMkt / (N - 1), 0), ""]
    ];
    $("#demoStats").innerHTML = (fast >= slow ? '<div class="callout warn" style="grid-column:1/-1;margin:0">提示:短均线周期应小于长均线周期,否则信号含义相反。</div>' : "") +
      items.map(it => '<div class="stat"><div class="k">' + it[0] + '</div><div class="v ' + it[2] + '">' + it[1] + "</div></div>").join("");

    const labels = P.map((_, i) => "第" + (i + 1) + "天");
    const text = css("--text"), grid = css("--border"), muted = css("--muted");
    Chart.defaults.color = muted; Chart.defaults.borderColor = grid;
    const base = (extra) => Object.assign({ responsive: true, maintainAspectRatio: false, animation: false, interaction: { mode: "index", intersect: false },
      plugins: { legend: { labels: { color: text, boxWidth: 14 } } }, scales: { x: { ticks: { maxTicksLimit: 8, color: muted }, grid: { color: grid } }, y: { ticks: { color: muted }, grid: { color: grid } } } }, extra || {});
    const line = (label, data, color, w) => ({ label, data, borderColor: color, backgroundColor: color, borderWidth: w || 1.5, pointRadius: 0, tension: 0, spanGaps: false });
    const mk = (id, cfg) => { if (charts[id]) charts[id].destroy(); charts[id] = new Chart(document.getElementById(id), cfg); };
    mk("priceChart", { type: "line", data: { labels, datasets: [
      line("模拟价格", P, "#64748b", 1.2), line("短均线 SMA" + fast, F, "#f59e0b"), line("长均线 SMA" + slow, S, "#3b82f6"),
      { label: "买入", data: buys, showLine: false, pointStyle: "triangle", pointRadius: 7, pointHoverRadius: 8, backgroundColor: "#dc2626", borderColor: "#dc2626" },
      { label: "卖出", data: sells, showLine: false, pointStyle: "triangle", rotation: 180, pointRadius: 7, pointHoverRadius: 8, backgroundColor: "#16a34a", borderColor: "#16a34a" }
    ] }, options: base() });
    mk("equityChart", { type: "line", data: { labels, datasets: [line("均线策略净值", eqS, "#8b5cf6", 2), line("买入持有净值", eqB, "#64748b", 1.5)] }, options: base() });
    mk("ddChart", { type: "line", data: { labels, datasets: [Object.assign(line("策略回撤", st.dd, "#dc2626", 1), { fill: true, backgroundColor: "rgba(220,38,38,0.25)" })] },
      options: base({ scales: { x: { ticks: { maxTicksLimit: 8, color: muted }, grid: { color: grid } }, y: { ticks: { color: muted, callback: v => (v * 100).toFixed(0) + "%" }, grid: { color: grid } } } }) });
  }
  function initDemo() {
    if (!window.Chart) { $("#demoStats").innerHTML = '<div class="callout bad">图表库加载失败。</div>'; return; }
    if (!demoReady) {
      demoReady = true;
      let timer; const deb = () => { clearTimeout(timer); timer = setTimeout(runDemo, 60); };
      $$("#demo input[type=range]").forEach(inp => inp.addEventListener("input", deb));
      $("#btnNewSeed").addEventListener("click", () => { $("#inSeed").value = 1 + Math.floor(Math.random() * 500); runDemo(); });
    }
    runDemo();
  }

  renderProgress();
  route();
})();

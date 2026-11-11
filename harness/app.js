(function () {
  "use strict";
  const CHAPTERS = ["ch1", "ch2", "ch3", "ch4", "ch5", "ch6", "ch7", "ch8", "ch9", "ch10", "ch11", "ch12", "ch13", "ch14"];
  const PAGES = ["home", ...CHAPTERS, "arcade", "glossary", "resources"];
  const TITLES = {};
  // 本站独立的存储前缀 hl-*,不会和同域名下其它学习站的进度互相干扰
  const LS_PROGRESS = "hl-progress", LS_THEME = "hl-theme", LS_QUIZ = "hl-quiz";
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
    document.dispatchEvent(new CustomEvent("hl:theme"));
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
    if (confirm("确定要清空本站的学习进度、测验记录、经验值和闯关记录吗?")) {
      progress = {}; save(LS_PROGRESS, progress); save(LS_QUIZ, {});
      ["hl-xp", "hl-pred", "hl-game"].forEach(k => { try { localStorage.removeItem(k); } catch (e) {} });
      location.hash = "#home"; location.reload();
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
  const ORDER = ["home", ...CHAPTERS];
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
  const CHNAME = {}; CHAPTERS.forEach((c, i) => { CHNAME[c] = "第" + (i + 1) + "章"; });
  function renderGloss(filter) {
    const f = (filter || "").trim().toLowerCase();
    const list = (window.GLOSSARY || []).filter(g => !f || g.join(" ").toLowerCase().includes(f));
    $("#glossCount").textContent = "共 " + (window.GLOSSARY || []).length + " 个术语" + (f ? ",匹配 " + list.length + " 个" : "");
    $("#glossList").innerHTML = list.length ? list.map(g =>
      "<dt>" + g[0] + (g[3] ? ' <a class="chap-tag" href="#' + g[3] + '">' + CHNAME[g[3]] + "</a>" : "") +
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
    document.title = (id === "home" ? "" : TITLES[id] + " · ") + "Agent Harness 学习站";
    closeMenu(); const top = () => window.scrollTo({ top: 0, behavior: "instant" });
    top(); setTimeout(top, 0); requestAnimationFrame(() => requestAnimationFrame(top));
    document.dispatchEvent(new CustomEvent("hl:page", { detail: id }));
  }
  window.addEventListener("hashchange", route);
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  window.addEventListener("load", () => { window.scrollTo(0, 0); setTimeout(() => window.scrollTo(0, 0), 50); });

  renderProgress();
  route();
})();

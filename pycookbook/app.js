/* Python Cookbook 中文阅读器 —— 纯前端，数据保存在 localStorage（pcb-*） */
(function () {
  'use strict';
  var TOC = window.PCB_TOC || [];
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var LS = {
    get: function (k, d) { try { var v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { toast('无法保存到本地存储'); } }
  };
  if (window.hljs) hljs.configure({ ignoreUnescapedHTML: true });

  /* ---------- 目录索引 ---------- */
  var pages = [], chapById = {};
  TOC.forEach(function (ch) {
    chapById[ch.id] = ch;
    ch.items.forEach(function (it) { pages.push({ c: ch.id, r: it.id, title: it.title, chTitle: ch.title }); });
  });
  function pageIndex(c, r) { for (var i = 0; i < pages.length; i++) if (pages[i].c === c && pages[i].r === r) return i; return -1; }
  function findPage(c, r) { var i = pageIndex(c, r); return i < 0 ? null : pages[i]; }

  /* ---------- 内容按章懒加载（script 注入，file:// 和 GitHub Pages 都能用） ---------- */
  var cache = {}, pending = {};
  window.PCB_LOAD = function (data) { cache[data.id] = data; (pending[data.id] || []).forEach(function (f) { f[0](data); }); delete pending[data.id]; };
  function loadChapter(cid) {
    return new Promise(function (res, rej) {
      if (cache[cid]) return res(cache[cid]);
      if (pending[cid]) { pending[cid].push([res, rej]); return; }
      pending[cid] = [[res, rej]];
      var s = document.createElement('script');
      s.src = 'content/' + cid + '.js';
      s.onerror = function () { (pending[cid] || []).forEach(function (f) { f[1](new Error('load ' + cid)); }); delete pending[cid]; };
      document.head.appendChild(s);
    });
  }
  var searchLoaded = null;
  function loadSearch() {
    if (searchLoaded) return searchLoaded;
    searchLoaded = new Promise(function (res, rej) {
      if (window.PCB_SEARCH) return res();
      var s = document.createElement('script'); s.src = 'search-index.js';
      s.onload = function () {
        window.PCB_SEARCH.forEach(function (e) { e.push((e[2] + ' ' + e[3]).toLowerCase()); });
        res();
      };
      s.onerror = rej; document.head.appendChild(s);
    });
    return searchLoaded;
  }

  /* ---------- 存储 ---------- */
  var bookmarks = LS.get('pcb-bookmarks', []);
  if (!Array.isArray(bookmarks)) bookmarks = [];
  var readMap = LS.get('pcb-read', {}) || {};
  var tocOpen = LS.get('pcb-toc-open', []) || [];
  function saveBm() { LS.set('pcb-bookmarks', bookmarks); renderBmList(); updateBmBadges(); }
  function bmId(c, r, b) { return c + '/' + r + (b != null ? '#' + b : ''); }
  function findBm(id) { for (var i = 0; i < bookmarks.length; i++) if (bookmarks[i].id === id) return i; return -1; }

  /* ---------- 小工具 ---------- */
  var toastTimer;
  function toast(msg) { var t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.hidden = true; }, 1800); }
  function fmtTime(t) { var d = new Date(t), p = function (n) { return (n < 10 ? '0' : '') + n; }; return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes()); }
  function chProgress(ch) { var n = 0; ch.items.forEach(function (it) { if (readMap[ch.id + '/' + it.id]) n++; }); return n; }

  /* ---------- 侧边栏目录 ---------- */
  function renderToc() {
    var h = '';
    TOC.forEach(function (ch) {
      var done = chProgress(ch), tot = ch.items.length, open = tocOpen.indexOf(ch.id) >= 0;
      h += '<div class="ch' + (open ? ' open' : '') + '" data-c="' + ch.id + '">' +
        '<div class="ch-head" role="button" tabindex="0"><span class="ch-caret">▶</span><span class="ch-title">' + esc(ch.title) + '</span><span class="ch-prog">' + done + '/' + tot + '</span></div>' +
        '<div class="ch-bar"><i style="width:' + (tot ? Math.round(done * 100 / tot) : 0) + '%"></i></div><ul class="ch-items">';
      if (ch.id !== 'c00' && ch.items.length > 1) h += '<li><a href="#/' + ch.id + '" data-key="' + ch.id + '"><span class="rd">≡</span><span>本章概述</span></a></li>';
      ch.items.forEach(function (it) {
        var k = ch.id + '/' + it.id;
        h += '<li><a href="#/' + k + '" data-key="' + k + '"><span class="rd">' + (readMap[k] ? '✓' : '') + '</span><span style="flex:1">' + esc(it.title) + '</span><span class="bmk"></span></a></li>';
      });
      h += '</ul></div>';
    });
    $('#toc').innerHTML = h;
    var total = pages.length, done = Object.keys(readMap).filter(function (k) { var p = k.split('/'); return findPage(p[0], p[1]); }).length;
    $('#overall-progress').textContent = '已读 ' + done + '/' + total;
    updateBmBadges(); markCurrent();
  }
  $('#toc').addEventListener('click', function (e) {
    var head = e.target.closest('.ch-head');
    if (head) { toggleCh(head.parentNode.dataset.c); return; }
    if (e.target.closest('a')) closeDrawer();
  });
  $('#toc').addEventListener('keydown', function (e) { var head = e.target.closest('.ch-head'); if (head && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); toggleCh(head.parentNode.dataset.c); } });
  function toggleCh(cid, force) {
    var el = $('.ch[data-c="' + cid + '"]'); if (!el) return;
    var open = force != null ? force : !el.classList.contains('open');
    el.classList.toggle('open', open);
    var i = tocOpen.indexOf(cid); if (open && i < 0) tocOpen.push(cid); if (!open && i >= 0) tocOpen.splice(i, 1);
    LS.set('pcb-toc-open', tocOpen);
  }
  $('#btn-expand-all').addEventListener('click', function () {
    var allOpen = $$('.ch').every(function (e) { return e.classList.contains('open'); });
    TOC.forEach(function (ch) { toggleCh(ch.id, !allOpen); });
    this.textContent = allOpen ? '全部展开' : '全部收起';
  });
  function markCurrent() {
    $$('#toc a.current').forEach(function (a) { a.classList.remove('current'); a.removeAttribute('aria-current'); });
    if (!route.c) return;
    var key = route.r ? route.c + '/' + route.r : route.c;
    var a = $('#toc a[data-key="' + key + '"]');
    if (a) {
      a.classList.add('current'); a.setAttribute('aria-current', 'page');
      toggleCh(route.c, true);
      var sb = $('#sidebar'), ar = a.getBoundingClientRect(), sr = sb.getBoundingClientRect();
      if (ar.top < sr.top + 40 || ar.bottom > sr.bottom - 20) sb.scrollTop += ar.top - sr.top - sr.height / 3;
    }
  }
  function updateBmBadges() {
    $('#bm-count').textContent = bookmarks.length;
    $('#bm-count').style.display = bookmarks.length ? '' : 'none';
    var has = {}; bookmarks.forEach(function (b) { has[b.c + '/' + b.r] = 1; });
    $$('#toc a[data-key]').forEach(function (a) { var s = $('.bmk', a); if (s) s.textContent = has[a.dataset.key] ? '🔖' : ''; });
  }

  /* ---------- 抽屉（移动端） ---------- */
  function closeDrawer() { document.body.classList.remove('toc-open'); syncOverlay(); }
  function syncOverlay() { document.body.classList.toggle('bm-open', !$('#bm-panel').hidden); $('#overlay').hidden = !(document.body.classList.contains('toc-open') || (!$('#bm-panel').hidden && innerWidth <= 900)); }
  $('#btn-menu').addEventListener('click', function () { document.body.classList.toggle('toc-open'); syncOverlay(); });
  $('#overlay').addEventListener('click', function () { closeDrawer(); $('#bm-panel').hidden = true; syncOverlay(); });

  /* ---------- 路由 ---------- */
  var route = {};
  function parseHash() {
    var h = decodeURIComponent(location.hash.replace(/^#\/?/, ''));
    var q = {}, qi = h.indexOf('?');
    if (qi >= 0) { h.slice(qi + 1).split('&').forEach(function (kv) { var p = kv.split('='); q[p[0]] = p.slice(1).join('='); }); h = h.slice(0, qi); }
    var parts = h.split('/').filter(Boolean);
    return { c: parts[0] && /^c\d\d$/.test(parts[0]) ? parts[0] : null, r: parts[1] || null, page: parts[0] || '', q: q };
  }
  var pendingScroll = null, firstRoute = true;
  function onRoute() {
    route = parseHash();
    $('#search-results').hidden = true; document.body.classList.remove('search-open');
    var p;
    if (route.c && route.r && (p = findPage(route.c, route.r))) renderRecipe(p);
    else if (route.c && chapById[route.c] && chapById[route.c].items.length === 1) { location.replace('#/' + route.c + '/' + chapById[route.c].items[0].id); return; }
    else if (route.c && chapById[route.c]) renderChapter(chapById[route.c]);
    else if (route.page === 'about') renderAbout();
    else renderHome();
    markCurrent();
    if (firstRoute) { firstRoute = false; maybeShowResume(); } else $('#resume').hidden = true;
  }
  window.addEventListener('hashchange', onRoute);
  function go(hash) { if (location.hash === hash) onRoute(); else location.hash = hash; }

  /* ---------- 页面：首页 ---------- */
  function chapterCards() {
    return '<div class="grid">' + TOC.map(function (ch) {
      var d = chProgress(ch), t = ch.items.length;
      return '<a class="card" href="#/' + ch.id + (ch.id === 'c00' || ch.items.length === 1 ? '/' + ch.items[0].id : '') + '"><div class="ct">' + esc(ch.title) + '</div><div class="cm">' + t + ' 节 · 已读 ' + d + '</div><div class="ch-bar"><i style="width:' + Math.round(d * 100 / t) + '%"></i></div></a>';
    }).join('') + '</div>';
  }
  function renderHome() {
    document.title = 'Python Cookbook 第三版 · 中文在线阅读';
    var nrec = pages.filter(function (p) { return /^c(0[1-9]|1[0-5])$/.test(p.c); }).length;
    $('#article').innerHTML = '<div class="home-hero"><h1>🐍 Python Cookbook 第三版（中文版）</h1>' +
      '<p class="muted" style="font-size:14px">David Beazley、Brian K. Jones 著 · 熊能 译 · 共 15 章 ' + nrec + ' 个小节（“秘籍”）＋附录</p>' +
      '<p>每个小节都是「问题 → 解决方案 → 讨论」的结构，可以按章顺序读，也可以用上方搜索直接找到想解决的问题。</p>' +
      '<p style="font-size:14px">小技巧：点每节标题旁的 <b>🔖 收藏本节</b> 加书签；把鼠标移到段落或代码左侧可以收藏<b>某一段</b>；读完点 <b>✓ 标记已读</b>，左侧目录会显示每章进度。书签可在右上角 🔖 面板里写笔记、导出/导入。</p>' +
      '<div class="rec-actions"><a class="btn primary" href="#/c01/p01">从第一章开始读</a><a class="btn" href="#/c00/preface">先看前言</a><a class="btn ghost" href="#/about">关于 & 许可证</a></div></div>' +
      chapterCards();
    window.scrollTo(0, 0);
  }

  /* ---------- 页面：关于 ---------- */
  function renderAbout() {
    document.title = '关于本站 · Python Cookbook 中文';
    $('#article').innerHTML = '<h1>关于本站</h1>' +
      '<p>这是《Python Cookbook》第三版中文译本的离线友好型网页阅读器。正文全部来自开源翻译项目 ' +
      '<a href="https://github.com/yidao620c/python3-cookbook" target="_blank" rel="noopener">yidao620c/python3-cookbook</a>' +
      '（在线版：<a href="https://python3-cookbook.readthedocs.io/zh_CN/latest/" target="_blank" rel="noopener">python3-cookbook.readthedocs.io</a>），' +
      '由熊能（Xiong Neng）及其他贡献者翻译，本站只把其 reStructuredText 源文件转换成了 HTML，并加上目录、搜索、书签、阅读进度等功能，未改动译文内容。</p>' +
      '<h2>许可证</h2>' +
      '<p>原项目声明：<br><code>Copyright (c) 2014-2018 Xiong Neng and other contributors</code><br>' +
      'Licensed under the Apache License, Version 2.0. 你可以在 <a href="http://www.apache.org/licenses/LICENSE-2.0" target="_blank" rel="noopener">apache.org/licenses/LICENSE-2.0</a> 或本站附带的 <a href="LICENSE-Apache-2.0.txt" target="_blank">LICENSE-Apache-2.0.txt</a> 查看许可证全文。' +
      '软件/内容按“原样”提供，不附带任何明示或暗示的担保。</p>' +
      '<p><b>本站所做的修改：</b>将 rst 源转换为 HTML；把译者照片的外链替换为本地文件；去掉 Sphinx 的 toctree 指令；新增阅读器界面与交互功能（app.js / style.css）。</p>' +
      '<h2>原书版权</h2><p>《Python Cookbook》3rd Edition，作者 David Beazley 与 Brian K. Jones，O’Reilly Media, Inc. 出版，Copyright © 2013 David Beazley and Brian Jones. 如果觉得有帮助，欢迎支持正版原书。</p>' +
      '<h2>第三方组件</h2><p>代码高亮：<a href="https://highlightjs.org/" target="_blank" rel="noopener">highlight.js</a> 11.x（BSD-3-Clause），已打包在本地 <code>vendor/</code> 目录，阅读时不需要访问外网。</p>' +
      '<h2>数据存储</h2><p>书签、笔记、已读标记、阅读位置、主题与字号都只保存在你自己浏览器的 localStorage（键名以 <code>pcb-</code> 开头），不会上传。换浏览器或清理缓存前，可以在书签面板里“导出 JSON”备份。</p>' +
      '<p><button class="btn" id="btn-clear-read">清空已读标记</button></p>';
    $('#btn-clear-read').onclick = function () { if (confirm('确定清空所有已读标记？')) { readMap = {}; LS.set('pcb-read', readMap); renderToc(); toast('已清空'); } };
    window.scrollTo(0, 0);
  }

  /* ---------- 页面：章节概述 ---------- */
  function renderChapter(ch) {
    document.title = ch.title + ' · Python Cookbook 中文';
    $('#article').innerHTML = '<p class="muted">加载中…</p>';
    loadChapter(ch.id).then(function (data) {
      var list = '<ul class="rlist">' + ch.items.map(function (it) {
        var k = ch.id + '/' + it.id; return '<li><span class="ok">' + (readMap[k] ? '✓ ' : '　') + '</span><a href="#/' + k + '">' + esc(it.title) + '</a></li>';
      }).join('') + '</ul>';
      var d = chProgress(ch);
      $('#article').innerHTML = '<div class="crumb"><a href="#/">首页</a></div><h1>' + esc(ch.title) + '</h1>' +
        '<div class="content">' + (data.intro || '') + '</div>' +
        '<div class="rec-actions"><a class="btn primary" href="#/' + ch.id + '/' + ch.items[0].id + '">开始阅读本章</a><span class="muted" style="align-self:center">本章 ' + ch.items.length + ' 节，已读 ' + d + '</span></div>' +
        '<h2>本章小节</h2>' + list;
      window.scrollTo(0, 0);
    }).catch(loadFail);
  }
  function loadFail() { $('#article').innerHTML = '<p>内容加载失败，请刷新重试。</p>'; }

  /* ---------- 页面：小节 ---------- */
  function renderRecipe(p) {
    document.title = p.title + ' · Python Cookbook 中文';
    var idx = pageIndex(p.c, p.r), prev = pages[idx - 1], next = pages[idx + 1];
    loadChapter(p.c).then(function (data) {
      if (route.c !== p.c || route.r !== p.r) return;
      var it = data.items[p.r];
      var key = p.c + '/' + p.r;
      $('#article').innerHTML =
        '<div class="crumb"><a href="#/">首页</a> › <a href="#/' + p.c + '">' + esc(p.chTitle) + '</a></div>' +
        '<h1 id="rec-title">' + esc(p.title) + '</h1>' +
        '<div class="rec-actions"><button class="btn" id="btn-page-bm"></button><button class="btn" id="btn-read"></button></div>' +
        '<div class="content" id="content">' + it.html + '</div>' +
        '<div class="rec-actions" style="margin-top:28px"><button class="btn" id="btn-read2"></button></div>' +
        '<nav class="pager">' +
        (prev ? '<a class="prev" href="#/' + prev.c + '/' + prev.r + '"><small>← 上一节</small>' + esc(prev.title) + '</a>' : '<span></span>') +
        (next ? '<a class="next" id="next-link" href="#/' + next.c + '/' + next.r + '"><small>下一节 →</small>' + esc(next.title) + '</a>' : '<span></span>') +
        '</nav>';
      var content = $('#content');
      // 代码高亮 + 复制按钮
      $$('pre', content).forEach(function (pre) {
        var code = pre.querySelector('code');
        if (!code) { code = document.createElement('code'); code.textContent = pre.textContent; pre.textContent = ''; pre.appendChild(code); }
        var lang = ['python', 'c', 'bash', 'xml', 'text'].filter(function (l) { return pre.classList.contains(l); })[0] || 'python';
        code.className = 'language-' + (lang === 'text' ? 'plaintext' : lang);
        if (window.hljs) try { hljs.highlightElement(code); } catch (e) {}
        var b = document.createElement('button'); b.className = 'copy-btn'; b.type = 'button'; b.textContent = '复制';
        b.onclick = function () { copyText(code.textContent); };
        pre.appendChild(b);
      });
      $$('a[href^="http"]', content).forEach(function (a) { a.target = '_blank'; a.rel = 'noopener'; });
      // 可收藏的块编号
      $$('h2,h3,h4,p,pre,table,blockquote', content).forEach(function (el, i) { el.dataset.b = i; });
      $$('h2,h3,h4', content).forEach(function (h) {
        var b = document.createElement('button'); b.className = 'hbm'; b.type = 'button'; b.title = '收藏这个小标题'; b.textContent = '🔖';
        b.onclick = function (e) { e.stopPropagation(); toggleBlockBm(h); };
        h.appendChild(b);
      });
      $('#btn-page-bm').onclick = function () { togglePageBm(); };
      $('#btn-read').onclick = $('#btn-read2').onclick = function () { toggleRead(key); };
      var nl = $('#next-link'); if (nl) nl.addEventListener('click', function () { if (!readMap[key]) { readMap[key] = Date.now(); LS.set('pcb-read', readMap); renderToc(); } });
      refreshRecipeState();
      // 定位
      if (pendingScroll != null) { var y = pendingScroll; pendingScroll = null; requestAnimationFrame(function () { window.scrollTo(0, y); }); }
      else if (route.q.b != null) { var t = content.querySelector('[data-b="' + route.q.b + '"]'); if (t) { requestAnimationFrame(function () { t.scrollIntoView({ block: 'center' }); t.classList.add('bm-target'); }); } else window.scrollTo(0, 0); }
      else if (route.q.q) { var m = highlightTerms(content, route.q.q.split(/\s+/)); if (m) requestAnimationFrame(function () { m.scrollIntoView({ block: 'center' }); }); else window.scrollTo(0, 0); }
      else window.scrollTo(0, 0);
      saveLast();
    }).catch(loadFail);
  }
  function refreshRecipeState() {
    if (!route.c || !route.r || !$('#content')) return;
    var key = route.c + '/' + route.r, on = findBm(bmId(route.c, route.r)) >= 0, rd = !!readMap[key];
    var b = $('#btn-page-bm'); if (b) { b.classList.toggle('on', on); b.textContent = on ? '🔖 已收藏（点击取消）' : '🔖 收藏本节'; }
    ['#btn-read', '#btn-read2'].forEach(function (s) { var e = $(s); if (e) { e.classList.toggle('on', rd); e.textContent = rd ? '✓ 已读（点击取消）' : '✓ 标记为已读'; } });
    var set = {}; bookmarks.forEach(function (bm) { if (bm.c === route.c && bm.r === route.r && bm.b != null) set[bm.b] = 1; });
    $$('#content [data-b]').forEach(function (el) {
      var is = !!set[el.dataset.b]; el.classList.toggle('is-bm', is);
      var hb = el.querySelector(':scope > .hbm'); if (hb) { hb.classList.toggle('on', is); hb.title = is ? '取消收藏' : '收藏这个小标题'; }
    });
  }
  function toggleRead(key) {
    if (readMap[key]) delete readMap[key]; else readMap[key] = Date.now();
    LS.set('pcb-read', readMap); renderToc(); refreshRecipeState();
    toast(readMap[key] ? '已标记为已读' : '已取消已读');
  }
  function copyText(t) {
    var done = function () { toast('代码已复制'); };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(t).then(done, fallback); else fallback();
    function fallback() { var ta = document.createElement('textarea'); ta.value = t; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); done(); } catch (e) {} ta.remove(); }
  }
  function highlightTerms(root, terms) {
    terms = terms.filter(Boolean).map(function (t) { return t.toLowerCase(); }); if (!terms.length) return null;
    var re = new RegExp('(' + terms.map(function (t) { return t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }).join('|') + ')', 'gi');
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null), nodes = [], n;
    while ((n = walker.nextNode())) if (re.test(n.nodeValue) && !n.parentNode.closest('button')) nodes.push(n);
    var first = null;
    nodes.forEach(function (node) {
      var frag = document.createDocumentFragment(), parts = node.nodeValue.split(re);
      parts.forEach(function (s, i) { if (i % 2) { var m = document.createElement('mark'); m.textContent = s; frag.appendChild(m); if (!first) first = m; } else if (s) frag.appendChild(document.createTextNode(s)); });
      node.parentNode.replaceChild(frag, node);
    });
    return first;
  }

  /* ---------- 书签 ---------- */
  function excerptOf(el) {
    var c = el.cloneNode(true); $$('button', c).forEach(function (b) { b.remove(); });
    var t = c.textContent.replace(/\s+/g, ' ').trim(); return t.length > 90 ? t.slice(0, 90) + '…' : t;
  }
  function togglePageBm() {
    var p = findPage(route.c, route.r); if (!p) { toast('请先打开一个小节'); return; }
    var id = bmId(p.c, p.r), i = findBm(id);
    if (i >= 0) { bookmarks.splice(i, 1); toast('已取消收藏'); }
    else { bookmarks.unshift({ id: id, c: p.c, r: p.r, b: null, title: p.title, chTitle: p.chTitle, excerpt: '', note: '', t: Date.now() }); toast('已加入书签'); }
    saveBm(); refreshRecipeState();
  }
  function toggleBlockBm(el) {
    var p = findPage(route.c, route.r); if (!p) return;
    var b = +el.dataset.b, id = bmId(p.c, p.r, b), i = findBm(id);
    if (i >= 0) { bookmarks.splice(i, 1); toast('已取消这一段的书签'); }
    else {
      var isHead = /^H\d$/.test(el.tagName);
      bookmarks.unshift({ id: id, c: p.c, r: p.r, b: b, kind: isHead ? 'heading' : (el.tagName === 'PRE' ? 'code' : 'para'), title: p.title, chTitle: p.chTitle, excerpt: excerptOf(el), note: '', t: Date.now() });
      toast(isHead ? '已收藏这个小标题' : '已收藏这一段');
    }
    saveBm(); refreshRecipeState();
  }
  // 段落悬停收藏按钮
  var paraBtn = $('#para-bm'), hoverEl = null;
  function showParaBtn(el) {
    hoverEl = el; var r = el.getBoundingClientRect(), art = $('#article').getBoundingClientRect();
    paraBtn.style.top = (r.top + window.scrollY + 2) + 'px';
    paraBtn.style.left = Math.max(2, art.left - 30) + 'px';
    var on = findBm(bmId(route.c, route.r, +el.dataset.b)) >= 0;
    paraBtn.textContent = on ? '✖' : '🔖'; paraBtn.title = on ? '取消收藏这一段' : '收藏这一段';
    paraBtn.hidden = false;
  }
  document.addEventListener('mouseover', function (e) {
    if (e.target === paraBtn) return;
    var el = e.target.closest && e.target.closest('#content p[data-b], #content pre[data-b], #content table[data-b], #content blockquote[data-b]');
    if (el) showParaBtn(el); else if (!e.target.closest('#content')) paraBtn.hidden = true;
  });
  document.addEventListener('click', function (e) {
    var el = e.target.closest && e.target.closest('#content p[data-b], #content pre[data-b]');
    if (el && !e.target.closest('a,button') && window.matchMedia('(hover: none)').matches) showParaBtn(el);
  });
  paraBtn.addEventListener('click', function () { if (hoverEl) { toggleBlockBm(hoverEl); showParaBtn(hoverEl); } });

  function renderBmList() {
    var f = ($('#bm-filter').value || '').trim().toLowerCase();
    var list = bookmarks.slice().sort(function (a, b) { return b.t - a.t; }).filter(function (b) {
      return !f || (b.title + ' ' + b.chTitle + ' ' + (b.excerpt || '') + ' ' + (b.note || '')).toLowerCase().indexOf(f) >= 0;
    });
    if (!bookmarks.length) { $('#bm-list').innerHTML = '<div class="bm-empty">还没有书签。<br>在任意小节点「🔖 收藏本节」，<br>或把鼠标移到段落左侧点 🔖 收藏某一段。</div>'; return; }
    if (!list.length) { $('#bm-list').innerHTML = '<div class="bm-empty">没有匹配的书签</div>'; return; }
    $('#bm-list').innerHTML = list.map(function (b) {
      var kind = b.b == null ? '整节' : ({ heading: '小标题', code: '代码', para: '段落' }[b.kind] || '段落');
      return '<div class="bm-item" data-id="' + esc(b.id) + '">' +
        '<div class="bm-ch">' + esc(b.chTitle) + '</div>' +
        '<a class="bm-title" href="' + bmHref(b) + '">' + esc(b.title) + '</a>' +
        (b.excerpt ? '<div class="bm-ex">' + esc(b.excerpt) + '</div>' : '') +
        '<textarea class="bm-note" placeholder="写点笔记…（自动保存）" rows="1">' + esc(b.note || '') + '</textarea>' +
        '<div class="bm-meta"><span>' + kind + '</span><span>' + fmtTime(b.t) + '</span><span class="sp"></span>' +
        '<a class="link-btn bm-go" href="' + bmHref(b) + '">跳转</a><button class="link-btn bm-del" style="color:#d33">删除</button></div></div>';
    }).join('');
  }
  function bmHref(b) { return '#/' + b.c + '/' + b.r + (b.b != null ? '?b=' + b.b : ''); }
  $('#bm-list').addEventListener('click', function (e) {
    var item = e.target.closest('.bm-item'); if (!item) return;
    var id = item.dataset.id;
    if (e.target.closest('.bm-del')) { var i = findBm(id); if (i >= 0) { bookmarks.splice(i, 1); saveBm(); refreshRecipeState(); toast('书签已删除'); } return; }
    if (e.target.closest('a')) {
      e.preventDefault(); go(e.target.closest('a').getAttribute('href'));
      if (innerWidth <= 900) { $('#bm-panel').hidden = true; syncOverlay(); }
    }
  });
  var noteTimer;
  $('#bm-list').addEventListener('input', function (e) {
    if (!e.target.classList.contains('bm-note')) return;
    var i = findBm(e.target.closest('.bm-item').dataset.id); if (i < 0) return;
    bookmarks[i].note = e.target.value;
    clearTimeout(noteTimer); noteTimer = setTimeout(function () { LS.set('pcb-bookmarks', bookmarks); }, 300);
  });
  $('#bm-filter').addEventListener('input', renderBmList);
  $('#btn-bookmarks').addEventListener('click', function () { var p = $('#bm-panel'); p.hidden = !p.hidden; if (!p.hidden) renderBmList(); syncOverlay(); });
  $('#btn-bm-close').addEventListener('click', function () { $('#bm-panel').hidden = true; syncOverlay(); });
  $('#btn-bm-add').addEventListener('click', function () {
    if (!route.r) { toast('请先打开一个小节'); return; }
    if (findBm(bmId(route.c, route.r)) >= 0) { toast('本节已经在书签里了'); return; }
    togglePageBm();
  });
  $('#btn-bm-export').addEventListener('click', function () {
    var data = { app: 'pycookbook-reader', version: 1, exported: new Date().toISOString(), bookmarks: bookmarks, read: readMap };
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    var a = document.createElement('a'), d = new Date();
    a.href = URL.createObjectURL(blob); a.download = 'pycookbook-bookmarks-' + d.toISOString().slice(0, 10) + '.json';
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    toast('已导出 ' + bookmarks.length + ' 个书签');
  });
  $('#bm-import').addEventListener('change', function () {
    var file = this.files[0]; if (!file) return; var input = this;
    var fr = new FileReader();
    fr.onload = function () {
      try {
        var data = JSON.parse(fr.result), list = Array.isArray(data) ? data : data.bookmarks;
        if (!Array.isArray(list)) throw new Error('bad');
        var added = 0, updated = 0;
        list.forEach(function (b) {
          if (!b || !b.c || !b.r || !findPage(b.c, b.r)) return;
          var p = findPage(b.c, b.r), bb = (b.b == null || b.b === '') ? null : +b.b;
          var nb = { id: bmId(b.c, b.r, bb), c: b.c, r: b.r, b: bb, kind: b.kind, title: p.title, chTitle: p.chTitle, excerpt: String(b.excerpt || ''), note: String(b.note || ''), t: +b.t || Date.now() };
          var i = findBm(nb.id);
          if (i >= 0) { if (nb.note && nb.note !== bookmarks[i].note) { bookmarks[i].note = bookmarks[i].note ? bookmarks[i].note + '\n' + nb.note : nb.note; updated++; } }
          else { bookmarks.push(nb); added++; }
        });
        if (data.read && typeof data.read === 'object') { Object.keys(data.read).forEach(function (k) { if (!readMap[k]) readMap[k] = data.read[k]; }); LS.set('pcb-read', readMap); renderToc(); }
        saveBm(); refreshRecipeState();
        toast('导入完成：新增 ' + added + ' 个' + (updated ? '，合并笔记 ' + updated + ' 个' : ''));
      } catch (e) { toast('导入失败：不是有效的书签 JSON'); }
      input.value = '';
    };
    fr.readAsText(file);
  });

  /* ---------- 阅读位置 ---------- */
  var scrollTimer;
  function saveLast() {
    if (!route.c || !route.r) return;
    LS.set('pcb-last', { c: route.c, r: route.r, y: Math.round(window.scrollY), t: Date.now() });
  }
  window.addEventListener('scroll', function () { clearTimeout(scrollTimer); scrollTimer = setTimeout(saveLast, 250); if (!paraBtn.hidden && hoverEl && innerWidth > 900) showParaBtn(hoverEl); }, { passive: true });
  window.addEventListener('pagehide', saveLast);
  function maybeShowResume() {
    var last = LS.get('pcb-last', null), box = $('#resume');
    if (!last || !findPage(last.c, last.r)) return;
    if (route.c === last.c && route.r === last.r) {
      // 直接打开的就是上次那一节：自动回到上次位置
      if (!route.q.b && !route.q.q && last.y > 50) { box.hidden = true; pendingScroll = last.y; whenReady(function () { window.scrollTo(0, last.y); pendingScroll = null; }); toast('已回到上次阅读的位置'); }
      return;
    }
    if (route.c) return;
    var p = findPage(last.c, last.r);
    box.innerHTML = '<span>📖</span><div class="grow">上次读到：<b>' + esc(p.title) + '</b><br><span class="muted">' + esc(p.chTitle) + ' · ' + fmtTime(last.t) + '</span></div>' +
      '<button class="btn primary" id="btn-resume">继续阅读</button><button class="btn ghost" id="btn-resume-x">关闭</button>';
    box.hidden = false;
    $('#btn-resume').onclick = function () { box.hidden = true; pendingScroll = last.y; go('#/' + last.c + '/' + last.r); };
    $('#btn-resume-x').onclick = function () { box.hidden = true; };
  }
  function whenReady(fn) { var n = 0; (function chk() { if ($('#content') || n++ > 100) fn(); else setTimeout(chk, 50); })(); }

  /* ---------- 搜索 ---------- */
  var sInput = $('#search'), sBox = $('#search-results'), sTimer, sActive = -1;
  sInput.addEventListener('input', function () { clearTimeout(sTimer); sTimer = setTimeout(doSearch, 180); });
  sInput.addEventListener('focus', function () { loadSearch(); if (sInput.value.trim()) doSearch(); });
  sInput.addEventListener('keydown', function (e) {
    var items = $$('.sr-item', sBox);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); if (!items.length) return; sActive = (sActive + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length; items.forEach(function (it, i) { it.classList.toggle('active', i === sActive); }); items[sActive].scrollIntoView({ block: 'nearest' }); }
    else if (e.key === 'Enter') { var it = items[sActive >= 0 ? sActive : 0]; if (it) { go(it.getAttribute('href')); sInput.blur(); } }
    else if (e.key === 'Escape') { sBox.hidden = true; sInput.blur(); }
  });
  document.addEventListener('click', function (e) { if (!e.target.closest('.search-wrap') && !e.target.closest('#btn-search-m')) { sBox.hidden = true; document.body.classList.remove('search-open'); } });
  $('#btn-search-m').addEventListener('click', function () { document.body.classList.toggle('search-open'); if (document.body.classList.contains('search-open')) sInput.focus(); });
  function doSearch() {
    var q = sInput.value.trim();
    if (!q) { sBox.hidden = true; return; }
    loadSearch().then(function () {
      var terms = q.toLowerCase().split(/\s+/).filter(Boolean), res = [];
      window.PCB_SEARCH.forEach(function (e) {
        var hay = e[4], tl = e[2].toLowerCase(), score = 0;
        for (var i = 0; i < terms.length; i++) {
          var t = terms[i], pos = hay.indexOf(t); if (pos < 0) return;
          if (tl.indexOf(t) >= 0) score += 20;
          var cnt = 0, p = pos; while (p >= 0 && cnt < 20) { cnt++; p = hay.indexOf(t, p + t.length); } score += cnt;
        }
        res.push({ e: e, s: score });
      });
      res.sort(function (a, b) { return b.s - a.s; });
      sActive = -1;
      var qs = encodeURIComponent(terms.join(' '));
      sBox.innerHTML = '<div class="sr-head">找到 ' + res.length + ' 个小节' + (res.length > 50 ? '（显示前 50 个）' : '') + '</div>' +
        (res.length ? res.slice(0, 50).map(function (r) {
          var e = r.e, ch = chapById[e[0]];
          return '<a class="sr-item" href="#/' + e[0] + '/' + e[1] + '?q=' + qs + '"><div class="sr-ch">' + esc(ch ? ch.title : '') + '</div><div class="sr-title">' + hl(esc(e[2]), terms) + '</div><div class="sr-snip">' + snippet(e[3], terms) + '</div></a>';
        }).join('') : '<div class="sr-head">没有找到，换个关键词试试（多个词用空格分隔）</div>');
      sBox.hidden = false;
    });
  }
  function hl(s, terms) { var re = new RegExp('(' + terms.map(function (t) { return esc(t).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }).join('|') + ')', 'gi'); return s.replace(re, '<mark>$1</mark>'); }
  function snippet(text, terms) {
    var low = text.toLowerCase(), pos = -1;
    terms.forEach(function (t) { var p = low.indexOf(t); if (p >= 0 && (pos < 0 || p < pos)) pos = p; });
    if (pos < 0) pos = 0;
    var s = Math.max(0, pos - 30), str = (s > 0 ? '…' : '') + text.slice(s, pos + 70) + (pos + 70 < text.length ? '…' : '');
    return hl(esc(str), terms);
  }

  /* ---------- 主题 & 字号 ---------- */
  function applyTheme(t) {
    document.documentElement.dataset.theme = t;
    $('#hl-light').disabled = t === 'dark'; $('#hl-dark').disabled = t !== 'dark';
  }
  applyTheme(document.documentElement.dataset.theme || 'light');
  $('#btn-theme').addEventListener('click', function () { var t = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; applyTheme(t); localStorage.setItem('pcb-theme', t); });
  function fontSize() { return parseInt(getComputedStyle(document.documentElement).getPropertyValue('--fs')) || 17; }
  function setFont(n) { n = Math.max(14, Math.min(24, n)); document.documentElement.style.setProperty('--fs', n + 'px'); localStorage.setItem('pcb-font', n); toast('字号 ' + n + 'px'); }
  $('#btn-font-dec').addEventListener('click', function () { setFont(fontSize() - 1); });
  $('#btn-font-inc').addEventListener('click', function () { setFont(fontSize() + 1); });

  document.addEventListener('keydown', function (e) {
    if (e.target.matches('input,textarea')) return;
    if (e.key === 'Escape') { $('#bm-panel').hidden = true; closeDrawer(); syncOverlay(); }
    if (e.key === '/') { e.preventDefault(); if (innerWidth <= 640) document.body.classList.add('search-open'); sInput.focus(); }
    if (route.r && (e.key === 'ArrowLeft' || e.key === 'ArrowRight') && !e.altKey && !e.ctrlKey && !e.metaKey) {
      var a = $(e.key === 'ArrowLeft' ? '.pager .prev' : '.pager .next'); if (a) a.click();
    }
  });

  renderToc();
  renderBmList();
  onRoute();
})();

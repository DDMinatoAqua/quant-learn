/* 让页面上的每个 Python 代码块都可以编辑、在浏览器里运行(Pyodide),失败时回退到预先计算的输出 */
(function () {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const FILES = window.PYFILES || {}, EXTRA = window.PYEXTRA || {};
  let worker = null, seq = 0, busy = null, bootFailed = false;
  const blocks = $$(".runnable");
  function textOf(code) { return code.innerText.replace(/\u00a0/g, " ").replace(/\n$/, ""); }
  function rehighlight(code) { const t = textOf(code); code.textContent = t; if (window.hljs) { delete code.dataset.highlighted; code.classList.remove("hljs"); hljs.highlightElement(code); } }
  // 用页面上(可能被修改过的)各段代码,拼出某个文件的完整源码
  function assemble(file) {
    const full = FILES[file]; if (full == null) return null;
    const parts = {}; blocks.forEach(b => { if (b.dataset.file === file && b.dataset.part) parts[b.dataset.part] = textOf($("code", b)); });
    const whole = blocks.find(b => b.dataset.file === file && !b.dataset.part);
    if (whole) return textOf($("code", whole));
    if (!Object.keys(parts).length) return full;
    const out = []; let cur = null;
    full.split("\n").forEach(l => {
      if (l.startsWith("# >>> ")) { cur = l.slice(6).trim(); out.push(l); if (parts[cur] != null) out.push(parts[cur]); return; }
      if (cur == null || parts[cur] == null) out.push(l);
    });
    return out.join("\n");
  }
  function getWorker() {
    if (worker) return worker;
    worker = new Worker("pyworker.js");
    worker.onmessage = e => { const m = e.data; if (busy && m.id === busy.id) busy.on(m); };
    worker.onerror = e => { if (busy) busy.on({ type: "done", ok: false, err: "Worker 出错:" + (e.message || "未知错误"), boot: true }); };
    return worker;
  }
  function setBusy(on) { blocks.forEach(b => { const r = $(".run-btn", b); if (r) r.disabled = on; }); }
  function run(b) {
    if (busy) return;
    const file = b.dataset.file, out = $("pre.live", b), oc = $("code", out), status = $(".run-status", b), stop = $(".stop-btn", b);
    if (bootFailed) { status.innerHTML = '<span class="neg">⚠️ 浏览器 Python 环境加载失败(可能无法访问 cdn.jsdelivr.net)。请参考下方预先计算的输出,或复制代码到本地运行。</span>'; return; }
    const files = {}; Object.keys(FILES).forEach(f => { files[f] = assemble(f); });
    const id = ++seq, t0 = performance.now(); let gotOut = false;
    out.hidden = false; oc.textContent = ""; out.classList.remove("error"); status.textContent = "准备中…"; stop.hidden = false; setBusy(true);
    const timer = setInterval(() => { const s = ((performance.now() - t0) / 1000).toFixed(0); if (+s > 4) stop.title = "已运行 " + s + " 秒"; }, 1000);
    busy = {
      id, on(m) {
        if (m.type === "status") status.textContent = m.text;
        else if (m.type === "out") { oc.textContent += m.text; gotOut = true; }
        else if (m.type === "err") { const sp = document.createElement("span"); sp.className = "py-err"; sp.textContent = m.text; oc.appendChild(sp); }
        else if (m.type === "done") {
          clearInterval(timer); busy = null; setBusy(false); stop.hidden = true;
          if (m.ok) {
            status.innerHTML = '<span class="pos">✔ 运行完成</span>(' + (m.ms / 1000).toFixed(1) + " 秒,在你的浏览器里执行)";
            if (!gotOut) oc.textContent = "(程序没有打印任何输出)";
            if (window.QX) QX.award("py:" + file + (b.dataset.part ? "#" + b.dataset.part : ""), 5, "在浏览器里运行了 " + file + ".py");
          } else {
            out.classList.add("error");
            if (m.boot) { bootFailed = true; out.hidden = true; status.innerHTML = '<span class="neg">⚠️ 无法加载浏览器 Python 环境(需要访问 cdn.jsdelivr.net)。</span>下方是预先计算好的输出;你也可以点“复制”在本地运行。'; worker && worker.terminate(); worker = null; }
            else { const sp = document.createElement("span"); sp.className = "py-err"; sp.textContent = "\n" + m.err; oc.appendChild(sp); status.innerHTML = '<span class="neg">✘ 运行出错</span>——看看错误信息最后一行,改好后再运行,或点“重置”恢复原始代码。'; }
          }
        }
      }
    };
    stop.onclick = () => { if (!busy) return; worker.terminate(); worker = null; clearInterval(timer); busy = null; setBusy(false); stop.hidden = true; status.innerHTML = '<span class="neg">⏹ 已停止</span>(下次运行需要重新加载 Python 环境)'; };
    const scan = [file], q = [file];
    while (q.length) { const f = q.pop(); (files[f] || "").replace(/^\s*(?:from|import)\s+((?:ch|hl_)\w+)/gm, (_, d) => { if (files[d] != null && !scan.includes(d)) { scan.push(d); q.push(d); } }); }
    const pkgs = []; scan.forEach(f => (EXTRA[f] || []).forEach(p => { if (!pkgs.includes(p)) pkgs.push(p); }));
    getWorker().postMessage({ id, files, main: file, scan, pkgs });
  }
  blocks.forEach(b => {
    const code = $("pre code", b); if (!code) return;
    const orig = code.textContent;
    try { code.contentEditable = "plaintext-only"; } catch (e) { code.contentEditable = "true"; }
    if (code.contentEditable !== "plaintext-only") code.contentEditable = "true";
    code.spellcheck = false; code.setAttribute("autocapitalize", "off"); code.setAttribute("autocorrect", "off");
    const mod = $(".mod-tag", b);
    code.addEventListener("keydown", e => { if (e.key === "Tab") { e.preventDefault(); document.execCommand("insertText", false, "    "); } if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); rehighlight(code); run(b); } });
    code.addEventListener("input", () => { mod.hidden = false; });
    code.addEventListener("blur", () => { rehighlight(code); mod.hidden = textOf(code) === orig.replace(/\n$/, ""); });
    $(".run-btn", b).addEventListener("click", () => { rehighlight(code); run(b); });
    $(".reset-btn", b).addEventListener("click", () => { code.textContent = orig; rehighlight(code); mod.hidden = true; const out = $("pre.live", b); out.hidden = true; $(".run-status", b).textContent = ""; });
  });
})();

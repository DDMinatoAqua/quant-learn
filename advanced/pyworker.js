/* 在 Web Worker 里运行 Pyodide(浏览器里的 Python),避免卡住页面 */
const VER = "0.27.7";
const BASES = ["https://cdn.jsdelivr.net/pyodide/v" + VER + "/full/", "https://fastly.jsdelivr.net/pyodide/v" + VER + "/full/", "https://gcore.jsdelivr.net/pyodide/v" + VER + "/full/"];
let py = null, booting = null, curId = null;
const post = (type, extra) => postMessage(Object.assign({ type, id: curId }, extra || {}));
async function boot() {
  let lastErr = null;
  for (const base of BASES) {
    try {
      post("status", { text: "正在下载 Python 运行环境(首次约 10 MB,来自 " + new URL(base).host + ")…" });
      importScripts(base + "pyodide.js");
      py = await loadPyodide({ indexURL: base });
      py.setStdout({ batched: s => post("out", { text: s + "\n" }) });
      py.setStderr({ batched: s => post("err", { text: s + "\n" }) });
      py.FS.mkdirTree("/home/pyodide/code");
      await py.runPythonAsync("import warnings; warnings.filterwarnings('ignore', category=DeprecationWarning); warnings.filterwarnings('ignore', category=FutureWarning)");
      return;
    } catch (e) { lastErr = e; py = null; }
  }
  throw lastErr || new Error("无法加载 Pyodide");
}
onmessage = async ev => {
  const m = ev.data; curId = m.id;
  try {
    if (!py) { booting = booting || boot(); await booting; }
    for (const [name, src] of Object.entries(m.files)) py.FS.writeFile("/home/pyodide/code/" + name + ".py", src);
    const cb = { messageCallback: s => { if (/^Loading|^Loaded/.test(s)) post("status", { text: s.replace(/^Loading/, "正在加载依赖库").replace(/^Loaded/, "已加载") }); }, errorCallback: s => post("err", { text: s + "\n" }) };
    if (m.pkgs && m.pkgs.length) await py.loadPackage(m.pkgs, cb);
    const deps = (m.scan || [m.main]).map(n => m.files[n] || "").join("\n");
    await py.loadPackagesFromImports(deps, cb);
    post("status", { text: "运行中…" });
    const t0 = performance.now();
    py.globals.set("_qa_main", m.main);
    await py.runPythonAsync([
      "import os, sys, runpy",
      "os.chdir('/home/pyodide/code')",
      "sys.path.insert(0, '/home/pyodide/code') if '/home/pyodide/code' not in sys.path else None",
      "[sys.modules.pop(k) for k in list(sys.modules) if k.startswith(('ch', 'pre_'))]",
      "runpy.run_path(_qa_main + '.py', run_name='__main__')"
    ].join("\n"));
    post("done", { ok: true, ms: performance.now() - t0 });
  } catch (e) {
    const msg = String(e && e.message || e);
    const pyErr = msg.includes("Traceback") ? msg.split("\n").filter(l => !/_pyodide|pyodide\/|runpy\.py|<exec>/.test(l)).join("\n") : msg;
    post("done", { ok: false, err: pyErr, boot: !py });
  }
};

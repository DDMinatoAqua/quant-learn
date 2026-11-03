/* 互动组件:第 3 章、第 4 章、第 5 章 */
(function () {
  "use strict";
  const { def, U } = window.QX;
  const { rng, mean, std, pct, fx, clamp, ranks, corr, hist, cumprod, PALETTE, matVec, dot, solve, inv, projSimplex } = U;
  const C = { blue: "#2563eb", orange: "#f59e0b", green: "#16a34a", red: "#dc2626", purple: "#8b5cf6", gray: "#64748b", cyan: "#0891b2" };
  const km = el => { if (window.renderMathInElement) renderMathInElement(el, { delimiters: [{ left: "\\(", right: "\\)", display: false }], throwOnError: false }); };

  /* ===================== 第 3 章 ===================== */
  def("ch3-station", {
    kind: "game", title: "平稳性侦探:6 条序列,哪些是平稳的?", xp: 25,
    tryit: "点击每张小图下方的按钮,在“平稳 / 不平稳”之间切换你的判断,然后点“提交”。<b>答对 5 条</b>以上过关。判断依据就是上面的三条定义:均值恒定?方差恒定?会不会“一去不回”?",
    build(body, api) {
      const TYPES = [
        ["白噪声", true, "均值、方差都恒定,今天和昨天无关——最典型的平稳序列。"],
        ["AR(1),φ=0.5", true, "受冲击后很快回到均值 0,方差恒定 = σ²/(1−φ²)。"],
        ["AR(1),φ=0.9", true, "回归得慢一些(半衰期约 6.6 步),但始终围着均值转,仍然平稳。"],
        ["随机游走", false, "单位根:冲击永久保留,方差随时间线性增长,可以“走”得任意远。价格通常就长这样。"],
        ["线性趋势 + 噪声", false, "均值随时间变化(趋势),违反“均值恒定”。去掉趋势后才平稳(趋势平稳)。"],
        ["方差突变", false, "均值不变,但后半段方差变成 3 倍——违反“方差恒定”。只看均值会被骗。"],
        ["带漂移的随机游走", false, "单位根 + 漂移:既有趋势又会一去不回。"]
      ];
      let seed = 1, items = [], submitted = false;
      const grid = api.div(body, "mini-grid"), bar = api.div(body, "btn-row"), fb = api.div(body, "gc-fb");
      api.btn(bar, "✅ 提交判断", submit); api.btn(bar, "🔁 换一组", () => { seed++; gen(); }, "secondary");
      function series(k, R) {
        const T = 200, x = []; let p = 0;
        for (let t = 0; t < T; t++) {
          const e = R.g();
          if (k === 0) p = e; else if (k === 1) p = 0.5 * p + e; else if (k === 2) p = 0.9 * p + e; else if (k === 3) p += e; else if (k === 4) p = 0.04 * t + e * 1.2; else if (k === 5) p = e * (t < 100 ? 1 : 3); else p += 0.15 + e;
          x.push(p);
        }
        return x;
      }
      function gen() {
        submitted = false; fb.innerHTML = ""; const R = rng(seed * 7717);
        const ks = [0, 1, 2, 3, 4, 5, 6].sort(() => R.u() - 0.5).slice(0, 6);
        items = ks.map(k => ({ k, x: series(k, R), guess: null }));
        grid.innerHTML = "";
        items.forEach((it, i) => {
          const cell = document.createElement("div"); cell.className = "mini-cell"; grid.appendChild(cell);
          cell.innerHTML = "<b>序列 " + "ABCDEF"[i] + "</b>";
          const cv = api.canvas(cell, 120);
          api.draw(cv, { type: "line", data: { labels: it.x.map((_, t) => t), datasets: [api.line("", it.x, PALETTE[i], { borderWidth: 1.2 })] }, options: api.chartOpts({ legend: false, tooltip: false, noX: true }) });
          const b = document.createElement("button"); b.type = "button"; b.className = "btn secondary tog"; b.textContent = "❓ 点我判断"; cell.appendChild(b);
          const why = document.createElement("div"); why.className = "why"; cell.appendChild(why);
          b.addEventListener("click", () => { if (submitted) return; it.guess = it.guess === true ? false : true; b.textContent = it.guess ? "〰️ 平稳" : "📈 不平稳"; b.classList.toggle("on", it.guess); });
          it.b = b; it.why = why;
        });
        api.explain("先凭直觉判断。小技巧:想象把序列切成前后两半——两半的均值、波动看起来一样吗?");
      }
      function submit() {
        if (items.some(it => it.guess === null)) { fb.innerHTML = '<span class="warn-t">还有序列没判断哦(每张图下面的按钮)。</span>'; return; }
        submitted = true; let sc = 0;
        items.forEach(it => { const t = TYPES[it.k], ok = it.guess === t[1]; if (ok) sc++; it.why.innerHTML = (ok ? '<span class="pos">✔</span> ' : '<span class="neg">✘</span> ') + "<b>" + t[0] + "</b>(" + (t[1] ? "平稳" : "不平稳") + "):" + t[2]; });
        fb.innerHTML = "答对 <b>" + sc + " / 6</b>。" + (sc >= 5 ? "🎉 过关!" : "再换一组试试。");
        if (sc >= 5) api.win("平稳性判断 ≥ 5/6");
        api.explain("最容易错的是 <b>AR(1) φ=0.9</b>(看起来有“趋势段”,其实会回来)和<b>方差突变</b>(均值没变,但不平稳)。肉眼不可靠,所以需要 ADF 这样的正式检验——而 ADF 本身对 φ 接近 1 的序列也很难区分。");
      }
      gen();
    }
  });

  def("ch3-ar", {
    kind: "play", title: "AR(1) 游乐场:φ 决定记忆有多长", xp: 20,
    predict: { q: "φ = 0.99 的 AR(1)(平稳)和 φ = 1 的随机游走(不平稳),只看 300 天的走势,好分辨吗?", o: ["很容易,一眼看出", "很难,两者看起来都像随机游走", "φ=0.99 的会是一条直线"], a: 1, e: "φ=0.99 的半衰期约 69 天,300 天里只“回归”了几次,肉眼和 ADF 检验都很难区分——这就是 ADF 检验功效低的原因。" },
    tryit: "把 φ 从 0 拖到 0.5、0.9、0.99、1.00,观察:① 路径越来越“黏”;② 右边自相关柱子衰减得越来越慢;③ 半衰期迅速变长。再试试 <b>负的 φ</b>:序列会来回“锯齿”震荡。",
    build(body, api) {
      let seed = 1;
      const v = api.controls(body, [
        { k: "phi", label: "φ(自回归系数)", min: -0.9, max: 1, step: 0.01, v: 0.9, fmt: x => x.toFixed(2) },
        { k: "T", label: "长度", min: 100, max: 1000, step: 50, v: 300, fmt: x => x + " 天" }
      ], () => api.render());
      api.btn(api.div(body, "btn-row"), "🎲 换一组随机冲击", () => { seed++; api.render(); }, "secondary");
      const st = api.div(body), row = api.div(body, "two-col wide-left"), c1 = api.canvas(row, 260), c2 = api.canvas(row, 260);
      api.render = () => {
        const R = rng(seed * 59), x = []; let p = 0; for (let t = 0; t < v.T; t++) { p = v.phi * p + R.g(); x.push(p); }
        const m = mean(x), d = x.map(a => a - m), v0 = d.reduce((s, a) => s + a * a, 0);
        const acf = Array.from({ length: 20 }, (_, h) => d.slice(h + 1).reduce((s, a, i) => s + a * d[i], 0) / v0);
        api.draw(c1, { type: "line", data: { labels: x.map((_, t) => t), datasets: [api.line("x_t", x, C.blue, { borderWidth: 1.3 }), api.line("长期均值 0", x.map(() => 0), C.gray, { borderDash: [5, 4], borderWidth: 1 })] }, options: api.chartOpts({ xTitle: "时间", legend: false }) });
        api.draw(c2, { type: "bar", data: { labels: acf.map((_, h) => h + 1), datasets: [{ label: "样本自相关", data: acf, backgroundColor: "rgba(37,99,235,.6)" }, { type: "line", label: "理论 φ^h", data: acf.map((_, h) => Math.abs(v.phi) < 1 ? Math.pow(v.phi, h + 1) : 1), borderColor: C.orange, backgroundColor: C.orange, pointRadius: 0, borderWidth: 2 }] }, options: api.chartOpts({ xTitle: "滞后 h", yMin: -1, yMax: 1 }) });
        const hl = v.phi > 0 && v.phi < 1 ? Math.log(0.5) / Math.log(v.phi) : null, tv = Math.abs(v.phi) < 1 ? 1 / (1 - v.phi * v.phi) : Infinity;
        api.stats(st, [["半衰期 ln0.5/lnφ", hl ? fx(hl, 1) + " 天" : (v.phi >= 1 ? "∞(不回归)" : "—")], ["理论方差 σ²/(1−φ²)", isFinite(tv) ? fx(tv, 1) : "∞", isFinite(tv) ? "" : "bad"], ["样本方差", fx(std(x) ** 2, 1)], ["是否平稳", Math.abs(v.phi) < 1 ? "平稳 ✔" : "单位根 ✘", Math.abs(v.phi) < 1 ? "good" : "bad"]]);
        api.explain(v.phi >= 1 ? "φ = 1 就是随机游走:每个冲击都被<b>永久</b>记住,方差随时间无限增长,样本自相关几乎全是 1。对它做回归、算均值都没有意义。"
          : v.phi > 0.95 ? "φ = " + fx(v.phi) + ":平稳,但半衰期 " + fx(hl, 0) + " 天,序列会长时间偏离均值。和随机游走放在一起很难分辨——这就是 ADF 检验“功效低”的直观含义。"
            : v.phi < 0 ? "负的 φ:今天高于均值,明天大概率低于均值,形成锯齿状震荡。自相关柱子正负交替。日收益率中轻微的负自相关(买卖价差反弹)就是这种形态。"
              : "φ = " + fx(v.phi) + ":冲击按 φ^h 衰减,半衰期 " + (hl ? fx(hl, 1) : "<1") + " 天。样本自相关(蓝柱)大致贴着理论曲线 φ^h(橙线),但有抽样误差。");
      };
    }
  });

  def("ch3-garch", {
    kind: "play", title: "GARCH 波动率聚集模拟器", xp: 20,
    tryit: "先把 α 调到 0(波动恒定),看收益图很“均匀”;再把 α 调到 0.15、β 调到 0.83,出现一簇一簇的大波动。勾选“注入冲击”,看一次 −8% 的暴跌之后,橙色的条件波动需要多久才回落——这就是持续性 α+β 和半衰期。",
    build(body, api) {
      let seed = 1;
      const v = api.controls(body, [
        { k: "a", label: "α(对新冲击的反应)", min: 0, max: 0.3, step: 0.01, v: 0.08, fmt: x => x.toFixed(2) },
        { k: "b", label: "β(对旧波动的记忆)", min: 0, max: 0.99, step: 0.01, v: 0.9, fmt: x => x.toFixed(2) },
        { k: "lv", label: "长期年化波动", min: 10, max: 60, step: 5, v: 20, fmt: x => x + "%" },
        { k: "shock", label: "第 400 天注入 −8% 冲击", type: "check", v: false }
      ], () => api.render());
      api.btn(api.div(body, "btn-row"), "🎲 换一组随机数", () => { seed++; api.render(); }, "secondary");
      const st = api.div(body), cv = api.canvas(body, 300);
      api.render = () => {
        const R = rng(seed * 71), T = 750, pers = v.a + v.b, lr = (v.lv / 100) ** 2 / 252, om = pers < 1 ? lr * (1 - pers) : lr * 0.001;
        let s2 = lr; const r = [], vol = [];
        for (let t = 0; t < T; t++) { if (t > 0) s2 = om + v.a * r[t - 1] ** 2 + v.b * s2; let x = Math.sqrt(s2) * R.g(); if (v.shock && t === 400) x = -0.08; r.push(x); vol.push(Math.sqrt(s2 * 252)); }
        const m = mean(r), k4 = mean(r.map(x => (x - m) ** 4)) / (mean(r.map(x => (x - m) ** 2)) ** 2);
        api.draw(cv, { type: "bar", data: { labels: r.map((_, t) => t), datasets: [
          { label: "日收益 %", data: r.map(x => x * 100), backgroundColor: r.map(x => x >= 0 ? "rgba(22,163,74,.6)" : "rgba(220,38,38,.6)"), yAxisID: "y", barPercentage: 1, categoryPercentage: 1 },
          { type: "line", label: "条件年化波动 σ_t(右轴)", data: vol.map(x => x * 100), borderColor: C.orange, backgroundColor: C.orange, pointRadius: 0, borderWidth: 2, yAxisID: "y1" }] },
          options: api.chartOpts({ yTitle: "日收益 %", y1: "年化波动 %", xTicks: { ticks: { maxTicksLimit: 8, color: U.css("--muted") } } }) });
        const hl = pers < 1 && pers > 0 ? Math.log(0.5) / Math.log(pers) : null;
        api.stats(st, [["持续性 α+β", fx(pers, 2), pers >= 1 ? "bad" : ""], ["冲击半衰期", hl ? fx(hl, 0) + " 天" : (pers >= 1 ? "∞" : "—")], ["ω = σ̄²(1−α−β)", om.toExponential(2)], ["收益峰度(正态=3)", fx(k4, 1), k4 > 4 ? "bad" : ""]]);
        api.explain(pers >= 1 ? "<b>α+β ≥ 1</b>:波动率没有长期均值(IGARCH/爆炸),冲击永不消散。估计结果出现这种情况时要警惕模型设定。"
          : v.a === 0 ? "α = 0 时昨天的“意外”不影响今天的波动,σ_t 是常数,收益就是普通的正态白噪声(峰度≈3)。"
            : "α = " + v.a + " 让大冲击推高明天的方差,β = " + v.b + " 让高方差“粘”住。两者合起来产生<b>波动聚集</b>和<b>肥尾</b>(峰度 " + fx(k4, 1) + " > 3)——即使每天的 z_t 都是正态的!半衰期 " + fx(hl, 0) + " 天意味着一次冲击后,超额波动大约 " + fx(hl, 0) + " 天才消退一半。" + (v.shock ? " 看第 400 天之后的橙线:先跳升,再按 (α+β)^h 慢慢回落。" : ""));
      };
    }
  });

  def("ch3-pairs", {
    kind: "play", title: "配对交易沙盘:z-score 进出场", xp: 25,
    tryit: "调整价差的<b>半衰期</b>和<b>进场阈值</b>,看交易次数和收益怎么变。然后勾选“第 300 天协整断裂”——价差不再回归,看看策略会怎样<b>越亏越多</b>,以及止损阈值能不能救你。",
    build(body, api) {
      let seed = 4;
      const v = api.controls(body, [
        { k: "hl", label: "价差半衰期", min: 2, max: 60, v: 10, fmt: x => x + " 天" },
        { k: "en", label: "进场 |z| >", min: 1, max: 3, step: 0.1, v: 2, fmt: x => x.toFixed(1) },
        { k: "ex", label: "出场 |z| <", min: 0, max: 1, step: 0.1, v: 0.5, fmt: x => x.toFixed(1) },
        { k: "stop", label: "止损 |z| >", min: 3, max: 8, step: 0.5, v: 8, fmt: x => x >= 8 ? "不止损" : x.toFixed(1) },
        { k: "win", label: "滚动窗口", min: 20, max: 120, step: 10, v: 60, fmt: x => x + " 天" },
        { k: "brk", label: "第 300 天协整断裂", type: "check", v: false }
      ], () => api.render());
      api.btn(api.div(body, "btn-row"), "🎲 换一条路径", () => { seed++; api.render(); }, "secondary");
      const st = api.div(body), c1 = api.canvas(body, 240), c2 = api.canvas(body, 180);
      api.render = () => {
        const R = rng(seed * 131), T = 600, phi = Math.pow(0.5, 1 / v.hl); let u = 0; const sp = [];
        for (let t = 0; t < T; t++) { u = (v.brk && t >= 300 ? 1 : phi) * u + R.g() * 0.02; sp.push(u); }
        const z = [], pos = [], pnl = [0]; let p = 0, trades = 0, wins = 0, entryVal = 0;
        for (let t = 0; t < T; t++) {
          let zz = null; if (t >= v.win) { const w = sp.slice(t - v.win, t), m = mean(w), s = std(w); zz = (sp[t] - m) / (s || 1); }
          z.push(zz);
          if (t > 0) pnl.push(pnl[t - 1] + p * (sp[t] - sp[t - 1]) * 100);
          if (zz != null) {
            const old = p;
            if (p === 0) { if (zz > v.en) p = -1; else if (zz < -v.en) p = 1; }
            else if (Math.abs(zz) < v.ex || (v.stop < 8 && Math.abs(zz) > v.stop)) p = 0;
            if (old === 0 && p !== 0) { trades++; entryVal = pnl[t]; } if (old !== 0 && p === 0 && pnl[t] > entryVal) wins++;
          }
          pos.push(p);
        }
        const L = sp.map((_, t) => t);
        api.draw(c1, { type: "line", data: { labels: L, datasets: [api.line("价差 z-score(只用过去 " + v.win + " 天)", z, C.blue, { borderWidth: 1.3 }), api.line("+进场", L.map(() => v.en), C.red, { borderDash: [5, 4], borderWidth: 1 }), api.line("−进场", L.map(() => -v.en), C.green, { borderDash: [5, 4], borderWidth: 1 }),
          { label: "持仓(+1 做多价差 / −1 做空)", data: pos.map(x => x * 3), borderColor: "rgba(139,92,246,.7)", backgroundColor: "rgba(139,92,246,.12)", fill: true, pointRadius: 0, borderWidth: 1, stepped: true }] }, options: api.chartOpts({ yMin: -5, yMax: 5 }) });
        api.draw(c2, { type: "line", data: { labels: L, datasets: [api.line("累计盈亏(价差单位)", pnl, C.orange)] }, options: api.chartOpts({}) });
        const dd = Math.min(...pnl.map((x, i) => x - Math.max(...pnl.slice(0, i + 1))));
        api.stats(st, [["交易次数", trades], ["盈利交易占比", trades ? pct(wins / trades, 0) : "—"], ["累计盈亏", fx(pnl[T - 1], 2), pnl[T - 1] >= 0 ? "good" : "bad"], ["最大回撤", fx(dd, 2), "bad"]]);
        api.explain(v.brk ? "第 300 天后价差变成随机游走:<b>z-score 一次次突破进场线,你一次次“抄底”,但价差不再回来</b>。滚动窗口会慢慢“适应”新水平,所以 z 又看起来正常——这正是协整断裂最危险的地方。止损阈值(试试 4)能限制亏损,但也会在正常波动中误杀。"
          : "半衰期 " + v.hl + " 天:价差偏离后大约 " + v.hl + " 天回归一半。半衰期越短,交易机会越多、持仓越短;阈值越高,交易越少但每笔更“确定”。注意 z-score 只用了<b>过去</b>的均值和标准差,没有未来函数。");
      };
    }
  });

  def("ch3-kalman", {
    kind: "walk", title: "卡尔曼滤波一步一步:β 在漂移", xp: 25,
    tryit: "点 ▶ 播放,看绿色估计线如何追踪漂移的真实 β(蓝线),阴影是 ±2√P 的不确定带。下方文字给出每一步的预测、新息、增益和更新。然后把 Q 调大(更相信“β 会变”)或把 R 调大(更不相信观测),比较追踪速度和平滑程度。",
    build(body, api) {
      const v = api.controls(body, [
        { k: "q", label: "过程噪声 Q", type: "select", opts: [[1e-6, "1e-6(β 几乎不变)"], [1e-5, "1e-5"], [1e-4, "1e-4(默认)"], [1e-3, "1e-3"], [1e-2, "1e-2(β 剧烈变化)"]], v: 1e-4 },
        { k: "r", label: "观测噪声 R", type: "select", opts: [[0.5, "0.5"], [4, "4(默认)"], [25, "25"], [100, "100"]], v: 4 }
      ], () => { compute(); S.go(S.i); });
      const st = api.div(body), cv = api.canvas(body, 280);
      const T = 120, R0 = rng(8); const beta = [], x = [], y = []; let b = 1.0, xx = 50;
      for (let t = 0; t < T; t++) { b += 0.012 * R0.g() + (t > 60 && t < 90 ? 0.006 : 0); xx += R0.g() * 0.8; beta.push(b); x.push(xx); y.push(b * xx + 2 * R0.g()); }
      const olsB = x.reduce((s, a, i) => s + a * y[i], 0) / x.reduce((s, a) => s + a * a, 0);
      let K = [];
      function compute() {
        K = []; let bh = 1.0, P = 0.01;
        for (let t = 0; t < T; t++) { const Pp = P + v.q, e = y[t] - x[t] * bh, S2 = x[t] * x[t] * Pp + v.r, g = Pp * x[t] / S2, nb = bh + g * e, nP = (1 - g * x[t]) * Pp; K.push({ prev: bh, Pp, e, S2, g, b: nb, P: nP }); bh = nb; P = nP; }
      }
      compute();
      const S = api.stepper(body, {
        n: T, label: "第",
        onStep(i) {
          const L = beta.map((_, t) => t), cut = a => a.map((q, t) => t <= i ? q : null), k = K[i];
          api.draw(cv, { type: "line", data: { labels: L, datasets: [
            api.line("真实 β_t(未知)", beta, C.blue, { borderWidth: 2 }),
            api.line("卡尔曼估计 β̂_t", cut(K.map(o => o.b)), C.green, { borderWidth: 2.5 }),
            { label: "+2√P", data: cut(K.map(o => o.b + 2 * Math.sqrt(o.P))), borderColor: "transparent", backgroundColor: "rgba(22,163,74,.15)", pointRadius: 0, fill: "+1" },
            { label: "−2√P", data: cut(K.map(o => o.b - 2 * Math.sqrt(o.P))), borderColor: "transparent", backgroundColor: "rgba(22,163,74,.15)", pointRadius: 0, fill: false },
            api.line("全样本 OLS 固定 β", L.map(() => olsB), C.gray, { borderDash: [6, 4], borderWidth: 1.5 })] },
            options: api.chartOpts({ yTitle: "β", extra: { plugins: { legend: { labels: { filter: it => !it.text.includes("√P") } } } } }) });
          api.stats(st, [["真实 β", fx(beta[i], 3)], ["估计 β̂", fx(k.b, 3)], ["增益 K", k.g.toExponential(2)], ["不确定性 √P", fx(Math.sqrt(k.P), 4)]]);
          return "<b>t = " + i + "</b>:① 预测 \\(\\hat\\beta_{t|t-1}=" + fx(k.prev, 3) + "\\),\\(P_{t|t-1}=" + k.Pp.toExponential(2) + "\\);② 新息 \\(e_t=y_t-x_t\\hat\\beta=" + fx(y[i], 1) + "-" + fx(x[i], 1) + "\\times" + fx(k.prev, 3) + "=" + fx(k.e, 2) + "\\);③ 增益 \\(K_t=" + k.g.toExponential(2) + "\\);④ 更新 \\(\\hat\\beta_t=" + fx(k.prev, 3) + "+K_te_t=" + fx(k.b, 3) + "\\)。";
        }
      });
      api.render = () => { S.go(S.i); };
      api.explain("Q/R 的比值决定滤波器的性格:<b>Q 大 / R 小</b> → 增益 K 大,紧跟数据但抖动大;<b>Q 小 / R 大</b> → 估计平滑但反应迟钝(Q=1e-6 时几乎退化成固定 β)。灰色虚线是全样本 OLS:它用到了未来数据,而且完全看不到 β 的漂移。");
    }
  });

  /* ===================== 第 4 章 ===================== */
  const ASSETS = ["大盘股", "小盘股", "国债", "信用债", "商品"];
  const MU = [0.07, 0.09, 0.03, 0.04, 0.05], VOL = [0.18, 0.26, 0.04, 0.06, 0.20];
  const CORR = [[1, 0.7, -0.1, 0.0, 0.3], [0.7, 1, -0.1, 0.0, 0.3], [-0.1, -0.1, 1, 0.6, 0.0], [0.0, 0.0, 0.6, 1, 0.1], [0.3, 0.3, 0.0, 0.1, 1]];
  const SIG = CORR.map((r, i) => r.map((c, j) => c * VOL[i] * VOL[j]));
  const pstat = (w, mu, S, rf = 0.02) => { const r = dot(w, mu), v = Math.sqrt(Math.max(dot(w, matVec(S, w)), 0)); return { r, v, sr: (r - rf) / v }; };
  function mvLong(mu, S, lam, w0) { const n = mu.length; let w = w0 ? [...w0] : new Array(n).fill(1 / n); let tr = 0; for (let i = 0; i < n; i++) tr += S[i][i]; const step = 1 / (2 * tr + 1e-12); for (let it = 0; it < 600; it++) { const g = matVec(S, w).map((x, i) => 2 * x - lam * mu[i]); w = projSimplex(w.map((x, i) => x - step * g[i])); } return w; }
  function frontierLong(mu, S) { const pts = []; let w0 = null; [0, 0.01, 0.02, 0.04, 0.07, 0.1, 0.15, 0.2, 0.3, 0.45, 0.6, 0.8, 1, 1.3, 1.7, 2.2, 3, 4, 6, 9, 14, 25, 50].forEach(l => { const w = mvLong(mu, S, l, w0); w0 = w; const s = pstat(w, mu, S); pts.push({ x: s.v, y: s.r, w, sr: s.sr }); }); pts.sort((a, b) => a.y - b.y); return pts; }
  let FRONT = null; const front = () => FRONT || (FRONT = frontierLong(MU, SIG));

  def("ch4-two", {
    kind: "play", title: "两资产有效前沿:拖动权重走一遍曲线", xp: 15,
    tryit: "拖动“股票权重”,看橙点沿着曲线移动;注意从 100% 债券开始加一点股票时,<b>波动反而下降</b>(曲线向左弯)。然后改变相关系数,看曲线“鼓”出来的程度。勾选“允许做空”看曲线延伸。",
    build(body, api) {
      const v = api.controls(body, [
        { k: "w", label: "股票权重", min: -50, max: 150, v: 40, fmt: x => x + "%" },
        { k: "rho", label: "股债相关 ρ", min: -1, max: 1, step: 0.05, v: 0, fmt: x => x.toFixed(2) },
        { k: "m1", label: "股票预期收益", min: 4, max: 14, v: 8, fmt: x => x + "%" },
        { k: "s1", label: "股票波动", min: 10, max: 35, v: 20, fmt: x => x + "%" },
        { k: "short", label: "允许做空 / 加杠杆", type: "check", v: false }
      ], () => api.render());
      const st = api.div(body), cv = api.canvas(body, 300);
      api.render = () => {
        const m1 = v.m1 / 100, s1 = v.s1 / 100, m2 = 0.03, s2 = 0.06, r = v.rho;
        const P = w => ({ x: Math.sqrt(Math.max(w * w * s1 * s1 + (1 - w) ** 2 * s2 * s2 + 2 * w * (1 - w) * r * s1 * s2, 0)) * 100, y: (w * m1 + (1 - w) * m2) * 100 });
        const lo = v.short ? -0.5 : 0, hi = v.short ? 1.5 : 1, ws = []; for (let k = 0; k <= 100; k++) ws.push(lo + (hi - lo) * k / 100);
        let w = v.w / 100; if (!v.short) w = clamp(w, 0, 1);
        const cur = P(w), gmvW = (s2 * s2 - r * s1 * s2) / (s1 * s1 + s2 * s2 - 2 * r * s1 * s2), g = P(v.short ? gmvW : clamp(gmvW, 0, 1));
        api.draw(cv, { type: "line", data: { datasets: [
          api.line("组合(股票权重从 " + Math.round(lo * 100) + "% 到 " + Math.round(hi * 100) + "%)", ws.map(P), C.blue),
          { type: "scatter", label: "当前组合", data: [cur], backgroundColor: C.orange, borderColor: C.orange, pointRadius: 8 },
          { type: "scatter", label: "最小方差组合", data: [g], backgroundColor: C.green, borderColor: C.green, pointRadius: 6, pointStyle: "triangle" },
          { type: "scatter", label: "100% 债券 / 100% 股票", data: [P(0), P(1)], backgroundColor: C.gray, borderColor: C.gray, pointRadius: 5, pointStyle: "rect" }] },
          options: api.chartOpts({ xType: "linear", xTitle: "年化波动 %", yTitle: "年化收益 %", xMin: 0 }) });
        api.stats(st, [["当前收益 / 波动", fx(cur.y, 1) + "% / " + fx(cur.x, 1) + "%"], ["夏普(rf=2%)", fx((cur.y - 2) / cur.x)], ["最小方差股票权重", pct(gmvW, 1)], ["最小方差波动", fx(g.x, 2) + "%", "good"]]);
        if (!v.short && v.w !== Math.round(w * 100)) api.explain("没有勾选“允许做空”,权重被限制在 0–100%。");
        else api.explain("曲线的上半段(最小方差点以上)是<b>有效前沿</b>:同样的波动下收益最高。下半段的组合都“不划算”——总能找到波动相同但收益更高的组合。" + (gmvW > 0 ? " 最小方差组合里有 " + pct(gmvW, 1) + " 的股票:即使你只关心风险,少量加入高波动、低相关的资产也能<b>降低</b>总波动。" : " 现在股债相关性很高,加入股票只会增加风险,最小方差组合就是全仓债券。") + " 最小方差权重的公式:\\(w_1=\\dfrac{\\sigma_2^2-\\rho\\sigma_1\\sigma_2}{\\sigma_1^2+\\sigma_2^2-2\\rho\\sigma_1\\sigma_2}\\)。");
        km(api.el.querySelector(".ix-exp-text"));
      };
    }
  });

  def("ch4-build", {
    kind: "game", title: "组合搭建挑战:三个关卡", xp: 35,
    tryit: "用 5 个滑块搭一个组合(会自动归一化成总和 100%),橙点就是你的组合。完成三个关卡:<b>① 稳健型</b>:波动 ≤ 8% 且收益 ≥ 5%;<b>② 最小方差</b>:波动不超过最小方差组合的 1.05 倍;<b>③ 夏普大师</b>:夏普达到最大可能值的 97%。",
    build(body, api) {
      const v = api.controls(body, ASSETS.map((a, i) => ({ k: "w" + i, label: a + "(μ " + Math.round(MU[i] * 100) + "%,σ " + Math.round(VOL[i] * 100) + "%)", min: 0, max: 100, v: 20 })), () => api.render());
      const bar = api.div(body, "btn-row"); api.btn(bar, "↺ 恢复等权", () => ASSETS.forEach((_, i) => v._set("w" + i, 20)), "secondary");
      const lv = api.div(body, "levels"), st = api.div(body), cv = api.canvas(body, 320);
      const F = front(), maxSR = Math.max(...F.map(p => p.sr)), gmv = F.reduce((b, p) => p.x < b.x ? p : b);
      const LV = [["① 稳健型", s => s.v <= 0.08 && s.r >= 0.05, "波动 ≤ 8% 且收益 ≥ 5%"], ["② 最小方差", s => s.v <= gmv.x * 1.05, "波动 ≤ " + pct(gmv.x * 1.05, 2)], ["③ 夏普大师", s => s.sr >= maxSR * 0.97, "夏普 ≥ " + fx(maxSR * 0.97)]];
      const passed = QX.load("qa-game", {})["ch4-build"] || [false, false, false];
      api.render = () => {
        const raw = ASSETS.map((_, i) => v["w" + i]), tot = U.sum(raw) || 1, w = raw.map(x => x / tot), s = pstat(w, MU, SIG);
        LV.forEach((L, k) => { if (!passed[k] && L[1](s)) { passed[k] = true; const g = QX.load("qa-game", {}); g["ch4-build"] = passed; QX.save("qa-game", g); api.bonus("lv" + k, 5, "通过关卡 " + L[0]); } });
        if (passed.every(Boolean)) api.win("三关全部通过");
        lv.innerHTML = LV.map((L, k) => '<span class="lvl' + (passed[k] ? " on" : "") + (L[1](s) ? " now" : "") + '">' + (passed[k] ? "✔ " : "🔒 ") + L[0] + "<small>" + L[2] + "</small></span>").join("");
        api.draw(cv, { type: "line", data: { datasets: [
          api.line("有效前沿(只做多,真实参数)", F.map(p => ({ x: p.x * 100, y: p.y * 100 })), C.blue),
          { type: "scatter", label: "单个资产", data: ASSETS.map((_, i) => ({ x: VOL[i] * 100, y: MU[i] * 100 })), backgroundColor: C.gray, pointRadius: 5 },
          { type: "scatter", label: "你的组合", data: [{ x: s.v * 100, y: s.r * 100 }], backgroundColor: C.orange, borderColor: C.orange, pointRadius: 9, pointStyle: "star", borderWidth: 2 },
          api.line("稳健型目标区", [{ x: 0, y: 5 }, { x: 8, y: 5 }, { x: 8, y: 10 }], "rgba(22,163,74,.6)", { borderDash: [4, 4], borderWidth: 1 })] },
          options: api.chartOpts({ xType: "linear", xTitle: "年化波动 %", yTitle: "年化收益 %", xMin: 0, xMax: 28, yMin: 2, yMax: 10 }) });
        api.stats(st, [["归一化权重", w.map(x => (x * 100).toFixed(0)).join(" / ") + " %"], ["收益 / 波动", pct(s.r) + " / " + pct(s.v)], ["夏普(rf=2%)", fx(s.sr), s.sr >= maxSR * 0.97 ? "good" : ""], ["距最大夏普", pct(1 - s.sr / maxSR, 0)]]);
        const dist = Math.min(...F.map(p => Math.hypot(p.x - s.v, p.y - s.r)));
        api.explain("你的组合离有效前沿 " + (dist < 0.003 ? "<b>非常近</b>,几乎是有效的。" : "还有 " + pct(dist, 1) + " 的距离:同样的波动下还能多赚一些。") + " 提示:国债和信用债相关 0.6,而它们和股票几乎不相关——<b>分散化的关键是低相关的资产组合在一起</b>。最大夏普组合大约是:" + F.reduce((b, p) => p.sr > b.sr ? p : b).w.map((x, i) => ASSETS[i] + " " + pct(x, 0)).filter(t => !t.endsWith(" 0%")).join("、") + "(完成第 ③ 关前先别看 😉)。");
      };
    }
  });

  def("ch4-amplify", {
    kind: "play", title: "误差放大器:8 段历史,8 个“最优”组合", xp: 20,
    predict: { q: "从同一个真实市场里抽 8 段 5 年的历史数据,分别算“最大夏普”组合。8 个组合的权重会?", o: ["几乎一样", "差别巨大,经常集中在一两个资产上", "全部等权"], a: 1, e: "5 年数据估计的预期收益误差往往和收益本身一样大。优化器会把这些误差当成真信息,在“看起来收益高”的资产上下重注。" },
    tryit: "看 8 根柱子(每根 = 一段随机历史得出的最大夏普权重)有多“乱”。然后把“收益向均值收缩 κ”调到 0.7,或者把历史长度拉到 20 年,看柱子是否变整齐、真实夏普是否提高。",
    build(body, api) {
      let seed = 1;
      const v = api.controls(body, [
        { k: "T", label: "历史长度", min: 24, max: 300, step: 12, v: 60, fmt: x => x + " 个月(" + (x / 12).toFixed(0) + " 年)" },
        { k: "kap", label: "收益向均值收缩 κ", min: 0, max: 1, step: 0.05, v: 0, fmt: x => x.toFixed(2) },
        { k: "del", label: "协方差向对角收缩 δ", min: 0, max: 1, step: 0.05, v: 0, fmt: x => x.toFixed(2) }
      ], () => api.render());
      api.btn(api.div(body, "btn-row"), "🎲 重新抽 8 段历史", () => { seed++; api.render(); }, "secondary");
      const st = api.div(body), cv = api.canvas(body, 300), L = U.cholesky(SIG);
      api.render = () => {
        const R = rng(seed * 997), res = [];
        for (let k = 0; k < 8; k++) {
          const X = []; for (let t = 0; t < v.T; t++) { const e = matVec(L, ASSETS.map(() => R.g())); X.push(MU.map((m, i) => m / 12 + e[i] / Math.sqrt(12))); }
          let mu = ASSETS.map((_, i) => mean(X.map(r => r[i])) * 12); const gm = mean(mu); mu = mu.map(m => (1 - v.kap) * m + v.kap * gm);
          const S = ASSETS.map((_, i) => ASSETS.map((_, j) => { const mi = mean(X.map(r => r[i])), mj = mean(X.map(r => r[j])); return X.reduce((s, r) => s + (r[i] - mi) * (r[j] - mj), 0) / (v.T - 1) * 12; })).map((r, i) => r.map((x, j) => i === j ? x : (1 - v.del) * x));
          const F = frontierLong(mu, S), b = F.reduce((q, p) => p.sr > q.sr ? p : q);
          res.push({ w: b.w, est: b.sr, tru: pstat(b.w, MU, SIG).sr });
        }
        const bt = front().reduce((q, p) => p.sr > q.sr ? p : q);
        const labels = [...res.map((_, k) => "历史 " + (k + 1)), "真实最优"], all = [...res.map(r => r.w), bt.w];
        api.draw(cv, { type: "bar", data: { labels, datasets: ASSETS.map((a, i) => ({ label: a, data: all.map(w => w[i] * 100), backgroundColor: PALETTE[i] })) }, options: api.chartOpts({ stacked: true, yTitle: "权重 %", yMax: 100 }) });
        const avgEst = mean(res.map(r => r.est)), avgTru = mean(res.map(r => r.tru)), disp = mean(ASSETS.map((_, i) => std(res.map(r => r.w[i]))));
        api.stats(st, [["你以为的夏普(平均)", fx(avgEst), "bad"], ["这些组合的真实夏普", fx(avgTru)], ["真实可达最大夏普", fx(bt.sr), "good"], ["权重离散度(平均标准差)", pct(disp, 0)]]);
        api.explain("“你以为的夏普”" + fx(avgEst) + " 远高于这些组合的真实夏普 " + fx(avgTru) + ":优化器专挑<b>碰巧估高</b>的资产,所以估计值系统性乐观。" + (v.kap > 0.4 || v.T > 150 ? " 现在收缩/更长的历史让权重稳定了不少,真实夏普也更接近上限——<b>少相信一点估计值,反而更好</b>。" : " 试试收缩 κ:它把每个资产的预期收益往平均值拉,相当于说“我不太相信这些差异”。"));
      };
    }
  });

  def("ch4-rp", {
    kind: "walk", title: "风险平价迭代:看风险贡献一步步拉平", xp: 20,
    tryit: "先看第 0 步(等权):股票贡献了绝大部分风险。按 ▶ 播放,每一步都按“风险贡献偏多就减仓、偏少就加仓”调整权重,直到三根风险贡献柱一样高。改变债券波动后重新播放。",
    build(body, api) {
      const v = api.controls(body, [
        { k: "s1", label: "股票波动", min: 10, max: 35, v: 18, fmt: x => x + "%" },
        { k: "s2", label: "债券波动", min: 2, max: 15, v: 5, fmt: x => x + "%" },
        { k: "s3", label: "商品波动", min: 10, max: 35, v: 22, fmt: x => x + "%" }
      ], () => { compute(); S.go(S.i); });
      const row = api.div(body, "two-col"), c1 = api.canvas(row, 240), c2 = api.canvas(row, 240), st = api.div(body);
      const NM = ["股票", "债券", "商品"], RH = [[1, -0.2, 0.3], [-0.2, 1, 0], [0.3, 0, 1]];
      let iters = [];
      const rc = (w, S) => { const Sw = matVec(S, w), vv = dot(w, Sw); return w.map((x, i) => x * Sw[i] / vv); };
      function compute() {
        const vol = [v.s1, v.s2, v.s3].map(x => x / 100), S = RH.map((r, i) => r.map((c, j) => c * vol[i] * vol[j]));
        let w = [1 / 3, 1 / 3, 1 / 3]; iters = [];
        for (let k = 0; k < 13; k++) { const c = rc(w, S); iters.push({ w: [...w], c, vol: Math.sqrt(dot(w, matVec(S, w))) }); w = w.map((x, i) => x * Math.sqrt((1 / 3) / c[i])); const s = U.sum(w); w = w.map(x => x / s); }
      }
      compute();
      const S = api.stepper(body, {
        n: 13, label: "迭代",
        onStep(i) {
          const it = iters[i], eq = iters[0];
          api.draw(c1, { type: "bar", data: { labels: NM, datasets: [{ label: "等权的权重 %", data: eq.w.map(x => x * 100), backgroundColor: "rgba(100,116,139,.45)" }, { label: "第 " + i + " 步权重 %", data: it.w.map(x => x * 100), backgroundColor: PALETTE.slice(0, 3) }] }, options: api.chartOpts({ yMin: 0, yMax: 100 }) });
          api.draw(c2, { type: "bar", data: { labels: NM, datasets: [{ label: "等权的风险贡献 %", data: eq.c.map(x => x * 100), backgroundColor: "rgba(100,116,139,.45)" }, { label: "第 " + i + " 步风险贡献 %", data: it.c.map(x => x * 100), backgroundColor: PALETTE.slice(0, 3) }, { type: "line", label: "目标 33.3%", data: [33.33, 33.33, 33.33], borderColor: C.red, borderDash: [5, 4], pointRadius: 0, borderWidth: 1.5 }] }, options: api.chartOpts({ yMin: 0, yMax: 100 }) });
          const dev = Math.max(...it.c.map(x => Math.abs(x - 1 / 3)));
          api.stats(st, [["组合波动", pct(it.vol, 2)], ["最大偏离目标", pct(dev, 2), dev < 0.005 ? "good" : ""], ["权重", it.w.map((x, k) => NM[k] + " " + pct(x, 0)).join(" · ")]]);
          return i === 0 ? "<b>第 0 步 = 等权</b>:每个资产 33% 的钱,但股票和商品贡献了 " + pct(it.c[0] + it.c[2], 0) + " 的风险,债券几乎没有贡献。" :
            "<b>第 " + i + " 次迭代</b>:\\(w_i \\leftarrow w_i\\sqrt{(1/3)/\\text{RC}_i}\\) 后再归一化。风险贡献偏多的资产被减仓,偏少的被加仓。" + (dev < 0.005 ? " 已经收敛:三个资产的风险贡献都约为 1/3。债券权重最高,因为它波动最小。" : "");
        }
      });
      api.render = () => S.go(S.i);
      api.explain("风险平价不需要预期收益 μ,只需要协方差 Σ,所以比均值-方差稳定得多。代价是低波动资产(债券)权重很高——实务中常配合杠杆把组合波动调到目标水平。");
    }
  });

  def("ch4-bl", {
    kind: "play", title: "Black-Litterman 调音台:观点有多自信?", xp: 20,
    tryit: "设定一个观点“大盘股比小盘股每年多赚 q%”,然后拖动“信心”。信心 → 0%:后验收益(橙)回到市场均衡(蓝);信心 → 100%:后验完全服从你的观点。看权重如何<b>温和地</b>倾斜,而不是像均值-方差那样走极端。",
    build(body, api) {
      const v = api.controls(body, [
        { k: "q", label: "观点:大盘股 − 小盘股", min: -6, max: 6, step: 0.5, v: 3, fmt: x => (x > 0 ? "+" : "") + x + "%/年" },
        { k: "c", label: "信心", min: 1, max: 99, v: 50, fmt: x => x + "%" }
      ], () => api.render());
      const row = api.div(body, "two-col"), c1 = api.canvas(row, 250), c2 = api.canvas(row, 250), st = api.div(body);
      const N3 = ["大盘股", "小盘股", "国债"], wm = [0.5, 0.2, 0.3], vol = [0.18, 0.24, 0.05], rh = [[1, 0.8, -0.1], [0.8, 1, -0.1], [-0.1, -0.1, 1]];
      const S = rh.map((r, i) => r.map((c, j) => c * vol[i] * vol[j])), delta = 2.5, tau = 0.05;
      api.render = () => {
        const pi = matVec(S, wm).map(x => x * delta), P = [1, -1, 0], q = v.q / 100, c = v.c / 100;
        const pSp = dot(P, matVec(S, P)) * tau, om = pSp * (1 - c) / c;
        const tS = S.map(r => r.map(x => x * tau)), A = inv(tS).map((r, i) => r.map((x, j) => x + P[i] * P[j] / om));
        const bvec = matVec(inv(tS), pi).map((x, i) => x + P[i] * q / om), mu = solve(A, bvec);
        const wu = solve(S.map(r => r.map(x => x * delta)), mu);
        api.draw(c1, { type: "bar", data: { labels: N3, datasets: [{ label: "均衡收益 π", data: pi.map(x => x * 100), backgroundColor: "rgba(37,99,235,.65)" }, { label: "BL 后验收益", data: mu.map(x => x * 100), backgroundColor: "rgba(245,158,11,.8)" }] }, options: api.chartOpts({ yTitle: "年化 %" }) });
        api.draw(c2, { type: "bar", data: { labels: N3, datasets: [{ label: "市场权重", data: wm.map(x => x * 100), backgroundColor: "rgba(37,99,235,.65)" }, { label: "BL 最优权重", data: wu.map(x => x * 100), backgroundColor: "rgba(245,158,11,.8)" }] }, options: api.chartOpts({ yTitle: "权重 %" }) });
        const gap0 = (pi[0] - pi[1]) * 100, gap = (mu[0] - mu[1]) * 100;
        api.stats(st, [["均衡下 大盘−小盘", fx(gap0, 2) + "%"], ["你的观点", fx(v.q, 1) + "%"], ["后验 大盘−小盘", fx(gap, 2) + "%", "good"], ["观点不确定性 Ω", om.toExponential(2)]]);
        api.explain("市场均衡隐含“大盘−小盘 = " + fx(gap0, 2) + "%”,你认为是 " + fx(v.q, 1) + "%。后验 " + fx(gap, 2) + "% 落在两者之间,位置由信心决定(本例用 Ω = τPΣPᵀ·(1−c)/c,信心 50% 时两者各占一半)。" + " 注意国债的后验收益也变了:因为它和股票相关,<b>一个观点会通过协方差“传染”到其它资产</b>。权重只在观点涉及的资产上倾斜,其它资产基本保持市场权重。");
      };
    }
  });

  /* ===================== 第 5 章 ===================== */
  def("ch5-barrier", {
    kind: "walk", title: "三重障碍法:价格先碰到哪条线?", xp: 20,
    tryit: "按 ▶ 播放,看价格从入场点出发,先碰到<b>止盈线</b>(+1)、<b>止损线</b>(−1)还是<b>时间线</b>(0)。点“新路径”多试几次;再调宽止盈、调窄止损,看下方 1000 条路径的标签分布怎么变。",
    build(body, api) {
      let seed = 1, path = [];
      const v = api.controls(body, [
        { k: "up", label: "止盈 = 入场价 × (1 + k₁·σ)", min: 0.5, max: 4, step: 0.25, v: 2, fmt: x => "k₁ = " + x },
        { k: "dn", label: "止损 = 入场价 × (1 − k₂·σ)", min: 0.5, max: 4, step: 0.25, v: 2, fmt: x => "k₂ = " + x },
        { k: "H", label: "最长持有", min: 5, max: 40, v: 20, fmt: x => x + " 天" },
        { k: "mu", label: "日漂移(趋势)", min: -0.3, max: 0.3, step: 0.05, v: 0, fmt: x => x.toFixed(2) + "%" }
      ], () => { gen(); S.reset(v.H + 1, true); dist(); });
      const bar = api.div(body, "btn-row"); api.btn(bar, "🎲 新路径", () => { seed++; gen(); S.reset(v.H + 1); }, "secondary");
      const cv = api.canvas(body, 270), row = api.div(body, "two-col"), st = api.div(row), c2 = api.canvas(row, 180);
      const sig = 0.015, B = (k, sgn) => 100 * (1 + sgn * k * sig * Math.sqrt(1));
      function simPath(R) { const p = [100]; for (let t = 1; t <= 40; t++) p.push(p[t - 1] * Math.exp(v.mu / 100 + sig * R.g())); return p; }
      function label(p) { const up = B(v.up, 1), dn = B(v.dn, -1); for (let t = 1; t <= v.H; t++) { if (p[t] >= up) return [1, t]; if (p[t] <= dn) return [-1, t]; } return [0, v.H]; }
      function gen() { path = simPath(rng(seed * 433)); }
      function dist() {
        const R = rng(77), cnt = { "-1": 0, "0": 0, "1": 0 }; let hold = 0;
        for (let k = 0; k < 1000; k++) { const [l, t] = label(simPath(R)); cnt[l]++; hold += t; }
        api.draw(c2, { type: "bar", data: { labels: ["−1 止损", "0 到期", "+1 止盈"], datasets: [{ label: "1000 条路径的标签分布", data: [cnt["-1"], cnt["0"], cnt["1"]], backgroundColor: [C.red, C.gray, C.green] }] }, options: api.chartOpts({}) });
        api._avgHold = hold / 1000;
      }
      gen(); dist();
      const S = api.stepper(body, {
        n: v.H + 1, label: "第",
        onStep(i) {
          const up = B(v.up, 1), dn = B(v.dn, -1), [l, t] = label(path), L = Array.from({ length: v.H + 1 }, (_, k) => k);
          const hit = i >= t;
          api.draw(cv, { type: "line", data: { labels: L, datasets: [
            api.line("价格", path.slice(0, v.H + 1).map((x, k) => k <= Math.min(i, t) ? x : null), C.blue, { borderWidth: 2.5 }),
            api.line("止盈线 " + fx(up), L.map(() => up), C.green, { borderDash: [6, 4] }), api.line("止损线 " + fx(dn), L.map(() => dn), C.red, { borderDash: [6, 4] }),
            { type: "scatter", label: "触发点", data: L.map(k => (hit && k === t) ? path[t] : null), backgroundColor: l === 1 ? C.green : l === -1 ? C.red : C.gray, pointRadius: 9, pointStyle: "star" }] },
            options: api.chartOpts({ xTitle: "入场后第几天(竖直的终点 = 时间障碍)", yTitle: "价格", yMin: Math.min(dn, ...path.slice(0, v.H + 1)) - 1, yMax: Math.max(up, ...path.slice(0, v.H + 1)) + 1 }) });
          api.stats(st, [["当前天数", Math.min(i, t) + " / " + v.H], ["当前价格", fx(path[Math.min(i, t)])], ["标签", hit ? (l === 1 ? "+1 止盈" : l === -1 ? "−1 止损" : "0 到期") : "…进行中", hit ? (l === 1 ? "good" : l === -1 ? "bad" : "") : ""], ["平均持有(1000 条)", fx(api._avgHold, 1) + " 天"]]);
          return hit ? (l === 0 ? "第 " + t + " 天到达<b>时间障碍</b>,价格既没止盈也没止损 → 标签 0(或按最终收益的符号记)。" : "第 " + t + " 天碰到<b>" + (l === 1 ? "止盈线 → 标签 +1" : "止损线 → 标签 −1") + "</b>。之后的价格不再影响标签——这正是它和“固定 " + v.H + " 天后看涨跌”的区别。")
            : "第 " + i + " 天:价格 " + fx(path[i]) + ",还在两条线之间,继续观察。";
        }
      });
      api.render = () => S.go(S.i);
      api.explain("障碍宽度用波动率 σ 的倍数设定,所以高波动时期障碍自动变宽。止盈宽、止损窄会产生更多 −1 标签(因为窄的线更容易先被碰到);加入正漂移则 +1 变多。标签分布是否平衡,会直接影响分类模型的训练。");
    }
  });

  def("ch5-cv", {
    kind: "play", title: "交叉验证泄漏实验室:Purge 与 Embargo", xp: 25,
    predict: { q: "数据是纯随机游走(没有任何可预测性),标签看未来 10 天。用<b>打乱的</b> 5 折交叉验证训练一个最近邻模型,准确率大约是?", o: ["约 50%", "明显高于 50%", "明显低于 50%"], a: 1, e: "打乱后,测试样本的“时间邻居”在训练集里,它们的特征和标签高度重叠。模型只要“抄邻居”就能答对——准确率被泄漏抬高。" },
    tryit: "上半部分:每个小方块是一天。选择第几折做测试,调大“标签期限 h”,看训练集中有多少红色方块(标签区间与测试集重叠 = 泄漏);勾选 Purge 和调整 Embargo 把它们删掉。下半部分:在纯噪声数据上真的跑一遍最近邻分类器,比较三种切分方式的准确率。",
    build(body, api) {
      const v = api.controls(body, [
        { k: "K", label: "折数 K", min: 3, max: 8, v: 5 },
        { k: "f", label: "测试第几折", min: 1, max: 8, v: 3 },
        { k: "h", label: "标签期限 h", min: 1, max: 15, v: 10, fmt: x => x + " 天" },
        { k: "purge", label: "Purge(删除重叠样本)", type: "check", v: false },
        { k: "emb", label: "Embargo(测试后禁运)", min: 0, max: 10, v: 0, fmt: x => x + " 天" }
      ], () => api.render());
      const tl = api.div(body, "cv-tl"), leg = api.div(body, "legend-note"), st = api.div(body), cv = api.canvas(body, 230);
      leg.innerHTML = '<span class="cvk tr"></span>训练 <span class="cvk te"></span>测试 <span class="cvk lk"></span>泄漏(标签与测试期重叠,却留在训练集) <span class="cvk pg"></span>已 purge <span class="cvk em"></span>embargo';
      let cache = {};
      function leakExp(h) {
        if (cache[h]) return cache[h];
        const R = rng(123), n = 500, e = Array.from({ length: n + 5 * h + 5 }, () => R.g()), X = [], Y = [];
        for (let t = 4 * h; t < n + 4 * h; t++) { const f = [1, 2, 3, 4].map(m => { let a = 0; for (let k = 0; k < m * h; k++) a += e[t - k]; return a / Math.sqrt(m * h); }); let c = 0; for (let k = 1; k <= h; k++) c += e[t + k]; X.push(f); Y.push(c > 0 ? 1 : 0); }
        const N = X.length, idx = Array.from({ length: N }, (_, i) => i);
        function acc(folds, purge) {
          let ok = 0, tot = 0;
          folds.forEach(test => {
            const tset = new Set(test), lo = Math.min(...test), hi = Math.max(...test);
            const train = idx.filter(i => !tset.has(i) && !(purge && i + h >= lo && i <= hi + h + 5));
            test.forEach(i => { let best = 1e9, by = 0; const xi = X[i]; for (const j of train) { const xj = X[j]; const d = (xi[0] - xj[0]) ** 2 + (xi[1] - xj[1]) ** 2 + (xi[2] - xj[2]) ** 2 + (xi[3] - xj[3]) ** 2; if (d < best) { best = d; by = Y[j]; } } ok += by === Y[i]; tot++; });
          });
          return ok / tot;
        }
        const sh = [...idx].sort(() => R.u() - 0.5), K = 5;
        const shuf = Array.from({ length: K }, (_, k) => sh.filter((_, i) => i % K === k));
        const blk = Array.from({ length: K }, (_, k) => idx.filter(i => Math.floor(i * K / N) === k));
        return (cache[h] = [acc(shuf, false), acc(blk, false), acc(blk, true)]);
      }
      api.render = () => {
        const n = 60, K = v.K, f = Math.min(v.f, K) - 1, h = v.h;
        const lo = Math.floor(f * n / K), hi = Math.floor((f + 1) * n / K) - 1;
        let leak = 0, purged = 0, emb = 0, train = 0;
        tl.innerHTML = Array.from({ length: n }, (_, i) => {
          let c = "tr";
          if (i >= lo && i <= hi) c = "te";
          else if (i < lo && i + h >= lo) { c = v.purge ? "pg" : "lk"; }
          else if (i > hi && i <= hi + v.emb) c = "em";
          if (c === "lk") leak++; if (c === "pg") purged++; if (c === "em") emb++; if (c === "tr" || c === "lk") train++;
          return '<span class="cvc ' + c + '" title="第 ' + i + " 天,标签区间 [" + i + ", " + (i + h) + ']"></span>';
        }).join("");
        const [a1, a2, a3] = leakExp(h);
        api.draw(cv, { type: "bar", data: { labels: ["打乱的 K 折", "按时间切块", "切块 + Purge + Embargo"], datasets: [{ label: "最近邻分类器在纯噪声上的准确率 %(h = " + h + ")", data: [a1, a2, a3].map(x => x * 100), backgroundColor: [C.red, C.blue, C.green] }, { type: "line", label: "应有的 50%", data: [50, 50, 50], borderColor: C.gray, borderDash: [5, 4], pointRadius: 0 }] }, options: api.chartOpts({ yMin: 30, yMax: 100, yTitle: "%" }) });
        api.stats(st, [["训练样本", train], ["泄漏样本", leak, leak ? "bad" : "good"], ["已 purge", purged], ["embargo 删除", emb]]);
        api.explain("测试块是第 " + lo + "–" + hi + " 天。训练样本 i 的标签要看到第 i+h 天,所以第 " + Math.max(0, lo - h) + "–" + (lo - 1) + " 天的标签“偷看”了测试期 → 红色。" + (v.purge ? " Purge 把它们删掉了。" : " 勾选 Purge 删除它们。") + " 测试块<b>之后</b>的样本,它们的特征(如滚动指标)用到了测试期的数据,用 Embargo 隔开。<br>下方实验:打乱 K 折的准确率 <b>" + pct(a1, 0) + "</b>——在纯噪声上!这完全是“抄邻居”的泄漏。h 越大,泄漏越严重(试试 h = 1 和 h = 15)。");
      };
    }
  });

  def("ch5-overfit", {
    kind: "game", title: "找出过拟合:树要长多深?", xp: 25,
    tryit: "拖动“树深度”,看拟合曲线(橙)怎样从粗糙的台阶变成追逐每个噪声点的锯齿。训练误差(蓝)会一直下降——但测试误差呢?先用滑块选你认为<b>测试误差最低</b>的深度,点“锁定答案”揭晓。猜中(±1)即过关。",
    build(body, api) {
      let seed = 1, locked = false, data;
      const v = api.controls(body, [{ k: "d", label: "树深度 max_depth", min: 1, max: 10, v: 2 }, { k: "leaf", label: "叶子最少样本 min_samples_leaf", min: 1, max: 15, v: 1 }], () => api.render());
      const bar = api.div(body, "btn-row"); api.btn(bar, "🔒 锁定答案,揭晓测试误差", () => { locked = true; api.render(); }); api.btn(bar, "🎲 换一组数据", () => { seed++; locked = false; gen(); api.render(); }, "secondary");
      const row = api.div(body, "two-col"), c1 = api.canvas(row, 260), c2 = api.canvas(row, 260), st = api.div(body), fb = api.div(body, "gc-fb");
      const fn = x => Math.sin(2 * Math.PI * x) * 0.8 + 0.6 * x;
      function gen() { const R = rng(seed * 61); const mk = n => Array.from({ length: n }, () => { const x = R.u(); return { x, y: fn(x) + R.g() * 0.45 }; }); data = { tr: mk(60).sort((a, b) => a.x - b.x), te: mk(600) }; }
      function fit(pts, depth, leaf) {
        if (depth === 0 || pts.length < 2 * leaf) return { v: mean(pts.map(p => p.y)) };
        let best = null; const ys = pts.map(p => p.y), tot = U.sum(ys);
        let ls = 0, lq = 0; const tq = ys.reduce((s, y) => s + y * y, 0);
        for (let i = 0; i < pts.length - 1; i++) { ls += ys[i]; lq += ys[i] * ys[i]; const nl = i + 1, nr = pts.length - nl; if (nl < leaf || nr < leaf || pts[i].x === pts[i + 1].x) continue; const sse = (lq - ls * ls / nl) + (tq - lq - (tot - ls) ** 2 / nr); if (!best || sse < best.sse) best = { sse, i }; }
        if (!best) return { v: mean(ys) };
        const thr = (pts[best.i].x + pts[best.i + 1].x) / 2;
        return { thr, l: fit(pts.slice(0, best.i + 1), depth - 1, leaf), r: fit(pts.slice(best.i + 1), depth - 1, leaf) };
      }
      const pred = (t, x) => t.thr == null ? t.v : pred(x < t.thr ? t.l : t.r, x);
      const mse = (t, pts) => mean(pts.map(p => (p.y - pred(t, p.x)) ** 2));
      gen();
      api.render = () => {
        const curves = Array.from({ length: 10 }, (_, k) => { const t = fit(data.tr, k + 1, v.leaf); return { tr: mse(t, data.tr), te: mse(t, data.te) }; });
        const t = fit(data.tr, v.d, v.leaf), xs = Array.from({ length: 300 }, (_, k) => k / 299);
        api.draw(c1, { type: "scatter", data: { datasets: [{ label: "训练数据(60 个点)", data: data.tr, backgroundColor: "rgba(37,99,235,.55)", pointRadius: 3 }, { type: "line", label: "深度 " + v.d + " 的树", data: xs.map(x => ({ x, y: pred(t, x) })), borderColor: C.orange, pointRadius: 0, borderWidth: 2.5, stepped: true }, { type: "line", label: "真实规律", data: xs.map(x => ({ x, y: fn(x) })), borderColor: C.green, borderDash: [5, 4], pointRadius: 0, borderWidth: 1.5 }] }, options: api.chartOpts({ xType: "linear", xMin: 0, xMax: 1 }) });
        const bestD = curves.reduce((b, c, k) => c.te < curves[b].te ? k : b, 0) + 1;
        api.draw(c2, { type: "line", data: { labels: curves.map((_, k) => k + 1), datasets: [api.line("训练误差 MSE", curves.map(c => c.tr), C.blue, { pointRadius: 3 }), api.line("测试误差 MSE(600 个新点)", locked ? curves.map(c => c.te) : curves.map(() => null), C.red, { pointRadius: 3 }), { type: "scatter", label: "你的选择", data: curves.map((c, k) => k + 1 === v.d ? c.tr : null), backgroundColor: C.orange, pointRadius: 8, pointStyle: "star" }] }, options: api.chartOpts({ xTitle: "树深度", yTitle: "MSE", yMin: 0 }) });
        api.stats(st, [["训练 MSE", fx(curves[v.d - 1].tr, 3)], ["测试 MSE", locked ? fx(curves[v.d - 1].te, 3) : "🔒"], ["噪声方差(不可约误差)", fx(0.45 ** 2, 3)], ["测试最优深度", locked ? bestD : "🔒"]]);
        if (locked) {
          const ok = Math.abs(v.d - bestD) <= 1;
          fb.innerHTML = ok ? '<span class="pos">🎉 猜中了!</span> 测试误差在深度 ' + bestD + " 最低。" : '<span class="neg">没猜中</span>:测试误差在深度 <b>' + bestD + "</b> 最低。换一组数据再试!";
          if (ok) api.win("找到了最优树深度");
          api.explain("训练误差随深度<b>单调下降</b>,深度 10 时几乎在背诵每个噪声点;测试误差先降后升,呈 U 形。训练误差低于噪声方差 " + fx(0.45 ** 2, 3) + " 就说明模型在拟合噪声。“叶子最少样本”是另一个刹车:把它调到 10,深树也不容易过拟合了。金融数据信噪比极低,最优模型通常比你想象的更简单。");
        } else { fb.innerHTML = ""; api.explain("现在只看得到训练误差——就像只看样本内回测。它总是告诉你“越复杂越好”。"); }
      };
    }
  });

  def("ch5-gd", {
    kind: "walk", title: "梯度下降:一步一步走下山", xp: 20,
    tryit: "图中颜色越深代表损失越小(山谷)。按 ▶ 播放看参数 (a, b) 每一步沿负梯度移动。把学习率调到 0.9 看它“之”字形震荡,调到 1.05 看它<b>发散</b>飞出去;调到 0.02 看它慢吞吞。梯度提升树(LightGBM)的 learning_rate 也是同一个道理。",
    needsChart: false,
    build(body, api) {
      const v = api.controls(body, [{ k: "lr", label: "学习率 η", min: 0.02, max: 1.1, step: 0.01, v: 0.3, fmt: x => x.toFixed(2) }, { k: "st", label: "起点", type: "select", opts: [["a", "(−3, 3)"], ["b", "(3, −2)"], ["c", "(−2, −3)"]], v: "a" }], () => { compute(); S.go(S.i); });
      const wrap = api.div(body, "gd-wrap"), cvs = document.createElement("canvas"); cvs.className = "gd-canvas"; wrap.appendChild(cvs); const st = api.div(body);
      const R = rng(9), n = 50, xs = [], ys = []; for (let i = 0; i < n; i++) { const x = R.g(); xs.push(x); ys.push(1 + 2 * x + R.g() * 0.7 + 0.3 * x * x * 0); }
      const mx = mean(xs), sx = std(xs), X = xs.map(x => (x - mx) / sx);
      const loss = (a, b) => mean(X.map((x, i) => (ys[i] - a - b * x) ** 2));
      const grad = (a, b) => { let ga = 0, gb = 0; X.forEach((x, i) => { const e = ys[i] - a - b * x; ga += -2 * e; gb += -2 * e * x; }); return [ga / n, gb / n]; };
      let path = [];
      function compute() { const s = { a: [-3, 3], b: [3, -2], c: [-2, -3] }[v.st]; let [a, b] = s; path = [{ a, b, L: loss(a, b), g: grad(a, b) }]; for (let k = 0; k < 30; k++) { const g = grad(a, b); a -= v.lr * g[0]; b -= v.lr * g[1]; if (!isFinite(a) || Math.abs(a) > 1e6) break; path.push({ a, b, L: loss(a, b), g: grad(a, b) }); } }
      compute();
      const ols = U.ols(X.map(x => [1, x]), ys).beta;
      function paint(i) {
        const W = wrap.clientWidth || 600, H = Math.min(360, Math.max(240, W * 0.55)), dpr = window.devicePixelRatio || 1;
        cvs.width = W * dpr; cvs.height = H * dpr; cvs.style.width = W + "px"; cvs.style.height = H + "px";
        const ctx = cvs.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        const A0 = -4, A1 = 6, B0 = -4, B1 = 6, px = a => (a - A0) / (A1 - A0) * W, py = b => H - (b - B0) / (B1 - B0) * H;
        const dark = document.documentElement.getAttribute("data-theme") === "dark", step = 6;
        let mn = 1e9, mxL = -1e9; const grid = [];
        for (let yy = 0; yy < H; yy += step) for (let xx = 0; xx < W; xx += step) { const a = A0 + xx / W * (A1 - A0), b = B0 + (H - yy) / H * (B1 - B0), l = Math.log(loss(a, b) + 0.1); grid.push([xx, yy, l]); mn = Math.min(mn, l); mxL = Math.max(mxL, l); }
        grid.forEach(([xx, yy, l]) => { const t = (l - mn) / (mxL - mn); const band = Math.floor(t * 14) % 2; const c = dark ? Math.round(20 + t * 60 + band * 6) : Math.round(255 - (1 - t) * 120 - band * 8); ctx.fillStyle = dark ? "rgb(" + c + "," + (c + 10) + "," + (c + 40) + ")" : "rgb(" + (c - 30) + "," + (c - 10) + "," + c + ")"; ctx.fillRect(xx, yy, step, step); });
        ctx.fillStyle = dark ? "#e6edf3" : "#1f2328"; ctx.font = "12px sans-serif"; ctx.fillText("截距 a →", W - 70, H - 8); ctx.fillText("↑ 斜率 b", 6, 14);
        ctx.strokeStyle = "#16a34a"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(px(ols[0]), py(ols[1]), 7, 0, 7); ctx.stroke();
        ctx.strokeStyle = "#f59e0b"; ctx.lineWidth = 2.5; ctx.beginPath();
        path.slice(0, i + 1).forEach((p, k) => { const x = clamp(px(p.a), -50, W + 50), y = clamp(py(p.b), -50, H + 50); k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.stroke();
        path.slice(0, i + 1).forEach((p, k) => { ctx.fillStyle = k === i ? "#dc2626" : "#f59e0b"; ctx.beginPath(); ctx.arc(clamp(px(p.a), -50, W + 50), clamp(py(p.b), -50, H + 50), k === i ? 6 : 3, 0, 7); ctx.fill(); });
      }
      const S = api.stepper(body, {
        n: 31, label: "迭代",
        onStep(i) {
          const k = Math.min(i, path.length - 1), p = path[k]; paint(k);
          api.stats(st, [["参数 (a, b)", "(" + fx(p.a, 2) + ", " + fx(p.b, 2) + ")"], ["损失 MSE", p.L > 1e6 ? "爆炸 💥" : fx(p.L, 3), p.L > path[0].L ? "bad" : ""], ["梯度 (∂a, ∂b)", "(" + fx(p.g[0], 2) + ", " + fx(p.g[1], 2) + ")"], ["最优解(绿圈)", "(" + fx(ols[0], 2) + ", " + fx(ols[1], 2) + ")"]]);
          const div = path.length < 31 || path[path.length - 1].L > path[0].L;
          return "<b>第 " + k + " 步</b>:新参数 = 旧参数 − η × 梯度 = (" + fx(p.a, 2) + ", " + fx(p.b, 2) + ")。" + (div && k > 3 ? " <b>学习率太大,步子迈过了谷底,越跳越远——发散了!</b>" : v.lr > 0.8 ? " 步子很大,在谷底两侧来回跳(“之”字形)。" : v.lr < 0.06 ? " 步子太小,要走很久才能到谷底。" : p.L - loss(ols[0], ols[1]) < 1e-3 ? " 已经到达谷底附近。" : "");
        }
      });
      api.render = () => S.go(S.i);
      window.addEventListener("resize", () => { if (api.el.offsetParent) S.go(S.i); });
      api.explain("梯度指向损失<b>上升最快</b>的方向,所以沿负梯度走一步损失就会下降。学习率 η 决定步长:这里 x 已经标准化,当 η > 1 时步子超过“谷宽”,迭代必然发散。梯度提升(GBDT/LightGBM)把同样的思想用在“函数空间”里:每棵新树拟合当前的负梯度,再乘以 learning_rate 加进模型——学习率小 + 树多,通常比学习率大 + 树少更不容易过拟合。");
    }
  });
})();

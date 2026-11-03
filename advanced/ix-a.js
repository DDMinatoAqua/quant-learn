/* 互动组件:前置知识、第 1 章、第 2 章 */
(function () {
  "use strict";
  const { def, U } = window.QX;
  const { rng, mean, std, pct, fx, clamp, ranks, corr, rankCorr, hist, cumprod, PALETTE } = U;
  const C = { blue: "#2563eb", orange: "#f59e0b", green: "#16a34a", red: "#dc2626", purple: "#8b5cf6", gray: "#64748b", cyan: "#0891b2" };

  /* ===================== 前置知识 ===================== */
  def("pre-dot", {
    kind: "play", title: "两资产组合波动:相关性的魔法", xp: 15,
    predict: { q: "两只资产波动分别为 20% 和 10%,相关系数 ρ = −1。能不能配出一个波动率为 0 的组合(只做多)?", o: ["不能,最低也有 10%", "能,按某个比例配置时波动正好为 0", "只有各配 50% 时才行"], a: 1, e: "完全负相关时一个涨、另一个必然按比例跌,只要 w₁σ₁ = w₂σ₂(即 w₁ = σ₂/(σ₁+σ₂) = 1/3),两者的波动正好抵消。" },
    tryit: "先把相关系数 ρ 拖到 <b>1</b>,看蓝色曲线和虚线重合;再慢慢拖到 <b>−1</b>,看曲线如何“弯下去”甚至碰到 0。注意:每个资产自己的波动没变,变的只有相关性。",
    build(body, api) {
      const v = api.controls(body, [
        { k: "w", label: "资产 1 权重 w₁", min: 0, max: 100, v: 60, fmt: x => x + "%" },
        { k: "s1", label: "资产 1 波动 σ₁", min: 5, max: 40, v: 20, fmt: x => x + "%" },
        { k: "s2", label: "资产 2 波动 σ₂", min: 5, max: 40, v: 10, fmt: x => x + "%" },
        { k: "rho", label: "相关系数 ρ", min: -100, max: 100, v: 30, fmt: x => (x / 100).toFixed(2) }
      ], () => api.render());
      const st = api.div(body), cv = api.canvas(body, 300), calc = api.div(body, "calc-box");
      const vol = (w, s1, s2, r) => Math.sqrt(Math.max(w * w * s1 * s1 + (1 - w) * (1 - w) * s2 * s2 + 2 * w * (1 - w) * r * s1 * s2, 0));
      api.render = () => {
        const w = v.w / 100, s1 = v.s1 / 100, s2 = v.s2 / 100, r = v.rho / 100;
        const cur = vol(w, s1, s2, r), avg = w * s1 + (1 - w) * s2;
        const xs = Array.from({ length: 101 }, (_, i) => i / 100);
        let best = 0, bv = 9; xs.forEach(x => { const q = vol(x, s1, s2, r); if (q < bv) { bv = q; best = x; } });
        api.draw(cv, { type: "line", data: { datasets: [
          api.line("组合波动 √(wᵀΣw)", xs.map(x => ({ x: x * 100, y: vol(x, s1, s2, r) * 100 })), C.blue),
          api.line("加权平均波动(ρ=1 时的情形)", xs.map(x => ({ x: x * 100, y: (x * s1 + (1 - x) * s2) * 100 })), C.gray, { borderDash: [6, 4], borderWidth: 1.5 }),
          { type: "scatter", label: "你当前的组合", data: [{ x: w * 100, y: cur * 100 }], backgroundColor: C.orange, borderColor: C.orange, pointRadius: 7 },
          { type: "scatter", label: "最小波动点", data: [{ x: best * 100, y: bv * 100 }], backgroundColor: C.green, borderColor: C.green, pointRadius: 5, pointStyle: "triangle" }
        ] }, options: api.chartOpts({ xType: "linear", xTitle: "资产 1 权重 w₁(%)", yTitle: "年化波动(%)", yMin: 0, xMin: 0, xMax: 100 }) });
        api.stats(st, [["组合波动", pct(cur)], ["加权平均波动", pct(avg)], ["分散化“省下”的波动", pct(avg - cur), "good"], ["最小波动 / 对应 w₁", pct(bv) + " / " + pct(best, 0)]]);
        const S11 = s1 * s1, S22 = s2 * s2, S12 = r * s1 * s2;
        calc.innerHTML = "逐项计算:\\(\\Sigma_{12}=\\rho\\sigma_1\\sigma_2=" + fx(r, 2) + "\\times" + fx(s1, 2) + "\\times" + fx(s2, 2) + "=" + fx(S12, 4) + "\\);" +
          "\\(w^\\top\\Sigma w=" + fx(w * w, 4) + "\\times" + fx(S11, 4) + "+" + fx((1 - w) ** 2, 4) + "\\times" + fx(S22, 4) + "+2\\times" + fx(w, 2) + "\\times" + fx(1 - w, 2) + "\\times(" + fx(S12, 4) + ")=" + fx(cur * cur, 5) + "\\),开方得 " + pct(cur) + "。";
        if (window.renderMathInElement) renderMathInElement(calc, { delimiters: [{ left: "\\(", right: "\\)", display: false }], throwOnError: false });
        api.explain(r > 0.99 ? "ρ = 1:两个资产同涨同跌,组合波动就是加权平均波动(蓝线和虚线重合),<b>分散化毫无作用</b>。"
          : r < -0.99 ? "ρ = −1:完全对冲。w₁ = σ₂/(σ₁+σ₂) = " + pct(s2 / (s1 + s2), 1) + " 时组合波动为 0。现实中几乎不存在这么完美的对冲,但它说明了<b>相关性越低,分散化收益越大</b>。"
          : "ρ = " + fx(r) + ":协方差项 2w₁w₂ρσ₁σ₂ " + (r < 0 ? "是负的,直接“抵消”一部分方差" : "比 ρ=1 时小") + ",所以组合波动 " + pct(cur) + " 低于加权平均 " + pct(avg) + "。绿色三角是只做多时能达到的最低波动。");
      };
    }
  });

  def("pre-ols", {
    kind: "game", title: "手动拟合挑战:你能比最小二乘更好吗?", xp: 25,
    tryit: "拖动<b>截距</b>和<b>斜率</b>两个滑块,让你的橙色直线尽量贴近散点。灰色竖线是残差(每个点到直线的距离)。得分 = OLS 的残差平方和 ÷ 你的残差平方和,<b>达到 97 分</b>就过关。",
    build(body, api) {
      let seed = 7, data, olsFit, shown = false, wins = 0; const wonSeeds = new Set();
      const v = api.controls(body, [
        { k: "a", label: "截距 a", min: -6, max: 6, step: 0.1, v: 0, fmt: x => x.toFixed(1) },
        { k: "b", label: "斜率 b", min: -1, max: 3, step: 0.02, v: 0.5, fmt: x => x.toFixed(2) },
        { k: "res", label: "显示残差", type: "check", v: true }
      ], () => api.render());
      const bar = api.div(body, "btn-row");
      api.btn(bar, "🔄 换一组数据", () => { seed++; shown = false; gen(); api.render(); }, "secondary");
      api.btn(bar, "👀 揭晓 OLS 答案", () => { shown = true; api.render(); }, "secondary");
      const st = api.div(body), cv = api.canvas(body, 320);
      function gen() {
        const R = rng(seed * 101); const a0 = (R.u() * 4 - 2), b0 = 0.3 + R.u() * 1.7;
        const xs = Array.from({ length: 25 }, () => R.u() * 10);
        data = xs.map(x => ({ x, y: a0 + b0 * x + R.g() * 1.6 }));
        olsFit = U.ols(data.map(p => [1, p.x]), data.map(p => p.y));
      }
      gen();
      const sse = (a, b) => data.reduce((s, p) => s + (p.y - a - b * p.x) ** 2, 0);
      api.render = () => {
        const [A, B] = olsFit.beta, my = sse(v.a, v.b), best = sse(A, B), score = Math.min(100, best / my * 100);
        const ds = [{ type: "scatter", label: "数据点", data, backgroundColor: C.blue, borderColor: C.blue, pointRadius: 4 },
          api.line("你的直线", [{ x: 0, y: v.a }, { x: 10, y: v.a + v.b * 10 }], C.orange, { borderWidth: 3 })];
        if (v.res) { const seg = []; data.forEach(p => { seg.push({ x: p.x, y: p.y }, { x: p.x, y: v.a + v.b * p.x }, { x: p.x, y: null }); }); ds.push(api.line("残差", seg, "rgba(100,116,139,.55)", { borderWidth: 1, spanGaps: false })); }
        if (shown) ds.push(api.line("OLS 最优直线", [{ x: 0, y: A }, { x: 10, y: A + B * 10 }], C.green, { borderDash: [6, 4] }));
        api.draw(cv, { type: "line", data: { datasets: ds }, options: api.chartOpts({ xType: "linear", xTitle: "x", yTitle: "y", xMin: 0, xMax: 10, extra: {} }) });
        api.stats(st, [["你的残差平方和", fx(my, 1)], ["OLS 残差平方和", shown ? fx(best, 1) : "?"], ["得分", score.toFixed(1), score >= 97 ? "good" : ""], ["过关次数", wins]]);
        if (score >= 97 && !wonSeeds.has(seed)) { wonSeeds.add(seed); wins++; api.win("手动拟合过关"); if (wins >= 3) api.bonus("3wins", 10, "拟合成功 3 组数据"); }
        api.explain((shown ? "OLS 给出 \\(\\hat a=" + fx(A) + ",\\ \\hat b=" + fx(B) + "\\)(斜率 t 值 " + fx(olsFit.t[1], 1) + ",R² = " + fx(olsFit.r2) + ")。它就是让残差平方和<b>最小</b>的那条线——你怎么拖都不可能比它更低,所以得分最高 100。" :
          "你现在的残差平方和是 " + fx(my, 1) + "。每个残差都要<b>平方</b>,所以离得远的点“惩罚”特别大——试试把线故意拉偏到一个远点附近,看看分数怎么变。") +
          " 公式 \\(\\hat\\beta=(X^\\top X)^{-1}X^\\top y\\) 就是把“拖滑块找最低点”这件事一步算出来。" + (score >= 97 ? " <b>🎉 过关!点“换一组数据”再来一局。</b>" : ""));
        const ex = api.el.querySelector(".ix-exp-text"); if (window.renderMathInElement) renderMathInElement(ex, { delimiters: [{ left: "\\(", right: "\\)", display: false }], throwOnError: false });
      };
    }
  });

  def("pre-ttest", {
    kind: "play", title: "p 值模拟器:1000 个平行宇宙里的回测", xp: 20,
    predict: { q: "一个<b>毫无 alpha</b> 的策略(真实月均收益 = 0),在 1000 个平行宇宙里各做一次 36 个月的回测 + t 检验。大约有多少次会得到 p < 0.05 的“显著”结果?", o: ["0 次", "约 50 次", "约 500 次"], a: 1, e: "显著性水平 5% 的含义就是:原假设为真时,仍有 5% 的概率“误报”。1000 次里约 50 次会显著——全是运气。" },
    tryit: "先保持“真实月均收益 = 0”,看红色柱子(|t| > 1.96,即 p < 0.05)大约占 5%。然后把真实收益调到 0.8%,再把月数从 36 拉到 120,观察“检出率”(统计功效)怎么变。",
    build(body, api) {
      const v = api.controls(body, [
        { k: "mu", label: "真实月均收益", min: 0, max: 2, step: 0.1, v: 0, fmt: x => x.toFixed(1) + "%" },
        { k: "sd", label: "月收益标准差", min: 1, max: 10, step: 0.5, v: 5, fmt: x => x + "%" },
        { k: "n", label: "回测月数", min: 12, max: 240, step: 12, v: 36, fmt: x => x + " 个月" },
        { k: "seed", label: "随机种子", min: 1, max: 50, v: 1 }
      ], () => api.render());
      const st = api.div(body), cv = api.canvas(body, 300);
      api.render = () => {
        const R = rng(v.seed * 977), N = 1000, ts = [];
        for (let k = 0; k < N; k++) { let s = 0, s2 = 0; for (let t = 0; t < v.n; t++) { const x = v.mu / 100 + R.g() * v.sd / 100; s += x; s2 += x * x; } const m = s / v.n, sd = Math.sqrt((s2 - v.n * m * m) / (v.n - 1)); ts.push(m / (sd / Math.sqrt(v.n))); }
        const H = hist(ts, -5, 9, 56), rej = ts.filter(t => Math.abs(t) > 1.96).length;
        const ncp = (v.mu / v.sd) * Math.sqrt(v.n), power = 1 - U.normCdf(1.96 - ncp) + U.normCdf(-1.96 - ncp);
        api.draw(cv, { type: "bar", data: { labels: H.labels.map(x => x.toFixed(1)), datasets: [{ label: "1000 次回测的 t 值分布", data: H.h, backgroundColor: H.labels.map(x => Math.abs(x) > 1.96 ? "rgba(220,38,38,.75)" : "rgba(100,116,139,.55)"), barPercentage: 1, categoryPercentage: 1 }] },
          options: api.chartOpts({ xTitle: "t 值(红色 = |t| > 1.96,p < 0.05)", yTitle: "次数" }) });
        api.stats(st, [["“显著”次数", rej + " / 1000", v.mu === 0 ? "bad" : "good"], ["占比", pct(rej / N)], ["理论值", v.mu === 0 ? "5.0%(误报率)" : pct(power) + "(功效)"], ["t 的理论中心", fx(ncp)]]);
        api.explain(v.mu === 0 ? "真实收益为 0,但仍有约 <b>" + rej + "</b> 次回测“显著”——这就是 5% 显著性水平的代价。如果你试了很多策略,只报告显著的那个,几乎可以肯定是在报告运气(第 7 章的多重检验)。"
          : "真实月均 " + v.mu + "%、波动 " + v.sd + "% 时,夏普(月)= " + fx(v.mu / v.sd) + ",t 值的中心大约在 " + fx(ncp) + "(= 月夏普 × √月数)。" + (power < 0.5 ? "检出率只有 " + pct(power, 0) + ":<b>策略是真的,但样本太短,多数时候检验不出来。</b>试着增加月数。" : "检出率 " + pct(power, 0) + ":样本足够长时,真实的效果才能稳定地被检验出来。"));
      };
    }
  });

  /* ===================== 第 1 章 ===================== */
  def("ch1-adjust", {
    kind: "play", title: "复权实验室:让“假暴跌”消失", xp: 20,
    predict: { q: "前收盘 20.4 元,每股派现 0.4 元并且 10 送 10。不复权的价格在除权日看起来会“跌”多少?", o: ["约 −2%", "约 −51%", "0%,价格不变"], a: 1, e: "参考价 = (20.4 − 0.4)/(1+1) = 10 元,看起来暴跌 51%;但你的股数翻了一倍还拿到了现金,财富几乎没变。" },
    tryit: "先选“不复权”,看第 30 天的悬崖;再切到“后复权”“前复权”,悬崖消失了。拖动分红 D 和送转 S,再打开“5 日均线信号”,看看不复权数据会让均线策略在哪天<b>误发卖出信号</b>。",
    build(body, api) {
      const v = api.controls(body, [
        { k: "mode", label: "价格口径", type: "select", opts: [["raw", "不复权(原始价)"], ["hfq", "后复权"], ["qfq", "前复权"]], v: "raw" },
        { k: "D", label: "每股派现 D", min: 0, max: 2, step: 0.1, v: 0.4, fmt: x => x.toFixed(1) + " 元" },
        { k: "S", label: "每股送转 S", type: "select", opts: [[0, "不送转 (S=0)"], [0.3, "10 转 3 (S=0.3)"], [0.5, "10 转 5 (S=0.5)"], [1, "10 送 10 (S=1)"]], v: 1 },
        { k: "ma", label: "显示 5 日均线和卖出信号", type: "check", v: false }
      ], () => api.render());
      const st = api.div(body), cv = api.canvas(body, 300);
      const R = rng(42), moves = Array.from({ length: 60 }, () => R.g() * 0.015 + 0.001);
      api.render = () => {
        const raw = [], f = []; let p = 20.4 / Math.exp(moves.slice(0, 29).reduce((a, b) => a + b, 0));
        for (let t = 0; t < 60; t++) {
          if (t > 0) p = p * Math.exp(moves[t]);
          if (t === 30) { const prev = raw[29]; p = (prev - v.D) / (1 + v.S) * Math.exp(moves[t]); f.push(prev / ((prev - v.D) / (1 + v.S))); } else f.push(1);
          raw.push(p);
        }
        let F = 1; const Fc = f.map(x => (F *= x)), FT = Fc[59];
        const hfq = raw.map((x, t) => x * Fc[t]), qfq = raw.map((x, t) => x * Fc[t] / FT);
        const ser = v.mode === "raw" ? raw : v.mode === "hfq" ? hfq : qfq;
        const labels = raw.map((_, t) => "D" + (t + 1));
        const ma = ser.map((_, t) => t < 4 ? null : mean(ser.slice(t - 4, t + 1)));
        const sells = ser.map((x, t) => (t > 4 && ma[t - 1] != null && ser[t - 1] >= ma[t - 1] && x < ma[t]) ? x : null);
        const ds = [api.line({ raw: "不复权", hfq: "后复权", qfq: "前复权" }[v.mode] + "价格", ser, C.blue, { borderWidth: 2.5 })];
        if (v.mode !== "raw") ds.push(api.line("不复权(对照)", raw, "rgba(100,116,139,.5)", { borderDash: [4, 4], borderWidth: 1.2 }));
        if (v.ma) { ds.push(api.line("5 日均线", ma, C.orange, { borderWidth: 1.5 })); ds.push({ type: "scatter", label: "跌破均线 → 卖出信号", data: sells, backgroundColor: C.red, borderColor: C.red, pointRadius: 6, pointStyle: "triangle", rotation: 180 }); }
        api.draw(cv, { type: "line", data: { labels, datasets: ds }, options: api.chartOpts({ yTitle: "价格(元)" }) });
        const jump = ser[30] / ser[29] - 1, ref = (raw[29] - v.D) / (1 + v.S);
        api.stats(st, [["除权参考价", fx(ref) + " 元"], ["单日复权因子 f", fx(f[30], 4)], ["第 30 天“收益”", pct(jump), Math.abs(jump) > 0.1 ? "bad" : "good"], ["真实收益(含分红送股)", pct(raw[30] / ref - 1)]]);
        api.explain(v.mode === "raw" ? "不复权价格在除权日从 " + fx(raw[29]) + " 掉到 " + fx(raw[30]) + ",看起来“收益” " + pct(jump) + "。但持有者的股数变成 " + (1 + v.S) + " 倍、还拿到 " + v.D + " 元现金,真实收益只有 " + pct(raw[30] / ref - 1) + "。<b>任何用这条曲线算收益、动量、均线的策略都会被骗。</b>" + (v.ma ? " 看红色三角:除权日的“卖出信号”完全是假的。" : "")
          : (v.mode === "hfq" ? "后复权:以第一天为基准,把除权日之后的价格乘以累计因子 F = " + fx(FT, 3) + "。价格连续了,第 30 天收益恢复为真实值。缺点:价格水平和当时的真实价格不同(最新价被放大了)。"
            : "前复权:以最新价为基准,把除权日之前的价格除以 F = " + fx(FT, 3) + "。最新价格和行情软件一致,但<b>历史价格会随每次新分红而改变</b>。") + " 两种复权的日收益率完全一样——切换看看第 30 天的“收益”数字。");
      };
    }
  });

  def("ch1-tradable", {
    kind: "game", title: "能不能成交?A 股交易规则快问快答", xp: 30,
    tryit: "每一题给出一只股票当天的行情和你想做的交易。按本节的<b>保守规则</b>判断:回测里这笔交易能不能成交?答完 8 题,<b>答对 7 题</b>以上过关。提示:先算涨停价 / 跌停价(前收 × (1 ± 限制比例),四舍五入到分)。",
    build(body, api) {
      const card = api.div(body, "game-card"), st = api.div(body);
      let round = 0, score = 0, seed = 1, q = null, answered = false;
      const BOARDS = [["主板", 0.10], ["ST 股", 0.05], ["创业板", 0.20]];
      const TYPES = ["normal", "yzzt", "yzdt", "closeup", "closedown", "halt"];
      const r2 = x => Math.round(x * 100) / 100;
      function gen() {
        const R = rng(seed * 7919 + round * 31);
        const [bn, lim] = R.pick(BOARDS), pc = r2(5 + R.u() * 45), up = r2(pc * (1 + lim)), dn = r2(pc * (1 - lim));
        const type = R.pick(TYPES), side = R.u() < 0.5 ? "buy" : "sell", at = R.u() < 0.5 ? "open" : "close";
        let o, h, l, c, vol = Math.round(2e5 + R.u() * 3e6);
        const mid = () => r2(pc * (1 + (R.u() - 0.5) * lim));
        if (type === "normal") { o = mid(); c = mid(); h = r2(Math.max(o, c) * (1 + R.u() * lim / 4)); l = r2(Math.min(o, c) * (1 - R.u() * lim / 4)); h = Math.min(h, up); l = Math.max(l, dn); }
        else if (type === "yzzt") { o = h = l = c = up; vol = Math.round(vol / 20); }
        else if (type === "yzdt") { o = h = l = c = dn; vol = Math.round(vol / 20); }
        else if (type === "closeup") { o = r2(pc * (1 + lim * 0.3)); h = up; l = r2(Math.min(o, pc) * (1 - lim * 0.1)); c = up; }
        else if (type === "closedown") { o = r2(pc * (1 - lim * 0.3)); l = dn; h = r2(Math.max(o, pc) * (1 + lim * 0.1)); c = dn; }
        else { o = h = l = c = pc; vol = 0; }
        let ok, why;
        if (type === "halt") { ok = false; why = "停牌(成交量为 0),买卖都不可能成交。"; }
        else if (type === "yzzt") { ok = side === "sell"; why = "一字涨停:全天都在涨停价,买单排队几乎轮不到你 → 买入 ❌;想卖的人很少,卖出 ✅。"; }
        else if (type === "yzdt") { ok = side === "buy"; why = "一字跌停:全天封在跌停价,卖单排队卖不掉 → 卖出 ❌;买入 ✅。"; }
        else if (type === "closeup") { ok = !(side === "buy" && at === "close"); why = "收盘涨停但开盘时没有涨停:" + (side === "buy" && at === "close" ? "按<b>收盘价买入</b>时价格已封涨停,保守假设买不到 ❌。" : at === "open" ? "按开盘价 " + o + " 成交时还没涨停,✅。" : "卖出不受涨停影响 ✅。"); }
        else if (type === "closedown") { ok = !(side === "sell" && at === "close"); why = "收盘跌停但开盘时没有跌停:" + (side === "sell" && at === "close" ? "按<b>收盘价卖出</b>时已封跌停,保守假设卖不掉 ❌。" : at === "open" ? "按开盘价 " + o + " 成交时还没跌停,✅。" : "买入不受跌停影响 ✅。"); }
        else { ok = true; why = "正常交易日,价格在涨跌停之间,成交量正常 → 可以成交 ✅。"; }
        q = { bn, lim, pc, up, dn, o, h, l, c, vol, side, at, ok, why };
      }
      function show() {
        answered = false;
        if (round >= 8) {
          const pass = score >= 7;
          card.innerHTML = '<div class="game-over">' + (pass ? "🎉 过关!" : "😅 差一点") + " 8 题答对 <b>" + score + "</b> 题。" + (pass ? "你已经能像一个谨慎的回测引擎那样思考了。" : "回看上面的保守规则表,再来一局吧。") + "</div>";
          const b = api.btn(card, "🔁 再来一局", () => { seed++; round = 0; score = 0; gen(); show(); });
          if (pass) api.win("可交易性判断 8 题 ≥ 7"); if (score === 8) api.bonus("perfect", 10, "全对!");
          api.explain("核心原则:<b>拿不准能否成交时,假设不能</b>。回测把买不到的涨停股当成买到了,是打板、动量类策略收益被严重高估的头号原因。"); renderStats(); return;
        }
        gen();
        card.innerHTML = '<div class="gc-top">第 ' + (round + 1) + ' / 8 题 · <b>' + q.bn + '</b>(涨跌幅限制 ±' + q.lim * 100 + '%)</div>' +
          '<table class="mini"><tr><th>前收</th><th>开</th><th>高</th><th>低</th><th>收</th><th>成交量(股)</th></tr><tr><td>' + q.pc.toFixed(2) + "</td><td>" + q.o.toFixed(2) + "</td><td>" + q.h.toFixed(2) + "</td><td>" + q.l.toFixed(2) + "</td><td>" + q.c.toFixed(2) + "</td><td>" + q.vol.toLocaleString() + "</td></tr></table>" +
          '<div class="gc-q">你的回测想要:<b>' + (q.at === "open" ? "以开盘价" : "以收盘价") + (q.side === "buy" ? "买入" : "卖出") + "</b>。能成交吗?</div>" +
          '<div class="btn-row"><button type="button" class="btn ans" data-v="1">✅ 能成交</button><button type="button" class="btn secondary ans" data-v="0">❌ 不能成交</button><button type="button" class="btn secondary hint">💡 提示</button></div><div class="gc-fb"></div>';
        card.querySelectorAll(".ans").forEach(b => b.addEventListener("click", () => answer(b.dataset.v === "1")));
        card.querySelector(".hint").addEventListener("click", () => { card.querySelector(".gc-fb").innerHTML = "涨停价 = " + q.pc.toFixed(2) + " × " + (1 + q.lim).toFixed(2) + " ≈ <b>" + q.up.toFixed(2) + "</b>,跌停价 ≈ <b>" + q.dn.toFixed(2) + "</b>。对比开盘价和收盘价。"; });
        renderStats();
      }
      function answer(a) {
        if (answered) return; answered = true;
        const right = a === q.ok; if (right) score++;
        const fb = card.querySelector(".gc-fb");
        fb.innerHTML = (right ? '<span class="pos">✔ 正确!</span> ' : '<span class="neg">✘ 不对。</span> ') + q.why + " (涨停价 " + q.up.toFixed(2) + ",跌停价 " + q.dn.toFixed(2) + ")";
        card.querySelectorAll(".ans").forEach(b => b.disabled = true);
        api.btn(fb, round < 7 ? "下一题 →" : "看结果 →", () => { round++; show(); }).style.marginLeft = "10px";
        renderStats();
        api.explain(q.why);
      }
      function renderStats() { api.stats(st, [["进度", Math.min(round + (answered ? 1 : 0), 8) + " / 8"], ["答对", score], ["过关线", "7 题"]]); }
      api.explain("读完题目先自己算涨跌停价,再对照上面的“回测中的保守规则”表格。");
      show();
    }
  });

  def("ch1-pit", {
    kind: "walk", title: "时间机器:回测那天你到底能看到哪些财报?", xp: 20,
    tryit: "按 ▶ 播放,让“回测日期”从 1 月走到 7 月。每走一步,看表格里哪些记录<b>已经公告</b>(可见),比较“PIT 正确做法”和“按报告期对齐(错误)”给出的净利润。重点看 1–4 月:错误做法提前“知道”了什么?",
    build(body, api) {
      const REC = [
        { n: "2023 三季报", p: "2023-09-30", a: "2023-10-28", v: 7.2 },
        { n: "2023 年报(原始版)", p: "2023-12-31", a: "2024-04-20", v: 10.0 },
        { n: "2024 一季报", p: "2024-03-31", a: "2024-04-28", v: 3.0 },
        { n: "2023 年报(更正版)", p: "2023-12-31", a: "2024-06-15", v: 8.5 }
      ];
      const d0 = Date.parse("2024-01-05"), days = Array.from({ length: 31 }, (_, i) => new Date(d0 + i * 7 * 864e5));
      const iso = d => d.toISOString().slice(0, 10);
      const tl = api.div(body, "pit-tl"), tbl = api.div(body), st = api.div(body), cv = api.canvas(body, 220);
      function pit(t) { const vis = REC.filter(r => r.a <= t); if (!vis.length) return null; const mp = vis.reduce((m, r) => r.p > m ? r.p : m, ""); const same = vis.filter(r => r.p === mp).sort((x, y) => x.a < y.a ? 1 : -1); return same[0]; }
      function wrong(t) { const vis = REC.filter(r => r.p <= t); if (!vis.length) return null; const mp = vis.reduce((m, r) => r.p > m ? r.p : m, ""); const same = REC.filter(r => r.p === mp).sort((x, y) => x.a < y.a ? 1 : -1); return same[0]; } // 用“最终版”
      const S = api.stepper(body, {
        n: days.length, label: "第",
        onStep(i) {
          const t = iso(days[i]), lo = Date.parse("2023-10-01"), hi = Date.parse("2024-08-01"), X = d => (6 + (Date.parse(d) - lo) / (hi - lo) * 88).toFixed(2) + "%";
          tl.innerHTML = '<div class="pit-axis"></div>' + REC.map((r, k) => '<div class="pit-mk' + (r.a <= t ? " on" : "") + '" style="left:' + X(r.a) + ';top:' + [4, 4, 44, 4][k] + 'px" title="' + r.n + '">📢 ' + ["三季报", "年报", "一季报", "年报更正"][k] + "<br><small>" + r.a.slice(5) + "</small></div>").join("") +
            '<div class="pit-now" style="left:' + X(t) + '"><span>回测日 ' + t + "</span></div>";
          tbl.innerHTML = '<table class="mini"><tr><th>记录</th><th>报告期</th><th>公告日</th><th>净利润</th><th>回测日能看到吗?</th></tr>' + REC.map(r => "<tr><td>" + r.n + "</td><td>" + r.p + "</td><td>" + r.a + "</td><td>" + r.v + "</td><td>" + (r.a <= t ? '<span class="pos">✔ 已公告</span>' : '<span class="neg">✘ 未来信息</span>') + "</td></tr>").join("") + "</table>";
          const a = pit(t), b = wrong(t);
          api.stats(st, [["PIT 正确:最新一期", a ? a.n + " = " + a.v : "无"], ["按报告期对齐(错)", b ? b.n.replace("原始版", "最终版").replace("更正版", "最终版") + " = " + b.v : "无", a && b && a.v !== b.v ? "bad" : ""], ["两者是否一致", a && b && a.v === b.v ? "一致" : "❌ 不一致", a && b && a.v === b.v ? "good" : "bad"]]);
          const sa = days.slice(0, i + 1).map(d => { const r = pit(iso(d)); return r ? r.v : null; }), sb = days.slice(0, i + 1).map(d => { const r = wrong(iso(d)); return r ? r.v : null; });
          api.draw(cv, { type: "line", data: { labels: days.map(iso).map(s => s.slice(5)), datasets: [api.line("PIT 看到的净利润", sa, C.green, { stepped: true, borderWidth: 3 }), api.line("按报告期对齐 + 最终版(错误)", sb, C.red, { stepped: true, borderDash: [6, 4] })] }, options: api.chartOpts({ yTitle: "净利润", yMin: 0, yMax: 12 }) });
          let msg;
          if (t < "2024-04-20") msg = "现在是 " + t + ":2023 年报<b>还没公布</b>。PIT 只能用三季报(7.2);错误做法因为“报告期 12-31 已过”,直接用了年报——而且是 6 月才更正的<b>最终版 8.5</b>,一次犯了两个错。";
          else if (t < "2024-04-28") msg = "4 月 20 日年报公布(原始版 10.0),PIT 现在看到 10.0;错误做法仍然是 8.5——它用的是“未来修订后”的数字。";
          else if (t < "2024-06-15") msg = "一季报(3.0)公布了,报告期更新,PIT 的“最新一期”换成一季报。注意这里的一季报是单季数据。";
          else msg = "6 月 15 日年报更正为 8.5。从这天起,PIT 数据库里才“应该”出现 8.5。只保存最终版的数据库会把这个数字错误地放到过去所有日期上。";
          return msg;
        }
      });
      api.explain("PIT 查询的规则只有一句话:<b>先按公告日 ≤ 回测日过滤,再在剩下的记录里取报告期最新、公告最晚的那条</b>。红色虚线高于/不同于绿色实线的每一天,都是一次“偷看未来”。");
      S.go(0);
    }
  });

  def("ch1-survivor", {
    kind: "play", title: "幸存者偏差:消失的股票去哪了?", xp: 20,
    predict: { q: "用“今天还在上市”的股票去回测过去 10 年的等权组合,结果通常会?", o: ["偏高(太乐观)", "偏低(太悲观)", "基本不受影响"], a: 0, e: "跌得最惨、最后退市的股票被提前剔除了,剩下的是“赢家”。回测就像只采访了幸存的士兵。" },
    tryit: "调高“退市门槛”和“个股波动”,看橙色线(只用幸存者)和蓝色线(包含退市股)的差距怎么拉大。点“换一个随机市场”多试几次:差距每次都在,而且总是同一个方向。",
    build(body, api) {
      let seed = 3;
      const v = api.controls(body, [
        { k: "th", label: "退市门槛(跌到初始价的)", min: 10, max: 70, step: 5, v: 35, fmt: x => x + "%" },
        { k: "vol", label: "个股年化波动", min: 20, max: 70, step: 5, v: 45, fmt: x => x + "%" },
        { k: "yrs", label: "回测年数", min: 5, max: 15, v: 10, fmt: x => x + " 年" }
      ], () => api.render());
      api.btn(api.div(body, "btn-row"), "🎲 换一个随机市场", () => { seed++; api.render(); }, "secondary");
      const st = api.div(body), cv = api.canvas(body, 300);
      api.render = () => {
        const R = rng(seed * 313), N = 300, T = v.yrs * 12, sd = v.vol / 100 / Math.sqrt(12), mu = 0.006 - sd * sd / 2;
        const price = new Array(N).fill(1), alive = new Array(N).fill(true), rets = [];
        for (let t = 0; t < T; t++) {
          const r = new Array(N).fill(null);
          for (let i = 0; i < N; i++) if (alive[i]) { const g = Math.exp(mu + sd * R.g()); price[i] *= g; r[i] = g - 1; if (price[i] < v.th / 100) { alive[i] = false; r[i] = (1 + r[i]) * 0.5 - 1; } }
          rets.push(r);
        }
        const surv = alive.map((a, i) => a ? i : -1).filter(i => i >= 0);
        const allEW = rets.map(r => mean(r.filter(x => x != null))), survEW = rets.map(r => mean(surv.map(i => r[i])));
        const ea = cumprod(allEW), es = cumprod(survEW), ann = e => Math.pow(e[e.length - 1], 12 / T) - 1;
        const labels = allEW.map((_, t) => (t % 12 === 0 ? "第" + (t / 12 + 1) + "年" : ""));
        api.draw(cv, { type: "line", data: { labels, datasets: [api.line("只用今天的幸存者(有偏差)", es, C.orange), api.line("包含退市股的真实股票池", ea, C.blue)] }, options: api.chartOpts({ yTitle: "等权组合净值", yType: "logarithmic", xTicks: { ticks: { autoSkip: false, maxRotation: 0, color: U.css("--muted"), callback: function (val, i) { return labels[i] || null; } } } }) });
        const dead = N - surv.length;
        api.stats(st, [["退市股票数", dead + " / " + N, "bad"], ["幸存者组合年化", pct(ann(es)), "bad"], ["真实组合年化", pct(ann(ea))], ["每年高估", pct(ann(es) - ann(ea)), "bad"]]);
        api.explain("在这个模拟市场里,每只股票的预期收益<b>完全一样</b>。但 " + dead + " 只股票因为跌破门槛退市(退市时再损失 50%)。只用幸存者回测,你等于提前知道了“谁不会倒下”,年化收益被高估了 <b>" + pct(ann(es) - ann(ea)) + "</b>。波动越大、退市越多,偏差越大。修复方法:使用<b>包含退市股</b>的历史行情和当时的指数成分。");
      };
    }
  });

  /* ===================== 第 2 章 ===================== */
  def("ch2-mad", {
    kind: "play", title: "去极值实验:一个坏数据能毁掉多少?", xp: 15,
    tryit: "增加“极端值比例”和“极端值大小”,观察左图被少数几个点撑宽、标准差暴涨;再调 MAD 的倍数 k,看右图如何把极端值“拉回”边界。注意右边的标准差回到了 1 附近。",
    build(body, api) {
      const v = api.controls(body, [
        { k: "p", label: "极端值比例", min: 0, max: 5, step: 0.5, v: 1, fmt: x => x + "%" },
        { k: "size", label: "极端值大小", min: 5, max: 60, step: 5, v: 25, fmt: x => "±" + x },
        { k: "k", label: "MAD 倍数 k", min: 1.5, max: 6, step: 0.5, v: 3, fmt: x => x.toFixed(1) }
      ], () => api.render());
      const st = api.div(body), row = api.div(body, "two-col"), c1 = api.canvas(row, 230), c2 = api.canvas(row, 230);
      api.render = () => {
        const R = rng(11), N = 500, x = Array.from({ length: N }, () => R.g());
        const no = Math.round(N * v.p / 100); for (let i = 0; i < no; i++) x[i] = (R.u() < 0.5 ? -1 : 1) * v.size * (0.6 + 0.4 * R.u());
        const sorted = [...x].sort((a, b) => a - b), med = sorted[N >> 1];
        const ad = x.map(a => Math.abs(a - med)).sort((a, b) => a - b), mad = ad[N >> 1], sig = 1.4826 * mad;
        const lo = med - v.k * sig, hi = med + v.k * sig, w = x.map(a => clamp(a, lo, hi)), clipped = x.filter(a => a < lo || a > hi).length;
        const H1 = hist(x, Math.min(...x), Math.max(...x) + 1e-9, 40), H2 = hist(w, lo - 0.3, hi + 0.3, 40);
        const mkc = (cv, H, label, col) => api.draw(cv, { type: "bar", data: { labels: H.labels.map(a => a.toFixed(1)), datasets: [{ label, data: H.h, backgroundColor: col, barPercentage: 1, categoryPercentage: 1 }] }, options: api.chartOpts({ yTitle: "股票数" }) });
        mkc(c1, H1, "原始因子分布", "rgba(220,38,38,.6)"); mkc(c2, H2, "MAD 去极值后(±" + v.k + "σ̂)", "rgba(37,99,235,.65)");
        api.stats(st, [["原始 均值 / 标准差", fx(mean(x)) + " / " + fx(std(x))], ["去极值后 均值 / 标准差", fx(mean(w)) + " / " + fx(std(w)), "good"], ["MAD → σ̂ = 1.4826×MAD", fx(mad, 3) + " → " + fx(sig, 3)], ["被截断的股票", clipped]]);
        api.explain("中位数 = " + fx(med, 3) + ",边界 = 中位数 ± " + v.k + " × " + fx(sig, 3) + " = [" + fx(lo) + ", " + fx(hi) + "]。" + (no ? "仅 " + no + " 个极端值就把标准差从约 1 推到 " + fx(std(x)) + ":如果直接做 z-score,正常股票的分数都被“压扁”到 0 附近,排序信息被极端值淹没。" : "没有极端值时,MAD 估计的 σ̂ ≈ 1,和标准差几乎一样——这正是常数 1.4826 的作用。") + " 中位数和 MAD 本身<b>不受极端值影响</b>,所以它们是稳健的。k 太小会把正常数据也截断(看“被截断”数)。");
      };
    }
  });

  def("ch2-ic", {
    kind: "game", title: "猜猜 IC:用眼睛感受预测力", xp: 30,
    predict: { q: "单期 IC = 0.05 的因子,在 300 只股票的“因子 vs 下期收益”散点图上,肉眼能看出“因子越高收益越高”吗?", o: ["一眼就能看出", "几乎看不出,像一团噪声", "能看出明显的负相关"], a: 1, e: "IC 0.05 意味着因子只解释约 0.25% 的收益方差。它的价值来自很多期、很多股票的累积,而不是单张图上的肉眼可见。" },
    tryit: "每一轮给你一张“因子值 vs 下期收益”的散点图(300 只股票)和 5 组平均收益柱状图。猜猜生成它的真实 IC 是多少?5 轮,猜中得 2 分,差一档得 1 分,<b>6 分</b>以上过关。看不出来?试试盯着右边的分组柱状图。",
    build(body, api) {
      const OPTS = [0, 0.05, 0.15, 0.3, 0.6];
      let round = 0, score = 0, seed = 1, cur = null, answered = false;
      const top = api.div(body, "gc-top"), row = api.div(body, "two-col"), c1 = api.canvas(row, 270), c2 = api.canvas(row, 270);
      const opts = api.div(body, "btn-row"), fb = api.div(body, "gc-fb"), st = api.div(body);
      OPTS.forEach((o, k) => api.btn(opts, "IC ≈ " + o, () => guess(k), "secondary ic-opt"));
      function gen() {
        const R = rng(seed * 4241 + round * 17), k = Math.floor(R.u() * OPTS.length), ic = OPTS[k], N = 300;
        const f = Array.from({ length: N }, () => R.g()), r = f.map(x => (ic * x + Math.sqrt(1 - ic * ic) * R.g()) * 8);
        cur = { k, ic, f, r, ric: rankCorr(f, r) };
      }
      function drawRound() {
        const rk = ranks(cur.f), g = [0, 0, 0, 0, 0], c = [0, 0, 0, 0, 0];
        cur.r.forEach((x, i) => { const q = Math.min(4, Math.floor(rk[i] * 5 / cur.f.length)); g[q] += x; c[q]++; });
        api.draw(c1, { type: "scatter", data: { datasets: [{ label: "每个点 = 一只股票", data: cur.f.map((x, i) => ({ x, y: cur.r[i] })), backgroundColor: "rgba(37,99,235,.45)", pointRadius: 2.5 }] }, options: api.chartOpts({ xType: "linear", xTitle: "因子值(标准化)", yTitle: "下期收益 %" }) });
        api.draw(c2, { type: "bar", data: { labels: ["组1(低)", "组2", "组3", "组4", "组5(高)"], datasets: [{ label: "各组平均下期收益 %", data: g.map((x, q) => x / c[q]), backgroundColor: PALETTE.slice(0, 5) }] }, options: api.chartOpts({}) });
      }
      function next() {
        answered = false; fb.innerHTML = "";
        if (round >= 5) {
          const pass = score >= 6;
          top.innerHTML = (pass ? "🎉 过关!" : "😅 再练练") + " 5 轮得分 <b>" + score + " / 10</b>。";
          opts.querySelectorAll("button").forEach(b => b.disabled = true);
          api.btn(fb, "🔁 再来一局", () => { seed++; round = 0; score = 0; opts.querySelectorAll("button").forEach(b => b.disabled = false); next(); });
          if (pass) api.win("猜 IC 得分 ≥ 6");
          api.explain("你应该发现了:IC 0 和 0.05 在散点图上几乎没法区分,0.15 开始在分组柱状图里看出阶梯,0.3 以上才在散点图里肉眼可见。<b>真实市场里好因子的单期 IC 通常只有 0.02–0.08</b>——所以我们必须看很多期的 IC 均值、ICIR 和 t 值,而不是看一张图。");
          return;
        }
        gen(); drawRound();
        top.innerHTML = "第 " + (round + 1) + " / 5 轮 · 当前得分 " + score + " · 这张图背后的真实 IC 是多少?";
        opts.querySelectorAll("button").forEach(b => { b.disabled = false; b.classList.remove("correct", "wrong"); });
      }
      function guess(k) {
        if (answered || round >= 5) return; answered = true;
        const d = Math.abs(k - cur.k), pts = d === 0 ? 2 : d === 1 ? 1 : 0; score += pts;
        opts.querySelectorAll("button").forEach((b, i) => { b.disabled = true; if (i === cur.k) b.classList.add("correct"); else if (i === k) b.classList.add("wrong"); });
        fb.innerHTML = (pts === 2 ? '<span class="pos">✔ 猜中!+2</span>' : pts === 1 ? '<span class="warn-t">差一档,+1</span>' : '<span class="neg">✘ 差得有点远</span>') + " 真实 IC = <b>" + cur.ic + "</b>,这一期样本 RankIC = " + fx(cur.ric, 3) + "(样本值会围绕真实值随机波动,标准误约 1/√300 ≈ 0.058)。 ";
        api.btn(fb, round < 4 ? "下一轮 →" : "看总分 →", () => { round++; next(); });
        api.stats(st, [["本轮真实 IC", cur.ic], ["样本 RankIC", fx(cur.ric, 3)], ["累计得分", score + " / " + (round + 1) * 2]]);
        api.explain("单期 RankIC 的标准误大约是 1/√N ≈ " + fx(1 / Math.sqrt(300), 3) + ",比 0.05 还大!这就是为什么<b>单期 IC 几乎没有信息</b>,要用 T 期的平均:t = IC均值 / (IC标准差/√T)。");
      }
      api.explain("提示:散点图越像一个“往右上倾斜的椭圆”IC 越大;完全是圆形的一团就是 IC ≈ 0。");
      next();
    }
  });

  def("ch2-quantile", {
    kind: "walk", title: "分层回测慢动作:20 只股票 × 12 个月", xp: 20,
    tryit: "点 ▶ 播放(或一步步点 ▶|),看每个月发生的 5 件事:看因子 → 排序 → 切成 5 组 → 揭晓下期收益 → 算组平均并累加到净值。12 个月后,看下方的 5 条净值线是否“单调分层”。",
    build(body, api) {
      const N = 20, M = 12, Q = 5, R = rng(2024), IC = 0.35;
      const months = []; let f = Array.from({ length: N }, () => R.g());
      for (let m = 0; m < M; m++) {
        if (m > 0) f = f.map(x => 0.6 * x + 0.8 * R.g());
        const r = f.map(x => (IC * x + Math.sqrt(1 - IC * IC) * R.g()) * 0.06);
        const rk = ranks(f), grp = rk.map(k => Math.floor(k * Q / N));
        const gr = Array.from({ length: Q }, (_, q) => mean(r.filter((_, i) => grp[i] === q)));
        months.push({ f: [...f], r, rk, grp, gr });
      }
      const chips = api.div(body, "chips"), row = api.div(body, "two-col"), c1 = api.canvas(row, 220), c2 = api.canvas(row, 220);
      const PH = ["① 看因子值", "② 按因子从小到大排序", "③ 切成 5 组(每组 4 只)", "④ 揭晓下个月的收益", "⑤ 计算每组平均收益,累加到净值"];
      const S = api.stepper(body, {
        n: M * 5, label: "第",
        onStep(i) {
          const m = Math.floor(i / 5), ph = i % 5, d = months[m];
          chips.innerHTML = d.f.map((x, k) => {
            const ord = ph >= 1 ? d.rk[k] : k, g = d.grp[k];
            return '<div class="chip' + (ph >= 2 ? " g" + g : "") + '" style="order:' + ord + '"><b>S' + String(k + 1).padStart(2, "0") + "</b><span>因子 " + x.toFixed(2) + "</span>" + (ph >= 3 ? '<span class="' + (d.r[k] >= 0 ? "pos" : "neg") + '">' + (d.r[k] >= 0 ? "+" : "") + (d.r[k] * 100).toFixed(1) + "%</span>" : "") + (ph >= 2 ? "<i>组" + (g + 1) + "</i>" : "") + "</div>";
          }).join("");
          const shown = months.slice(0, ph === 4 ? m + 1 : m);
          api.draw(c1, { type: "bar", data: { labels: ["组1", "组2", "组3", "组4", "组5"], datasets: [{ label: "第 " + (m + 1) + " 月各组平均收益 %", data: ph === 4 ? d.gr.map(x => x * 100) : [0, 0, 0, 0, 0], backgroundColor: PALETTE.slice(0, 5) }] }, options: api.chartOpts({}) });
          api.draw(c2, { type: "line", data: { labels: Array.from({ length: M + 1 }, (_, k) => "月" + k), datasets: Array.from({ length: Q }, (_, q) => api.line("组" + (q + 1), [1, ...cumprod(shown.map(x => x.gr[q]))], PALETTE[q])) }, options: api.chartOpts({ yTitle: "累计净值", legend: true }) });
          const tips = ["每个卡片是一只股票。现在只知道本月月末的因子值,还不知道下个月的收益。", "按因子值排队:左边因子最小,右边最大。这一步只用到了“当时”能知道的信息。", "每 4 只一组:组 1 因子最低,组 5 最高。组内等权持有一个月。", "一个月过去了,收益揭晓。注意:单只股票的收益很嘈杂,高因子的股票也可能大跌。", "组平均把个股噪声平均掉了一部分。本月 组5 − 组1 = " + ((d.gr[4] - d.gr[0]) * 100).toFixed(2) + "%。" + (m === M - 1 ? " 12 个月结束:如果因子有效,组 5 的净值应在最上面、组 1 最下面。" : "")];
          return "<b>第 " + (m + 1) + " 个月 · " + PH[ph] + "</b> — " + tips[ph];
        }
      });
      api.explain("分层回测不需要假设因子和收益是线性关系,它直接回答“按因子买,能不能赚钱”。真实研究里每组有上百只股票,组平均的噪声小得多;这里只有 4 只,所以偶尔会出现组 4 跑赢组 5 的“不单调”。");
      S.go(0);
    }
  });

  def("ch2-decay", {
    kind: "play", title: "因子持久性 × 交易成本:毛收益不等于净收益", xp: 20,
    tryit: "把“因子持久性 ρ”从 0.9 往 0 拖,看头部组换手率飙升、扣成本后的夏普掉下来;再把单边成本从 0 调到 20bp。找一找:在什么持久性以下,这个因子扣完成本就不赚钱了?",
    build(body, api) {
      const v = api.controls(body, [
        { k: "rho", label: "因子持久性 ρ(相邻月截面相关)", min: 0, max: 0.98, step: 0.02, v: 0.6, fmt: x => x.toFixed(2) },
        { k: "cost", label: "单边交易成本", min: 0, max: 30, v: 10, fmt: x => x + " bp" },
        { k: "ic", label: "因子 IC", min: 0.02, max: 0.15, step: 0.01, v: 0.06, fmt: x => x.toFixed(2) }
      ], () => api.render());
      const st = api.div(body), cv = api.canvas(body, 280);
      function sim(rho, ic, cost, seed) {
        const R = rng(seed), N = 300, T = 60, Q = 5; let f = Array.from({ length: N }, () => R.g()), prevTop = null, prevBot = null;
        const gross = [], net = [], tos = [];
        for (let t = 0; t < T; t++) {
          if (t > 0) f = f.map(x => rho * x + Math.sqrt(1 - rho * rho) * R.g());
          const r = f.map(x => 0.08 * (ic * x + Math.sqrt(1 - ic * ic) * R.g())), rk = ranks(f);
          const top = new Set(), bot = new Set(); rk.forEach((k, i) => { if (k >= N * (Q - 1) / Q) top.add(i); if (k < N / Q) bot.add(i); });
          const gT = mean([...top].map(i => r[i])), gB = mean([...bot].map(i => r[i]));
          let to = 1; if (prevTop) { let a = 0, b = 0; top.forEach(i => { if (!prevTop.has(i)) a++; }); bot.forEach(i => { if (!prevBot.has(i)) b++; }); to = (a / top.size + b / bot.size) / 2; }
          prevTop = top; prevBot = bot;
          gross.push(gT - gB); net.push(gT - gB - 2 * 2 * cost / 1e4 * to); tos.push(to);
        }
        return { g: U.sharpe(gross, 12), n: U.sharpe(net, 12), to: mean(tos.slice(1)), ag: mean(gross) * 12, an: mean(net) * 12 };
      }
      api.render = () => {
        const cur = sim(v.rho, v.ic, v.cost, 99), grid = [0, 0.2, 0.4, 0.6, 0.8, 0.9, 0.95];
        const rs = grid.map(r => sim(r, v.ic, v.cost, 99));
        api.draw(cv, { type: "bar", data: { labels: grid.map(r => "ρ=" + r), datasets: [
          { label: "多空夏普(毛)", data: rs.map(x => x.g), backgroundColor: "rgba(37,99,235,.6)", yAxisID: "y" },
          { label: "多空夏普(扣成本)", data: rs.map(x => x.n), backgroundColor: "rgba(220,38,38,.7)", yAxisID: "y" },
          { type: "line", label: "头部/底部组月换手(右轴)", data: rs.map(x => x.to * 100), borderColor: C.orange, backgroundColor: C.orange, yAxisID: "y1", pointRadius: 4 }] },
          options: api.chartOpts({ yTitle: "年化夏普", y1: "月换手 %" }) });
        api.stats(st, [["月换手率", pct(cur.to, 0)], ["每月成本拖累", (2 * 2 * v.cost * cur.to).toFixed(1) + " bp"], ["多空年化(毛 → 净)", pct(cur.ag) + " → " + pct(cur.an), cur.an < 0 ? "bad" : ""], ["夏普(毛 → 净)", fx(cur.g) + " → " + fx(cur.n), cur.n < 0 ? "bad" : "good"]]);
        api.explain("持久性 ρ = " + v.rho + " 时,头部组每月约有 " + pct(cur.to, 0) + " 的股票被换掉。多空两条腿、每次换仓买 + 卖,月成本 ≈ 2 × 2 × 换手 × 单边成本 = " + (4 * v.cost * cur.to).toFixed(1) + " bp。" + (cur.n < 0 ? " <b>毛夏普 " + fx(cur.g) + " 被成本吃成了负数</b>——这类“快因子”需要更低的成本或更慢的调仓。" : " 越持久的因子换手越低,成本越不重要;快速变化的因子(如短期反转)纸面上很强,扣成本后可能一文不值。"));
      };
    }
  });

  def("ch2-combine", {
    kind: "play", title: "多因子合成:1 + 1 能大于 1 吗?", xp: 15,
    predict: { q: "两个 IC 都是 0.03、彼此<b>不相关</b>(ρ = 0)的因子,标准化后等权相加。合成因子的 IC 大约是?", o: ["0.03(没变)", "约 0.042", "0.06(直接相加)"], a: 1, e: "IC 合成 = (IC₁ + IC₂)/√(2 + 2ρ) = 0.06/√2 ≈ 0.042。信号相加,噪声只按 √2 增长。" },
    tryit: "把两个因子的相关系数 ρ 从 0.9 慢慢拖到 0 再到负数,看合成 IC(橙点)怎样沿着曲线上升。再把因子 2 的 IC 调得很小,看看“加一个弱因子”什么时候反而拖后腿。",
    build(body, api) {
      const v = api.controls(body, [
        { k: "a", label: "因子 1 的 IC", min: 0.01, max: 0.1, step: 0.005, v: 0.03, fmt: x => x.toFixed(3) },
        { k: "b", label: "因子 2 的 IC", min: 0, max: 0.1, step: 0.005, v: 0.03, fmt: x => x.toFixed(3) },
        { k: "rho", label: "两因子相关 ρ", min: -0.5, max: 0.95, step: 0.05, v: 0.2, fmt: x => x.toFixed(2) }
      ], () => api.render());
      const st = api.div(body), cv = api.canvas(body, 270);
      const comb = (a, b, r) => (a + b) / Math.sqrt(2 + 2 * r);
      api.render = () => {
        const xs = []; for (let r = -0.5; r <= 0.951; r += 0.05) xs.push(+r.toFixed(2));
        const c = comb(v.a, v.b, v.rho), best = Math.max(v.a, v.b);
        // 蒙特卡洛验证:60 期 × 300 只
        const R = rng(5), N = 300; let s1 = 0, s2 = 0, sc = 0; const Sg = [[1, v.rho], [v.rho, 1]], bb = U.solve(Sg, [v.a, v.b]); const ev = 1 - (bb[0] * v.a + bb[1] * v.b);
        for (let t = 0; t < 60; t++) { const f1 = [], f2 = [], r = []; for (let i = 0; i < N; i++) { const z1 = R.g(), z2 = v.rho * z1 + Math.sqrt(1 - v.rho * v.rho) * R.g(); f1.push(z1); f2.push(z2); r.push(bb[0] * z1 + bb[1] * z2 + Math.sqrt(Math.max(ev, 1e-6)) * R.g()); } s1 += U.corr(f1, r); s2 += U.corr(f2, r); sc += U.corr(f1.map((x, i) => x + f2[i]), r); }
        api.draw(cv, { type: "line", data: { datasets: [
          api.line("等权合成 IC(理论)", xs.map(r => ({ x: r, y: comb(v.a, v.b, r) })), C.blue),
          api.line("单因子最好的 IC", xs.map(r => ({ x: r, y: best })), C.gray, { borderDash: [6, 4], borderWidth: 1.5 }),
          { type: "scatter", label: "当前 ρ", data: [{ x: v.rho, y: c }], backgroundColor: C.orange, borderColor: C.orange, pointRadius: 7 }] },
          options: api.chartOpts({ xType: "linear", xTitle: "两因子相关 ρ", yTitle: "IC", xMin: -0.5, xMax: 0.95 }) });
        api.stats(st, [["合成 IC(理论)", fx(c, 4), c > best ? "good" : "bad"], ["模拟 60 期平均 IC:因子1 / 因子2", fx(s1 / 60, 3) + " / " + fx(s2 / 60, 3)], ["模拟:合成因子", fx(sc / 60, 3)], ["相对最好单因子", (c / best * 100 - 100).toFixed(0) + "%"]]);
        api.explain("公式 \\(\\text{IC}_c=(\\text{IC}_1+\\text{IC}_2)/\\sqrt{2+2\\rho}\\):分子是“信号相加”,分母是“合成因子自身的波动”。ρ 越低,分母越小,合成越划算。" + (c < best ? " <b>现在合成反而不如单独用最好的那个因子</b>——因为因子 2 太弱、或者两者太相似。这时应该用 ICIR 加权而不是等权。" : " 现在合成比最好的单因子高 " + (c / best * 100 - 100).toFixed(0) + "%。"));
        if (window.renderMathInElement) renderMathInElement(api.el.querySelector(".ix-exp-text"), { delimiters: [{ left: "\\(", right: "\\)", display: false }], throwOnError: false });
      };
    }
  });
})();

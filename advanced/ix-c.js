/* 互动组件:第 6–9 章 */
(function () {
  "use strict";
  const { def, U } = window.QX;
  const { rng, mean, std, pct, fx, clamp, cumprod, PALETTE, sharpe, maxDD } = U;
  const C = { blue: "#2563eb", orange: "#f59e0b", green: "#16a34a", red: "#dc2626", purple: "#8b5cf6", gray: "#64748b", cyan: "#0891b2" };
  const maArr = (a, n) => a.map((_, t) => t < n - 1 ? null : mean(a.slice(t - n + 1, t + 1)));
  function walkPrices(seed, n, mu, sig, p0) { const R = rng(seed); const c = [], o = []; let p = p0 || 20; for (let t = 0; t < n; t++) { const op = p * Math.exp(R.g() * sig * 0.3); p = op * Math.exp(mu + R.g() * sig); o.push(op); c.push(p); } return { o, c }; }

  /* ===================== 第 6 章 ===================== */
  def("ch6-loop", {
    kind: "walk", title: "事件驱动引擎慢动作:一根 K 线里发生了什么", xp: 30,
    tryit: "按 ▶ 播放(或 ▶| 单步),跟着高亮的模块看事件在队列里流动:<b>MarketEvent → 策略 → SignalEvent → 组合 → OrderEvent → 撮合 → FillEvent → 组合记账</b>。注意:信号在第 t 天收盘产生,成交却发生在<b>第 t+1 天开盘</b>。",
    build(body, api) {
      const N = 32, FAST = 3, SLOW = 8, { o, c } = walkPrices(606, N, 0.002, 0.025, 20);
      const mf = maArr(c, FAST), ms = maArr(c, SLOW);
      const steps = []; let cash = 100000, pos = 0, state = 0; const marks = []; const log = [];
      const snap = (mod, q, msg, t) => steps.push({ mod, q: [...q], msg, t, cash, pos, eq: cash + pos * c[t], marks: [...marks] });
      for (let t = 0; t < N; t++) {
        snap("data", ["MarketEvent"], "📥 DataHandler 推送第 " + (t + 1) + " 根 K 线(收盘 " + fx(c[t]) + "),把 <b>MarketEvent</b> 放进队列。", t);
        let want = state;
        if (ms[t] != null) want = mf[t] > ms[t] ? 1 : 0;
        if (want !== state && t < N - 1) {
          state = want;
          snap("strategy", ["SignalEvent"], "🧠 Strategy 取出 MarketEvent:" + FAST + " 日均线 " + fx(mf[t]) + (want ? " > " : " < ") + SLOW + " 日均线 " + fx(ms[t]) + " → 发出 <b>SignalEvent(目标仓位 " + (want ? "100%" : "0%") + ")</b>。", t);
          const qty = want ? Math.floor(cash / c[t] / 100) * 100 : -pos;
          snap("portfolio", ["OrderEvent"], "📒 Portfolio 取出 SignalEvent:按今天收盘价 " + fx(c[t]) + " 估算,下单 <b>OrderEvent(" + (qty > 0 ? "买入 " : "卖出 ") + Math.abs(qty) + " 股)</b>(100 股一手取整)。", t);
          const px = o[t + 1] * (1 + 0.0005 * Math.sign(qty)), fee = Math.max(Math.abs(qty) * px * 0.00025, 5) + (qty < 0 ? Math.abs(qty) * px * 0.0005 : 0);
          snap("execution", ["FillEvent"], "⚙️ SimExecution 取出 OrderEvent:用<b>下一根 K 线(第 " + (t + 2) + " 天)的开盘价</b> " + fx(o[t + 1]) + " + 滑点成交于 " + fx(px, 3) + ",费用 " + fx(fee) + " 元 → <b>FillEvent</b>。", t);
          cash -= qty * px + fee; pos += qty; marks.push({ t: t + 1, px, side: qty > 0 ? 1 : -1 });
          snap("portfolio", [], "📒 Portfolio 取出 FillEvent:更新持仓 = " + pos + " 股,现金 = " + fx(cash, 0) + " 元。队列空了,内层循环结束。", t);
        } else {
          snap("strategy", [], "🧠 Strategy 取出 MarketEvent:" + (ms[t] == null ? "数据不足 " + SLOW + " 天,长均线还算不出来,不行动。" : "信号没有变化(" + (state ? "继续持有" : "继续空仓") + "),不发事件。队列空了。"), t);
        }
        snap("mtm", [], "📊 收盘记账 mark_to_market:净值 = 现金 + 持仓 × 收盘价 = " + fx(cash + pos * c[t], 0) + " 元。外层循环 → 下一天。", t);
      }
      const flow = api.div(body, "ev-flow"), row = api.div(body, "two-col wide-left"), cv = api.canvas(row, 260), side = api.div(row, "ev-side");
      const MODS = [["data", "📥 DataHandler"], ["strategy", "🧠 Strategy"], ["portfolio", "📒 Portfolio"], ["execution", "⚙️ Execution"], ["mtm", "📊 记账"]];
      const S = api.stepper(body, {
        n: steps.length, label: "第",
        onStep(i) {
          const s = steps[i], t = s.t;
          flow.innerHTML = MODS.map(m => '<span class="ev-mod' + (m[0] === s.mod ? " on" : "") + '">' + m[1] + "</span>").join('<span class="arrow">→</span>');
          side.innerHTML = '<div class="ev-q"><b>事件队列</b> ' + (s.q.length ? s.q.map(e => '<span class="ev-chip">' + e + "</span>").join("") : '<span class="muted">(空)</span>') + "</div>" +
            '<table class="mini"><tr><td>第几天</td><td><b>' + (t + 1) + "</b> / " + N + "</td></tr><tr><td>现金</td><td>" + fx(s.cash, 0) + "</td></tr><tr><td>持仓</td><td>" + s.pos + " 股</td></tr><tr><td>净值</td><td><b>" + fx(s.eq, 0) + "</b></td></tr></table>";
          const L = c.map((_, k) => "D" + (k + 1)), cut = a => a.map((x, k) => k <= t ? x : null);
          api.draw(cv, { type: "line", data: { labels: L, datasets: [api.line("收盘价", cut(c), C.blue), api.line(FAST + " 日均线", cut(mf), C.orange, { borderWidth: 1.5 }), api.line(SLOW + " 日均线", cut(ms), C.purple, { borderWidth: 1.5 }),
            { type: "scatter", label: "买入成交(次日开盘)", data: L.map((_, k) => { const m = s.marks.find(q => q.t === k && q.side > 0); return m ? m.px : null; }), backgroundColor: C.green, pointRadius: 7, pointStyle: "triangle" },
            { type: "scatter", label: "卖出成交", data: L.map((_, k) => { const m = s.marks.find(q => q.t === k && q.side < 0); return m ? m.px : null; }), backgroundColor: C.red, pointRadius: 7, pointStyle: "triangle", rotation: 180 }] },
            options: api.chartOpts({ yTitle: "价格" }) });
          return s.msg;
        }
      });
      api.explain("事件驱动的核心是两层循环:<b>外层</b>推进时间(每天一根 K 线),<b>内层</b>把当天产生的事件处理完。策略<b>永远拿不到明天的数据</b>(DataHandler 只给 history),成交被强制推迟到下一根 K 线——未来函数在结构上就被堵死了。");
      S.go(0);
    }
  });

  def("ch6-look", {
    kind: "play", title: "未来函数有多可怕:同一个策略,差一天", xp: 20,
    predict: { q: "价格是<b>纯随机游走</b>(没有任何规律)。策略:“收盘价在 5 日均线之上就持有”。如果回测时用<b>当天</b>收益(偷看了当天收盘),夏普大约是?", o: ["≈ 0,和正确版一样", "明显为正,甚至 > 3", "明显为负"], a: 1, e: "今天收盘站上均线,往往正是因为今天涨了。用今天的收盘价决定“今天是否持有”,等于先看到结果再下注。" },
    tryit: "比较红线(偷看版:信号和收益同一天)和蓝线(正确版:今天的信号,赚明天的收益)。改变均线长度、换几条随机路径:红线总是一飞冲天,蓝线在 0 附近随机游荡——因为数据本来就没有规律。",
    build(body, api) {
      let seed = 1;
      const v = api.controls(body, [{ k: "n", label: "均线长度", min: 2, max: 60, v: 5, fmt: x => x + " 日" }, { k: "lag", label: "正确版的执行延迟", type: "select", opts: [[1, "次日(t+1)"], [2, "后天(t+2)"]], v: 1 }], () => api.render());
      api.btn(api.div(body, "btn-row"), "🎲 换一条随机路径", () => { seed++; api.render(); }, "secondary");
      const st = api.div(body), cv = api.canvas(body, 290);
      api.render = () => {
        const R = rng(seed * 37), T = 750, r = Array.from({ length: T }, () => R.g() * 0.015), p = cumprod(r, 20), ma = maArr(p, v.n);
        const sig = p.map((x, t) => ma[t] != null && x > ma[t] ? 1 : 0);
        const cheat = r.map((x, t) => sig[t] * x), good = r.map((x, t) => t >= v.lag ? sig[t - v.lag] * x : 0);
        const L = r.map((_, t) => t);
        api.draw(cv, { type: "line", data: { labels: L, datasets: [api.line("偷看版:sig[t] × r[t]", cumprod(cheat), C.red), api.line("正确版:sig[t−" + v.lag + "] × r[t]", cumprod(good), C.blue), api.line("买入持有", cumprod(r), C.gray, { borderWidth: 1, borderDash: [4, 3] })] }, options: api.chartOpts({ yTitle: "净值(对数)", yType: "logarithmic" }) });
        api.stats(st, [["偷看版夏普", fx(sharpe(cheat)), "bad"], ["正确版夏普", fx(sharpe(good)), "good"], ["偷看版总收益", pct(cumprod(cheat)[T - 1] - 1, 0), "bad"], ["正确版总收益", pct(cumprod(good)[T - 1] - 1, 0)]]);
        api.explain("偷看版的“超能力”完全来自时间错位:<code>close[t] > MA[t]</code> 这个条件本身就偏向“今天上涨”的日子。代码上只差一个 <code>shift(1)</code>,结果却是夏普 " + fx(sharpe(cheat)) + " vs " + fx(sharpe(good)) + "。均线越短,当天收益对信号的影响越大,偷看越严重(试试 2 日和 60 日)。事件驱动引擎让这种错误在结构上不可能发生。");
      };
    }
  });

  def("ch6-cost", {
    kind: "play", title: "成本模型调音台:均线策略的毛收益和净收益", xp: 20,
    tryit: "把快线调短(比如 3 日)让交易变频繁,再把滑点从 0 调到 20bp,看灰色“毛净值”和蓝色“净值”之间的缝隙如何变成鸿沟。观察“成本占毛利润”这一项。",
    build(body, api) {
      let seed = 2;
      const v = api.controls(body, [
        { k: "f", label: "快线", min: 2, max: 30, v: 5, fmt: x => x + " 日" }, { k: "s", label: "慢线", min: 10, max: 120, step: 5, v: 30, fmt: x => x + " 日" },
        { k: "slip", label: "滑点(单边)", min: 0, max: 30, v: 5, fmt: x => x + " bp" }, { k: "comm", label: "佣金(单边)", min: 0, max: 10, step: 0.5, v: 2.5, fmt: x => x + " bp" },
        { k: "tax", label: "印花税(卖出)", min: 0, max: 10, step: 0.5, v: 5, fmt: x => x + " bp" }
      ], () => api.render());
      api.btn(api.div(body, "btn-row"), "🎲 换一段行情", () => { seed++; api.render(); }, "secondary");
      const st = api.div(body), cv = api.canvas(body, 280);
      api.render = () => {
        const R = rng(seed * 91), T = 750; let mu = 0.0006; const r = []; for (let t = 0; t < T; t++) { if (R.u() < 0.01) mu = -mu; r.push(mu + R.g() * 0.016); }
        const p = cumprod(r, 20), mf = maArr(p, v.f), ms = maArr(p, Math.max(v.s, v.f + 1));
        const pos = p.map((_, t) => ms[t] != null && mf[t] > ms[t] ? 1 : 0);
        let trades = 0; const g = [], n = []; let costSum = 0;
        for (let t = 1; t < T; t++) {
          const ret = pos[t - 1] * r[t]; let c = 0;
          if (pos[t - 1] !== (t > 1 ? pos[t - 2] : 0)) { trades++; c = (v.slip + v.comm) / 1e4 + (pos[t - 1] === 0 ? v.tax / 1e4 : 0); }
          g.push(ret); n.push(ret - c); costSum += c;
        }
        const eg = cumprod(g), en = cumprod(n), gp = eg[eg.length - 1] - 1, np = en[en.length - 1] - 1;
        api.draw(cv, { type: "line", data: { labels: g.map((_, t) => t), datasets: [api.line("毛净值(零成本)", eg, C.gray, { borderDash: [5, 4] }), api.line("净值(扣成本)", en, C.blue), api.line("买入持有", cumprod(r.slice(1)), "rgba(245,158,11,.7)", { borderWidth: 1 })] }, options: api.chartOpts({ yTitle: "净值" }) });
        api.stats(st, [["交易次数(单边)", trades], ["累计成本", pct(costSum, 1), "bad"], ["毛收益 → 净收益", pct(gp, 0) + " → " + pct(np, 0), np < 0 ? "bad" : ""], ["夏普 毛 → 净", fx(sharpe(g)) + " → " + fx(sharpe(n))], ["成本占毛利润", gp > 0 ? pct(Math.min(costSum / gp, 9.99), 0) : "毛利润 ≤ 0"]]);
        api.explain("每次换仓的成本 = 滑点 + 佣金(+ 卖出时的印花税)。" + trades + " 次交易累计吃掉 " + pct(costSum, 1) + "(近似按简单相加)。快线越短,交易越多,成本线性增长,而毛收益并不会因为交易更频繁而增加。实务中,<b>先估成本、再评估策略</b>;第 8 章会告诉你滑点该设多少。");
      };
    }
  });

  def("ch6-game", {
    kind: "game", title: "模拟交易挑战:你能跑赢买入持有吗?", xp: 30,
    tryit: "你有 10 万元,先看 20 根 K 线的历史。每一步选择<b>买入(满仓)/ 卖出(清仓)/ 持有</b>,然后进入下一根。和引擎一样,你的订单在<b>下一根 K 线开盘</b>成交,并扣除滑点 5bp、佣金 2.5bp、卖出印花税 5bp。40 根之后结算,和“买入持有”与“5/20 日均线策略”比一比。",
    build(body, api) {
      let seed = QX.load("qa-game", {})["ch6-seed"] || 1, d, t, cash, pos, pend, marks, done, best = QX.load("qa-game", {})["ch6-best"];
      const START = 20, END = 60;
      const top = api.div(body, "gc-top"), cv = api.canvas(body, 280), bar = api.div(body, "btn-row"), st = api.div(body), fb = api.div(body, "gc-fb");
      const bBuy = api.btn(bar, "🟢 买入(满仓)", () => act(1)), bSell = api.btn(bar, "🔴 卖出(清仓)", () => act(-1), "danger"), bHold = api.btn(bar, "⏭ 持有,下一根", () => act(0), "secondary");
      api.btn(bar, "🔁 新的一局", () => { seed++; const g = QX.load("qa-game", {}); g["ch6-seed"] = seed; QX.save("qa-game", g); reset(); }, "secondary");
      function reset() {
        const R = rng(seed * 2027); let mu = (R.u() - 0.45) * 0.004; const o = [], c = []; let p = 20;
        for (let k = 0; k < END + 1; k++) { if (R.u() < 0.04) mu = (R.u() - 0.45) * 0.004; const op = p * Math.exp(R.g() * 0.006); p = op * Math.exp(mu + R.g() * 0.02); o.push(op); c.push(p); }
        d = { o, c }; t = START; cash = 100000; pos = 0; pend = 0; marks = []; done = false; fb.innerHTML = ""; render();
      }
      function fill(k, side) { // 在第 k 根开盘成交
        const px = d.o[k] * (1 + 0.0005 * side);
        if (side > 0) { const q = Math.floor(cash / (px * 1.00025) / 100) * 100; if (q > 0) { cash -= q * px * 1.00025; pos += q; marks.push({ k, px, s: 1 }); } }
        else if (pos > 0) { cash += pos * px * (1 - 0.00025 - 0.0005); marks.push({ k, px, s: -1 }); pos = 0; }
      }
      function act(a) {
        if (done) return;
        if (a !== 0) pend = a;
        t++;
        if (pend) { fill(t, pend); pend = 0; }
        if (t >= END) finish(); else render();
      }
      function stratMA() { let ca = 100000, ps = 0; const mf = maArr(d.c, 5), ms = maArr(d.c, 20); for (let k = START; k < END; k++) { const want = mf[k] > ms[k] ? 1 : 0; const nk = k + 1; if (nk > END) break; const px = d.o[nk]; if (want && !ps) { ps = Math.floor(ca / (px * 1.0003) / 100) * 100; ca -= ps * px * 1.0003; } else if (!want && ps) { ca += ps * px * (1 - 0.0013); ps = 0; } } return ca + ps * d.c[END]; }
      function finish() {
        done = true; render();
        const me = cash + pos * d.c[END], bh = 100000 / (d.o[START + 1] * 1.0003) * d.c[END], ma = stratMA();
        const r = me / 1e5 - 1, rb = bh / 1e5 - 1, rm = ma / 1e5 - 1;
        fb.innerHTML = "<b>结算</b>:你 " + pct(r) + " · 买入持有 " + pct(rb) + " · 均线策略 " + pct(rm) + " · 交易 " + marks.length + " 次。" + (r > rb ? " 🎉 你跑赢了买入持有!" : " 这局没跑赢买入持有。");
        api.win("完成一局模拟交易"); if (r > rb) api.bonus("beat", 10, "跑赢买入持有");
        if (best == null || r > best) { best = r; const g = QX.load("qa-game", {}); g["ch6-best"] = best; QX.save("qa-game", g); }
        api.explain("这段行情是<b>随机生成</b>的(有随机切换的弱趋势)。一局的输赢有很大运气成分:想知道你的“手感”是不是真的,需要玩很多局并做统计检验(第 7 章)。你也会发现,频繁交易的成本会悄悄吃掉收益,而且你每次都要等到<b>下一根开盘</b>才能成交——这就是实盘的感觉。");
        bBuy.disabled = bSell.disabled = bHold.disabled = true;
      }
      function render() {
        bBuy.disabled = done || pos > 0; bSell.disabled = done || pos === 0; bHold.disabled = done;
        const L = d.c.map((_, k) => k), cut = a => a.map((x, k) => k <= t ? x : null), eq = cash + pos * d.c[t];
        api.draw(cv, { type: "line", data: { labels: L, datasets: [api.line("收盘价", cut(d.c), C.blue), api.line("5 日均线", cut(maArr(d.c, 5)), C.orange, { borderWidth: 1 }), api.line("20 日均线", cut(maArr(d.c, 20)), C.purple, { borderWidth: 1 }),
          { type: "scatter", label: "你的买入", data: L.map(k => { const m = marks.find(q => q.k === k && q.s > 0); return m ? m.px : null; }), backgroundColor: C.green, pointRadius: 8, pointStyle: "triangle" },
          { type: "scatter", label: "你的卖出", data: L.map(k => { const m = marks.find(q => q.k === k && q.s < 0); return m ? m.px : null; }), backgroundColor: C.red, pointRadius: 8, pointStyle: "triangle", rotation: 180 }] },
          options: api.chartOpts({ yTitle: "价格", xMin: 0, xMax: END }) });
        top.innerHTML = "第 " + (t - START) + " / " + (END - START) + " 根 · " + (pos ? "📦 持仓中" : "💵 空仓") + (best != null ? " · 你的最好成绩 " + pct(best) : "");
        api.stats(st, [["现金", fx(cash, 0)], ["持仓", pos + " 股"], ["净值", fx(eq, 0), eq >= 1e5 ? "good" : "bad"], ["收益", pct(eq / 1e5 - 1)]]);
        if (!done) api.explain("现在是第 " + t + " 根收盘(" + fx(d.c[t]) + ")。你做出的决定会在第 " + (t + 1) + " 根开盘成交——和事件驱动引擎一模一样。");
      }
      reset();
    }
  });

  /* ===================== 第 7 章 ===================== */
  def("ch7-attr", {
    kind: "play", title: "收益归因拆解:alpha 还是“小盘股马甲”?", xp: 20,
    predict: { q: "某策略的<b>真实 alpha = 0</b>,但它偏爱小盘股(β_SMB = 0.8)。如果只对市场因子回归(CAPM),估计出的 alpha 会?", o: ["约等于 0", "显著为正:小盘溢价被误当成 alpha", "显著为负"], a: 1, e: "遗漏的因子暴露会“藏”进截距项。小盘溢价 × 0.8 的收益在 CAPM 里没有归属,只能算作 alpha。" },
    tryit: "保持真实 alpha = 0,把 β_SMB 调到 0.8:左边 CAPM 柱子出现一大块“alpha”,右边三因子模型把它正确地归给了 SMB。再把真实 alpha 设为 0.3%/月,看三因子模型能否识别,以及月数少时 t 值是否显著。",
    build(body, api) {
      const v = api.controls(body, [
        { k: "a", label: "真实 alpha", min: -0.5, max: 0.8, step: 0.05, v: 0, fmt: x => x.toFixed(2) + "%/月" },
        { k: "bm", label: "β_MKT", min: 0, max: 1.5, step: 0.1, v: 1, fmt: x => x.toFixed(1) },
        { k: "bs", label: "β_SMB", min: -0.5, max: 1.2, step: 0.1, v: 0.8, fmt: x => x.toFixed(1) },
        { k: "bh", label: "β_HML", min: -0.5, max: 1, step: 0.1, v: 0, fmt: x => x.toFixed(1) },
        { k: "T", label: "样本月数", min: 36, max: 360, step: 12, v: 120, fmt: x => x + " 月" }
      ], () => api.render());
      const st = api.div(body), cv = api.canvas(body, 290);
      api.render = () => {
        const R = rng(17), T = v.T, F = [], y = [];
        for (let t = 0; t < T; t++) { const m = 0.006 + 0.045 * R.g(), s = 0.004 + 0.03 * R.g(), h = 0.003 + 0.03 * R.g(); F.push([m, s, h]); y.push(v.a / 100 + v.bm * m + v.bs * s + v.bh * h + 0.015 * R.g()); }
        const capm = U.ols(F.map(f => [1, f[0]]), y), ff = U.ols(F.map(f => [1, ...f]), y);
        const fm = [0, 1, 2].map(k => mean(F.map(f => f[k])));
        const parts = [["alpha", capm.beta[0], ff.beta[0]], ["市场 MKT", capm.beta[1] * fm[0], ff.beta[1] * fm[0]], ["规模 SMB", 0, ff.beta[2] * fm[1]], ["价值 HML", 0, ff.beta[3] * fm[2]]];
        api.draw(cv, { type: "bar", data: { labels: ["CAPM(只有市场)", "三因子模型"], datasets: parts.map((p, k) => ({ label: p[0], data: [p[1] * 100, p[2] * 100], backgroundColor: [C.red, C.blue, C.orange, C.green][k] })) }, options: api.chartOpts({ stacked: true, yTitle: "月均收益的来源 %" }) });
        api.stats(st, [["策略月均收益", pct(mean(y), 2)], ["CAPM alpha(t)", pct(capm.beta[0], 2) + "(" + fx(capm.t[0], 1) + ")", Math.abs(capm.t[0]) > 2 ? "bad" : ""], ["三因子 alpha(t)", pct(ff.beta[0], 2) + "(" + fx(ff.t[0], 1) + ")", Math.abs(ff.t[0]) > 2 ? "good" : ""], ["估计 β_SMB", fx(ff.beta[2])]]);
        api.explain("堆叠柱的高度都等于策略月均收益,区别只是“功劳归谁”。CAPM 没有 SMB 这一项,小盘股带来的 " + pct(v.bs * fm[1], 2) + "/月 只能挤进红色的 alpha。<b>如果 alpha 在加入常见因子后消失,你得到的只是一个(更贵的)因子暴露</b>,而不是独特的能力。t 值 > 2 才大致算显著;样本越短越难区分。");
      };
    }
  });

  def("ch7-wf", {
    kind: "walk", title: "滚动前向分析:一个窗口一个窗口地走", xp: 25,
    tryit: "按 ▶ 播放。每一步:在蓝色训练窗口里试 6 个均线参数,挑样本内夏普最高的(左图高亮),然后把它<b>原封不动</b>地用到紧接着的绿色测试窗口。右图把所有测试段拼起来,就是诚实的样本外表现。切换“数据有无真实规律”对比。",
    build(body, api) {
      const v = api.controls(body, [{ k: "edge", label: "数据", type: "select", opts: [[1, "有真实的趋势规律"], [0, "纯随机(没有规律)"]], v: 1 }, { k: "mode", label: "训练窗口", type: "select", opts: [["roll", "滚动(固定 250 天)"], ["exp", "扩展(从头开始)"]], v: "roll" }], () => { compute(); S.reset(W.length, true); });
      const tl = api.div(body, "wf-tl"), row = api.div(body, "two-col"), c1 = api.canvas(row, 230), c2 = api.canvas(row, 230), st = api.div(body);
      const PARAMS = [5, 10, 20, 40, 80, 120], TR = 250, TE = 60, T = 1030;
      let W = [], r = [];
      function compute() {
        const R = rng(v.edge ? 303 : 404); let mu = 0.0012; r = [];
        for (let t = 0; t < T; t++) { if (v.edge) { if (R.u() < 0.012) mu = -mu; r.push(mu + R.g() * 0.012); } else r.push(R.g() * 0.012); }
        const p = cumprod(r, 1), sig = PARAMS.map(n => { const m = maArr(p, n); return p.map((x, t) => m[t] != null && x > m[t] ? 1 : 0); });
        const sr = (k, a, b) => { const x = []; for (let t = Math.max(a, 1); t < b; t++) x.push(sig[k][t - 1] * r[t]); return sharpe(x); };
        W = []; const oos = [];
        for (let s = TR; s + TE <= T; s += TE) {
          const a = v.mode === "roll" ? s - TR : 120, isr = PARAMS.map((_, k) => sr(k, a, s)), best = isr.indexOf(Math.max(...isr));
          for (let t = s; t < s + TE; t++) oos.push(sig[best][t - 1] * r[t]);
          W.push({ a, s, e: s + TE, isr, best, oosSR: sr(best, s, s + TE), oos: [...oos] });
        }
      }
      compute();
      const S = api.stepper(body, {
        n: W.length, label: "窗口",
        onStep(i) {
          const w = W[i], X = x => (x / T * 100).toFixed(2) + "%";
          tl.innerHTML = '<div class="wf-bar">' + W.slice(0, i).map(q => '<span class="wf-seg te old" style="left:' + X(q.s) + ";width:" + X(q.e - q.s) + '"></span>').join("") +
            '<span class="wf-seg tr" style="left:' + X(w.a) + ";width:" + X(w.s - w.a) + '">训练</span><span class="wf-seg te" style="left:' + X(w.s) + ";width:" + X(w.e - w.s) + '">测试</span></div><div class="wf-axis"><span>第 0 天</span><span>第 ' + T + " 天</span></div>";
          api.draw(c1, { type: "bar", data: { labels: PARAMS.map(n => "MA" + n), datasets: [{ label: "训练窗口内的夏普(挑最高的)", data: w.isr, backgroundColor: w.isr.map((_, k) => k === w.best ? C.orange : "rgba(37,99,235,.5)") }] }, options: api.chartOpts({ yTitle: "夏普" }) });
          api.draw(c2, { type: "line", data: { labels: w.oos.map((_, k) => k), datasets: [api.line("拼接的样本外净值", cumprod(w.oos), C.green)] }, options: api.chartOpts({ yTitle: "净值" }) });
          const isAvg = mean(W.slice(0, i + 1).map(q => q.isr[q.best])), oosAll = sharpe(w.oos);
          api.stats(st, [["本窗口选中", "MA" + PARAMS[w.best]], ["样本内最佳夏普(平均)", fx(isAvg), ""], ["样本外夏普(累计)", fx(oosAll), oosAll > 0.3 ? "good" : "bad"], ["样本内 → 样本外 衰减", isAvg > 0 ? pct(1 - oosAll / isAvg, 0) : "—"]]);
          return "<b>窗口 " + (i + 1) + "</b>:训练第 " + w.a + "–" + (w.s - 1) + " 天,选中 MA" + PARAMS[w.best] + "(样本内夏普 " + fx(w.isr[w.best]) + ");测试第 " + w.s + "–" + (w.e - 1) + " 天,样本外夏普 " + fx(w.oosSR) + "。" + (i === W.length - 1 ? (v.edge ? " 有规律时,样本外仍然为正,但<b>明显低于样本内</b>——这是正常的选择偏差。" : " 没有规律时,样本内最高的夏普看起来很诱人,样本外却在 0 附近——<b>参数选择只是在挑噪声</b>。") : "");
        }
      });
      api.render = () => S.go(S.i);
      api.explain("滚动前向的关键是:<b>每一个测试点在被使用时,都没有参与过参数选择</b>。样本内夏普 vs 样本外夏普的差距,就是“调参带来的乐观偏差”的直接测量。");
      S.go(0);
    }
  });

  def("ch7-ci", {
    kind: "play", title: "夏普的置信区间:3 年回测能说明什么?", xp: 20,
    predict: { q: "一个<b>真实夏普 = 0.5</b> 的策略,回测 3 年(日频)。样本夏普的 95% 区间大约是?", o: ["0.4 ~ 0.6", "−0.6 ~ 1.6", "0 ~ 1"], a: 1, e: "年化夏普的标准误 ≈ √(1/年数) ≈ 0.58,95% 区间 ≈ 0.5 ± 1.13。3 年的数据几乎分不清夏普 0 和夏普 1!" },
    tryit: "拖动“回测年数”,看灰色直方图(2000 次平行回测的样本夏普)变宽变窄。把真实夏普设为 0,看有多少次回测碰巧做出了 > 1 的夏普。",
    build(body, api) {
      const v = api.controls(body, [{ k: "sr", label: "真实年化夏普", min: 0, max: 2, step: 0.1, v: 0.5, fmt: x => x.toFixed(1) }, { k: "y", label: "回测年数", min: 1, max: 20, v: 3, fmt: x => x + " 年" }], () => api.render());
      const st = api.div(body), cv = api.canvas(body, 280);
      api.render = () => {
        const R = rng(5), n = 1500, T = v.y * 252, mu = v.sr / Math.sqrt(252), out = [];
        for (let k = 0; k < n; k++) { let s = 0, s2 = 0; for (let t = 0; t < T; t++) { const x = mu + R.g(); s += x; s2 += x * x; } const m = s / T; out.push(m / Math.sqrt((s2 - T * m * m) / (T - 1)) * Math.sqrt(252)); }
        out.sort((a, b) => a - b); const lo = out[Math.floor(n * 0.025)], hi = out[Math.floor(n * 0.975)], se = Math.sqrt((1 + 0.5 * (v.sr / Math.sqrt(252)) ** 2) / T) * Math.sqrt(252);
        const H = U.hist(out, -3, 4, 70);
        api.draw(cv, { type: "bar", data: { labels: H.labels.map(x => x.toFixed(2)), datasets: [{ label: "1500 次回测的样本夏普", data: H.h, backgroundColor: H.labels.map(x => x < lo || x > hi ? "rgba(100,116,139,.35)" : "rgba(37,99,235,.65)"), barPercentage: 1, categoryPercentage: 1 }] }, options: api.chartOpts({ xTitle: "年化样本夏普(蓝色 = 中间 95%)", yTitle: "次数" }) });
        const neg = out.filter(x => x < 0).length / n, big = out.filter(x => x > 1).length / n;
        api.stats(st, [["理论标准误", fx(se)], ["95% 区间", "[" + fx(lo) + ", " + fx(hi) + "]"], ["样本夏普 < 0 的概率", pct(neg, 1), neg > 0.05 ? "bad" : ""], ["样本夏普 > 1 的概率", pct(big, 1)]]);
        api.explain("标准误 \\(\\approx\\sqrt{(1+\\tfrac12 SR^2)/T}\\)(按日计算再年化 ≈ \\(1/\\sqrt{\\text{年数}}\\))。要把标准误降一半,需要<b>四倍</b>长的数据。" + (v.sr === 0 ? " 真实夏普为 0 时,仍有 " + pct(big, 1) + " 的回测夏普 > 1——试了几十个策略后挑出一个 1.2 的夏普,一点也不稀奇。" : " 区间包含 0 时,你无法在统计上排除“这个策略毫无用处”。"));
        if (window.renderMathInElement) renderMathInElement(api.el.querySelector(".ix-exp-text"), { delimiters: [{ left: "\\(", right: "\\)", display: false }], throwOnError: false });
      };
    }
  });

  def("ch7-spot", {
    kind: "game", title: "找出真策略:4 条回测曲线,你投哪一个?", xp: 35,
    tryit: "每轮有 4 个策略的 3 年样本内回测。其中<b>只有 1 个</b>有真实的 alpha(真实夏普 0.9,只试了 1 次);其余 3 个是从 N 个纯噪声策略里挑出的最好者。卡片上写着夏普和“试验次数 N”。选一个你愿意投钱的,然后看接下来 2 年的样本外走势。3 轮中<b>选对 2 轮</b>过关。",
    build(body, api) {
      let round = 0, wins = 0, seed = 1, cards = null, picked = null;
      const top = api.div(body, "gc-top"), grid = api.div(body, "mini-grid four"), fb = api.div(body, "gc-fb");
      const IS = 756, OOS = 504;
      function path(R, mu, n) { return Array.from({ length: n }, () => mu + R.g() * 0.01); }
      function gen() {
        const R = rng(seed * 8887 + round * 13), Ns = [[50, 200, 1000][Math.floor(R.u() * 3)], 20, [100, 500][Math.floor(R.u() * 2)]];
        const out = [];
        const real = path(R, 0.9 * 0.01 / Math.sqrt(252), IS + OOS); out.push({ r: real, n: 1, real: true });
        Ns.forEach(N => { let best = null, bs = -9; for (let k = 0; k < N; k++) { const x = path(R, 0, IS); const s = sharpe(x); if (s > bs) { bs = s; best = x; } } out.push({ r: best.concat(path(R, 0, OOS)), n: N, real: false }); });
        cards = out.sort(() => R.u() - 0.5); picked = null;
      }
      function dsr(sr, N) { const sd = 1 / Math.sqrt(3), g = 0.5772156649, em = N > 1 ? sd * ((1 - g) * U.normInv(1 - 1 / N) + g * U.normInv(1 - 1 / (N * Math.E))) : 0; return U.normCdf((sr - em) / sd); }
      function render() {
        grid.innerHTML = "";
        cards.forEach((c, i) => {
          const cell = document.createElement("div"); cell.className = "mini-cell" + (picked === i ? " picked" : ""); grid.appendChild(cell);
          const isr = sharpe(c.r.slice(0, IS));
          cell.innerHTML = "<b>策略 " + "ABCD"[i] + "</b> · 样本内夏普 <b>" + fx(isr) + "</b> · 试验次数 N = <b>" + c.n + "</b>";
          const cv = api.canvas(cell, 130), n = picked == null ? IS : IS + OOS;
          api.draw(cv, { type: "line", data: { labels: Array.from({ length: IS + OOS }, (_, k) => k), datasets: [api.line("样本内", cumprod(c.r.slice(0, IS)), C.blue, { borderWidth: 1.4 }), api.line("样本外", picked == null ? [] : Array(IS - 1).fill(null).concat(cumprod(c.r.slice(IS - 1), cumprod(c.r.slice(0, IS - 1))[IS - 2])), C.orange, { borderWidth: 1.4 })] }, options: api.chartOpts({ legend: false, tooltip: false, noX: true, xMin: 0, xMax: IS + OOS - 1 }) });
          if (picked == null) { const b = document.createElement("button"); b.type = "button"; b.className = "btn secondary tog"; b.textContent = "💰 投这个"; b.onclick = () => pick(i); cell.appendChild(b); }
          else { const o = sharpe(c.r.slice(IS)); cell.insertAdjacentHTML("beforeend", '<div class="why">' + (c.real ? '<span class="pos">✔ 真策略</span>' : '<span class="neg">✘ 噪声中的“冠军”</span>') + " · 样本外夏普 " + fx(o) + " · DSR ≈ " + fx(dsr(isr, c.n)) + "</div>"); }
        });
        top.innerHTML = "第 " + Math.min(round + 1, 3) + " / 3 轮 · 已选对 " + wins + " 轮";
      }
      function pick(i) {
        picked = i; const ok = cards[i].real; if (ok) wins++; render();
        fb.innerHTML = (ok ? '<span class="pos">🎉 选对了!</span>' : '<span class="neg">选错了。</span>') + " 橙色是之后 2 年的样本外走势。";
        if (round < 2) api.btn(fb, "下一轮 →", () => { round++; gen(); fb.innerHTML = ""; render(); });
        else { fb.insertAdjacentHTML("beforeend", " <b>3 轮结束,选对 " + wins + " 轮。</b>"); if (wins >= 2) api.win("识破过拟合策略"); api.btn(fb, "🔁 再来一局", () => { seed++; round = 0; wins = 0; gen(); fb.innerHTML = ""; render(); }, "secondary"); }
        api.explain("从 N 个噪声策略里挑最好的,它的样本内夏普期望约为 \\(\\sqrt{1/年数}\\times\\Phi^{-1}(1-1/N)\\) 量级:N = 1000、3 年时可以高达 1.8!所以<b>只看夏普的大小会被骗,一定要问“试了多少次”</b>。卡片上的 DSR(Deflated Sharpe)把 N 考虑进去:DSR 接近 1 才可信。");
        if (window.renderMathInElement) renderMathInElement(api.el.querySelector(".ix-exp-text"), { delimiters: [{ left: "\\(", right: "\\)", display: false }], throwOnError: false });
      }
      api.explain("提示:夏普最高的那个,往往是试验次数最多的那个。");
      gen(); render();
    }
  });

  /* ===================== 第 8 章 ===================== */
  def("ch8-book", {
    kind: "walk", title: "订单簿撮合模拟器:你的单子吃掉了几档?", xp: 25,
    tryit: "选择方向、订单类型和数量,点“提交订单”,再按 ▶ 一档一档地看撮合过程:市价单从最优价开始<b>逐档吃单</b>,直到数量满足;限价单只吃到你的限价为止,剩下的部分挂在订单簿上排队。看看 3000 股的市价单平均价比中间价差了多少 bp。",
    build(body, api) {
      const v = api.controls(body, [
        { k: "side", label: "方向", type: "select", opts: [["buy", "买入"], ["sell", "卖出"]], v: "buy" },
        { k: "type", label: "订单类型", type: "select", opts: [["mkt", "市价单"], ["lmt", "限价单"]], v: "mkt" },
        { k: "qty", label: "数量", min: 100, max: 6000, step: 100, v: 1500, fmt: x => x + " 股" },
        { k: "lp", label: "限价(偏离最优价)", min: 0, max: 4, v: 1, fmt: x => "+" + x + " 档" }
      ], () => {});
      const bar = api.div(body, "btn-row"); api.btn(bar, "📨 提交订单", submit); api.btn(bar, "↺ 重置订单簿", () => { init(); show(-1); S.reset(1); }, "secondary");
      const row = api.div(body, "two-col"), bookEl = api.div(row, "book"), st = api.div(row);
      let asks, bids, steps = [], order = null;
      function init() { asks = [[10.02, 300], [10.03, 500], [10.04, 800], [10.05, 1200], [10.06, 2000]]; bids = [[10.00, 400], [9.99, 600], [9.98, 900], [9.97, 1300], [9.96, 2000]]; }
      init();
      const mid0 = () => (asks[0][0] + bids[0][0]) / 2;
      function submit() {
        const buy = v.side === "buy", book = (buy ? asks : bids).map(x => [...x]), other = (buy ? bids : asks).map(x => [...x]);
        const limit = v.type === "lmt" ? +(book[0][0] + (buy ? 1 : -1) * v.lp * 0.01).toFixed(2) : null;
        let rem = v.qty; const fills = []; steps = [{ book: book.map(x => [...x]), other: other.map(x => [...x]), fills: [], rem, note: "订单到达:" + (buy ? "买入 " : "卖出 ") + v.qty + " 股" + (limit ? ",限价 " + limit.toFixed(2) : "(市价)") + "。中间价 " + mid0().toFixed(3) + "。" }];
        while (rem > 0 && book.length) {
          const [px, q] = book[0];
          if (limit != null && (buy ? px > limit + 1e-9 : px < limit - 1e-9)) break;
          const take = Math.min(q, rem); rem -= take; fills.push([px, take]); book[0][1] -= take; if (book[0][1] === 0) book.shift();
          steps.push({ book: book.map(x => [...x]), other: other.map(x => [...x]), fills: fills.map(x => [...x]), rem, hit: px, note: "在 " + px.toFixed(2) + " 成交 " + take + " 股" + (q > take ? "(这一档还剩 " + (q - take) + " 股)" : "(这一档被吃光)") + ",剩余 " + rem + " 股。" });
        }
        if (rem > 0 && limit != null) { const o2 = other.map(x => [...x]); const i = o2.findIndex(x => buy ? x[0] < limit : x[0] > limit); const ex = o2.find(x => Math.abs(x[0] - limit) < 1e-9); if (ex) ex[1] += rem; else o2.splice(i < 0 ? o2.length : i, 0, [limit, rem]); steps.push({ book: book.map(x => [...x]), other: o2, fills: fills.map(x => [...x]), rem, rest: limit, note: "价格超过限价,剩余 " + rem + " 股作为<b>新的" + (buy ? "买单" : "卖单") + "挂在 " + limit.toFixed(2) + "</b> 排队,等待别人来成交。" }); }
        else if (rem > 0) steps.push({ book: [], other, fills, rem, note: "订单簿被吃空了,还剩 " + rem + " 股没成交!真实市场里这会引发剧烈的价格冲击。" });
        order = { buy, limit, fills, mid: mid0(), qty: v.qty };
        S.reset(steps.length); api.touch();
      }
      function show(i) {
        const s = i >= 0 ? steps[i] : { book: asks, other: bids, fills: [], rem: 0 };
        const buy = order ? order.buy : true, A = i >= 0 ? (buy ? s.book : s.other) : asks, B = i >= 0 ? (buy ? s.other : s.book) : bids;
        const rowh = (side, p, q) => '<tr class="' + side + (s.hit && Math.abs(p - s.hit) < 1e-9 ? " hit" : "") + (s.rest && Math.abs(p - s.rest) < 1e-9 ? " rest" : "") + '"><td>' + (side === "ask" ? "卖" : "买") + '</td><td>' + p.toFixed(2) + '</td><td><span class="qbar" style="width:' + Math.min(100, q / 20) + '%"></span>' + q + "</td></tr>";
        bookEl.innerHTML = '<table class="mini book-t"><tr><th></th><th>价格</th><th>挂单量</th></tr>' + A.slice(0, 6).slice().reverse().map(x => rowh("ask", x[0], x[1])).join("") + '<tr class="midrow"><td colspan="3">— 价差 —</td></tr>' + B.slice(0, 6).map(x => rowh("bid", x[0], x[1])).join("") + "</table>";
        const filled = s.fills.reduce((a, f) => a + f[1], 0), avg = filled ? s.fills.reduce((a, f) => a + f[0] * f[1], 0) / filled : null;
        const bp = avg && order ? (order.buy ? avg / order.mid - 1 : 1 - avg / order.mid) * 1e4 : null;
        api.stats(st, [["已成交", filled + " 股"], ["平均成交价", avg ? avg.toFixed(4) : "—"], ["相对中间价成本", bp != null ? fx(bp, 1) + " bp" : "—", bp > 15 ? "bad" : ""], ["吃掉档数", s.fills.length]]);
        if (i === steps.length - 1 && order && filled) api.explain("这笔" + (order.buy ? "买单" : "卖单") + "成交 " + filled + " 股,平均价 " + avg.toFixed(4) + ",比中间价贵 " + fx(bp, 1) + " bp。其中半个价差(约 10bp)是“过路费”,剩下的是<b>吃深档的冲击</b>。订单越大、盘口越薄,成本越高——这就是为什么大单要拆成小单慢慢执行(8.5 节)。" + (order.limit ? " 限价单保护了价格,代价是可能<b>成交不全</b>。" : ""));
      }
      const S = api.stepper(body, { n: 1, label: "第", onStep(i) { if (!steps.length) { show(-1); return "设置好订单后点“提交订单”。"; } show(i); return steps[i].note; }, onEnd() { if (steps.length > 1) api.win("完成一次撮合"); } });
      api.explain("订单簿上半部分是卖单(ask,红色价格),下半部分是买单(bid,绿色价格)。最低卖价 10.02 和最高买价 10.00 之间的差 0.02 元就是价差,中间价 10.01。");
      S.go(0);
    }
  });

  def("ch8-impact", {
    kind: "play", title: "平方根冲击计算器", xp: 15,
    predict: { q: "按平方根定律,如果订单量变成原来的 <b>4 倍</b>,每股的冲击成本(bp)大约变成原来的?", o: ["4 倍", "2 倍", "不变"], a: 1, e: "I ∝ √(Q/V):√4 = 2。总冲击金额 = 每股冲击 × 股数,所以总成本是 4 × 2 = 8 倍。" },
    tryit: "拖动“订单占日成交量比例”,沿着曲线看成本如何增长:从 1% 到 4%,冲击只翻一倍(凹函数)。再改变日波动:波动大的股票冲击也大。",
    build(body, api) {
      const v = api.controls(body, [
        { k: "p", label: "订单占日成交量 Q/V", min: 0.1, max: 30, step: 0.1, v: 5, fmt: x => x.toFixed(1) + "%" },
        { k: "sig", label: "日波动 σ", min: 0.5, max: 5, step: 0.1, v: 2, fmt: x => x.toFixed(1) + "%" },
        { k: "Y", label: "系数 Y", min: 0.3, max: 1.5, step: 0.1, v: 1, fmt: x => x.toFixed(1) },
        { k: "hs", label: "半个价差", min: 1, max: 30, v: 5, fmt: x => x + " bp" },
        { k: "nt", label: "订单金额", min: 100, max: 10000, step: 100, v: 1000, fmt: x => x + " 万元" }
      ], () => api.render());
      const st = api.div(body), cv = api.canvas(body, 280);
      api.render = () => {
        const I = p => v.Y * v.sig / 100 * Math.sqrt(p / 100) * 1e4, xs = []; for (let p = 0.1; p <= 30.01; p += 0.3) xs.push(p);
        const imp = I(v.p), tot = imp + v.hs;
        api.draw(cv, { type: "line", data: { datasets: [api.line("冲击成本 bp", xs.map(p => ({ x: p, y: I(p) })), C.blue), api.line("冲击 + 半价差 bp", xs.map(p => ({ x: p, y: I(p) + v.hs })), C.orange), api.line("线性冲击(对照)", xs.map(p => ({ x: p, y: I(v.p) / v.p * p })), C.gray, { borderDash: [5, 4], borderWidth: 1 }), { type: "scatter", label: "当前", data: [{ x: v.p, y: tot }], backgroundColor: C.red, pointRadius: 7 }] }, options: api.chartOpts({ xType: "linear", xTitle: "订单占日成交量 %", yTitle: "单边成本 bp", xMin: 0, xMax: 30 }) });
        api.stats(st, [["冲击 Yσ√(Q/V)", fx(imp, 1) + " bp"], ["+ 半价差", fx(tot, 1) + " bp", tot > 50 ? "bad" : ""], ["成本金额", fx(v.nt * 1e4 * tot / 1e4, 0) + " 元"], ["4 倍订单时", fx(I(Math.min(v.p * 4, 100)) + v.hs, 1) + " bp"]]);
        api.explain("平方根定律:\\(I\\approx Y\\sigma\\sqrt{Q/V}\\)。当前 " + v.p.toFixed(1) + "% 的参与率、" + v.sig + "% 的日波动 → 冲击 " + fx(imp, 1) + " bp。凹形意味着<b>第一手最贵的部分是“开始交易”</b>,但总成本依然随规模快速增长:策略规模扩大 10 倍,每股成本约增 3.2 倍,这决定了策略的<b>容量</b>。");
        if (window.renderMathInElement) renderMathInElement(api.el.querySelector(".ix-exp-text"), { delimiters: [{ left: "\\(", right: "\\)", display: false }], throwOnError: false });
      };
    }
  });

  def("ch8-exec", {
    kind: "game", title: "执行挑战:把 1 万股买得比 TWAP 更便宜", xp: 35,
    tryit: "你要在 10 个时段内买入 10,000 股。每个时段选择买多少(灰柱是该时段市场成交量,开盘和收盘量大)。买得越集中,冲击越大;拖得越久,价格漂移风险越大。最后一个时段会强制买完剩余数量。目标:<b>执行落差(相对到达价的成本)低于 TWAP</b>。",
    build(body, api) {
      let seed = 1, k, rem, buys, fills, mid, noise, done;
      const VOL = [1.8, 1.2, 0.9, 0.7, 0.6, 0.6, 0.7, 0.9, 1.2, 1.9].map(x => x * 10000), TOTAL = 10000, P0 = 10;
      const top = api.div(body, "gc-top"), bar = api.div(body, "btn-row"), cv = api.canvas(body, 260), st = api.div(body), fb = api.div(body, "gc-fb");
      [0, 500, 1000, 1500, 2500].forEach(q => api.btn(bar, "买 " + q, () => step(q), "secondary"));
      api.btn(bar, "买完剩余", () => step(rem)); api.btn(bar, "🔁 新的一局", () => { seed++; reset(); }, "secondary");
      function simulate(sched) { let m = P0, cost = 0; const px = []; sched.forEach((q, i) => { const f = m * (1 + 0.0003 + 0.012 * Math.sqrt(q / VOL[i])) ; if (q) cost += q * f; px.push(f); m = m * (1 + noise[i]) + m * 0.25 * 0.012 * q / VOL[i]; }); return { avg: cost / U.sum(sched), px }; }
      function reset() { const R = rng(seed * 557); noise = VOL.map(() => R.g() * 0.003); k = 0; rem = TOTAL; buys = []; fills = []; mid = [P0]; done = false; fb.innerHTML = ""; render(); }
      function step(q) {
        if (done) return; q = Math.min(q, rem); if (k === 9) q = rem;
        const m = mid[k], f = m * (1 + 0.0003 + 0.012 * Math.sqrt(q / VOL[k]));
        buys.push(q); fills.push(q ? f : null); rem -= q; mid.push(m * (1 + noise[k]) + m * 0.25 * 0.012 * q / VOL[k]); k++;
        if (k === 10 || rem === 0) { while (buys.length < 10) { buys.push(0); fills.push(null); mid.push(mid[mid.length - 1] * (1 + noise[mid.length - 1])); } finish(); } else render();
      }
      function finish() {
        done = true; const me = simulate(buys), tw = simulate(VOL.map(() => TOTAL / 10)), vw = simulate(VOL.map(x => TOTAL * x / U.sum(VOL))), all = simulate([TOTAL, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
        const bp = a => (a / P0 - 1) * 1e4;
        render(tw, vw);
        fb.innerHTML = "<b>结算</b>(相对到达价 10.00 的执行落差):你 <b>" + fx(bp(me.avg), 1) + " bp</b> · TWAP " + fx(bp(tw.avg), 1) + " bp · VWAP " + fx(bp(vw.avg), 1) + " bp · 开盘一次买完 " + fx(bp(all.avg), 1) + " bp。" + (bp(me.avg) < bp(tw.avg) ? " 🎉 你赢了 TWAP!" : " 这次没赢 TWAP,再试试更均匀的拆单。");
        api.win("完成执行挑战"); if (bp(me.avg) < bp(tw.avg)) api.bonus("beat", 10, "执行成本低于 TWAP");
        api.explain("你的成本由三部分组成:<b>价差</b>(固定 3bp)、<b>临时冲击</b>(∝ √(每段买量/该段成交量),集中买入很贵)、<b>永久冲击 + 价格漂移</b>(早买的单子推高了后面的价格;随机漂移则是运气)。VWAP 按成交量分配,让每段的参与率相同,通常比 TWAP 略好;一次买完的冲击最大。执行算法的本质就是在“冲击成本”和“时间风险”之间权衡。");
      }
      function render(tw, vw) {
        const L = VOL.map((_, i) => "时段" + (i + 1)), ds = [{ label: "市场成交量 / 10", data: VOL.map(x => x / 10), backgroundColor: "rgba(100,116,139,.3)", yAxisID: "y" }, { label: "你的买入量", data: VOL.map((_, i) => buys[i] || 0), backgroundColor: C.orange, yAxisID: "y" }];
        if (tw) ds.push({ type: "line", label: "TWAP 计划", data: VOL.map(() => 1000), borderColor: C.blue, borderDash: [5, 4], pointRadius: 0, yAxisID: "y" }, { type: "line", label: "VWAP 计划", data: VOL.map(x => TOTAL * x / U.sum(VOL)), borderColor: C.green, borderDash: [5, 4], pointRadius: 0, yAxisID: "y" });
        ds.push({ type: "line", label: "中间价(右轴)", data: mid.slice(0, 10).map((x, i) => i <= k ? x : null), borderColor: C.red, backgroundColor: C.red, pointRadius: 3, yAxisID: "y1" });
        api.draw(cv, { type: "bar", data: { labels: L, datasets: ds }, options: api.chartOpts({ yTitle: "股数", y1: "价格" }) });
        const got = TOTAL - rem, cost = buys.reduce((a, q, i) => a + (q ? q * fills[i] : 0), 0);
        top.innerHTML = done ? "执行完成 ✅" : "时段 " + (k + 1) + " / 10 · 当前中间价 " + mid[k].toFixed(3) + " · 本时段市场成交量约 " + VOL[k].toLocaleString() + " 股";
        api.stats(st, [["已买入", got + " / " + TOTAL], ["剩余", rem], ["平均成交价", got ? (cost / got).toFixed(4) : "—"], ["当前执行落差", got ? fx((cost / got / P0 - 1) * 1e4, 1) + " bp" : "—"]]);
        if (!done) api.explain("如果这个时段买 1000 股,预计临时冲击约 " + fx(1.2e2 * Math.sqrt(1000 / VOL[k]), 1) + " bp;买 2500 股约 " + fx(1.2e2 * Math.sqrt(2500 / VOL[k]), 1) + " bp。成交量大的时段(开盘、收盘)能“吸收”更多订单。");
      }
      reset();
    }
  });

  /* ===================== 第 9 章 ===================== */
  def("ch9-risk", {
    kind: "game", title: "风控闯关:你是最后一道防线", xp: 30,
    tryit: "你是风控系统。下面每一笔订单到达时,对照右边的<b>事前风控规则</b>,决定“放行”还是“拦截”。8 笔订单<b>判断对 7 笔</b>以上过关。小心:有的订单只是看起来吓人。",
    build(body, api) {
      const RULES = ["单笔金额 ≤ 50 万元", "下单后单票持仓 ≤ 总资产 10%(100 万元)", "限价偏离最新价 ≤ 3%", "当日亏损 ≥ 2%(20 万)后禁止开新仓(允许平仓)", "同一策略每秒下单 ≤ 5 笔", "禁止交易风险警示(ST)股票"];
      let round = 0, score = 0, seed = 1, q, answered;
      const row = api.div(body, "two-col"), card = api.div(row, "game-card"), rules = api.div(row, "rules-card"), st = api.div(body);
      rules.innerHTML = "<b>📋 事前风控规则</b>(总资产 1000 万)<ol>" + RULES.map(r => "<li>" + r + "</li>").join("") + "</ol>";
      function gen() {
        const R = rng(seed * 6007 + round * 7), viol = R.u() < 0.55 ? Math.floor(R.u() * 6) : -1;
        const names = ["平安银行", "贵州茅台", "宁德时代", "招商银行", "比亚迪", "中国平安"], nm = R.pick(names), last = +(10 + R.u() * 90).toFixed(2);
        let side = R.u() < 0.7 ? "买入" : "卖出", qty = (1 + Math.floor(R.u() * 30)) * 100, px = +(last * (1 + (R.u() - 0.5) * 0.03)).toFixed(2), hold = Math.round(R.u() * 40) * 1e4, pnl = -(R.u() * 1.5).toFixed(2) * 1, rate = 1 + Math.floor(R.u() * 4), st_ = false;
        const val = () => qty * px;
        while (val() > 5e5) qty -= 100;
        if (side === "买入") while (hold + val() > 1e6 && qty > 100) qty -= 100;
        if (viol === 0) { qty = Math.ceil(5.2e5 / px / 100) * 100 + 100 * Math.floor(R.u() * 20); hold = 0; side = "买入"; }
        if (viol === 1) { side = "买入"; hold = 8e5 + Math.round(R.u() * 15) * 1e4; while (val() < 1e6 - hold + 2e4) qty += 100; while (val() > 4.9e5) qty -= 100; if (hold + val() <= 1e6) hold = 1e6 - val() + 5e4; }
        if (viol === 2) px = +(last * (1 + (R.u() < 0.5 ? -1 : 1) * (0.035 + R.u() * 0.05))).toFixed(2);
        if (viol === 3) { pnl = -(2.1 + R.u() * 1.5); side = "买入"; }
        if (viol === 4) rate = 6 + Math.floor(R.u() * 5);
        if (viol === 5) st_ = true;
        if (viol !== 3 && pnl <= -2) pnl = -1.2;
        if (viol !== 3 && R.u() < 0.25) { pnl = -(2.2 + R.u()); side = "卖出"; } // 亏损时平仓:应放行
        const name = (st_ ? "*ST " : "") + nm, dev = px / last - 1;
        const checks = [val() <= 5e5, side === "卖出" || hold + val() <= 1e6, Math.abs(dev) <= 0.03, !(pnl <= -2 && side === "买入"), rate <= 5, !st_];
        const bad = checks.findIndex(x => !x);
        q = { name, side, qty, px, last, hold, pnl, rate, dev, val: val(), bad };
      }
      function show() {
        answered = false;
        if (round >= 8) { const pass = score >= 7; card.innerHTML = '<div class="game-over">' + (pass ? "🛡️ 过关!" : "😬 有漏网之鱼") + " 8 笔判断对 <b>" + score + "</b> 笔。</div>"; api.btn(card, "🔁 再来一局", () => { seed++; round = 0; score = 0; show(); }); if (pass) api.win("风控闯关 ≥ 7/8"); api.explain("事前风控必须是<b>机械的、无例外的</b>:规则写进配置、由程序执行、上线前测试过。人在压力下最容易做的就是“这次先放过去”。"); return; }
        gen();
        card.innerHTML = '<div class="gc-top">订单 ' + (round + 1) + ' / 8</div><table class="mini"><tr><td>标的</td><td><b>' + q.name + "</b></td></tr><tr><td>方向 / 数量</td><td>" + q.side + " " + q.qty + " 股</td></tr><tr><td>限价 / 最新价</td><td>" + q.px.toFixed(2) + " / " + q.last.toFixed(2) + "(偏离 " + pct(q.dev, 1) + ")</td></tr><tr><td>订单金额</td><td>" + (q.val / 1e4).toFixed(1) + " 万</td></tr><tr><td>当前该票持仓</td><td>" + (q.hold / 1e4).toFixed(0) + " 万</td></tr><tr><td>今日盈亏</td><td>" + q.pnl.toFixed(2) + "%</td></tr><tr><td>过去 1 秒下单数</td><td>" + q.rate + " 笔(含本笔)</td></tr></table>" +
          '<div class="btn-row"><button type="button" class="btn ans" data-v="1">✅ 放行</button><button type="button" class="btn danger ans" data-v="0">⛔ 拦截</button></div><div class="gc-fb"></div>';
        card.querySelectorAll(".ans").forEach(b => b.addEventListener("click", () => answer(b.dataset.v === "1")));
        api.stats(st, [["进度", round + " / 8"], ["判断正确", score]]);
      }
      function answer(pass) {
        if (answered) return; answered = true;
        const right = pass === (q.bad < 0); if (right) score++;
        const fbx = card.querySelector(".gc-fb");
        fbx.innerHTML = (right ? '<span class="pos">✔ 正确。</span>' : '<span class="neg">✘ 判断错误。</span>') + (q.bad < 0 ? "这笔订单符合全部规则,应该放行。" + (q.pnl <= -2 ? "(亏损超限后只禁止<b>开新仓</b>,卖出平仓是允许的。)" : "") : "违反第 " + (q.bad + 1) + " 条:" + RULES[q.bad] + "。");
        card.querySelectorAll(".ans").forEach(b => b.disabled = true);
        api.btn(fbx, round < 7 ? "下一笔 →" : "看结果 →", () => { round++; show(); }).style.marginLeft = "10px";
        api.stats(st, [["进度", round + 1 + " / 8"], ["判断正确", score]]);
      }
      api.explain("逐条核对:金额、持仓、价格偏离、亏损状态、频率、黑名单。");
      show();
    }
  });

  def("ch9-live", {
    kind: "walk", title: "实盘监控台:回测说好的收益去哪了?", xp: 25,
    tryit: "设定实盘的不完美(额外滑点、成交率、信号延迟)和“策略从第 N 天起失效”,然后按 ▶ 播放,一天一天地看实盘净值(橙)和回测(蓝)分道扬镳。告警日志会在偏离过大时报警;当回撤超过总开关阈值,系统自动停止交易。",
    build(body, api) {
      const v = api.controls(body, [
        { k: "slip", label: "额外滑点(每日换手 30%)", min: 0, max: 30, v: 8, fmt: x => x + " bp" },
        { k: "fill", label: "成交率", min: 50, max: 100, step: 5, v: 85, fmt: x => x + "%" },
        { k: "delay", label: "信号延迟损耗", min: 0, max: 50, step: 5, v: 15, fmt: x => x + "% 的 alpha" },
        { k: "dead", label: "策略失效", type: "select", opts: [[0, "不失效"], [120, "第 120 天起"], [200, "第 200 天起"]], v: 120 },
        { k: "kill", label: "总开关:回撤超过", min: 3, max: 30, v: 10, fmt: x => x + "%" }
      ], () => { compute(); S.go(S.i); });
      const cv = api.canvas(body, 260), row = api.div(body, "two-col"), st = api.div(row), logEl = api.div(row, "alert-log");
      const T = 300; let D = null;
      function compute() {
        const R = rng(99), mu = 1.5 * 0.01 / Math.sqrt(252); const bt = [], lv = [], alerts = []; let pk = 1, eq = 1, killed = -1, beq = 1, dev = [];
        for (let t = 0; t < T; t++) {
          const alive = !v.dead || t < v.dead, e = R.g() * 0.01, b = mu + e;
          bt.push(b);
          let l = killed >= 0 ? 0 : (alive ? (mu * (1 - v.delay / 100) + e) * v.fill / 100 : (-0.3 * mu + e) * v.fill / 100) - 0.3 * v.slip / 1e4;
          lv.push(l); eq *= 1 + l; beq *= 1 + b; pk = Math.max(pk, eq);
          dev.push(l - b);
          if (killed < 0 && eq / pk - 1 < -v.kill / 100) { killed = t; alerts.push([t, "🛑 回撤 " + pct(eq / pk - 1) + " 超过 " + v.kill + "%,总开关触发:撤单、停止开仓,通知负责人。"]); }
          if (t >= 40 && t % 20 === 0 && killed < 0) { const w = dev.slice(t - 40), m = mean(w) * 252, s = std(w) * Math.sqrt(252); if (m < -0.1) alerts.push([t, "⚠️ 近 40 天实盘落后回测 " + pct(-m / 252 * 40, 1) + ",跟踪误差 " + pct(s, 1) + "。检查成交与信号。"]); }
          if (v.dead && t === v.dead) alerts.push([t, "ℹ️(上帝视角)从这一天起,策略的 alpha 消失了。实盘系统并不知道这一点。"]);
        }
        D = { bt: cumprod(bt), lv: cumprod(lv), alerts, killed, r: lv };
      }
      compute();
      const S = api.stepper(body, {
        n: T, label: "第",
        onStep(i) {
          const L = D.bt.map((_, t) => t), cut = a => a.map((x, t) => t <= i ? x : null);
          api.draw(cv, { type: "line", data: { labels: L, datasets: [api.line("回测预期", cut(D.bt), C.blue, { borderDash: [5, 4] }), api.line("实盘净值", cut(D.lv), C.orange, { borderWidth: 2.5 }), { type: "scatter", label: "总开关触发", data: L.map(t => t === D.killed && t <= i ? D.lv[t] : null), backgroundColor: C.red, pointRadius: 9, pointStyle: "crossRot", borderColor: C.red, borderWidth: 3 }] }, options: api.chartOpts({ yTitle: "净值" }) });
          const eqs = D.lv.slice(0, i + 1);
          api.stats(st, [["回测收益", pct(D.bt[i] - 1)], ["实盘收益", pct(D.lv[i] - 1), D.lv[i] < 1 ? "bad" : ""], ["实盘最大回撤", pct(maxDD(eqs)), "bad"], ["状态", D.killed >= 0 && i >= D.killed ? "🛑 已停机" : "🟢 运行中"]]);
          logEl.innerHTML = "<b>告警日志</b>" + (D.alerts.filter(a => a[0] <= i).slice(-5).reverse().map(a => '<div class="al">第 ' + a[0] + " 天 · " + a[1] + "</div>").join("") || '<div class="muted">暂无告警</div>');
          return "第 " + i + " 天:实盘落后回测 " + pct(D.bt[i] - D.lv[i]) + "(净值差)。";
        }
      });
      api.render = () => S.go(S.i);
      api.explain("即使策略本身完全有效,滑点、成交率不足、信号延迟也会让实盘<b>系统性地</b>低于回测——上线前就该用模拟盘和小资金估计这些损耗。策略失效时,你在当下无法确定是“正常回撤”还是“失效”,所以需要<b>事先写好</b>的总开关:它可能会误杀,但能防止灾难。");
      S.go(0);
    }
  });

  def("ch9-gap", {
    kind: "play", title: "偏差瀑布图:从回测年化到实盘年化", xp: 15,
    tryit: "每个滑块代表上面表格里的一个偏差来源。调整它们,看瀑布图从“回测年化”一级一级掉到“实盘年化”。找出:在你的设定下,哪一项是最大的“收益杀手”?",
    build(body, api) {
      const v = api.controls(body, [
        { k: "bt", label: "回测年化收益", min: 5, max: 40, v: 20, fmt: x => x + "%" },
        { k: "to", label: "年换手(倍)", min: 1, max: 50, v: 15, fmt: x => x + " 倍" },
        { k: "slip", label: "实际滑点比假设多", min: 0, max: 20, v: 5, fmt: x => x + " bp" },
        { k: "fee", label: "费用低估", min: 0, max: 5, step: 0.5, v: 1, fmt: x => x + " bp" },
        { k: "fill", label: "成交率", min: 50, max: 100, step: 5, v: 90, fmt: x => x + "%" },
        { k: "lag", label: "信号延迟损失 alpha", min: 0, max: 50, step: 5, v: 10, fmt: x => x + "%" },
        { k: "data", label: "数据差异(复权/PIT)", min: 0, max: 5, step: 0.5, v: 1, fmt: x => x + "%/年" }
      ], () => api.render());
      const st = api.div(body), cv = api.canvas(body, 300);
      api.render = () => {
        const items = [["滑点", v.to * 2 * v.slip / 100], ["费用", v.to * 2 * v.fee / 100], ["信号延迟", v.bt * v.lag / 100], ["成交率不足", v.bt * (1 - v.lag / 100) * (1 - v.fill / 100)], ["数据差异", v.data]];
        let cur = v.bt; const bars = [[0, v.bt]], labels = ["回测年化"];
        items.forEach(([n, x]) => { bars.push([cur - x, cur]); labels.push("− " + n); cur -= x; }); bars.push([0, cur]); labels.push("实盘年化");
        api.draw(cv, { type: "bar", data: { labels, datasets: [{ label: "年化收益 %", data: bars, backgroundColor: bars.map((_, i) => i === 0 ? C.blue : i === bars.length - 1 ? (cur >= 0 ? C.green : C.red) : "rgba(220,38,38,.65)") }] }, options: api.chartOpts({ legend: false, yTitle: "年化 %" }) });
        const worst = items.reduce((a, b) => b[1] > a[1] ? b : a);
        api.stats(st, [["回测年化", v.bt + "%"], ["实盘年化", fx(cur, 1) + "%", cur < v.bt / 2 ? "bad" : "good"], ["最大杀手", worst[0] + "(−" + fx(worst[1], 1) + "%)", "bad"], ["实盘 / 回测", pct(cur / v.bt, 0)]]);
        api.explain("滑点和费用的损失 = 年换手 × 2(买+卖)× 单边偏差:换手 " + v.to + " 倍时,每多 1bp 滑点每年就少 " + fx(v.to * 2 / 100, 2) + "%。<b>高换手策略对执行质量极其敏感</b>,这也是为什么第 8 章要做 TCA、并用真实成交校准回测成本。");
      };
    }
  });
})();

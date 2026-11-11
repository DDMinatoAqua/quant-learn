/* 互动组件 · 第 1–5 章 */
(function () {
  "use strict";
  const D = QX.def, U = QX.U;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const tok = s => Math.max(1, Math.round(String(s).length / 1.6));   // 粗略估算(中英混排)
  const COL = { sys: "#64748b", tools: "#8b5cf6", hist: "#2563eb", tool: "#f59e0b", user: "#16a34a", free: "#94a3b8" };

  /* ===================== 第 1 章 ===================== */
  D("ch1-wfa", {
    title: "Workflow 还是 Agent?", kind: "game", xp: 25, needsChart: false,
    tryit: "每道题是一个内容业务里的真实需求。判断它更适合用固定的 workflow,还是让模型自己决定步骤的 agent。答对 5 题过关。",
    build(body, api) {
      api.quizGame(body, [
        { q: "每条新投稿:先过敏感词规则,再让模型输出“通过 / 拒绝 / 不确定”,不确定的送人工。", a: 0, e: "步骤完全固定,用 routing workflow 即可,便宜、稳定、好评测。" },
        { q: "运营说“最近某类内容的投诉变多了,帮我查清楚原因”。", a: 1, e: "要查什么、查到哪一步停,事先无法写死,适合 agent。" },
        { q: "给每篇文章生成标题 → 按品牌规范打分 → 不达标带意见重写,最多 3 次。", a: 0, e: "这是 evaluator-optimizer workflow,循环次数和步骤都是确定的。" },
        { q: "在一个陌生的推荐服务代码库里,定位“某些视频从不被分发”的 bug 并修复。", a: 1, e: "典型的开放式问题,路径依赖中间发现,编码 agent 的主场。" },
        { q: "把一篇长文同时翻译成英文、日文、韩文。", a: 0, e: "parallelization workflow:三个互不依赖的子任务并行跑。" },
        { q: "调查一个可疑账号:看历史内容、关联设备和账号、行为时间线,决定是否升级处理。", a: 1, e: "要根据查到的线索决定下一步查什么,适合 agent(配合严格的只读权限)。" },
        { q: "把用户问题按类型分到“退款 / 技术 / 账号”三个处理流程。", a: 0, e: "routing workflow:一次分类 + 固定分支。" }
      ], { bins: ["Workflow", "Agent"], pass: 5, winMsg: "能分清 workflow 和 agent 了",
        summary: "判断标准就一条:<b>执行路径能否事先写死</b>。能写死就用 workflow(更便宜、更稳);写不死、需要边做边决定,才用 agent。" });
      api.explain("先答题吧。记住 Anthropic 的建议:能用一次模型调用解决的不要上 workflow,能用 workflow 解决的不要上 agent。");
    }
  });

  const PARTS = [
    ["loop", "🔁 Agent 循环", "ch2", "反复“调模型 → 执行工具 → 回填结果”,并决定何时停止。", "Claude Code、Codex 的核心都是一个 while 循环;Codex 称之为 agent loop / turn。"],
    ["tools", "🔧 工具", "ch3", "给模型的“手”:函数 + 说明书(名字、描述、JSON Schema)。", "Claude Code 的 Read / Edit / Bash / Grep;Codex 的 shell、apply_patch、update_plan。"],
    ["mcp", "🔌 MCP", "ch4", "用统一协议接入外部工具和数据。", "在 Claude Code、Cursor、Codex 里配置一个 MCP server,就能用它的工具。"],
    ["ctx", "🧩 上下文管理", "ch5", "决定每一轮把什么放进有限的窗口。", "Cursor 的动态上下文发现;Manus 的“文件系统即上下文”。"],
    ["compact", "🗜️ 压缩", "ch6", "窗口快满时浓缩历史,让长任务能继续。", "Claude Code 的自动压缩;OpenAI 的 /responses/compact。"],
    ["mem", "🧠 记忆与状态", "ch7", "跨轮、跨会话、跨项目保存信息。", "AGENTS.md / CLAUDE.md;Anthropic memory 工具;LangGraph checkpointer。"],
    ["plan", "👥 规划与子 agent", "ch8", "拆任务、派子 agent 隔离上下文。", "Claude Code 的 todo 与 subagents;Anthropic Research 的编排者-工作者。"],
    ["sec", "🛡️ 沙箱与权限", "ch9", "限制 agent 能碰什么,危险操作问人。", "Claude Code 的 allow/ask/deny 与 hooks;Codex 的沙箱模式。"],
    ["cost", "💰 缓存与成本", "ch10", "保持前缀稳定以命中 prompt 缓存,控制预算。", "Codex 让每次 prompt 都是上次的精确前缀;Manus 把 KV 缓存命中率当头号指标。"],
    ["obs", "📊 追踪与评测", "ch11", "记录每一步,用任务集量化好坏。", "OpenTelemetry GenAI 约定;SWE-bench、Terminal-Bench;Cursor 的保留率。"]
  ];
  D("ch1-anatomy", {
    title: "Harness 部件地图", kind: "play", xp: 20, needsChart: false,
    tryit: "点击每个部件,看它负责什么、在真实产品里长什么样。全部点开就完成。",
    build(body, api) {
      const grid = api.div(body, "anat"), box = api.div(body, "detail-box", "👆 点一个部件看看。");
      const core = document.createElement("button"); core.type = "button"; core.className = "core"; core.textContent = "🤖 模型(只负责“想”和“说”)"; grid.appendChild(core);
      const seen = new Set();
      PARTS.forEach(p => {
        const b = document.createElement("button"); b.type = "button"; b.innerHTML = p[1] + "<small>第 " + p[2].slice(2) + " 章</small>"; grid.appendChild(b);
        b.addEventListener("click", () => {
          grid.querySelectorAll("button").forEach(x => x.classList.remove("on")); b.classList.add("on", "seen"); seen.add(p[0]);
          box.innerHTML = "<b>" + p[1] + "</b><p>" + p[3] + "</p><p class='muted'>真实例子:" + p[4] + "</p><a href='#" + p[2] + "'>→ 去第 " + p[2].slice(2) + " 章细看</a>";
          api.explain("已查看 " + seen.size + " / " + PARTS.length + " 个部件。" + (seen.size === PARTS.length ? " 🎉 这就是整个 harness:模型之外的一切。" : ""));
          if (seen.size === PARTS.length) api.win("认识了 harness 的全部部件");
        });
      });
      api.explain("中间是模型,周围这一圈都是 harness。");
    }
  });

  D("ch1-sort", {
    title: "模型问题还是 Harness 问题?", kind: "game", xp: 25, needsChart: false,
    tryit: "每道题是一个 agent 的故障现象。判断它主要该归咎于模型能力,还是 harness 设计。",
    build(body, api) {
      api.quizGame(body, [
        { q: "agent 读了一个 2 万行的日志文件,之后开始“忘记”任务要求。", a: 1, e: "工具没做截断 / 分页,上下文被撑爆。改工具返回格式即可。" },
        { q: "给了完整、正确的信息,模型仍然算错一道复杂的数学推理题。", a: 0, e: "信息齐全仍推理错,更像模型能力问题。" },
        { q: "agent 删除了生产环境的文件。", a: 1, e: "权限和沙箱没设好。不管模型多聪明,都不该有这个权限。" },
        { q: "每轮成本都很高,看 usage 发现缓存命中几乎为 0。", a: 1, e: "多半是前缀不稳定(时间戳、工具顺序变化)。纯 harness 问题。" },
        { q: "打标时模型输出了体系外的标签“手机”。", a: 1, e: "可以用 enum / 校验工具约束,并返回可操作的错误让它纠正。" },
        { q: "工具调用失败后程序直接崩溃,任务中断。", a: 1, e: "harness 应该把异常变成工具结果反馈给模型。" },
        { q: "在一门很冷门的编程语言上,模型写出的代码语法普遍不对。", a: 0, e: "训练数据覆盖不足,主要是模型问题(harness 能缓解,比如加 lint 反馈)。" }
      ], { bins: ["模型问题", "Harness 问题"], pass: 5, winMsg: "学会了先判断问题出在哪一层",
        summary: "大多数“agent 不好用”的问题,其实出在 harness:工具返回太长、权限太大、缓存失效、错误处理缺失。这些问题<b>今天就能修</b>。" });
      api.explain("先答题。");
    }
  });

  /* ===================== 第 2 章 ===================== */
  D("ch2-loop", {
    title: "一次完整的 agent 循环", kind: "walk", xp: 25, needsChart: false,
    tryit: "按 ▶ 播放或逐步点击。观察 messages 列表怎么一条条变长,以及上下文条怎么增长。",
    build(body, api) {
      const SYS = { role: "system", html: "你是内容打标助手。只能使用 get_taxonomy 返回的标签。", tok: 420 };
      const TOOLS = 380;
      const S = [
        [SYS, { role: "user", html: "给文章 a-17《折叠屏新机发布,芯片股大涨》打标签", tok: 30 }],
        [{ role: "assistant", html: "🔧 调用 <code>get_taxonomy()</code>", tok: 25 }],
        [{ role: "tool", html: "[\"科技\",\"财经\",\"体育\",\"娱乐\",\"健康\"]", tok: 20 }],
        [{ role: "assistant", html: "🔧 调用 <code>save_tags(\"a-17\", [\"手机\",\"财经\"])</code>", tok: 35 }],
        [{ role: "tool", html: "错误:['手机'] 不在标签体系内。请只使用 get_taxonomy 返回的标签后重试。", tok: 40 }],
        [{ role: "assistant", html: "🔧 调用 <code>save_tags(\"a-17\", [\"科技\",\"财经\"])</code>", tok: 35 }],
        [{ role: "tool", html: "ok:a-17 -> ['科技', '财经']", tok: 15 }],
        [{ role: "assistant", html: "已为 a-17 打上标签:科技、财经。(没有工具调用 → 循环结束)", tok: 30 }]
      ];
      const CAP = [
        "harness 组装初始 messages:系统提示 + 用户任务。工具定义也会随请求一起发出(约 380 tok)。",
        "第 1 轮:把全部 messages 发给模型。模型没有直接回答,而是请求调用工具。",
        "harness 执行工具,把结果作为 <b>tool 消息</b>追加到列表末尾。",
        "第 2 轮:再次发送<b>全部</b> messages。模型选了标签——其中“手机”不在体系内。",
        "工具校验失败,返回一条<b>写给模型看的</b>错误信息:错在哪、该怎么做。",
        "第 3 轮:模型读到错误,自我纠正。",
        "保存成功。",
        "第 4 轮:模型不再调用工具,给出最终回答 → 停止条件满足,循环结束。"
      ];
      const chat = api.div(body), bar = api.div(body);
      const st = api.stepper(body, { n: S.length, onStep(i) {
        const msgs = []; S.slice(0, i + 1).forEach((g, k) => g.forEach(m => msgs.push(Object.assign({}, m, { hl: k === i }))));
        api.chat(chat, msgs);
        const used = msgs.reduce((s, m) => s + m.tok, 0);
        api.ctxBar(bar, [["系统提示", SYS.tok, COL.sys], ["工具定义", TOOLS, COL.tools], ["对话与工具结果", used - SYS.tok, COL.hist]], 2000);
        const calls = S.slice(1, i + 1).filter(g => g[0].role === "assistant").length;
        api.explain("已调用模型 <b>" + calls + "</b> 次;每次调用的输入都包含之前的全部内容。");
        return CAP[i];
      } });
      st.go(0);
    }
  });

  D("ch2-react", {
    title: "串行 vs 并行工具调用", kind: "play", xp: 20, needsChart: false, touchGoal: 3,
    tryit: "调整要读取的文件数和延迟,比较“一次调一个”和“一次调多个(并行)”的轮数、耗时和输入 token。",
    build(body, api) {
      api.render = render;
      const out = api.div(body), viz = api.div(body);
      const v = api.controls(body, [
        { k: "n", label: "要读的文件数", min: 1, max: 10, v: 4 },
        { k: "lm", label: "每次模型调用延迟(秒)", min: 1, max: 10, v: 3 },
        { k: "lt", label: "每次工具执行延迟(秒)", min: 0, max: 10, v: 2 },
        { k: "sz", label: "每个文件结果大小(tok)", min: 200, max: 4000, step: 200, v: 1200 }
      ], render);
      body.insertBefore(out, null); body.appendChild(viz);
      function render() {
        const base = 2000;
        // 串行:n 轮工具 + 1 轮回答
        const sTurns = v.n + 1, sTime = sTurns * v.lm + v.n * v.lt;
        let sIn = 0; for (let t = 0; t < sTurns; t++) sIn += base + t * (v.sz + 60);
        // 并行:1 轮发起全部 + 1 轮回答;工具并发,耗时取最大
        const pTurns = 2, pTime = pTurns * v.lm + v.lt;
        const pIn = base + (base + v.n * (v.sz + 60));
        api.stats(out, [["串行:模型调用", sTurns + " 次"], ["串行:总耗时", sTime + " 秒"], ["串行:累计输入", sIn.toLocaleString() + " tok"],
          ["并行:模型调用", pTurns + " 次", "good"], ["并行:总耗时", pTime + " 秒", "good"], ["并行:累计输入", pIn.toLocaleString() + " tok", "good"]]);
        const w = Math.max(sTime, pTime);
        viz.innerHTML = '<div class="wf-row"><span class="nm">串行</span><span class="tr"><span class="bar" style="left:0;width:' + (sTime / w * 100) + '%;background:#dc2626"></span></span></div>' +
          '<div class="wf-row"><span class="nm">并行</span><span class="tr"><span class="bar" style="left:0;width:' + (pTime / w * 100) + '%;background:#16a34a"></span></span></div>';
        api.explain("串行时每读一个文件都要多一轮模型调用,而<b>每一轮都要重发全部历史</b>,所以输入 token 近似按轮数平方增长。并行调用把 " + v.n + " 个独立请求放进一条回复,harness 并发执行、一次回填(每个结果带上自己的 tool_call_id)。前提是这些调用<b>互不依赖</b>。");
      }
    }
  });

  D("ch2-stop", {
    title: "预测:这个 loop 会怎样?", kind: "game", xp: 25, needsChart: false,
    tryit: "每题给出一段有问题的循环代码或场景,预测运行结果。答对 4 题过关。",
    build(body, api) {
      api.quizGame(body, [
        { pre: "while True:\n    msg = llm.chat(messages, tools)\n    messages.append(msg)\n    for tc in msg.tool_calls or []:\n        messages.append(run(tc))", q: "模型一直认为“还需要再搜一次”,会发生什么?", o: ["循环自动在 10 轮后停止", "无限循环,直到上下文溢出或花光预算", "模型会报错", "Python 报语法错误"], a: 1, e: "没有 max_turns / 预算上限。生产 harness 必须有硬性停止条件。" },
        { pre: "try:\n    result = tools[name](**args)\nexcept Exception:\n    continue   # 出错就跳过", q: "工具出错时,下一轮请求会怎样?", o: ["一切正常", "这个 tool_call 没有对应的结果,API 可能报错,模型也不知道发生了什么", "模型会自动重试", "harness 会换一个工具"], a: 1, e: "每个 tool_call 都必须有对应结果。应把错误信息作为结果返回。" },
        { pre: "messages = [system, user]\nfor turn in range(10):\n    msg = llm.chat([messages[-1]], tools)   # 只发最后一条,省钱!", q: "这样“省钱”会导致什么?", o: ["更快更准", "模型每轮都看不到之前的工具结果,反复做同样的事", "没有区别", "缓存命中率提高"], a: 1, e: "模型是无状态的;它只知道你这次发给它的东西。" },
        { pre: "工具 read_file 返回整个文件,其中一个文件有 300,000 token。", q: "最可能的结果是?", o: ["模型读得更仔细", "请求超出上下文窗口而失败,或挤掉其他关键信息", "自动被压缩", "没有影响"], a: 1, e: "工具要分页 / 截断,并告诉模型如何读更多(第 3 章)。" },
        { pre: "模型一条回复里请求了 3 个工具调用,harness 只执行了第 1 个就进入下一轮。", q: "会发生什么?", o: ["正常", "另外两个 tool_call 缺少结果,请求报错或模型困惑", "模型自动合并", "harness 会自动并行"], a: 1, e: "并行工具调用要全部执行并回填。" }
      ], { pass: 4, winMsg: "能预判 loop 的坑了", summary: "agent loop 本身只有十几行,但<b>停止条件、错误回填、完整历史、结果大小、并行回填</b>这五个细节,每一个出错都会让 agent 表现诡异。" });
      api.explain("先答题。");
    }
  });

  /* ===================== 第 3 章 ===================== */
  D("ch3-format", {
    title: "同一个工具,三种格式", kind: "play", xp: 15, needsChart: false, touchGoal: 3,
    tryit: "切换 OpenAI / Anthropic / MCP,对比同一个工具定义的写法。",
    build(body, api) {
      const schema = { type: "object", properties: { query: { type: "string", description: "关键词" }, limit: { type: "integer", description: "最多返回条数", default: 10 } }, required: ["query"] };
      const F = {
        "OpenAI Chat Completions": { type: "function", function: { name: "search_articles", description: "按关键词检索内容库,返回 id 和标题。", parameters: schema } },
        "Anthropic Messages": { name: "search_articles", description: "按关键词检索内容库,返回 id 和标题。", input_schema: schema },
        "MCP tools/list 中的一项": { name: "search_articles", description: "按关键词检索内容库,返回 id 和标题。", inputSchema: schema }
      };
      const NOTE = {
        "OpenAI Chat Completions": "外面包了一层 <code>{type: \"function\", function: {...}}</code>,参数字段叫 <code>parameters</code>。Responses API 里则是扁平的 <code>{type: \"function\", name, description, parameters}</code>。",
        "Anthropic Messages": "扁平结构,参数字段叫 <code>input_schema</code>。",
        "MCP tools/list 中的一项": "MCP server 返回的工具定义,参数字段叫 <code>inputSchema</code>(驼峰)。Host 拿到后再转换成所用模型 API 的格式。"
      };
      const tg = api.div(body, "toggles"), pre = document.createElement("pre"); pre.className = "json"; body.appendChild(pre);
      Object.keys(F).forEach((k, i) => {
        const b = api.btn(tg, k, () => { tg.querySelectorAll("button").forEach(x => x.classList.remove("on")); b.classList.add("on"); pre.textContent = JSON.stringify(F[k], null, 2); api.explain(NOTE[k] + " 核心都一样:<b>名字 + 描述 + JSON Schema</b>。"); api.touch(); });
        b.className = ""; if (i === 0) { b.classList.add("on"); pre.textContent = JSON.stringify(F[k], null, 2); api.explain(NOTE[k]); }
      });
    }
  });

  D("ch3-schema", {
    title: "参数校验器", kind: "play", xp: 20, needsChart: false, touchGoal: 3,
    tryit: "左边是“模型生成的参数”。点预设或自己改,看校验器返回给模型的错误信息。",
    build(body, api) {
      const SCHEMA = { query: { type: "string", req: true }, category: { type: "string", enum: ["科技", "财经", "体育", "娱乐", "健康"] }, limit: { type: "integer", min: 1, max: 50 } };
      const io = api.div(body, "rule-io"), ta = document.createElement("textarea"), out = api.div(io, "dec");
      io.insertBefore(ta, out);
      const presets = { "✅ 正确": '{"query": "折叠屏", "category": "科技", "limit": 5}', "缺字段": '{"category": "科技"}', "类型错": '{"query": "折叠屏", "limit": "5"}', "枚举外": '{"query": "折叠屏", "category": "手机"}', "越界": '{"query": "折叠屏", "limit": 500}', "编造参数": '{"query": "折叠屏", "sort_by": "hot"}', "坏 JSON": '{"query": "折叠屏",}' };
      const pb = api.div(body, "toggles");
      Object.keys(presets).forEach(k => { const b = api.btn(pb, k, () => { ta.value = presets[k]; check(); api.touch(); }); b.className = ""; });
      ta.value = presets["类型错"]; ta.addEventListener("input", check);
      function check() {
        let d; const errs = [];
        try { d = JSON.parse(ta.value); } catch (e) { out.innerHTML = '<div class="deny">错误:参数不是合法 JSON(' + esc(e.message) + ')。请输出一个 JSON 对象。</div>'; return; }
        if (typeof d !== "object" || d === null || Array.isArray(d)) { out.innerHTML = '<div class="deny">错误:参数必须是 JSON 对象。</div>'; return; }
        Object.keys(SCHEMA).forEach(k => { const s = SCHEMA[k];
          if (!(k in d)) { if (s.req) errs.push("缺少必填参数 " + k + "(string,检索关键词)。"); return; }
          const x = d[k];
          if (s.type === "string" && typeof x !== "string") errs.push(k + " 应为字符串,收到 " + JSON.stringify(x) + "。");
          if (s.type === "integer" && !Number.isInteger(x)) errs.push(k + " 应为整数,收到 " + JSON.stringify(x) + (typeof x === "string" ? "(去掉引号)" : "") + "。");
          if (s.enum && typeof x === "string" && s.enum.indexOf(x) < 0) errs.push(k + " 只能取 " + s.enum.join(" / ") + ",收到 “" + x + "”。");
          if (s.min != null && Number.isInteger(x) && (x < s.min || x > s.max)) errs.push(k + " 范围是 " + s.min + "–" + s.max + ",收到 " + x + "。如需更多结果请分页。");
        });
        Object.keys(d).forEach(k => { if (!(k in SCHEMA)) errs.push("不存在参数 " + k + "。可用参数:" + Object.keys(SCHEMA).join(", ") + "。"); });
        out.innerHTML = errs.length ? errs.map(e => '<div class="deny">✗ ' + esc(e) + "</div>").join("") + '<div class="ask">→ 这段文字会作为工具结果返回给模型,让它修正后重试。</div>' : '<div class="allow">✓ 校验通过,可以执行 search_articles。</div>';
        api.explain(errs.length ? "注意每条错误都说明了<b>期望什么、收到什么、怎么改</b>——这是写给模型看的,不是写给人看的。" : "通过校验后,业务层还可以再做检查(比如关键词不能为空字符串)。");
      }
      check();
    }
  });

  D("ch3-resp", {
    title: "工具返回的“胖瘦”", kind: "play", xp: 20, touchGoal: 3, needsChart: false,
    tryit: "调整每次搜索返回的条数、返回格式和调用次数,看看工具结果吃掉多少上下文。",
    build(body, api) {
      api.render = render;
      const bar = api.div(body), out = api.div(body);
      const v = api.controls(body, [
        { k: "n", label: "每次返回条数", min: 1, max: 50, v: 20 },
        { k: "fmt", label: "返回格式", type: "select", opts: [["full", "详细(含正文片段、全部元数据)"], ["concise", "简洁(id + 标题 + 1 行摘要)"], ["ids", "只返回 id"]], v: "full" },
        { k: "calls", label: "任务中调用次数", min: 1, max: 30, v: 10 }
      ], render);
      body.appendChild(bar); body.appendChild(out);
      function render() {
        const per = { full: 450, concise: 150, ids: 12 }[v.fmt];
        const t = v.n * per * v.calls, W = 200000;
        api.ctxBar(bar, [["系统提示+工具", 8000, COL.sys], ["工具结果", t, COL.tool]], W);
        api.stats(out, [["每次结果", (v.n * per).toLocaleString() + " tok"], ["累计工具结果", t.toLocaleString() + " tok", t > W * 0.6 ? "neg" : ""], ["占 20 万窗口", U.pct(t / W, 0)]]);
        api.explain(v.fmt === "ids" ? "只返回 id 最省,但模型要多一轮去读详情,可能得不偿失。<b>好的默认是“简洁”,再给一个 detail 参数按需取详细</b>。" :
          v.fmt === "concise" ? "简洁格式通常足够模型做决定。Anthropic 的例子里简洁响应约是详细响应的 1/3 大小。" :
          "详细格式会迅速吃掉窗口。Claude Code 默认把工具响应限制在 25,000 token。考虑分页、截断,并在截断时告诉模型怎么拿更多。");
      }
    }
  });

  D("ch3-desc", {
    title: "工具描述诊所", kind: "game", xp: 25, needsChart: false,
    tryit: "每题给出同一个工具的两种描述,选出更好的那个。答对 4 题过关。",
    build(body, api) {
      api.quizGame(body, [
        { q: "搜索工具的描述:", o: ["search: 搜索", "search_articles: 在内容库中按关键词检索已发布文章,返回 id、标题、发布日期。只搜标题和摘要,不搜正文。查正文请先拿 id 再用 read_article。"], a: 1, e: "说清楚范围、返回什么、和其他工具怎么配合。" },
        { q: "两个工具的命名:", o: ["get_data / get_data2", "list_pending_reviews / get_review_detail"], a: 1, e: "名字本身就该说明用途,避免含糊和重叠。" },
        { q: "日期参数的说明:", o: ["date: string,格式 YYYY-MM-DD,例如 2026-11-10;不传则默认今天", "date: 日期"], a: 0, e: "给格式、给例子、给默认值,模型就不会猜。" },
        { q: "一个会产生副作用的工具:", o: ["publish: 发布文章", "publish_article: 把草稿发布到线上,对所有用户可见,不可撤回。仅在用户明确要求发布时调用。"], a: 1, e: "副作用和使用条件写进描述,同时 harness 层仍需权限确认。" },
        { q: "提供哪一组工具更好?", o: ["list_all_comments(返回全部几十万条评论)", "search_comments(按关键词 / 时间 / 文章过滤,分页返回)"], a: 1, e: "不要把“遍历全部数据”留给模型;提供能直接命中目标的工具。" }
      ], { pass: 4, winMsg: "会写工具描述了", summary: "好的工具描述就像给新同事的交接文档:<b>做什么、不做什么、参数怎么填、返回什么、什么时候用</b>。Anthropic 修复“搜索词末尾加 2025”的问题,靠的就是改描述。" });
      api.explain("先答题。");
    }
  });

  /* ===================== 第 4 章 ===================== */
  D("ch4-prim", {
    title: "Tool、Resource 还是 Prompt?", kind: "game", xp: 20, needsChart: false,
    tryit: "把内容业务里的能力归到 MCP 的三种原语。答对 5 题过关。",
    build(body, api) {
      api.quizGame(body, [
        { q: "“按关键词搜索内容库”", a: 0, e: "模型主动调用、带参数、有返回:Tool。" },
        { q: "“审核规范全文 policy.md”,宿主可以让用户附加到对话里", a: 1, e: "可读取的数据:Resource。" },
        { q: "斜杠命令“/周报”:预设好结构的周报生成提示", a: 2, e: "用户选择的提示模板:Prompt。" },
        { q: "“把文章下线”", a: 0, e: "有副作用的操作:Tool(并且需要权限确认)。" },
        { q: "某篇文章的元数据 article://a-101", a: 1, e: "用 URI 标识的数据:Resource。" },
        { q: "“/审核复盘”:引导模型按固定格式总结一批申诉案例", a: 2, e: "Prompt。" },
        { q: "“查询某账号最近 7 天的发帖量”", a: 0, e: "带参数的查询,由模型决定何时调用:Tool。" }
      ], { bins: ["Tool 工具", "Resource 资源", "Prompt 提示"], pass: 5, winMsg: "掌握了 MCP 三原语",
        summary: "粗略地记:<b>Tool 由模型决定调用,Resource 由应用决定附加,Prompt 由用户选择使用</b>。" });
      api.explain("先答题。");
    }
  });

  D("ch4-rpc", {
    title: "一次 MCP 交互(2026-07-28 版)", kind: "walk", xp: 25, needsChart: false,
    tryit: "逐步播放,看 client 和 server 之间来回的 JSON-RPC 消息。字段为示意,细节以规范为准。",
    build(body, api) {
      const seq = api.div(body, "seq"); seq.innerHTML = '<div class="lane">🖥️ Client(在 Host 里)</div><div class="lane">🔌 Server(内容库)</div>';
      const arrow = api.div(body, "seq-arrow"), pre = document.createElement("pre"); pre.className = "json"; body.appendChild(pre);
      const S = [
        ["→", "server/discover(可选)", { jsonrpc: "2.0", id: 1, method: "server/discover", params: { _meta: { protocolVersion: "2026-07-28" } } }, "客户端可以先问 server 支持哪些版本和能力。新版<b>没有 initialize 握手、没有会话 id</b>,每个请求自带协议版本。HTTP 头里还会带 <code>Mcp-Method: server/discover</code>。"],
        ["←", "能力声明", { jsonrpc: "2.0", id: 1, result: { supportedVersions: ["2026-07-28"], capabilities: { tools: {}, resources: {} }, serverInfo: { name: "content-lib", version: "1.2.0" } } }, "server 声明身份和能力。"],
        ["→", "tools/list", { jsonrpc: "2.0", id: 2, method: "tools/list", params: { _meta: { protocolVersion: "2026-07-28" } } }, "列出工具。新版要求列表结果<b>顺序确定、可缓存</b>——工具顺序一变,模型侧的 prompt 缓存就会失效。"],
        ["←", "工具定义", { jsonrpc: "2.0", id: 2, result: { tools: [{ name: "search_articles", description: "按关键词检索内容库", inputSchema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] } }] } }, "Host 把这些定义转换成模型 API 的工具格式,放进上下文。"],
        ["→", "tools/call", { jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "search_articles", arguments: { query: "折叠屏" } } }, "模型决定调用工具后,client 发出 tools/call。HTTP 头 <code>Mcp-Name: search_articles</code> 让网关不解析消息体也能路由和鉴权。"],
        ["←", "结果", { jsonrpc: "2.0", id: 3, result: { content: [{ type: "text", text: "[{\"id\":\"a-101\",\"title\":\"折叠屏手机横评\"}]" }], isError: false } }, "结果被 Host 作为工具结果放回模型上下文。"],
        ["←", "需要更多信息(MRTR)", { jsonrpc: "2.0", id: 4, result: { resultType: "input_required", "…": "需要用户确认的内容" } }, "如果 server 需要用户确认(比如下线一篇文章),返回 <code>resultType: \"input_required\"</code>;client 向用户收集信息后<b>重试原请求</b>,不需要一直开着双向流。"]
      ];
      api.stepper(body, { n: S.length, onStep(i) {
        const s = S[i]; arrow.textContent = (s[0] === "→" ? "Client ───── " + s[1] + " ────▶ Server" : "Client ◀──── " + s[1] + " ───── Server");
        pre.textContent = JSON.stringify(s[2], null, 2); api.explain(s[3]); return "第 " + (i + 1) + " 步:" + s[1];
      } }).go(0);
    }
  });

  D("ch4-budget", {
    title: "MCP 工具定义吃掉多少上下文?", kind: "play", xp: 20, needsChart: false, touchGoal: 3,
    tryit: "调整接入的 server 数、每个 server 的工具数和定义长度,再试试“按需加载”。",
    build(body, api) {
      api.render = render;
      const bar = api.div(body), out = api.div(body);
      const v = api.controls(body, [
        { k: "s", label: "MCP server 数", min: 1, max: 15, v: 5 },
        { k: "t", label: "每个 server 的工具数", min: 1, max: 60, v: 20 },
        { k: "d", label: "每个工具定义(tok)", min: 50, max: 800, step: 50, v: 300 },
        { k: "lazy", label: "按需加载(只放名字 + 一个搜索工具)", type: "check", v: false }
      ], render);
      body.appendChild(bar); body.appendChild(out);
      function render() {
        const n = v.s * v.t, full = n * v.d, lazy = n * 15 + 400, used = v.lazy ? lazy : full, W = 200000;
        api.ctxBar(bar, [["系统提示", 3000, COL.sys], ["工具定义", used, COL.tools], ["留给任务的空间", Math.max(0, W - 3000 - used), COL.free]], W);
        api.stats(out, [["工具总数", n], ["工具定义占用", used.toLocaleString() + " tok", used > 40000 ? "neg" : ""], [v.lazy ? "节省" : "若按需加载可省", U.pct(1 - lazy / full, 0), "good"]]);
        api.explain((n > 50 ? "工具越多,模型越难选对(Manus:“装备越多的 agent 越笨”)。" : "") + (v.lazy ? "按需加载:上下文里只放工具名和简短提示,需要时再搜索 / 读取完整定义。Cursor 报告在 MCP 场景下 token 减少 46.9%;Anthropic 的 tool search 也是同一思路。" : "所有工具定义每一轮都在上下文里,而且每一轮都要计费。勾选“按需加载”看看差别。"));
      }
    }
  });

  /* ===================== 第 5 章 ===================== */
  D("ch5-window", {
    title: "上下文窗口里都装了什么", kind: "play", xp: 20, needsChart: false, touchGoal: 4,
    tryit: "调整各部分的大小,看窗口占用和“注意力稀释”示意。目标:在 128k 窗口里给任务留出足够空间。",
    build(body, api) {
      api.render = render;
      const bar = api.div(body), out = api.div(body);
      const v = api.controls(body, [
        { k: "sys", label: "系统提示(k tok)", min: 1, max: 30, v: 4 },
        { k: "tools", label: "工具定义(k tok)", min: 1, max: 60, v: 12 },
        { k: "mem", label: "项目记忆 AGENTS.md(k tok)", min: 0, max: 30, v: 3 },
        { k: "rag", label: "预先检索的文档(k tok)", min: 0, max: 80, v: 30 },
        { k: "hist", label: "对话与工具结果(k tok)", min: 0, max: 100, v: 40 },
        { k: "rel", label: "其中与当前任务真正相关的比例(%)", min: 5, max: 100, v: 30 }
      ], render);
      body.appendChild(bar); body.appendChild(out);
      function render() {
        const W = 128, used = v.sys + v.tools + v.mem + v.rag + v.hist;
        api.ctxBar(bar, [["系统提示", v.sys * 1000, COL.sys], ["工具", v.tools * 1000, COL.tools], ["记忆", v.mem * 1000, "#0891b2"], ["检索文档", v.rag * 1000, "#db2777"], ["历史", v.hist * 1000, COL.hist]], W * 1000);
        const noise = (1 - v.rel / 100) * used, dil = U.clamp(noise / W, 0, 1);
        const lvl = dil < 0.25 ? ["lo", "低"] : dil < 0.5 ? ["mid", "中"] : ["hi", "高"];
        api.stats(out, [["已用", used + "k / " + W + "k", used > W ? "neg" : ""], ["无关内容", Math.round(noise) + "k tok"], ["注意力稀释(示意)", lvl[1], lvl[0] === "hi" ? "neg" : ""]]);
        api.explain(used > W ? "⚠ 已经超出窗口!必须削减。" : "“注意力稀释”只是示意:Chroma 的 context rot 研究显示,输入越长,模型表现越容易下降。<b>目标不是塞满,而是找到最小的高信号 token 集合</b>。试试把“预先检索的文档”调小、把相关比例调高。");
      }
    }
  });

  D("ch5-jit", {
    title: "预先加载 vs 即时检索", kind: "walk", xp: 20, needsChart: false,
    tryit: "同一个任务“找出审核规范里关于医疗广告的条款”,看两种策略每一步的上下文占用。",
    build(body, api) {
      const lanes = api.div(body, "lanes"); lanes.innerHTML = '<div class="ln" id="j-a"><b>📦 预先加载</b><div></div></div><div class="ln" id="j-b"><b>🎯 即时检索</b><div></div></div>';
      const ba = api.div(body), bb = api.div(body);
      const S = [
        [["开始:把整份审核规范(40k tok)放进系统提示。", 44], ["开始:上下文里只有一句“规范在 docs/policy/,用 grep / read 查”。", 4]],
        [["模型在 40k 里找“医疗”相关段落。", 44], ["grep \"医疗\" docs/policy/ → 返回 6 行匹配(0.3k)。", 4.3]],
        [["找到第 7 章第 3 条。", 44], ["read docs/policy/ch7.md 第 20–60 行(1.5k)。", 5.8]],
        [["回答。上下文中 90% 的内容与任务无关。", 45], ["回答。上下文几乎全是相关内容,但多花了 2 轮工具调用。", 6.5]]
      ];
      api.stepper(body, { n: S.length, onStep(i) {
        const a = lanes.children[0], b = lanes.children[1];
        a.lastChild.innerHTML = S.slice(0, i + 1).map(x => "• " + x[0][0]).join("<br>"); b.lastChild.innerHTML = S.slice(0, i + 1).map(x => "• " + x[1][0]).join("<br>");
        api.ctxBar(ba, [["预先加载", S[i][0][1] * 1000, "#db2777"]], 50000); api.ctxBar(bb, [["即时检索", S[i][1][1] * 1000, "#16a34a"]], 50000);
        api.explain("即时检索像人一样:记住<b>去哪找</b>,需要时再拿。代价是多几轮调用、需要好用的工具。Claude Code 用 CLAUDE.md 预先加载少量关键信息,其余用 grep / glob 即时检索——这就是混合策略。");
        return "第 " + (i + 1) + " 步";
      } }).go(0);
    }
  });

  D("ch5-manus", {
    title: "Manus 六条经验", kind: "game", xp: 25, needsChart: false,
    tryit: "每题描述一个做法,判断它是否符合 Manus 分享的上下文工程经验。答对 5 题过关。",
    build(body, api) {
      api.quizGame(body, [
        { q: "为了让模型知道当前时间,在系统提示第一行写上精确到秒的时间戳。", a: 1, e: "违反“围绕 KV 缓存设计”:前缀每次都变,缓存全失效。" },
        { q: "当前步骤不需要浏览器工具时,把浏览器相关工具从工具列表里删掉。", a: 1, e: "应该“遮蔽而不是删除”:用解码约束限制可选工具,工具定义保持不变。" },
        { q: "网页内容太长时,上下文里只保留 URL,需要时再重新访问。", a: 0, e: "“把文件系统当作上下文”:可恢复的压缩。" },
        { q: "agent 不断更新 todo.md,勾掉完成的项。", a: 0, e: "“通过复述操控注意力”:把目标推到上下文末尾。" },
        { q: "工具报错时,从历史里删掉失败的那一步,让上下文保持“干净”。", a: 1, e: "应该“把错误留在上下文里”,失败是模型调整行为的证据。" },
        { q: "批量处理 20 份相似文档时,在序列化格式和措辞上引入少量变化。", a: 0, e: "“别被 few-shot 带偏”:避免模型机械模仿重复的节奏。" },
        { q: "上下文要保持只追加,序列化 JSON 时固定键的顺序。", a: 0, e: "保持前缀稳定,提高 KV 缓存命中率。" }
      ], { bins: ["✅ 符合", "❌ 违反"], pass: 5, winMsg: "掌握了 Manus 的上下文经验",
        summary: "六条经验:① 围绕 KV 缓存设计 ② 遮蔽而不是删除工具 ③ 把文件系统当作上下文 ④ 通过复述操控注意力 ⑤ 把错误留在上下文里 ⑥ 别被 few-shot 带偏。" });
      api.explain("先答题。");
    }
  });
})();

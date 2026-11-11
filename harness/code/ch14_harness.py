"""第 14 章 动手实战:一个约 150 行、五脏俱全的 mini harness。
组成:工具注册 → 权限与人工确认 → 上下文压缩 → 追踪 → 主循环。
模型用 hl_mock.MockLLM 假扮;把 llm 换成 ch14_real.py 里的 OpenAICompatLLM 就能接真模型。"""
import inspect, json, time
from hl_mock import MockLLM, approx_tokens, messages_tokens, called

REGISTRY = {}
def tool(risk="read"):
    """risk: read(只读,自动放行)/ write(有副作用,需确认)/ danger(禁止)"""
    def deco(fn):
        params = {n: {"type": "integer" if p.annotation is int else "string"}
                  for n, p in inspect.signature(fn).parameters.items()}
        REGISTRY[fn.__name__] = {"fn": fn, "risk": risk, "schema": {"type": "function", "function": {
            "name": fn.__name__, "description": (fn.__doc__ or "").strip(),
            "parameters": {"type": "object", "properties": params, "required": list(params)}}}}
        return fn
    return deco

ARTICLES = {"a-101": ("折叠屏手机横评:三款新机谁更耐用", "正文:" + "铰链寿命、屏幕折痕、续航三项实测数据如下……" * 30),
            "a-102": ("折叠屏新品发布,股价上涨 5%", "正文:" + "发布会上公布了新的铰链方案与价格……" * 12)}
FILES = {}

@tool("read")
def search_articles(query: str) -> str:
    """按关键词检索内容库,返回 id 和标题(不含正文)。"""
    hits = [{"id": k, "title": v[0]} for k, v in ARTICLES.items() if query in v[0]]
    return json.dumps(hits, ensure_ascii=False)

@tool("read")
def read_article(article_id: str) -> str:
    """按 id 读取文章全文。"""
    if article_id not in ARTICLES:
        return f"错误:没有 id 为 {article_id} 的文章。请先用 search_articles 查找可用 id。"
    return ARTICLES[article_id][1]

@tool("write")
def write_file(path: str, content: str) -> str:
    """把内容写入工作区文件。"""
    FILES[path] = content
    return f"已写入 {path}({len(content)} 字)"

@tool("write")
def publish_article(path: str) -> str:
    """把工作区文件发布到线上(对外可见,不可撤回)。"""
    return f"已发布 {path}"

def human_approve(name, args):
    """真实产品里这里会弹出确认框;这里模拟一位谨慎的编辑:允许写文件,拒绝发布。"""
    ok = name != "publish_article"
    print(f"    🙋 请求人工确认:{name}({args}) → {'同意' if ok else '拒绝'}")
    return ok

def check_permission(name, args):
    risk = REGISTRY[name]["risk"]
    if risk == "danger": return False, "该工具被策略禁止。"
    if risk == "write" and not human_approve(name, args):
        return False, "用户拒绝了这次操作。不要重试同一操作;请在最终回复中说明需要用户自行处理。"
    return True, ""

CONTEXT_LIMIT = 1000       # 演示用的小窗口(真实模型通常是几十万 token)
COMPACT_AT = 0.6           # 用到 60% 就压缩
def maybe_compact(messages, tracer):
    used = messages_tokens(messages)
    if used < CONTEXT_LIMIT * COMPACT_AT:
        return messages
    tool_msgs = [i for i, m in enumerate(messages) if m["role"] == "tool"]
    for i in tool_msgs[:-1]:                     # 最轻量的压缩:清理除最近一条以外的旧工具结果
        if len(messages[i]["content"]) > 80:
            messages[i] = dict(messages[i], content=messages[i]["content"][:40] + "…[已压缩,需要时重新读取]")
    tracer.event("compact", f"{used} → {messages_tokens(messages)} tok")
    return messages

class Tracer:
    def __init__(self): self.t0, self.rows = time.perf_counter(), []
    def event(self, kind, detail):
        self.rows.append((round((time.perf_counter() - self.t0) * 1000, 1), kind, detail))
    def report(self):
        print("\n—— trace ——")
        for ms, kind, detail in self.rows:
            print(f"  {ms:>6} ms  {kind:<8} {detail}")

def run(task, llm, max_turns=10, token_budget=20000):
    tracer, spent = Tracer(), 0
    messages = [{"role": "system", "content": "你是内容运营助手。只用提供的工具完成任务;被拒绝的操作不要重试。"},
                {"role": "user", "content": task}]
    schemas = [t["schema"] for t in REGISTRY.values()]
    for turn in range(1, max_turns + 1):
        messages = maybe_compact(messages, tracer)
        msg, usage = llm.chat(messages, schemas)
        spent += usage["prompt_tokens"] + usage["completion_tokens"]
        tracer.event("llm", f"第{turn}轮 输入≈{usage['prompt_tokens']} tok")
        messages.append(msg)
        if not msg.get("tool_calls"):
            tracer.event("done", msg["content"][:30]); tracer.report()
            return msg["content"]
        for tc in msg["tool_calls"]:
            name, args = tc["function"]["name"], json.loads(tc["function"]["arguments"] or "{}")
            if name not in REGISTRY:
                result = f"错误:不存在工具 {name}。可用工具:{', '.join(REGISTRY)}"
            else:
                ok, why = check_permission(name, args)
                try:
                    result = REGISTRY[name]["fn"](**args) if ok else "⛔ " + why
                except Exception as e:
                    result = f"工具异常:{type(e).__name__}: {e}"
            tracer.event("tool", f"{name} → {result[:36]}")
            print(f"[第{turn}轮] {name}({json.dumps(args, ensure_ascii=False)[:50]}) → {result[:50]}")
            messages.append({"role": "tool", "tool_call_id": tc["id"], "content": result})
        if spent > token_budget:
            tracer.event("stop", "超出 token 预算"); tracer.report()
            return "超出预算,已停止。"
    tracer.report()
    return "达到最大轮数,已停止。"

def content_ops_policy(messages, tools):
    """假模型的“思路”:检索 → 读最相关的一篇 → 写摘要 → 尝试发布 → 汇报。"""
    if not called(messages, "search_articles"):
        return "tools", [("search_articles", {"query": "折叠屏"})]
    if not called(messages, "read_article"):
        first = json.loads(called(messages, "search_articles")[-1])[0]["id"]
        return "tools", [("read_article", {"article_id": first})]
    if not called(messages, "write_file"):
        return "tools", [("write_file", {"path": "summary.md", "content": "三款折叠屏实测:铰链寿命差距最大,续航差距最小。"})]
    if not called(messages, "publish_article"):
        return "tools", [("publish_article", {"path": "summary.md"})]
    denied = called(messages, "publish_article")[-1].startswith("⛔")
    return "text", "摘要已写入 summary.md。" + ("发布被拒绝,请编辑确认后手动发布。" if denied else "已发布。")

answer = run("找最近关于折叠屏的文章,读最相关的一篇,写 50 字摘要存为 summary.md,然后发布。", MockLLM(content_ops_policy))
print("\n最终回答:", answer)
print("工作区文件:", FILES)

"""第 6 章:四种上下文压缩策略的对比实验(纯 Python,无需 API)。
我们构造一段 30 轮的“排查日志”会话,其中第 3 轮出现一条关键信息(根因线索),
再看每种策略把上下文压到预算以内后,这条线索还在不在、能不能找回来。"""
import json, os
from hl_mock import approx_tokens

def make_history(turns=30):
    h = [{"role": "system", "content": "你是线上问题排查助手。"},
         {"role": "user", "content": "审核服务今天下午误杀率突然升高,帮我查原因。"}]
    for t in range(1, turns + 1):
        h.append({"role": "assistant", "content": f"第{t}步:调用 search_logs(page={t})"})
        log = f"[日志第{t}页] " + "INFO request ok latency=120ms; " * 25
        if t == 3:
            log += "WARN 敏感词表 v2.3 于 14:05 热更新,新增 1,204 个词条"   # 关键线索,藏在第 3 页
        h.append({"role": "tool", "name": "search_logs", "content": log})
    return h

def tokens(h): return sum(approx_tokens(m["content"]) + 4 for m in h)
CLUE = "敏感词表 v2.3"
def has_clue(h): return any(CLUE in m["content"] for m in h)

def truncate(h, budget):
    head, rest = h[:2], h[2:]                 # 永远保留 system 和最初的用户任务
    while tokens(head + rest) > budget and rest:
        rest = rest[1:]
    return head + rest

def clear_tool_results(h, budget, keep=4):
    out, tool_idx = [dict(m) for m in h], [i for i, m in enumerate(h) if m["role"] == "tool"]
    for i in tool_idx[:-keep]:
        out[i]["content"] = "[已清理的旧工具结果]"
    return out

def summarize(h, budget, keep_last=6):
    old, recent = h[2:-keep_last], h[-keep_last:]
    pages = sum(1 for m in old if m["role"] == "tool")
    summary = f"摘要:已翻阅日志 {pages} 页,请求大多正常,延迟约 120ms,暂未定位根因。"   # 线索被“总结掉”了
    return h[:2] + [{"role": "user", "content": summary}] + recent

def offload(h, budget, keep=4, folder="ctx_files"):
    os.makedirs(folder, exist_ok=True)
    out, tool_idx = [dict(m) for m in h], [i for i, m in enumerate(h) if m["role"] == "tool"]
    for i in tool_idx[:-keep]:
        path = f"{folder}/tool_{i}.txt"
        open(path, "w", encoding="utf-8").write(h[i]["content"])
        out[i]["content"] = f"[结果已保存到 {path},共 {approx_tokens(h[i]['content'])} tok,需要时可 grep/read]"
    return out

def grep_files(folder, pattern):            # agent 之后可以用工具把线索找回来
    return [f for f in sorted(os.listdir(folder)) if pattern in open(f"{folder}/{f}", encoding="utf-8").read()]

H = make_history()
BUDGET = 3000
print(f"原始会话:{len(H)} 条消息,约 {tokens(H)} tok;预算 {BUDGET} tok;关键线索在上下文中:{has_clue(H)}\n")
print("策略 | 压缩后 tok | 是否≤预算 | 线索仍在上下文 | 能否找回")
for name, fn in [("截断", truncate), ("清理工具结果", clear_tool_results), ("摘要", summarize), ("卸载到文件", offload)]:
    c = fn(H, BUDGET)
    recover = "能(grep)" if name == "卸载到文件" and grep_files("ctx_files", CLUE) else ("—" if has_clue(c) else "不能")
    print(f"{name} | {tokens(c)} | {'是' if tokens(c) <= BUDGET else '否'} | {'在' if has_clue(c) else '不在'} | {recover}")
print("\ngrep 'v2.3' 命中的文件:", grep_files("ctx_files", CLUE))

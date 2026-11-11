"""hl_mock.py —— 本站所有示例共用的“假大模型”(Mock LLM)。

真实的 harness 代码不关心模型内部怎么想,只关心模型“返回了什么”:
要么是一段文字(任务结束),要么是若干个工具调用(tool_calls)。
所以我们用一个按规则行动的假模型来代替真模型,好处是:
  * 不需要 API Key,在浏览器(Pyodide)里就能跑;
  * 结果可复现,方便你观察 harness 每一步做了什么。
返回格式模仿 OpenAI Chat Completions 的 message 结构(简化成 dict)。
"""
import json
import re

def approx_tokens(text):
    """粗略估算 token 数:中文约 1 字 ≈ 1 token,英文/符号约 4 字符 ≈ 1 token。
    (真实数字取决于具体模型的分词器,这里只用于演示数量级。)"""
    text = text if isinstance(text, str) else json.dumps(text, ensure_ascii=False)
    cjk = len(re.findall(r"[\u4e00-\u9fff]", text))
    return cjk + max(1, (len(text) - cjk) // 4)

def messages_tokens(messages):
    total = 0
    for m in messages:
        total += 4 + approx_tokens(m.get("content") or "")       # 每条消息有少量格式开销
        for tc in m.get("tool_calls") or []:
            total += approx_tokens(tc["function"]["name"] + tc["function"]["arguments"])
    return total

class MockLLM:
    """policy(messages, tools) -> ("text", "回答")  或  ("tools", [(name, args_dict), ...])"""
    def __init__(self, policy, name="mock-model"):
        self.policy, self.name, self.calls = policy, name, 0

    def chat(self, messages, tools=None):
        self.calls += 1
        kind, payload = self.policy(messages, tools or [])
        msg = {"role": "assistant", "content": None}
        if kind == "text":
            msg["content"] = payload
        else:
            msg["tool_calls"] = [
                {"id": f"call_{self.calls}_{i}", "type": "function",
                 "function": {"name": n, "arguments": json.dumps(a, ensure_ascii=False)}}
                for i, (n, a) in enumerate(payload)]
        usage = {"prompt_tokens": messages_tokens(messages) + approx_tokens(tools or []),
                 "completion_tokens": approx_tokens(msg.get("content") or msg.get("tool_calls"))}
        return msg, usage

# ---------- 工具函数:让 policy 更好写 ----------
def last_user(messages):
    for m in reversed(messages):
        if m["role"] == "user":
            return m["content"]
    return ""

def tool_results(messages):
    """返回 [(工具名, 结果字符串), ...],按时间顺序。"""
    names = {}
    out = []
    for m in messages:
        for tc in m.get("tool_calls") or []:
            names[tc["id"]] = tc["function"]["name"]
        if m["role"] == "tool":
            out.append((names.get(m["tool_call_id"], "?"), m["content"]))
    return out

def called(messages, name):
    return [r for n, r in tool_results(messages) if n == name]

# ---------- 一个现成的策略:内容打标 ----------
KEYWORDS = {"科技": ["手机", "芯片", "AI", "折叠屏", "发布"], "财经": ["股价", "上涨", "财报", "营收"],
            "体育": ["比赛", "冠军", "球"], "娱乐": ["电影", "综艺", "明星"], "健康": ["睡眠", "饮食", "医生"]}

def tagging_policy(messages, tools):
    """先查标签体系 -> (第一次故意犯错,用了体系外的标签)-> 看到报错后改正 -> 输出总结。"""
    task = messages[1]["content"] if len(messages) > 1 else last_user(messages)
    if not called(messages, "get_taxonomy"):
        return "tools", [("get_taxonomy", {})]
    saves = called(messages, "save_tags")
    m = re.search(r"([a-z]-\d+)", task)
    aid = m.group(1) if m else "a-001"
    if not saves:
        # 模拟真实模型常见的错误:直接用了文章里的词“手机”当标签
        return "tools", [("save_tags", {"article_id": aid, "tags": ["手机", "科技"]})]
    if saves[-1].startswith("错误"):
        taxonomy = json.loads(called(messages, "get_taxonomy")[-1])
        tags = [t for t in taxonomy if any(k in task for k in KEYWORDS.get(t, []))][:3]
        return "tools", [("save_tags", {"article_id": aid, "tags": tags or [taxonomy[0]]})]
    return "text", f"已为 {aid} 保存标签。依据:标题中的关键词与标签体系匹配。"

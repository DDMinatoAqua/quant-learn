"""第 2 章:最小 agent loop —— 约 40 行核心代码。
模型由 hl_mock.MockLLM 假扮(规则驱动,无需 API Key);loop 本身和接真模型时完全一样。"""
import json
from hl_mock import MockLLM, tagging_policy

TAXONOMY = ["科技", "财经", "体育", "娱乐", "健康"]

def get_taxonomy() -> str:
    return json.dumps(TAXONOMY, ensure_ascii=False)

def save_tags(article_id: str, tags: list) -> str:
    bad = [t for t in tags if t not in TAXONOMY]
    if bad:  # 错误信息是写给模型看的:说清楚错在哪、下一步怎么办
        return f"错误:{bad} 不在标签体系内。请只使用 get_taxonomy 返回的标签后重试。"
    return f"ok:{article_id} -> {tags}"

TOOLS = {"get_taxonomy": get_taxonomy, "save_tags": save_tags}
TOOL_SCHEMAS = [  # 发给模型的“说明书”(OpenAI function calling 格式)
    {"type": "function", "function": {"name": "get_taxonomy", "description": "返回可用标签列表。打标前先调用。",
                                      "parameters": {"type": "object", "properties": {}}}},
    {"type": "function", "function": {"name": "save_tags", "description": "保存文章标签。标签必须来自 get_taxonomy。",
                                      "parameters": {"type": "object", "properties": {
                                          "article_id": {"type": "string"},
                                          "tags": {"type": "array", "items": {"type": "string"}}},
                                          "required": ["article_id", "tags"]}}},
]

def run_agent(task, llm, max_turns=8):
    messages = [{"role": "system", "content": "你是内容打标助手。"},
                {"role": "user", "content": task}]
    for turn in range(1, max_turns + 1):               # ① 一定要有上限
        msg, usage = llm.chat(messages, TOOL_SCHEMAS)   # ② 调模型
        messages.append(msg)                            #    模型的回复也要放回历史
        if not msg.get("tool_calls"):                   # ③ 没有工具调用 = 任务结束
            print(f"[第{turn}轮] 模型给出最终回答:{msg['content']}")
            return msg["content"], messages
        for tc in msg["tool_calls"]:                    # ④ 逐个执行工具
            name = tc["function"]["name"]
            args = json.loads(tc["function"]["arguments"] or "{}")
            try:
                result = TOOLS[name](**args)
            except Exception as e:                      #    工具出错不要让程序崩,把错误告诉模型
                result = f"工具执行异常:{type(e).__name__}: {e}"
            print(f"[第{turn}轮] 调用 {name}({args}) -> {result}  (输入≈{usage['prompt_tokens']} tok)")
            messages.append({"role": "tool", "tool_call_id": tc["id"], "content": result})  # ⑤ 结果喂回去
    return "超过最大轮数,停止。", messages

llm = MockLLM(tagging_policy)
answer, history = run_agent("给文章 a-102 打标签:《某手机厂商发布折叠屏新品,股价上涨 5%》", llm)
print("\n共调用模型", llm.calls, "次;messages 里现在有", len(history), "条消息:")
for m in history:
    print("  ", m["role"].ljust(9), (m.get("content") or json.dumps([t["function"]["name"] for t in m["tool_calls"]], ensure_ascii=False))[:60])

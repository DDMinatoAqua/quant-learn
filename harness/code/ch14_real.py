"""ch14_real.py —— 把 mini harness 接到真实模型(任何 OpenAI 兼容的 Chat Completions 接口)。
⚠️ 这个文件需要在你自己的电脑上运行,需要 API Key,会产生费用;浏览器里的“运行”按钮不会执行它。

准备:
    pip install openai
    export OPENAI_API_KEY=sk-...                 # 你的 Key(不要写进代码、不要提交到仓库)
    export OPENAI_BASE_URL=https://api.deepseek.com   # 例:DeepSeek;用 OpenAI 官方则不设
    export MODEL=你要用的模型名                    # 以对应平台的模型列表为准
    python ch14_real.py
用法:把本文件和 ch14_harness.py、hl_mock.py 放在同一目录。"""
import json, os
from openai import OpenAI

class OpenAICompatLLM:
    """和 MockLLM 一样的接口:chat(messages, tools) -> (assistant_message_dict, usage_dict)"""
    def __init__(self, model=None):
        self.client = OpenAI()                     # 自动读取 OPENAI_API_KEY / OPENAI_BASE_URL
        self.model = model or os.environ["MODEL"]
        self.calls = 0

    def chat(self, messages, tools=None):
        self.calls += 1
        resp = self.client.chat.completions.create(
            model=self.model, messages=messages, tools=tools or None,
            temperature=0)                         # agent 场景一般用低温度,行为更稳定
        m = resp.choices[0].message
        msg = {"role": "assistant", "content": m.content}
        if m.tool_calls:                           # 转成和 MockLLM 相同的 dict 结构,harness 无需任何改动
            msg["tool_calls"] = [{"id": tc.id, "type": "function",
                                  "function": {"name": tc.function.name, "arguments": tc.function.arguments}}
                                 for tc in m.tool_calls]
        u = resp.usage
        return msg, {"prompt_tokens": u.prompt_tokens, "completion_tokens": u.completion_tokens}

if __name__ == "__main__":
    import ch14_harness as h                       # 导入时会先用 MockLLM 跑一遍演示,随后用真模型再跑一遍
    print("\n========== 换成真实模型 ==========")
    h.FILES.clear()
    answer = h.run("找最近关于折叠屏的文章,读最相关的一篇,写 50 字摘要存为 summary.md,然后发布。",
                   OpenAICompatLLM())
    print("\n最终回答:", answer)
    print("工作区文件:", json.dumps(h.FILES, ensure_ascii=False, indent=2))

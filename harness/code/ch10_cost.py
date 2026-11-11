"""第 10 章:一个 agent 任务到底花多少钱?—— 有无 prompt caching 的对比。
价格用“相对单价”表示(基础输入单价 = 1),倍率参考 Anthropic 文档:
写缓存 1.25×(5 分钟 TTL),读缓存 0.1×;输出单价按 5× 输入计。请以各家最新价格页为准。"""

SYSTEM_AND_TOOLS = 6000      # 系统提示 + 工具定义(每轮都一样,最适合缓存)
TASK = 300                   # 用户任务
PER_TURN_GROWTH = 1500       # 每轮新增:模型输出的工具调用 + 工具结果
OUTPUT_PER_TURN = 200        # 每轮模型输出 token
TURNS = 30
P_IN, P_OUT = 1.0, 5.0       # 相对单价(每 token)
W, R = 1.25, 0.10            # 缓存写入 / 读取倍率

def run(cache, broken=False):
    total_in_tok = cost = 0
    prev_prefix = 0                                   # 上一轮已缓存的前缀长度
    for t in range(1, TURNS + 1):
        prompt = SYSTEM_AND_TOOLS + TASK + PER_TURN_GROWTH * (t - 1)
        total_in_tok += prompt
        if cache:
            read = 0 if broken else prev_prefix        # 与上一轮相同的前缀:按读缓存计价
            write = prompt - read                      # 新增部分:写入缓存(下一轮就能读)
            cost += read * P_IN * R + write * P_IN * W
            prev_prefix = prompt
        else:
            cost += prompt * P_IN
        cost += OUTPUT_PER_TURN * P_OUT
    return total_in_tok, cost

tok, c0 = run(cache=False)
_, c1 = run(cache=True)
out_tok = OUTPUT_PER_TURN * TURNS
print(f"{TURNS} 轮累计输入 {tok:,} tok,输出 {out_tok:,} tok,输入:输出 ≈ {tok // out_tok}:1")
print(f"不用缓存:成本 {c0:,.0f} 单位")
print(f"使用缓存:成本 {c1:,.0f} 单位  → 节省 {1 - c1 / c0:.0%}")
_, c2 = run(cache=True, broken=True)
print("\n开了缓存,但每轮都在系统提示开头放一个精确到秒的时间戳(前缀每轮都变):")
print(f"  成本 {c2:,.0f} 单位 → 比不用缓存还贵 {c2 / c0 - 1:.0%}(每轮都付 1.25× 的写入费,却一次也读不到)")

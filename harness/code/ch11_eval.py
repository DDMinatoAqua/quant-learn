"""第 11 章:一个迷你 eval harness —— 任务集 × 多次试验 × 程序化判分 → pass@k / pass^k。
被测对象是一个“会随机出错”的假 agent(用随机数模拟模型的不确定性)。"""
import random
from math import comb

TASKS = [
    {"id": "tag-01", "text": "某手机厂商发布折叠屏新品", "gold": {"科技"}},
    {"id": "tag-02", "text": "芯片公司财报超预期,股价上涨", "gold": {"科技", "财经"}},
    {"id": "tag-03", "text": "国足晋级,球迷连夜庆祝", "gold": {"体育"}},
    {"id": "tag-04", "text": "医生提醒:熬夜比少吃一顿更伤身", "gold": {"健康"}},
    {"id": "tag-05", "text": "某综艺嘉宾在比赛环节受伤", "gold": {"娱乐"}},   # 难例:“比赛”容易被误判为体育
]
def grade(pred, gold):           # 代码判分:完全匹配才算通过(也可以换成 Jaccard ≥ 阈值)
    return pred == gold

HIDDEN_P = {"tag-01": 0.95, "tag-02": 0.7, "tag-03": 0.9, "tag-04": 0.85, "tag-05": 0.4}
def agent(task, rng):
    if rng.random() < HIDDEN_P[task["id"]]:
        return set(task["gold"])
    return {"体育"} if "比赛" in task["text"] else {"科技"}

def pass_at_k(n, c, k):   # 至少一次成功的概率(无偏估计,Chen et al. 2021)
    return 1.0 if n - c < k else 1 - comb(n - c, k) / comb(n, k)
def pass_hat_k(n, c, k):  # k 次全部成功的概率(τ-bench 提出的 pass^k)
    return comb(c, k) / comb(n, k)

rng, N = random.Random(7), 20
print("任务     成功/试验   pass@1  pass@3  pass^3")
rows = []
for t in TASKS:
    c = sum(grade(agent(t, rng), t["gold"]) for _ in range(N))
    rows.append((pass_at_k(N, c, 1), pass_at_k(N, c, 3), pass_hat_k(N, c, 3)))
    print(f"{t['id']}   {c:>2}/{N}       {rows[-1][0]:.2f}    {rows[-1][1]:.2f}    {rows[-1][2]:.2f}")
avg = [sum(r[i] for r in rows) / len(rows) for i in range(3)]
print(f"平均              {avg[0]:.2f}    {avg[1]:.2f}    {avg[2]:.2f}")
print("\n解读:pass@3 看“试 3 次至少对一次”(适合有人挑选结果的场景);")
print("      pass^3 看“连续 3 次都对”(适合线上自动处理,要求稳定)。同一个 agent,两个数字可以差很多。")

import numpy as np
import cvxpy as cp

rng = np.random.default_rng(9)
N = 30                                              # 30 只虚构股票
alpha = rng.normal(0, 0.02, N)                      # 模型给出的预期超额收益(模拟)
B = rng.normal(1, 0.3, (N, 1))                      # 单因子暴露
Sigma = B @ B.T * 0.15**2 + np.diag(rng.uniform(0.2, 0.4, N)**2)   # 年化协方差
industry = rng.integers(0, 3, N)                    # 3 个行业
w_bench = np.ones(N) / N                            # 基准:等权
w_prev = w_bench.copy()                             # 上期持仓
lam, tc = 5.0, 0.002                                # 风险厌恶、单边成本

w = cp.Variable(N)
active = w - w_bench                                # 主动权重
objective = cp.Maximize(alpha @ w
                        - lam * cp.quad_form(active, Sigma)        # 跟踪误差惩罚
                        - tc * cp.norm1(w - w_prev))               # 交易成本惩罚(换手)
cons = [cp.sum(w) == 1, w >= 0, w <= 0.08,                         # 满仓、只做多、个股上限 8%
        cp.norm1(w - w_prev) <= 0.4]                               # 单期双边换手 ≤ 40%
for g in range(3):                                                 # 行业偏离基准不超过 ±5%
    m = (industry == g).astype(float)
    cons += [cp.abs(m @ active) <= 0.05]
prob = cp.Problem(objective, cons)
prob.solve()
wv = w.value
te = np.sqrt((wv - w_bench) @ Sigma @ (wv - w_bench))
print(f"求解状态: {prob.status}")
print(f"持股数(权重>0.1%): {(wv > 1e-3).sum()}  最大权重: {wv.max():.2%}  换手: {np.abs(wv - w_prev).sum():.2%}")
print(f"预期超额收益: {alpha @ (wv - w_bench):.2%}  年化跟踪误差: {te:.2%}")
print("行业偏离:", [round(float(((industry == g) * (wv - w_bench)).sum()), 4) for g in range(3)])

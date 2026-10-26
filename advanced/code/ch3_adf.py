import numpy as np
from statsmodels.tsa.stattools import adfuller

rng = np.random.default_rng(1)
n = 1000
eps = rng.standard_normal(n)

random_walk = np.cumsum(eps)                  # 随机游走:x_t = x_{t-1} + ε_t(单位根,非平稳)
ar1 = np.zeros(n)                             # AR(1):x_t = 0.9·x_{t-1} + ε_t(平稳)
for t in range(1, n):
    ar1[t] = 0.9 * ar1[t - 1] + eps[t]
log_price = 4.6 + np.cumsum(0.0003 + 0.015 * rng.standard_normal(n))  # 模拟对数价格:带漂移的随机游走
log_ret = np.diff(log_price)                  # 对数收益率 = 对数价格的一阶差分

for name, x in [("随机游走", random_walk), ("AR(1) φ=0.9", ar1),
                ("模拟对数价格", log_price), ("模拟对数收益率", log_ret)]:
    res = adfuller(x, autolag="AIC")          # 自动用 AIC 选择差分滞后阶数
    stat, pvalue, crit = res[0], res[1], res[4]   # 检验统计量、p 值、临界值字典
    verdict = "拒绝单位根 → 平稳" if pvalue < 0.05 else "不能拒绝单位根 → 视为非平稳"
    print(f"{name:12s} ADF统计量={stat:7.3f}  p值={pvalue:.4f}  5%临界值={crit['5%']:.3f}  {verdict}")

import numpy as np
import statsmodels.api as sm
from statsmodels.tsa.stattools import coint, adfuller

rng = np.random.default_rng(4)
n = 750
# 共同的随机趋势 + 各自的平稳偏离 → 两个价格序列协整(模拟数据)
common = np.cumsum(rng.normal(0, 1, n))
spread_true = np.zeros(n)
for t in range(1, n):                                  # 价差服从 AR(1),φ=0.95,会回归
    spread_true[t] = 0.95 * spread_true[t - 1] + rng.normal(0, 1)
x = 50 + common                                        # 资产 X
y = 10 + 1.5 * x + spread_true                         # 资产 Y = 常数 + 1.5·X + 平稳价差

# 第 1 步:OLS 回归 y = c + β·x,得到对冲比率 β
ols = sm.OLS(y, sm.add_constant(x)).fit()
c_hat, beta_hat = ols.params
spread = y - c_hat - beta_hat * x
print(f"对冲比率 β 估计={beta_hat:.3f}  (真实 1.5)")

# 第 2 步:检验残差(价差)是否平稳 —— 用 coint() 而不是直接 adfuller(),
# 因为残差是“估计出来的”,临界值需要用 Engle-Granger 专门的表
t_stat, p_value, crit = coint(y, x)
print(f"Engle-Granger 检验: 统计量={t_stat:.3f}  p值={p_value:.4f}  5%临界值={crit[1]:.3f}")
print(f"(对照)直接对价差做 ADF 的 p 值={adfuller(spread)[1]:.4f} —— 偏乐观,不应这样用")

# 第 3 步:均值回归半衰期:Δs_t = λ·s_{t-1} + 误差,半衰期 = −ln2 / λ
ds, s_lag = np.diff(spread), spread[:-1]
lam = sm.OLS(ds, sm.add_constant(s_lag)).fit().params[1]
print(f"λ={lam:.4f}  半衰期≈{-np.log(2)/lam:.1f} 天  (真实 φ=0.95 对应 {np.log(0.5)/np.log(0.95):.1f} 天)")

# 第 4 步:z-score 信号
z = (spread - spread.mean()) / spread.std()
print(f"|z|>2 的天数占比: {(np.abs(z) > 2).mean():.1%}")

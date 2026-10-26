import numpy as np
import pandas as pd

rng = np.random.default_rng(24)
n = 252 * 8
# 模拟价格:前半段有趋势性(收益正自相关),后半段没有 —— 模拟“市场环境变化”
eps = rng.standard_normal(n) * 0.012
r = np.zeros(n)
for t in range(1, n):
    phi = 0.08 if t < n // 2 else 0.0
    r[t] = phi * r[t - 1] + eps[t]
close = pd.Series(100 * np.exp(np.cumsum(r)), index=pd.bdate_range("2016-01-01", periods=n))
ret = close.pct_change().fillna(0)

def strat_returns(fast, slow, cost=0.0005):
    """均线策略日收益(信号滞后一天,扣单边成本)。"""
    pos = (close.rolling(fast).mean() > close.rolling(slow).mean()).astype(float).shift(1).fillna(0)
    return pos * ret - pos.diff().abs().fillna(0) * cost

def sharpe(x):
    return x.mean() / x.std() * np.sqrt(252) if x.std() > 0 else 0.0

grid = [(f, s) for f in [5, 10, 20, 40] for s in [60, 120, 200] if f < s]
# ---- 参数敏感性:全样本上每组参数的夏普(注意:这一步只用来“看地形”,不用来挑参数)----
table = pd.Series({g: sharpe(strat_returns(*g)) for g in grid}).unstack()
print("全样本夏普(行=短均线,列=长均线):"); print(table.round(2).to_string())

# ---- 滚动前向:每次用过去 3 年选参数,在接下来 1 年上测试,然后整体往前滚 1 年 ----
all_r = {g: strat_returns(*g) for g in grid}
years = sorted(set(close.index.year))
oos = []
for k in range(3, len(years)):
    train = close.index.year.isin(years[k - 3:k]); test = close.index.year == years[k]
    best = max(grid, key=lambda g: sharpe(all_r[g][train]))
    oos.append(all_r[best][test])
    print(f"训练 {years[k-3]}-{years[k-1]} → 选中 {best},  样本内夏普={sharpe(all_r[best][train]):.2f},  "
          f"{years[k]} 年样本外夏普={sharpe(all_r[best][test]):.2f}")
print(f"拼接后的样本外夏普 = {sharpe(pd.concat(oos)):.2f}")

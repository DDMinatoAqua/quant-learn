import numpy as np
from scipy import stats
from ch7_sharpe_stats import psr, expected_max_sr

rng = np.random.default_rng(22)
N, T = 200, 756                                   # 200 个策略,每个 3 年日度
R = 0.01 * rng.standard_normal((T, N))            # 全部是纯噪声:真实夏普 = 0(模拟)
sr = R.mean(0) / R.std(0, ddof=1)                 # 每期(日度)夏普
sr_ann = sr * np.sqrt(252)
best = np.argmax(sr)
print(f"最好的那个“策略”年化夏普 = {sr_ann[best]:.2f}  (而所有策略的真实夏普都是 0)")
print(f"年化夏普 > 1 的策略个数: {(sr_ann > 1).sum()} / {N}")

# 单个策略的 t 检验 p 值:H0 “均值收益 = 0”
t = sr * np.sqrt(T)
p = 2 * (1 - stats.norm.cdf(np.abs(t)))
print(f"未校正时 p<0.05 的个数: {(p < 0.05).sum()}  (理论上约 5% × {N} = {0.05*N:.0f} 个是“假阳性”)")
print(f"Bonferroni 校正 (p < 0.05/{N}) 后显著的个数: {(p < 0.05 / N).sum()}")
# Benjamini-Hochberg:控制错误发现率 FDR
order = np.argsort(p); k = np.arange(1, N + 1)
passed = p[order] <= 0.05 * k / N
n_bh = k[passed].max() if passed.any() else 0
print(f"BH(FDR=5%)显著的个数: {n_bh}")
# Deflated Sharpe:把“挑了 200 次”考虑进去
sr0 = expected_max_sr(N, sr.var(ddof=1))
print(f"200 次尝试下最大夏普的期望(年化)≈ {sr0*np.sqrt(252):.2f};  最好策略的 PSR(0)={psr(R[:, best]):.3f}  DSR={psr(R[:, best], sr0):.3f}")

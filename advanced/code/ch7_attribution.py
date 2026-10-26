import numpy as np
import statsmodels.api as sm

rng = np.random.default_rng(25)
T = 120                                                 # 10 年月度数据(全部为模拟)
mkt = 0.006 + 0.045 * rng.standard_normal(T)            # 市场超额收益
smb = 0.002 + 0.030 * rng.standard_normal(T)            # 规模因子(小盘 − 大盘)
mom = 0.004 + 0.035 * rng.standard_normal(T)            # 动量因子
# “策略”的真实构成:0.9 倍市场 + 0.6 倍规模 + 很小的真实 alpha(每月 0.1%)+ 特质噪声
strat = 0.001 + 0.9 * mkt + 0.6 * smb + 0.0 * mom + 0.015 * rng.standard_normal(T)

print(f"策略月均超额收益 = {strat.mean():.2%},年化 ≈ {strat.mean()*12:.1%}")
# 只对市场回归(CAPM):alpha 包含了规模暴露带来的收益
capm = sm.OLS(strat, sm.add_constant(mkt)).fit()
print(f"CAPM:      alpha = {capm.params[0]:.2%}/月 (t = {capm.tvalues[0]:.2f}),  β_mkt = {capm.params[1]:.2f}")
# 多因子回归:把规模、动量也放进来
X = sm.add_constant(np.column_stack([mkt, smb, mom]))
ff = sm.OLS(strat, X).fit()
a, b_mkt, b_smb, b_mom = ff.params
print(f"三因子:    alpha = {a:.2%}/月 (t = {ff.tvalues[0]:.2f}),  β_mkt = {b_mkt:.2f}, β_smb = {b_smb:.2f}, β_mom = {b_mom:.2f}")
print(f"R² = {ff.rsquared:.2f}  —— 收益的大部分可以被已知因子解释")
# 收益分解:平均收益 = alpha + Σ β × 因子平均收益
parts = {"alpha": a, "市场": b_mkt * mkt.mean(), "规模": b_smb * smb.mean(), "动量": b_mom * mom.mean()}
print("月均收益分解:", {k: f"{v:.3%}" for k, v in parts.items()}, " 合计:", f"{sum(parts.values()):.3%}")

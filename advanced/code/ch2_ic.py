import numpy as np
import pandas as pd
from ch2_sim import make_panel
from ch2_preprocess import winsorize_mad, zscore, neutralize   # 复用上一段的预处理函数

panel = make_panel()

def prep(g):
    f = zscore(winsorize_mad(g["factor_raw"]))
    g = g.copy()
    g["factor"] = zscore(neutralize(f, g["industry"], g["log_mcap"]))
    return g
panel = pd.concat([prep(g) for _, g in panel.groupby("month")], ignore_index=True)

# ---- 1) 每期 IC 与 RankIC ----
by_m = panel.groupby("month")
ic = by_m.apply(lambda g: g["factor"].corr(g["fwd_ret"]))                      # Pearson IC
ric = by_m.apply(lambda g: g["factor"].corr(g["fwd_ret"], method="spearman"))  # 秩相关 RankIC
icir = ric.mean() / ric.std()                                                  # 信息比率 ICIR(月度)
t_stat = ric.mean() / (ric.std() / np.sqrt(len(ric)))                          # 均值是否显著不为 0
print(f"期数={len(ric)}  IC均值={ic.mean():.4f}  RankIC均值={ric.mean():.4f}  RankIC标准差={ric.std():.4f}")
print(f"ICIR={icir:.3f}  年化ICIR≈{icir*np.sqrt(12):.2f}  t值={t_stat:.2f}  RankIC>0 占比={(ric>0).mean():.1%}")

# ---- 2) 分层(分位数)回测:每期按因子分 5 组,看各组下月平均收益 ----
panel["q"] = by_m["factor"].transform(lambda s: pd.qcut(s, 5, labels=False) + 1)
q_ret = panel.groupby(["month", "q"])["fwd_ret"].mean().unstack()   # 行=月份,列=组别 1..5
print("\n各组月均收益(%):", (q_ret.mean() * 100).round(3).to_dict())
ls = q_ret[5] - q_ret[1]                                            # 多空组合:做多第5组、做空第1组
print(f"多空月均收益={ls.mean():.4%}  年化夏普≈{ls.mean()/ls.std()*np.sqrt(12):.2f}")

# ---- 3) 换手率:第 5 组成分股每月有多少比例被换掉 ----
top = panel[panel["q"] == 5].groupby("month")["code"].apply(set)
turnover = [1 - len(a & b) / len(b) for a, b in zip(top[:-1], top[1:])]
print(f"第5组平均月换手率={np.mean(turnover):.1%}")

# ---- 4) 因子衰减:用 t 月因子去预测 t+h 月收益 ----
wide_f = panel.pivot(index="month", columns="code", values="factor")
wide_r = panel.pivot(index="month", columns="code", values="fwd_ret")
for h in [0, 1, 2, 3, 6]:
    ics = [wide_f.iloc[t].corr(wide_r.iloc[t + h], method="spearman") for t in range(len(wide_f) - h)]
    print(f"滞后 {h} 期的 RankIC 均值: {np.mean(ics):.4f}")

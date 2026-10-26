import numpy as np
import pandas as pd
from ch2_sim import make_panel
from ch2_preprocess import winsorize_mad, zscore, neutralize

panel = make_panel()

def clean(g, col):
    """去极值 → 标准化 → 中性化 → 再标准化,返回干净的因子暴露。"""
    f = zscore(winsorize_mad(g[col]))
    return zscore(neutralize(f, g["industry"], g["log_mcap"]))

parts = []
for m, g in panel.groupby("month"):
    g = g.copy()
    g["f1"], g["f2"] = clean(g, "factor_raw"), clean(g, "factor2_raw")
    parts.append(g)
panel = pd.concat(parts, ignore_index=True)

def rank_ic(df, col):
    return df.groupby("month").apply(lambda g: g[col].corr(g["fwd_ret"], method="spearman"))

ic1, ic2 = rank_ic(panel, "f1"), rank_ic(panel, "f2")
print(f"f1 与 f2 的平均截面相关: {panel.groupby('month').apply(lambda g: g['f1'].corr(g['f2'])).mean():.2f}")

# 方法 A:等权合成
panel["eq"] = (panel["f1"] + panel["f2"]) / 2
# 方法 B:按“过去 12 个月”的 ICIR 加权 —— 权重只用历史信息,避免未来函数
icir1 = (ic1.rolling(12).mean() / ic1.rolling(12).std()).shift(1)   # shift(1):本月只能用到上月为止
icir2 = (ic2.rolling(12).mean() / ic2.rolling(12).std()).shift(1)
w1 = icir1.clip(lower=0) / (icir1.clip(lower=0) + icir2.clip(lower=0))  # 负的 ICIR 不给权重
panel["w1"] = panel["month"].map(w1)
panel["icir_w"] = panel["w1"] * panel["f1"] + (1 - panel["w1"]) * panel["f2"]
valid = panel.dropna(subset=["icir_w"])                                    # 前 13 个月没有足够历史

for name in ["f1", "f2", "eq", "icir_w"]:
    r = rank_ic(valid, name)
    print(f"{name:7s} RankIC均值={r.mean():.4f}  ICIR={r.mean()/r.std():.3f}")
print(f"ICIR 加权中 f1 的平均权重: {w1.mean():.2f}")

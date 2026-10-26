import numpy as np
import pandas as pd
from ch2_sim import make_panel

def winsorize_mad(x: pd.Series, k: float = 5.0) -> pd.Series:
    """MAD 去极值:把超出 中位数 ± k×1.4826×MAD 的值“拉回”到边界上。"""
    med = x.median()
    mad = (x - med).abs().median()            # 绝对离差的中位数
    sigma = 1.4826 * mad                      # 正态分布下 1.4826×MAD ≈ 标准差
    return x.clip(med - k * sigma, med + k * sigma)

def zscore(x: pd.Series) -> pd.Series:
    """标准化:减均值、除标准差,让不同因子处于同一量纲。"""
    return (x - x.mean()) / x.std()

def neutralize(f: pd.Series, industry: pd.Series, log_mcap: pd.Series) -> pd.Series:
    """行业 + 市值中性化:对 [行业哑变量, 对数市值] 做截面回归,取残差。"""
    X = pd.get_dummies(industry, prefix="ind", dtype=float)   # 每个行业一列 0/1,相当于各行业有自己的截距
    X["size"] = zscore(log_mcap)
    beta, *_ = np.linalg.lstsq(X.values, f.values, rcond=None)  # 最小二乘求回归系数
    resid = f.values - X.values @ beta                          # 残差 = 因子中无法被行业/市值解释的部分
    return pd.Series(resid, index=f.index)

if __name__ == "__main__":                  # 被其它脚本 import 时不执行下面的演示
    panel = make_panel()
    cs = panel[panel["month"] == panel["month"].iloc[0]].copy()     # 取第一个月的截面

    cs["f_w"] = winsorize_mad(cs["factor_raw"])
    cs["f_z"] = zscore(cs["f_w"])
    cs["f_n"] = zscore(neutralize(cs["f_z"], cs["industry"], cs["log_mcap"]))

    def describe(s):
        return f"min={s.min():7.2f} max={s.max():7.2f} 偏度={s.skew():6.2f} 与市值相关={s.corr(cs['log_mcap']):5.2f}"
    print("原始因子    ", describe(cs["factor_raw"]))
    print("去极值后    ", describe(cs["f_w"]))
    print("标准化后    ", describe(cs["f_z"]))
    print("中性化后    ", describe(cs["f_n"]))
    # 中性化后,各行业的因子均值应接近 0
    print("中性化后各行业均值(前 5 个):", cs.groupby("industry")["f_n"].mean().round(3).head().tolist())

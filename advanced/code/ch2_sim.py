"""ch2_sim.py —— 生成一个“教学用”模拟股票面板。所有数据均为随机生成,不对应任何真实股票。"""
import numpy as np
import pandas as pd

def make_panel(n_stocks=500, n_months=72, n_ind=10, ic_true=0.03, persist=0.8, seed=7):
    rng = np.random.default_rng(seed)
    codes = [f"S{i:04d}" for i in range(n_stocks)]
    months = pd.period_range("2019-01", periods=n_months, freq="M")
    industry = rng.integers(0, n_ind, n_stocks)                  # 每只股票固定属于一个行业
    log_mcap0 = rng.normal(23, 1.0, n_stocks)                    # 对数市值(约 1e10 元量级)
    alpha = rng.standard_normal(n_stocks)                        # 真实“好坏”信号(不可直接观测)
    alpha2 = rng.standard_normal(n_stocks)                       # 另一个独立的、较弱的真实信号
    rows = []
    for t, m in enumerate(months):
        # 真实信号随时间缓慢变化:persist 越高,信号越持久(因子换手越低)
        alpha = persist * alpha + np.sqrt(1 - persist**2) * rng.standard_normal(n_stocks)
        alpha2 = persist * alpha2 + np.sqrt(1 - persist**2) * rng.standard_normal(n_stocks)
        log_mcap = log_mcap0 + 0.05 * rng.standard_normal(n_stocks)
        size_z = (log_mcap - log_mcap.mean()) / log_mcap.std()
        # 我们观测到的“原始因子” = 真实信号 + 市值暴露 + 噪声,并混入少量极端值
        raw = alpha + 0.8 * size_z + 0.7 * rng.standard_normal(n_stocks)
        raw = np.where(rng.random(n_stocks) < 0.01, raw * 15, raw)       # 1% 的脏数据/极端值
        # 第二个因子:主要反映 alpha2,并带一点 alpha 的成分和更多噪声
        raw2 = alpha2 + 0.3 * alpha + 1.0 * rng.standard_normal(n_stocks)
        # 下月收益 = 行业效应 + 小市值效应 + 真实 alpha + 特质噪声(月度)
        ind_ret = rng.normal(0, 0.04, n_ind)[industry]
        noise_sd = 0.10
        fwd_ret = ind_ret - 0.01 * size_z + ic_true * noise_sd * (alpha + 0.7 * alpha2) + noise_sd * rng.standard_normal(n_stocks)
        rows.append(pd.DataFrame({"month": m, "code": codes, "industry": industry,
                                  "log_mcap": log_mcap, "factor_raw": raw, "factor2_raw": raw2, "fwd_ret": fwd_ret}))
    return pd.concat(rows, ignore_index=True)

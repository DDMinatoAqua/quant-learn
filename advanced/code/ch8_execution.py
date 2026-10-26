import numpy as np

rng = np.random.default_rng(31)
# ---- 1) 模拟一天的成交量分布:A 股连续竞价共 4 小时 = 240 分钟,这里按 48 个 5 分钟区间 ----
k = np.arange(48)
profile = 1.0 + 1.5 * np.exp(-k / 4) + 1.2 * np.exp(-(47 - k) / 4)   # 早盘、尾盘量大的 U 形(示意)
profile[24:] *= 0.9                                                  # 下午略低(示意)
profile /= profile.sum()
day_volume = 5_000_000                                               # 当天总成交量(股,假设)
market_vol = rng.multinomial(day_volume, profile)                    # 每个区间的成交量(模拟)
# 模拟价格:随机游走 + 我们自己的买单造成的临时冲击
sigma_5m = 0.0015
price = 10 * np.exp(np.cumsum(sigma_5m * rng.standard_normal(48)))

parent_qty = 250_000                                                 # 母单:要买 25 万股(占日成交 5%)
twap = np.full(48, parent_qty / 48)                                  # TWAP:时间均匀切分
vwap = parent_qty * profile                                          # VWAP:按预测的成交量分布切分

def execute(schedule, eta=0.1):
    """临时冲击模型:每个区间的成交价 = 市场价 × (1 + η·σ·√(子单量/该区间成交量))。"""
    part = schedule / market_vol                                     # 参与率
    fill_px = price * (1 + eta * sigma_5m * 10 * np.sqrt(part))      # 系数为示意值
    avg = (fill_px * schedule).sum() / schedule.sum()
    return avg, part.max()

arrival = price[0]                                                   # 决策时(到达)价格
mkt_vwap = (price * market_vol).sum() / market_vol.sum()             # 全市场当日 VWAP
for name, sch in [("TWAP", twap), ("VWAP", vwap)]:
    avg, pmax = execute(sch)
    is_bp = (avg - arrival) / arrival * 1e4                          # 执行落差 Implementation Shortfall
    vs_vwap = (avg - mkt_vwap) / mkt_vwap * 1e4
    print(f"{name}: 成交均价={avg:.4f}  执行落差={is_bp:6.1f} bp  相对市场VWAP={vs_vwap:5.1f} bp  最大参与率={pmax:.1%}")

# ---- 2) 平方根冲击模型的“量级估算”:成本 ≈ Y · σ_日 · √(Q / V_日) ----
Y, sigma_d = 1.0, 0.02                                               # Y 为经验系数(需用自己的成交数据校准)
for q_frac in [0.01, 0.05, 0.20]:
    print(f"下单量=日成交量的 {q_frac:4.0%}: 估算冲击 ≈ {Y*sigma_d*np.sqrt(q_frac)*1e4:5.1f} bp")

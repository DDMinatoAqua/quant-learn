import numpy as np
import pandas as pd

# 模拟 5 只股票某一天的行情快照(教学用虚构数据)
bar = pd.DataFrame({
    "code":       ["A", "B", "C", "D", "E"],
    "board":      ["main", "main", "st", "gem", "main"],   # 主板 / ST / 创业板
    "pre_close":  [10.00, 8.00, 5.00, 30.00, 12.00],
    "open":       [11.00, 7.50, 5.25, 31.00, np.nan],
    "high":       [11.00, 7.90, 5.25, 36.00, np.nan],
    "low":        [11.00, 7.20, 5.25, 30.50, np.nan],
    "close":      [11.00, 7.20, 5.25, 36.00, np.nan],
    "volume":     [1.2e5, 3.4e6, 8.0e4, 5.1e6, 0.0],
})
# 不同板块的涨跌幅限制(示意,具体以交易所最新规则为准)
limit_pct = bar["board"].map({"main": 0.10, "st": 0.05, "gem": 0.20})
# 涨停价/跌停价 = 前收盘 × (1 ± 限制比例),四舍五入到分
bar["up_limit"] = (bar["pre_close"] * (1 + limit_pct)).round(2)
bar["down_limit"] = (bar["pre_close"] * (1 - limit_pct)).round(2)

bar["suspended"] = bar["volume"].fillna(0) <= 0                       # 停牌:无成交
bar["one_word_up"] = (bar["low"] >= bar["up_limit"]) & ~bar["suspended"]   # 一字涨停:最低价=涨停价
bar["close_at_down"] = bar["close"] <= bar["down_limit"]              # 收盘跌停

# 回测里的“能否成交”规则(保守版本):
bar["can_buy"] = ~bar["suspended"] & ~bar["one_word_up"]              # 停牌、一字涨停都买不进
bar["can_sell"] = ~bar["suspended"] & ~bar["close_at_down"]           # 停牌、跌停(按收盘价成交时)卖不出
print(bar[["code", "board", "pre_close", "close", "up_limit", "down_limit",
           "suspended", "one_word_up", "can_buy", "can_sell"]].to_string(index=False))

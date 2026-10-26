import pandas as pd

# 一只虚构股票的 6 个交易日原始(不复权)收盘价 —— 教学用模拟数据
raw = pd.DataFrame({
    "date": pd.to_datetime(["2024-06-03", "2024-06-04", "2024-06-05",
                            "2024-06-06", "2024-06-07", "2024-06-11"]),
    "close": [20.0, 20.4, 10.0, 10.3, 10.1, 10.5],
})
# 公司行为(corporate action)表:6 月 5 日除权除息,每股派现 0.4 元,每 1 股送转 1 股
actions = pd.DataFrame({
    "date": pd.to_datetime(["2024-06-05"]),
    "cash_div": [0.4],     # 每股现金分红(元)
    "split": [1.0],        # 每股送转股数:10 送 10 即每股送 1 股
})

df = raw.merge(actions, on="date", how="left").fillna({"cash_div": 0.0, "split": 0.0})
df["prev_close"] = df["close"].shift(1)                       # 前一交易日收盘价
# 除权参考价 = (前收盘 − 每股派现) / (1 + 每股送转)
df["ref_price"] = (df["prev_close"] - df["cash_div"]) / (1 + df["split"])
# 单日复权因子:除权日 = 前收盘 / 除权参考价,其它日子 = 1
df["step"] = (df["prev_close"] / df["ref_price"]).where(df["cash_div"] + df["split"] > 0, 1.0)
df["adj_factor"] = df["step"].cumprod()                        # 累计复权因子(从第一天起连乘)
df["hfq"] = df["close"] * df["adj_factor"]                     # 后复权价:第一天价格不变
df["qfq"] = df["hfq"] / df["adj_factor"].iloc[-1]              # 前复权价:最后一天价格不变

df["ret_raw"] = df["close"].pct_change()                       # 用原始价算的“收益”(错的)
df["ret_adj"] = df["hfq"].pct_change()                         # 用复权价算的收益(对的)
pd.set_option("display.width", 120)
df["date"] = df["date"].dt.strftime("%m-%d")                     # 只显示月-日,便于阅读
print(df[["date", "close", "ref_price", "adj_factor", "hfq", "qfq", "ret_raw", "ret_adj"]].round(4).to_string(index=False))

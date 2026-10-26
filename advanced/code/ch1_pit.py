import pandas as pd

# 财报表:报告期(period)和真实公告日(ann_date)不是一回事 —— 教学用虚构数据
fin = pd.DataFrame({
    "code": ["A", "A", "A", "A"],
    "period": pd.to_datetime(["2023-12-31", "2024-03-31", "2023-12-31", "2024-06-30"]),
    "ann_date": pd.to_datetime(["2024-04-20", "2024-04-28", "2024-06-15", "2024-08-25"]),
    "net_profit": [10.0, 3.0, 8.5, 6.2],   # 第三行:2023 年报在 6 月 15 日被“更正”为 8.5
})
# 每月末调仓一次,想知道“当时”能看到的最新一期净利润
rebal = pd.to_datetime(["2024-03-29", "2024-04-30", "2024-06-28", "2024-08-30"])

# ❌ 错误做法 1:按报告期对齐 —— 3 月 29 日就“看到了”4 月 20 日才公布、甚至 6 月才更正的数据
wrong = pd.merge_asof(pd.DataFrame({"code": "A", "date": rebal}),
                      fin.sort_values("period"), left_on="date", right_on="period", by="code")

def pit_latest(fin, code, asof):
    """point-in-time 查询:只用 asof 当天及以前已公告的记录,
    取其中报告期最新的一期;同一报告期有多次公告时取最后一次(更正版)。"""
    known = fin[(fin["code"] == code) & (fin["ann_date"] <= asof)]     # 1) 只保留当时已知的
    if known.empty:
        return None                                                    # 当时还没有任何财报
    known = known.sort_values(["period", "ann_date"])                  # 2) 按报告期、公告日排序
    return known.iloc[-1]                                              # 3) 最后一行 = 最新期的最新版本

# ❌ 错误做法 2:用“今天的数据库快照”——每个报告期只保留最终修订版,丢失了更正前的数值
snapshot_fy23 = fin[fin["period"] == "2023-12-31"].sort_values("ann_date").iloc[-1]["net_profit"]

rows = []
for d in rebal:
    r = pit_latest(fin, "A", d)
    fy23 = fin[(fin["period"] == "2023-12-31") & (fin["ann_date"] <= d)].sort_values("ann_date")
    rows.append({"date": d.date(),
                 "wrong_by_period": wrong.loc[wrong["date"] == d, "net_profit"].item(),
                 "pit_period": None if r is None else r["period"].date(),
                 "pit_profit": None if r is None else r["net_profit"],
                 "fy23_snapshot": snapshot_fy23,                                   # 错:永远是 8.5
                 "fy23_pit": fy23["net_profit"].iloc[-1] if len(fy23) else None})  # 对:10.0 → 8.5
print(pd.DataFrame(rows).to_string(index=False))

import os, tempfile, time
import numpy as np
import pandas as pd

rng = np.random.default_rng(0)
dates = pd.bdate_range("2020-01-01", "2023-12-29")          # 约 1000 个工作日
codes = [f"S{i:04d}" for i in range(500)]                    # 500 只虚构股票
idx = pd.MultiIndex.from_product([dates, codes], names=["date", "code"])
panel = pd.DataFrame({
    "close": rng.lognormal(3, 0.5, len(idx)).astype("float32"),   # 模拟数据,仅用来测存储
    "volume": rng.integers(0, 10**7, len(idx)).astype("int64"),
}, index=idx).reset_index()
panel["year"] = panel["date"].dt.year                        # 用来分区的列

root = tempfile.mkdtemp()
csv_path = os.path.join(root, "panel.csv")
pq_dir = os.path.join(root, "panel_pq")

panel.to_csv(csv_path, index=False)                                  # 文本格式
panel.to_parquet(pq_dir, partition_cols=["year"], index=False)       # 按年分区的 parquet 数据集

def size(p):
    if os.path.isfile(p):
        return os.path.getsize(p)
    return sum(os.path.getsize(os.path.join(d, f)) for d, _, fs in os.walk(p) for f in fs)

print(f"行数: {len(panel):,}")
print(f"CSV 体积: {size(csv_path)/1e6:.1f} MB, Parquet 体积: {size(pq_dir)/1e6:.1f} MB")

t0 = time.perf_counter()
sub = pd.read_parquet(pq_dir, columns=["date", "code", "close"],
                      filters=[("year", "=", 2023), ("code", "in", ["S0001", "S0002"])])
print(f"只读 2023 年 2 只股票的 close 列: {len(sub)} 行, 用时 {time.perf_counter()-t0:.2f}s")
print(sub.head(3).to_string(index=False))

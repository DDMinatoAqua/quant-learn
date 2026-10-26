import numpy as np
import pandas as pd

def make_prices(n=2500, seed=11):
    """模拟日收盘价:带随机波动聚集的随机游走(没有可预测的规律)。"""
    rng = np.random.default_rng(seed)
    vol = np.empty(n); vol[0] = 0.015
    for t in range(1, n):                       # 让波动率慢慢变化,更像真实行情
        vol[t] = np.clip(vol[t-1] * np.exp(0.05 * rng.standard_normal()), 0.005, 0.05)
    ret = vol * rng.standard_normal(n)
    idx = pd.bdate_range("2015-01-01", periods=n)
    return pd.Series(100 * np.exp(np.cumsum(ret)), index=idx, name="close")

def triple_barrier(close, horizon=10, k=2.0, vol_win=20):
    """三重障碍标签:
       上障碍 = 入场价 × (1 + k·σ),下障碍 = 入场价 × (1 − k·σ),垂直障碍 = horizon 天后。
       先碰上障碍 → +1;先碰下障碍 → −1;都没碰到 → 用到期时收益的符号。
       返回标签和每个样本“标签结束时间” t1(后面做 purging 要用)。"""
    sigma = close.pct_change().rolling(vol_win).std()      # 用过去 20 天波动率设定障碍宽度
    labels, t1 = pd.Series(np.nan, index=close.index), pd.Series(pd.NaT, index=close.index)
    for i in range(vol_win, len(close) - horizon):
        p0, s = close.iloc[i], sigma.iloc[i]
        path = close.iloc[i + 1:i + 1 + horizon] / p0 - 1  # 未来 horizon 天的累计收益路径
        up = path[path >= k * s].index.min()               # 第一次触及上障碍的日期(没有则 NaT)
        dn = path[path <= -k * s].index.min()
        first = min([d for d in [up, dn] if pd.notna(d)], default=pd.NaT)
        if pd.isna(first):                                 # 两条水平障碍都没碰到
            labels.iloc[i], t1.iloc[i] = np.sign(path.iloc[-1]), path.index[-1]
        else:
            labels.iloc[i], t1.iloc[i] = (1 if first == up else -1), first
    return labels, t1

if __name__ == "__main__":
    close = make_prices()
    y, t1 = triple_barrier(close)
    ok = y.dropna()
    print("标签分布:", ok.value_counts().sort_index().to_dict())
    end_pos = close.index.get_indexer(t1.dropna())          # 标签结束日在序列中的位置
    start_pos = close.index.get_indexer(t1.dropna().index)   # 入场日的位置
    hold = end_pos - start_pos                                # 持有了多少个交易日
    print(f"平均持有 {hold.mean():.1f} 个交易日;  碰到垂直障碍(持满 10 天)的比例: {(hold == 10).mean():.0%}")
    print(ok.head(3).to_string())

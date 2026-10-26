import numpy as np
from scipy import stats

def psr(returns, sr_benchmark=0.0):
    """Probabilistic Sharpe Ratio(Bailey & López de Prado):
    在考虑样本长度、偏度、峰度后,真实夏普 > sr_benchmark 的概率。夏普用“每期”口径(不年化)。"""
    r = np.asarray(returns)
    T = len(r)
    sr = r.mean() / r.std(ddof=1)
    g3 = stats.skew(r)                              # 偏度
    g4 = stats.kurtosis(r, fisher=False)            # 峰度(正态 = 3)
    denom = np.sqrt(1 - g3 * sr + (g4 - 1) / 4 * sr**2)
    return stats.norm.cdf((sr - sr_benchmark) * np.sqrt(T - 1) / denom)

def expected_max_sr(n_trials, var_sr):
    """在 n_trials 个“真实夏普都为 0”的策略中,样本夏普最大值的近似期望。"""
    g = 0.5772156649                                # 欧拉-马歇罗尼常数
    z1 = stats.norm.ppf(1 - 1 / n_trials)
    z2 = stats.norm.ppf(1 - 1 / (n_trials * np.e))
    return np.sqrt(var_sr) * ((1 - g) * z1 + g * z2)

def block_bootstrap_sharpe(r, block=20, n_boot=5000, seed=0):
    """移动块 bootstrap:整块(连续 block 天)地重抽样,保留收益的短期相关性。返回年化夏普的分布。"""
    rng = np.random.default_rng(seed)
    r = np.asarray(r); T = len(r)
    n_blocks = int(np.ceil(T / block))
    out = np.empty(n_boot)
    for b in range(n_boot):
        starts = rng.integers(0, T - block + 1, n_blocks)
        sample = np.concatenate([r[s:s + block] for s in starts])[:T]
        out[b] = sample.mean() / sample.std(ddof=1) * np.sqrt(252)
    return out

if __name__ == "__main__":
    rng = np.random.default_rng(21)
    T = 756                                                  # 3 年日度
    r = 0.0004 + 0.01 * rng.standard_t(df=4, size=T) / np.sqrt(2)   # 模拟:带肥尾的日收益(t 分布)
    sr_ann = r.mean() / r.std(ddof=1) * np.sqrt(252)
    print(f"样本年化夏普 = {sr_ann:.2f}")
    print(f"偏度 = {stats.skew(r):.2f},  峰度 = {stats.kurtosis(r, fisher=False):.2f}(正态为 3)")
    boots = block_bootstrap_sharpe(r)
    lo, hi = np.percentile(boots, [2.5, 97.5])
    print(f"块 bootstrap 95% 区间: [{lo:.2f}, {hi:.2f}],  夏普 ≤ 0 的 bootstrap 比例: {(boots <= 0).mean():.1%}")
    print(f"PSR(基准 0) = {psr(r):.3f}")
    # 假设这个策略是从 100 个尝试里挑出来的最好的那个,各次尝试的(日度)夏普方差取 (0.5/√252)^2 —— 示意值
    sr0 = expected_max_sr(100, (0.5 / np.sqrt(252))**2)
    print(f"100 次尝试下,纯靠运气的最大年化夏普期望 ≈ {sr0*np.sqrt(252):.2f}")
    print(f"Deflated Sharpe Ratio = PSR(基准 = 该期望) = {psr(r, sr0):.3f}")

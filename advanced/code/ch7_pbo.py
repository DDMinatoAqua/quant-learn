import numpy as np
from itertools import combinations

def pbo_cscv(R, S=16):
    """CSCV 估计回测过拟合概率 PBO(Bailey, Borwein, López de Prado, Zhu)。
    R: T×N 收益矩阵(N 个参数组合/策略)。把时间切成 S 块,枚举所有“一半块做样本内、另一半做样本外”的组合。"""
    T, N = R.shape
    blocks = np.array_split(np.arange(T), S)
    logits = []
    for is_idx in combinations(range(S), S // 2):
        oos_idx = [b for b in range(S) if b not in is_idx]
        IS = np.concatenate([blocks[b] for b in is_idx]); OOS = np.concatenate([blocks[b] for b in oos_idx])
        sr_is = R[IS].mean(0) / R[IS].std(0)
        sr_oos = R[OOS].mean(0) / R[OOS].std(0)
        n_star = np.argmax(sr_is)                               # 样本内最好的那个
        rank = (sr_oos < sr_oos[n_star]).sum() + 1              # 它在样本外的名次(1=最差)
        w = rank / (N + 1)                                      # 相对名次 ∈ (0,1)
        logits.append(np.log(w / (1 - w)))
    logits = np.array(logits)
    return (logits <= 0).mean(), len(logits)                    # 样本外跌到中位数以下的比例

rng = np.random.default_rng(23)
T, N = 1000, 50
noise = 0.01 * rng.standard_normal((T, N))                      # 情形 1:50 个纯噪声策略
pbo1, n_comb = pbo_cscv(noise)
skill = noise.copy(); skill[:, :5] += 0.0015                     # 情形 2:其中 5 个有真实正收益(模拟)
pbo2, _ = pbo_cscv(skill)
print(f"组合数 C(16,8) = {n_comb}")
print(f"纯噪声策略库:   PBO = {pbo1:.2f}")
print(f"含真实信号策略库: PBO = {pbo2:.2f}")

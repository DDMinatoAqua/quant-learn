import numpy as np
from sklearn.covariance import LedoitWolf

rng = np.random.default_rng(6)
N, T_train, T_test, trials = 50, 60, 250, 200   # 50 只资产,只有 60 个样本估计协方差
# 真实协方差:单因子结构(市场 β)+ 特质波动 —— 模拟设定
beta = rng.uniform(0.5, 1.5, N)
Sigma_true = np.outer(beta, beta) * 0.01**2 + np.diag(rng.uniform(0.01, 0.03, N)**2)
L = np.linalg.cholesky(Sigma_true)

def gmv(S):
    """全局最小方差权重(允许做空)。"""
    x = np.linalg.solve(S, np.ones(len(S)))
    return x / x.sum()

res = {"样本协方差": [], "Ledoit-Wolf": [], "真实协方差(理想)": []}
for _ in range(trials):
    X = rng.standard_normal((T_train, N)) @ L.T          # 训练期收益
    S_sample = np.cov(X, rowvar=False)
    S_lw = LedoitWolf().fit(X).covariance_               # 收缩估计
    for k, S in [("样本协方差", S_sample), ("Ledoit-Wolf", S_lw), ("真实协方差(理想)", Sigma_true)]:
        w = gmv(S)
        res[k].append(np.sqrt(w @ Sigma_true @ w) * np.sqrt(252))   # 组合真实的(样本外)年化波动

lw = LedoitWolf().fit(rng.standard_normal((T_train, N)) @ L.T)
print(f"一次拟合中 Ledoit-Wolf 收缩强度 δ={lw.shrinkage_:.2f}")
print(f"样本协方差条件数≈{np.linalg.cond(np.cov(rng.standard_normal((T_train, N)) @ L.T, rowvar=False)):.0f}")
for k, v in res.items():
    print(f"{k:14s} 最小方差组合的真实年化波动: 均值={np.mean(v):.2%}  最差={np.max(v):.2%}")

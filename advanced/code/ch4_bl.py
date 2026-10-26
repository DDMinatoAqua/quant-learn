import numpy as np

names = ["股票A", "股票B", "债券C", "商品D"]
vol = np.array([0.20, 0.25, 0.05, 0.18])
corr = np.array([[1.0, 0.6, 0.1, 0.3], [0.6, 1.0, 0.0, 0.3],
                 [0.1, 0.0, 1.0, 0.0], [0.3, 0.3, 0.0, 1.0]])
Sigma = np.outer(vol, vol) * corr
w_mkt = np.array([0.35, 0.25, 0.30, 0.10])          # 假设的“市场/基准”权重
delta = 2.5                                          # 风险厌恶系数(常见取值 2~4,这里取 2.5)
tau = 0.05                                           # 先验不确定性缩放

# 1) 反推隐含均衡收益:π = δ Σ w_mkt(“市场持有这些权重,说明它隐含了这样的预期收益”)
pi = delta * Sigma @ w_mkt
# 2) 观点:① 股票B 比 股票A 年化多 3%;② 商品D 年化收益 4%
P = np.array([[-1, 1, 0, 0],
              [0, 0, 0, 1]], dtype=float)
Q = np.array([0.03, 0.04])
Omega = np.diag(np.diag(P @ (tau * Sigma) @ P.T))    # 观点不确定性(He-Litterman 常用设定)
# 3) 后验预期收益:
#    μ_BL = [(τΣ)^{-1} + Pᵀ Ω^{-1} P]^{-1} [(τΣ)^{-1} π + Pᵀ Ω^{-1} Q]
A = np.linalg.inv(tau * Sigma) + P.T @ np.linalg.inv(Omega) @ P
b = np.linalg.inv(tau * Sigma) @ pi + P.T @ np.linalg.inv(Omega) @ Q
mu_bl = np.linalg.solve(A, b)
# 4) 用后验收益做无约束均值-方差:w = (δΣ)^{-1} μ_BL
w_bl = np.linalg.solve(delta * Sigma, mu_bl)
for i, n in enumerate(names):
    print(f"{n}: 均衡收益 π={pi[i]:6.2%}  后验 μ_BL={mu_bl[i]:6.2%}  市场权重={w_mkt[i]:5.1%} → BL权重={w_bl[i]:6.1%}")
print(f"BL 权重合计={w_bl.sum():.3f}")

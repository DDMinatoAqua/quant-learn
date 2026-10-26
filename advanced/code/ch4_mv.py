import numpy as np
import cvxpy as cp

# 4 个虚构资产的“假设”年化预期收益、波动率和相关系数(教学用,非真实市场数据)
names = ["股票A", "股票B", "债券C", "商品D"]
mu = np.array([0.08, 0.10, 0.03, 0.06])
vol = np.array([0.20, 0.25, 0.05, 0.18])
corr = np.array([[1.0, 0.6, 0.1, 0.3],
                 [0.6, 1.0, 0.0, 0.3],
                 [0.1, 0.0, 1.0, 0.0],
                 [0.3, 0.3, 0.0, 1.0]])
Sigma = np.outer(vol, vol) * corr                  # 协方差 = σ_i σ_j ρ_ij
ones = np.ones(len(mu))
Si = np.linalg.inv(Sigma)                           # Σ^{-1}
rf = 0.02                                           # 无风险利率

# 1) 全局最小方差组合(允许做空):w = Σ^{-1}1 / (1ᵀΣ^{-1}1)
w_gmv = Si @ ones / (ones @ Si @ ones)
# 2) 切点组合 / 最大夏普(允许做空):w ∝ Σ^{-1}(μ − rf)
w_tan = Si @ (mu - rf); w_tan /= w_tan.sum()

def show(name, w):
    r, s = w @ mu, np.sqrt(w @ Sigma @ w)
    print(f"{name:10s} 权重=" + " ".join(f"{n}:{x:6.1%}" for n, x in zip(names, w)) +
          f" | 收益={r:.2%} 波动={s:.2%} 夏普={(r-rf)/s:.2f}")
show("最小方差", w_gmv)
show("最大夏普", w_tan)
show("等权", ones / 4)

# 3) 只做多 + 单资产不超过 50% 的最大夏普:用 cvxpy 求“给定收益下最小方差”,在收益网格上扫描
w = cp.Variable(4)
target = cp.Parameter()
prob = cp.Problem(cp.Minimize(cp.quad_form(w, Sigma)),
                  [cp.sum(w) == 1, w >= 0, w <= 0.5, mu @ w >= target])
best = None
for tr in np.linspace(0.03, 0.09, 61):              # 有效前沿:每个目标收益求一次
    target.value = tr
    prob.solve()
    if w.value is None:                              # 目标收益不可达时跳过
        continue
    wv = np.clip(w.value, 0, None); wv /= wv.sum()
    sr = (wv @ mu - rf) / np.sqrt(wv @ Sigma @ wv)
    if best is None or sr > best[0]:
        best = (sr, wv)
show("约束最大夏普", best[1])

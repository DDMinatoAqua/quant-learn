import numpy as np
from scipy.optimize import minimize

vol = np.array([0.20, 0.25, 0.05, 0.18])            # 与 ch4_mv.py 同一组假设
corr = np.array([[1.0, 0.6, 0.1, 0.3], [0.6, 1.0, 0.0, 0.3],
                 [0.1, 0.0, 1.0, 0.0], [0.3, 0.3, 0.0, 1.0]])
Sigma = np.outer(vol, vol) * corr

def risk_contrib(w, S):
    """风险贡献 RC_i = w_i (Σw)_i / σ_p,各项之和等于组合波动 σ_p。"""
    sigma_p = np.sqrt(w @ S @ w)
    return w * (S @ w) / sigma_p

def rp_objective(w, S):
    rc = risk_contrib(w, S)
    return np.sum((rc - rc.mean())**2)               # 让每个资产的风险贡献尽量相等

n = len(vol)
res = minimize(rp_objective, np.ones(n) / n, args=(Sigma,), method="SLSQP",
               bounds=[(0, 1)] * n, constraints=[{"type": "eq", "fun": lambda w: w.sum() - 1}],
               options={"ftol": 1e-14})
w_rp = res.x
for name, w in [("等权", np.ones(n) / n), ("风险平价", w_rp), ("反波动率", (1/vol) / (1/vol).sum())]:
    rc = risk_contrib(w, Sigma)
    print(f"{name:6s} 权重={np.round(w, 3)}  风险贡献占比={np.round(rc / rc.sum(), 3)}  组合波动={np.sqrt(w@Sigma@w):.2%}")

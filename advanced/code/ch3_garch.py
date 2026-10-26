import numpy as np
from scipy.optimize import minimize

rng = np.random.default_rng(3)
# ---- 1) 用已知参数模拟一条 GARCH(1,1) 日收益率序列 ----
omega, alpha, beta, n = 2e-6, 0.08, 0.90, 3000
r, s2 = np.zeros(n), np.zeros(n)
s2[0] = omega / (1 - alpha - beta)                 # 从长期方差开始
for t in range(n):
    if t > 0:
        s2[t] = omega + alpha * r[t - 1]**2 + beta * s2[t - 1]   # 条件方差递推
    r[t] = np.sqrt(s2[t]) * rng.standard_normal()                 # 收益 = 条件波动 × 标准正态

# ---- 2) 极大似然估计:最小化负对数似然 ----
def neg_loglik(params, r):
    w, a, b = params
    if w <= 0 or a < 0 or b < 0 or a + b >= 1:     # 不满足约束 → 返回极大值,让优化器避开
        return 1e10
    var = np.empty_like(r)
    var[0] = r.var()                               # 初值:用样本方差
    for t in range(1, len(r)):
        var[t] = w + a * r[t - 1]**2 + b * var[t - 1]
    return 0.5 * np.sum(np.log(2 * np.pi) + np.log(var) + r**2 / var)

x0 = [r.var() * 0.05, 0.05, 0.90]                  # 合理的初始猜测
opt = minimize(neg_loglik, x0, args=(r,), method="Nelder-Mead",
               options={"maxiter": 4000, "xatol": 1e-10, "fatol": 1e-6})
w_hat, a_hat, b_hat = opt.x
print(f"真实: ω={omega:.2e} α={alpha:.3f} β={beta:.3f}")
print(f"估计: ω={w_hat:.2e} α={a_hat:.3f} β={b_hat:.3f}  α+β={a_hat+b_hat:.3f}")
long_run_vol = np.sqrt(w_hat / (1 - a_hat - b_hat) * 252)
print(f"长期年化波动率≈{long_run_vol:.1%}  (真实值 {np.sqrt(omega/(1-alpha-beta)*252):.1%})")
half_life = np.log(0.5) / np.log(a_hat + b_hat)
print(f"波动冲击半衰期≈{half_life:.1f} 个交易日")

# ---- 3) 向前预测:h 步后的方差向长期方差回归 ----
var_f = np.empty_like(r)                            # 用“估计出的参数”重新滤波得到条件方差序列
var_f[0] = r.var()
for t in range(1, n):
    var_f[t] = w_hat + a_hat * r[t - 1]**2 + b_hat * var_f[t - 1]
var_T = w_hat + a_hat * r[-1]**2 + b_hat * var_f[-1]   # 明天(T+1)的条件方差
lr_var = w_hat / (1 - a_hat - b_hat)
for h in [1, 5, 20, 60]:
    v = lr_var + (a_hat + b_hat)**(h - 1) * (var_T - lr_var)
    print(f"{h:3d} 天后的日波动率预测: {np.sqrt(v):.4%}")

import numpy as np
from statsmodels.tsa.arima.model import ARIMA
from statsmodels.stats.diagnostic import acorr_ljungbox

rng = np.random.default_rng(2)
n, mu, phi, sigma = 1500, 0.0003, 0.10, 0.012       # 真实参数:均值、AR 系数、噪声标准差
r = np.zeros(n)
for t in range(1, n):                               # 生成 AR(1) 收益率:r_t − μ = φ(r_{t-1} − μ) + ε_t
    r[t] = mu + phi * (r[t - 1] - mu) + sigma * rng.standard_normal()

model = ARIMA(r, order=(1, 0, 0))                   # (p, d, q) = (1, 0, 0):AR(1),不差分,无 MA 项
res = model.fit()
const, ar_l1, s2 = res.params                       # 估计的常数(=均值)、AR 系数、残差方差
print(f"估计 μ={const:.5f}  φ={ar_l1:.3f} (标准误 {res.bse[1]:.3f})  σ={np.sqrt(s2):.4f}")
print(f"AIC={res.aic:.1f}")

lb = acorr_ljungbox(res.resid, lags=[10])           # 残差还有没有自相关?p 值大 = 没有明显剩余结构
print(f"残差 Ljung-Box(10) p值={lb['lb_pvalue'].iloc[0]:.3f}")

fc = res.get_forecast(steps=3)                      # 向前预测 3 步
print("未来 3 天预测均值:", np.round(fc.predicted_mean, 5))
print("95% 区间下限:", np.round(fc.conf_int()[:, 0], 4))

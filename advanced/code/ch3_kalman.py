import numpy as np

rng = np.random.default_rng(5)
n = 600
# 真实对冲比率 β_t 随时间缓慢漂移(模拟数据)
beta_true = 1.0 + np.cumsum(rng.normal(0.001, 0.01, n))
x = 50 + np.cumsum(rng.normal(0, 1, n))
y = beta_true * x + rng.normal(0, 2.0, n)              # 观测:y_t = β_t·x_t + 观测噪声

# 状态空间模型:
#   状态方程 β_t = β_{t-1} + w_t,  w_t ~ N(0, Q)   (β 像随机游走一样慢慢变)
#   观测方程 y_t = x_t·β_t + v_t,   v_t ~ N(0, R)
Q, R = 1e-4, 4.0                                        # 过程噪声方差 / 观测噪声方差(需调参)
beta_hat, P = 0.0, 1.0                                  # 初始估计与其不确定性(方差)
est = np.zeros(n)
for t in range(n):
    # 1) 预测:β 的最佳猜测不变,不确定性增加 Q
    P = P + Q
    # 2) 更新:看到 y_t 后,用“预测误差”修正
    y_pred = x[t] * beta_hat                            # 预测的观测值
    err = y[t] - y_pred                                 # 新息(innovation)
    S = x[t] * P * x[t] + R                             # 新息的方差
    K = P * x[t] / S                                    # 卡尔曼增益:多相信新数据还是旧估计
    beta_hat = beta_hat + K * err
    P = (1 - K * x[t]) * P
    est[t] = beta_hat

ols_beta = (x @ y) / (x @ x)                            # 对比:全样本一个固定 β(无截距)
for t in [50, 200, 400, 599]:
    print(f"t={t:3d}  真实β={beta_true[t]:.3f}  卡尔曼估计={est[t]:.3f}")
print(f"全样本 OLS 固定 β={ols_beta:.3f}")
print(f"后 400 天平均绝对误差: 卡尔曼={np.abs(est[200:]-beta_true[200:]).mean():.3f}  "
      f"固定OLS={np.abs(ols_beta-beta_true[200:]).mean():.3f}")

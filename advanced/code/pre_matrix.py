import numpy as np
w = np.array([0.6, 0.4])
sigma = np.array([0.20, 0.10])
corr = np.array([[1.0, 0.3], [0.3, 1.0]])
Sigma = np.outer(sigma, sigma) * corr   # 协方差矩阵 = σ_i σ_j ρ_ij
print(w @ Sigma @ w)                    # 0.01888  —— @ 就是矩阵乘法
print(np.sqrt(w @ Sigma @ w))           # 0.1374...

import numpy as np
import pandas as pd
from scipy.cluster.hierarchy import linkage, leaves_list
from scipy.spatial.distance import squareform

rng = np.random.default_rng(8)
# 模拟 8 个资产:两个“板块”(各 4 个),板块内相关高 —— 教学用
T, k = 500, 4
f1, f2 = rng.standard_normal(T), rng.standard_normal(T)
X = np.column_stack([0.8 * f1 + 0.6 * rng.standard_normal(T) for _ in range(k)] +
                    [0.7 * f2 + 0.7 * rng.standard_normal(T) for _ in range(k)])
X *= np.array([0.01, 0.012, 0.015, 0.02, 0.008, 0.01, 0.006, 0.009])   # 不同波动
ret = pd.DataFrame(X, columns=[f"A{i}" for i in range(8)])
cov, corr = ret.cov(), ret.corr()

# 第 1 步:树形聚类。距离 d_ij = sqrt((1 − ρ_ij)/2),相关越高距离越近
dist = np.sqrt((1 - corr) / 2)
link = linkage(squareform(dist.values, checks=False), method="single")
# 第 2 步:准对角化 —— 按聚类树的叶子顺序重排资产,相似资产排在一起
order = list(corr.index[leaves_list(link)])

def cluster_var(cov, items):
    """一个簇的方差:簇内用反方差权重组合后的方差。"""
    c = cov.loc[items, items]
    ivp = 1 / np.diag(c); ivp /= ivp.sum()
    return ivp @ c.values @ ivp

# 第 3 步:递归二分 —— 每次把列表劈成两半,按两半的风险反比分配权重
w = pd.Series(1.0, index=order)
clusters = [order]
while clusters:
    clusters = [c[j:k] for c in clusters for j, k in ((0, len(c)//2), (len(c)//2, len(c))) if len(c) > 1]
    for i in range(0, len(clusters), 2):
        left, right = clusters[i], clusters[i + 1]
        vl, vr = cluster_var(cov, left), cluster_var(cov, right)
        a = 1 - vl / (vl + vr)                       # 风险小的那半拿更多权重
        w[left] *= a
        w[right] *= 1 - a
print("聚类后的资产顺序:", order)
print("HRP 权重:", w.reindex(ret.columns).round(3).to_dict())
print("权重合计:", round(w.sum(), 6))

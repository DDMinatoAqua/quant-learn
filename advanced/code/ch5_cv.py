import numpy as np
import pandas as pd
import lightgbm as lgb
from sklearn.model_selection import KFold
from sklearn.metrics import accuracy_score
from ch5_labels import make_prices, triple_barrier

close = make_prices()
y, t1 = triple_barrier(close)

# ---- 特征工程:全部只用“当天及以前”的数据 ----
r = np.log(close).diff()
X = pd.DataFrame({
    "ret_5":   close.pct_change(5),                 # 过去 5 日收益
    "ret_20":  close.pct_change(20),                # 过去 20 日收益(动量)
    "vol_20":  r.rolling(20).std(),                 # 过去 20 日波动率
    "vol_60":  r.rolling(60).std(),
    "ma_gap":  close / close.rolling(60).mean() - 1,  # 价格偏离 60 日均线
    "z_20":    (close - close.rolling(20).mean()) / close.rolling(20).std(),
})
data = X.assign(y=y, t1=t1).dropna()
Xv, yv, t1v = data[X.columns], (data["y"] > 0).astype(int), data["t1"]
print(f"样本数={len(data)}  正类比例={yv.mean():.1%}")

def purged_kfold(index, t1, n_splits=5, embargo=0.01):
    """Purged K-Fold:按时间顺序切块;从训练集中删掉
       (a) 标签区间 [t, t1] 与测试集区间重叠的样本(purge),
       (b) 紧跟测试集之后一小段的样本(embargo)。"""
    n = len(index); emb = int(n * embargo)
    for test_idx in np.array_split(np.arange(n), n_splits):
        t0, t_end = index[test_idx[0]], t1.iloc[test_idx].max()   # 测试集覆盖的时间范围
        train_mask = np.ones(n, bool)
        train_mask[test_idx] = False
        overlap = (index <= t_end) & (t1.values >= t0)             # 标签区间与测试区间重叠
        train_mask &= ~overlap
        after = np.arange(test_idx[-1] + 1, min(n, test_idx[-1] + 1 + emb))
        train_mask[after] = False                                   # embargo:测试集之后再空出一段
        yield np.where(train_mask)[0], test_idx

def cv_score(splits):
    accs = []
    for tr, te in splits:
        model = lgb.LGBMClassifier(n_estimators=200, learning_rate=0.05, num_leaves=15,
                                   min_child_samples=20, subsample=0.8, subsample_freq=1,
                                   colsample_bytree=0.8, random_state=0, verbose=-1)
        model.fit(Xv.iloc[tr], yv.iloc[tr])
        accs.append(accuracy_score(yv.iloc[te], model.predict(Xv.iloc[te])))
    return np.mean(accs), np.std(accs)

naive = KFold(n_splits=5, shuffle=True, random_state=0).split(Xv)      # ❌ 打乱顺序的普通 K 折
plain = KFold(n_splits=5, shuffle=False).split(Xv)                     # 按时间切块,但不 purge
purged = purged_kfold(Xv.index, t1v, n_splits=5, embargo=0.01)         # ✅ purge + embargo
print("打乱的普通 KFold     准确率=%.3f ± %.3f" % cv_score(naive))
print("按时间切块(未purge) 准确率=%.3f ± %.3f" % cv_score(plain))
print("Purged + Embargo     准确率=%.3f ± %.3f" % cv_score(purged))
print("(数据是无规律的模拟随机游走,真实可达的准确率约等于“总猜多数类”的水平:%.3f)" % max(yv.mean(), 1 - yv.mean()))

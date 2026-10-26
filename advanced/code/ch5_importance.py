import numpy as np
import pandas as pd
import lightgbm as lgb
from sklearn.inspection import permutation_importance
from sklearn.metrics import roc_auc_score

rng = np.random.default_rng(12)
n = 4000
# 模拟特征表:只有 f_signal1、f_signal2 真正有用,其余是纯噪声 —— 教学用
X = pd.DataFrame({
    "f_signal1": rng.standard_normal(n),
    "f_signal2": rng.standard_normal(n),
    "noise_cont": rng.standard_normal(n),            # 连续噪声:可切分点很多
    "noise_bin": rng.integers(0, 2, n).astype(float),  # 二值噪声:只有一个切分点
})
logit = 0.6 * X["f_signal1"] - 0.4 * X["f_signal2"]
y = (rng.random(n) < 1 / (1 + np.exp(-logit))).astype(int)

split = int(n * 0.7)                                  # 前 70% 训练、后 30% 测试(按顺序,不打乱)
Xtr, Xte, ytr, yte = X.iloc[:split], X.iloc[split:], y.iloc[:split], y.iloc[split:]
model = lgb.LGBMClassifier(n_estimators=150, learning_rate=0.05, num_leaves=7, min_child_samples=50,
                           random_state=0, verbose=-1).fit(Xtr, ytr)

split_imp = pd.Series(model.booster_.feature_importance("split"), index=X.columns)   # 被用来分裂的次数
gain_imp = pd.Series(model.booster_.feature_importance("gain"), index=X.columns)     # 分裂带来的总增益
perm = permutation_importance(model, Xte, yte, n_repeats=20, random_state=0, scoring="roc_auc")
out = pd.DataFrame({"split次数": split_imp, "gain占比": gain_imp / gain_imp.sum(),
                    "置换重要性(测试集AUC下降)": perm.importances_mean,
                    "置换重要性标准差": perm.importances_std})
print(out.round(4).to_string())
print(f"\n测试集 AUC = {roc_auc_score(yte, model.predict_proba(Xte)[:, 1]):.3f}")

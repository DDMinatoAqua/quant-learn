# 一个极简的限价订单簿(Limit Order Book)—— 数字均为虚构示例
asks = [(10.02, 300), (10.03, 500), (10.04, 800), (10.05, 1200), (10.06, 2000)]   # 卖一 ~ 卖五 (价格, 股数)
bids = [(10.00, 400), (9.99, 600), (9.98, 900), (9.97, 1500), (9.96, 2500)]       # 买一 ~ 买五

best_ask, best_bid = asks[0][0], bids[0][0]
mid = (best_ask + best_bid) / 2                         # 中间价
spread = best_ask - best_bid                            # 绝对价差
print(f"买一={best_bid} 卖一={best_ask} 中间价={mid:.3f} 价差={spread:.2f} 元 = {spread/mid*1e4:.1f} bp")

def market_buy(book, qty):
    """市价买入 qty 股:从卖一开始逐档“吃掉”挂单,直到买够。返回成交均价和成交明细。"""
    left, cost, fills = qty, 0.0, []
    for price, size in book:
        take = min(left, size)
        fills.append((price, take)); cost += price * take; left -= take
        if left == 0:
            break
    if left > 0:
        raise ValueError("五档深度不够,剩余 %d 股无法成交" % left)
    return cost / qty, fills

for q in [200, 1000, 3000]:
    avg, fills = market_buy(asks, q)
    slip_bp = (avg - mid) / mid * 1e4                   # 相对中间价的成本(bp)
    print(f"市价买 {q:5d} 股: 成交均价={avg:.4f}  相对中间价成本={slip_bp:5.1f} bp  吃到 {len(fills)} 档")

# 订单簿不平衡度:买一量与卖一量的相对大小,常被用作极短期价格方向的特征
imb = (bids[0][1] - asks[0][1]) / (bids[0][1] + asks[0][1])
print(f"一档不平衡度 = {imb:.2f}  (>0 表示买盘相对更厚)")

from dataclasses import dataclass, field
import numpy as np

@dataclass
class RiskLimits:                       # 风控参数:全部是示意值,请根据自己的资金规模和策略设定
    max_order_value: float = 200_000    # 单笔委托金额上限(元)
    max_position_pct: float = 0.10      # 单只股票持仓占总资产上限
    max_daily_orders: int = 200         # 每日委托笔数上限(防止程序死循环狂发单)
    max_price_dev: float = 0.03         # 委托价偏离最新价上限(防“乌龙指”)
    daily_loss_stop: float = 0.03       # 当日亏损达到 3% 停止开新仓
    blacklist: set = field(default_factory=lambda: {"ST_XYZ"})

class PreTradeRisk:
    """事前风控:每一笔委托发出前都必须通过全部检查,任何一条不满足就拒绝并记录原因。"""
    def __init__(self, limits: RiskLimits, equity: float):
        self.lim, self.equity, self.start_equity = limits, equity, equity
        self.orders_today, self.positions = 0, {}
        self.kill_switch = False                                     # 人工或自动触发的“总开关”

    def check(self, symbol, qty, price, last_price):
        L = self.lim
        value = abs(qty) * price
        new_pos_value = (self.positions.get(symbol, 0) + qty) * last_price
        rules = [
            (self.kill_switch, "总开关已关闭"),
            (symbol in L.blacklist, "标的在黑名单"),
            (qty % 100 != 0 and qty > 0, "买入数量不是 100 股整数倍"),
            (value > L.max_order_value, f"单笔金额 {value:,.0f} 超过上限"),
            (abs(price / last_price - 1) > L.max_price_dev, "委托价偏离最新价过大"),
            (new_pos_value > L.max_position_pct * self.equity, "成交后单票仓位超限"),
            (self.orders_today >= L.max_daily_orders, "当日委托笔数已达上限"),
            (qty > 0 and self.equity / self.start_equity - 1 <= -L.daily_loss_stop, "当日亏损触发止损,禁止开仓"),
        ]
        for hit, reason in rules:
            if hit:
                return False, reason
        self.orders_today += 1
        return True, "通过"

    def on_fill(self, symbol, qty):
        """成交回报到达后更新持仓 —— 持仓以成交为准,而不是以“发出的委托”为准。"""
        self.positions[symbol] = self.positions.get(symbol, 0) + qty

risk = PreTradeRisk(RiskLimits(), equity=1_000_000)
tests = [("X0001", 5000, 10.00, 10.00), ("X0001", 30000, 10.00, 10.00), ("X0002", 1000, 10.80, 10.00),
         ("ST_XYZ", 100, 5.00, 5.00), ("X0003", 150, 20.00, 20.00), ("X0004", 8000, 12.00, 12.00),
         ("X0001", 6000, 10.00, 10.00)]   # 最后一笔:X0001 已持有 5000 股,再买 6000 股将超过 10% 仓位上限
for t in tests:
    ok, why = risk.check(*t)
    if ok:
        risk.on_fill(t[0], t[1])          # 演示:假设通过的委托全部成交
    print(f"{t[0]:7s} 数量={t[1]:6d} 价格={t[2]:6.2f} → {'✅' if ok else '❌'} {why}")

# ---- 事后监控:实盘净值相对回测净值的跟踪偏差,超阈值就告警 ----
rng = np.random.default_rng(41)
bt = np.cumprod(1 + 0.0005 + 0.01 * rng.standard_normal(60))              # 回测(模拟)
live = bt * np.cumprod(1 - 0.0004 + 0.002 * rng.standard_normal(60))      # 实盘 = 回测 × 额外损耗(模拟)
gap = live / bt - 1
alert_day = np.argmax(gap < -0.02) if (gap < -0.02).any() else None
print(f"60 天后实盘相对回测偏差: {gap[-1]:.2%};  首次跌破 −2% 告警阈值: 第 {alert_day + 1 if alert_day is not None else '—'} 天")

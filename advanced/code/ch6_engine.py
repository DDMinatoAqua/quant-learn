"""ch6_engine.py —— 一个约 200 行的教学用事件驱动回测引擎。
结构:DataHandler → Strategy → Portfolio → ExecutionHandler,模块之间只通过“事件”通信。"""
from collections import deque
from dataclasses import dataclass
import numpy as np
import pandas as pd

@dataclass
class MarketEvent:            # 新的一根 K 线到了
    date: pd.Timestamp

@dataclass
class SignalEvent:            # 策略说:我想把某只股票的目标仓位调到 target(0~1,占总资产比例)
    date: pd.Timestamp
    symbol: str
    target: float

@dataclass
class OrderEvent:             # 组合说:请买/卖多少股
    date: pd.Timestamp
    symbol: str
    qty: int                  # 正数买入、负数卖出

@dataclass
class FillEvent:              # 撮合说:实际成交了多少、什么价、花了多少成本
    date: pd.Timestamp
    symbol: str
    qty: int
    price: float
    cost: float
class DataHandler:
    """按日期逐根推送 K 线。关键:策略只能通过 history() 拿到“当前及以前”的数据。"""
    def __init__(self, bars: dict):                 # bars: {symbol: DataFrame[open, close, pre_close, volume]}
        self.bars = bars
        self.dates = sorted(set().union(*[df.index for df in bars.values()]))
        self.i = -1
    def update(self):
        self.i += 1
        return self.i < len(self.dates)             # 还有数据就返回 True
    @property
    def now(self):
        return self.dates[self.i]
    def history(self, symbol, field, n):
        df = self.bars[symbol]
        return df.loc[:self.now, field].iloc[-n:]   # 截至“现在”的最近 n 个值,杜绝未来函数
    def next_bar(self, symbol):
        """下一根 K 线(只给撮合模块用,用来模拟“次日开盘成交”)。"""
        df = self.bars[symbol]
        pos = df.index.searchsorted(self.now, side="right")
        return df.iloc[pos] if pos < len(df) else None
class MACrossStrategy:
    """双均线:短均线 > 长均线 → 目标仓位 = 1/股票数,否则 0。只在信号变化时发 SignalEvent。"""
    def __init__(self, data, events, symbols, fast=10, slow=40):
        self.data, self.events, self.symbols = data, events, symbols
        self.fast, self.slow = fast, slow
        self.state = {s: 0.0 for s in symbols}
    def on_market(self, ev):
        for s in self.symbols:
            closes = self.data.history(s, "close", self.slow)
            if len(closes) < self.slow:              # 数据不够计算长均线,先不动
                continue
            want = 1.0 / len(self.symbols) if closes.iloc[-self.fast:].mean() > closes.mean() else 0.0
            if want != self.state[s]:
                self.state[s] = want
                self.events.append(SignalEvent(ev.date, s, want))
class Portfolio:
    """记账:现金、持仓、每日净值;把“目标仓位”翻译成“股数”(A 股按 100 股一手取整)。"""
    def __init__(self, data, events, cash=1_000_000):
        self.data, self.events = data, events
        self.cash, self.pos = cash, {}
        self.equity_curve, self.trades = [], []
    def total_value(self):
        mv = sum(q * self.data.history(s, "close", 1).iloc[-1] for s, q in self.pos.items())
        return self.cash + mv
    def on_signal(self, ev):
        price = self.data.history(ev.symbol, "close", 1).iloc[-1]       # 用今天收盘价估算股数
        target_qty = int(self.total_value() * ev.target / price // 100 * 100)
        qty = target_qty - self.pos.get(ev.symbol, 0)
        if qty != 0:
            self.events.append(OrderEvent(ev.date, ev.symbol, qty))
    def on_fill(self, ev):
        self.pos[ev.symbol] = self.pos.get(ev.symbol, 0) + ev.qty
        self.cash -= ev.qty * ev.price + ev.cost                         # 买入花钱、卖出收钱,成本总是扣
        self.trades.append(ev)
    def mark_to_market(self):
        self.equity_curve.append((self.data.now, self.total_value()))
class SimExecution:
    """模拟撮合:次日开盘价成交 + 滑点;佣金(有最低 5 元)+ 卖出印花税;涨跌停/停牌不能成交。
    费率为示意参数,请按你券商和交易所的实际规则修改。"""
    def __init__(self, data, events, slippage_bps=5, commission=0.00025, min_comm=5.0,
                 stamp_tax=0.0005, limit=0.10):
        self.data, self.events = data, events
        self.slip, self.comm, self.min_comm = slippage_bps / 1e4, commission, min_comm
        self.tax, self.limit = stamp_tax, limit
        self.rejected = 0
    def on_order(self, ev):
        bar = self.data.next_bar(ev.symbol)
        if bar is None or bar["volume"] <= 0:                           # 没有下一根或停牌
            self.rejected += 1; return
        up, down = bar["pre_close"] * (1 + self.limit), bar["pre_close"] * (1 - self.limit)
        if (ev.qty > 0 and bar["open"] >= up - 1e-9) or (ev.qty < 0 and bar["open"] <= down + 1e-9):
            self.rejected += 1; return                                  # 开盘涨停买不进 / 跌停卖不出
        px = bar["open"] * (1 + self.slip * np.sign(ev.qty))            # 滑点总是对自己不利
        notional = abs(ev.qty) * px
        cost = max(notional * self.comm, self.min_comm) + (notional * self.tax if ev.qty < 0 else 0)
        self.events.append(FillEvent(bar.name, ev.symbol, ev.qty, px, cost))
def run_backtest(bars, **exec_kw):
    events = deque()
    data = DataHandler(bars)
    strat = MACrossStrategy(data, events, list(bars))
    port = Portfolio(data, events)
    exe = SimExecution(data, events, **exec_kw)
    while data.update():                         # 外层循环:时间前进一天
        events.append(MarketEvent(data.now))
        while events:                            # 内层循环:把今天产生的事件处理完
            ev = events.popleft()
            if isinstance(ev, MarketEvent):  strat.on_market(ev)
            elif isinstance(ev, SignalEvent): port.on_signal(ev)
            elif isinstance(ev, OrderEvent):  exe.on_order(ev)
            elif isinstance(ev, FillEvent):   port.on_fill(ev)
        port.mark_to_market()                    # 收盘后记录净值
    eq = pd.Series(dict(port.equity_curve))
    return eq, port, exe

def summary(eq):
    r = eq.pct_change().dropna()
    dd = eq / eq.cummax() - 1
    return {"总收益": f"{eq.iloc[-1]/eq.iloc[0]-1:.2%}",
            "年化波动": f"{r.std()*np.sqrt(252):.2%}",
            "夏普": f"{r.mean()/r.std()*np.sqrt(252):.2f}",
            "最大回撤": f"{dd.min():.2%}"}
def make_bars(seed, n=750, mu=0.0003, sigma=0.02, p_suspend=0.01, limit=0.10):
    """模拟日 K 线(open/close/pre_close/volume):涨跌幅截断在 ±10%,约 1% 的交易日停牌。
    纯教学用模拟数据,不对应任何真实股票。"""
    rng = np.random.default_rng(seed)
    idx = pd.bdate_range("2021-01-04", periods=n)
    rows, prev = [], 20.0
    for t in range(n):
        if rng.random() < p_suspend:                                   # 停牌:无成交,价格不变
            rows.append((prev, prev, prev, 0)); continue
        close = prev * np.exp(mu + sigma * rng.standard_normal())
        close = min(max(close, prev * (1 - limit)), prev * (1 + limit))   # 涨跌停截断
        opn = min(max(prev * (1 + 0.005 * rng.standard_normal()), prev * (1 - limit)), prev * (1 + limit))
        rows.append((opn, close, prev, int(rng.integers(100_000, 1_000_000))))
        prev = close
    return pd.DataFrame(rows, columns=["open", "close", "pre_close", "volume"], index=idx)

if __name__ == "__main__":
    bars = {f"S{i}": make_bars(seed=100 + i) for i in range(3)}
    for name, kw in [("无成本", dict(slippage_bps=0, commission=0, min_comm=0, stamp_tax=0)),
                     ("默认成本", {}),
                     ("高滑点 30bp", dict(slippage_bps=30))]:
        eq, port, exe = run_backtest(bars, **kw)
        fees = sum(f.cost for f in port.trades)                  # 显式费用:佣金 + 印花税(滑点已含在成交价里)
        print(f"{name:10s}", summary(eq), f"成交={len(port.trades)} 拒单={exe.rejected} 佣金+税={fees:,.0f} 元")

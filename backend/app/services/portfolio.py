"""组合回测：多只基金按权重定投"""
from datetime import date, timedelta
from collections import defaultdict
from sqlalchemy.orm import Session
from app.models import FundNav, FundKline, FundInfo
from app.services.data_fetcher import detect_fund_type


def backtest_portfolio_dca(
    holdings: list[dict],  # [{"fund_code": "510300", "weight": 0.5}, ...]
    db: Session,
    period: str = "monthly",
    total_amount: float = 1000.0,
    days: int = 730,
) -> dict:
    """组合定投回测

    每次定投按权重分配到各基金，计算组合整体收益
    """
    # 收集每只基金的价格序列
    fund_data = {}
    for h in holdings:
        code = h["fund_code"]
        weight = h["weight"]
        fund_type = detect_fund_type(code)
        cutoff = date.today() - timedelta(days=days)

        if fund_type == "ETF":
            records = db.query(FundKline).filter(
                FundKline.fund_code == code,
                FundKline.trade_date >= cutoff,
            ).order_by(FundKline.trade_date).all()
            prices = {r.trade_date: r.close for r in records}
            # ETF没有K线数据时，回退到净值
            if not prices:
                records = db.query(FundNav).filter(
                    FundNav.fund_code == code,
                    FundNav.nav_date >= cutoff,
                ).order_by(FundNav.nav_date).all()
                prices = {r.nav_date: r.nav for r in records}
        else:
            records = db.query(FundNav).filter(
                FundNav.fund_code == code,
                FundNav.nav_date >= cutoff,
            ).order_by(FundNav.nav_date).all()
            prices = {r.nav_date: r.nav for r in records}

        if not prices:
            return {"error": f"基金 {code} 无数据，请先拉取"}

        # 获取基金名称
        fund_info = db.query(FundInfo).filter(FundInfo.fund_code == code).first()
        fund_name = fund_info.fund_name if fund_info else code

        fund_data[code] = {
            "prices": prices,
            "weight": weight,
            "fund_type": fund_type,
            "fund_name": fund_name,
            "shares": 0.0,
            "cost": 0.0,
        }

    # 合并所有交易日期
    all_dates = set()
    for fd in fund_data.values():
        all_dates.update(fd["prices"].keys())
    all_dates = sorted(all_dates)

    if not all_dates:
        return {"error": "无可用交易日期"}

    # 按定投周期筛选买入日
    invest_dates = _get_portfolio_invest_dates(all_dates, period)

    # 模拟组合定投
    portfolio_records = []
    total_cost = 0.0

    for invest_date in invest_dates:
        day_cost = 0.0
        day_value = 0.0
        day_detail = {}

        for code, fd in fund_data.items():
            # 找最近有价格的日期
            price = _find_nearest_price(fd["prices"], invest_date)
            if price and price > 0:
                amount = total_amount * fd["weight"]
                shares = amount / price
                fd["shares"] += shares
                fd["cost"] += amount
                day_cost += amount
                day_detail[code] = {
                    "price": price,
                    "amount": round(amount, 2),
                    "shares": round(shares, 4),
                }

        total_cost += day_cost

        # 计算当日组合市值
        for code, fd in fund_data.items():
            price = _find_nearest_price(fd["prices"], invest_date)
            if price:
                day_value += fd["shares"] * price

        portfolio_records.append({
            "date": invest_date.isoformat(),
            "total_cost": round(total_cost, 2),
            "portfolio_value": round(day_value, 2),
            "detail": day_detail,
        })

    if total_cost == 0:
        return {"error": "未能执行任何定投"}

    # 最终市值
    last_date = all_dates[-1]
    final_value = 0.0
    for code, fd in fund_data.items():
        price = _find_nearest_price(fd["prices"], last_date)
        if price:
            final_value += fd["shares"] * price

    # 收益计算
    total_return = (final_value - total_cost) / total_cost * 100
    first_date = portfolio_records[0]["date"]
    last_invest_date = portfolio_records[-1]["date"]
    years = (date.fromisoformat(last_invest_date) - date.fromisoformat(first_date)).days / 365.25
    annual_return = ((final_value / total_cost) ** (1 / years) - 1) * 100 if years > 0 else 0

    # 最大回撤
    max_drawdown = _calc_portfolio_max_drawdown(portfolio_records)

    # 各基金持仓明细
    holdings_summary = []
    for code, fd in fund_data.items():
        last_price = _find_nearest_price(fd["prices"], last_date)
        market_value = fd["shares"] * last_price if last_price else 0
        holdings_summary.append({
            "fund_code": code,
            "fund_name": fd["fund_name"],
            "fund_type": fd["fund_type"],
            "weight": fd["weight"],
            "total_cost": round(fd["cost"], 2),
            "market_value": round(market_value, 2),
            "return_pct": round((market_value - fd["cost"]) / fd["cost"] * 100, 2) if fd["cost"] > 0 else 0,
        })

    return {
        "holdings": holdings_summary,
        "period": period,
        "total_amount_per_invest": total_amount,
        "invest_count": len(portfolio_records),
        "total_cost": round(total_cost, 2),
        "final_value": round(final_value, 2),
        "total_return_pct": round(total_return, 2),
        "annual_return_pct": round(annual_return, 2),
        "max_drawdown_pct": round(max_drawdown, 2),
        "portfolio_records": portfolio_records,
    }


def _get_portfolio_invest_dates(all_dates: list, period: str) -> list:
    """筛选定投日期"""
    result = []
    last_invest_month = -1
    last_invest_week = -1

    for d in all_dates:
        if period == "daily":
            result.append(d)
        elif period == "monthly":
            if d.month != last_invest_month:
                result.append(d)
                last_invest_month = d.month
        elif period == "weekly":
            week_num = d.isocalendar()[1]
            if week_num != last_invest_week or d.year != (result[-1].year if result else 0):
                result.append(d)
                last_invest_week = week_num
        elif period == "biweekly":
            if not result:
                result.append(d)
            elif (d - result[-1]).days >= 14:
                result.append(d)

    return result


def _find_nearest_price(prices: dict, target_date) -> float | None:
    """找最近有价格的日期"""
    if target_date in prices:
        return prices[target_date]
    # 向前找
    for i in range(1, 10):
        d = target_date - timedelta(days=i)
        if d in prices:
            return prices[d]
    return None


def _calc_portfolio_max_drawdown(records: list) -> float:
    """计算组合最大回撤"""
    peak = 0.0
    max_dd = 0.0
    for r in records:
        val = r["portfolio_value"]
        if val > peak:
            peak = val
        dd = (peak - val) / peak * 100 if peak > 0 else 0
        if dd > max_dd:
            max_dd = dd
    return max_dd

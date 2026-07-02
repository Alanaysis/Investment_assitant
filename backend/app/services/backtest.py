from datetime import date, timedelta
from sqlalchemy.orm import Session
from app.models import FundNav, FundKline
from app.services.data_fetcher import detect_fund_type


def backtest_dca(
    fund_code: str,
    db: Session,
    period: str = "monthly",  # weekly / biweekly / monthly
    amount: float = 1000.0,
    days: int = 730,
) -> dict:
    """定投回测

    Args:
        fund_code: 基金代码
        db: 数据库会话
        period: 定投周期 weekly/biweekly/monthly
        amount: 每次定投金额
        days: 回测天数

    Returns:
        回测结果字典
    """
    fund_type = detect_fund_type(fund_code)
    cutoff = date.today() - timedelta(days=days)

    if fund_type == "ETF":
        records = db.query(FundKline).filter(
            FundKline.fund_code == fund_code,
            FundKline.trade_date >= cutoff,
        ).order_by(FundKline.trade_date).all()
        price_field = "close"
        # ETF没有K线数据时，回退到净值
        if not records:
            records = db.query(FundNav).filter(
                FundNav.fund_code == fund_code,
                FundNav.nav_date >= cutoff,
            ).order_by(FundNav.nav_date).all()
            price_field = "nav"
    else:
        records = db.query(FundNav).filter(
            FundNav.fund_code == fund_code,
            FundNav.nav_date >= cutoff,
        ).order_by(FundNav.nav_date).all()
        price_field = "nav"

    if not records:
        return {"error": f"基金 {fund_code} 无数据，请先拉取数据"}

    # 按定投周期筛选买入日
    invest_dates = _get_invest_dates(records, period, price_field)

    # 模拟定投
    total_shares = 0.0
    total_cost = 0.0
    invest_records = []

    for invest_date, record in invest_dates:
        price = getattr(record, price_field)
        if price and price > 0:
            shares = amount / price
            total_shares += shares
            total_cost += amount
            invest_records.append({
                "date": invest_date.isoformat(),
                "price": price,
                "shares": round(shares, 4),
                "total_cost": total_cost,
            })

    if total_cost == 0:
        return {"error": "未能执行任何定投"}

    # 最终市值
    last_record = records[-1]
    last_price = getattr(last_record, price_field)
    final_value = total_shares * last_price

    # 收益计算
    total_return = (final_value - total_cost) / total_cost * 100
    # 年化收益
    first_date = invest_records[0]["date"]
    last_date = invest_records[-1]["date"]
    years = (date.fromisoformat(last_date) - date.fromisoformat(first_date)).days / 365.25
    annual_return = ((final_value / total_cost) ** (1 / years) - 1) * 100 if years > 0 else 0

    # 最大回撤（基于累计市值曲线）
    max_drawdown = _calc_max_drawdown(invest_records, last_price, total_shares)

    return {
        "fund_code": fund_code,
        "fund_type": fund_type,
        "period": period,
        "amount_per_invest": amount,
        "invest_count": len(invest_records),
        "total_cost": round(total_cost, 2),
        "final_value": round(final_value, 2),
        "total_return_pct": round(total_return, 2),
        "annual_return_pct": round(annual_return, 2),
        "max_drawdown_pct": round(max_drawdown, 2),
        "invest_records": invest_records,
    }


def _get_invest_dates(records, period: str, price_field: str) -> list:
    """根据定投周期筛选买入日期"""
    date_field = "trade_date" if price_field == "close" else "nav_date"
    result = []
    last_invest_month = -1
    last_invest_week = -1

    for record in records:
        d = getattr(record, date_field)

        if period == "daily":
            result.append((d, record))
        elif period == "monthly":
            if d.month != last_invest_month:
                result.append((d, record))
                last_invest_month = d.month
        elif period == "weekly":
            week_num = d.isocalendar()[1]
            if week_num != last_invest_week or d.year != (result[-1][0].year if result else 0):
                result.append((d, record))
                last_invest_week = week_num
        elif period == "biweekly":
            # 每两周投一次
            if len(result) == 0:
                result.append((d, record))
            else:
                prev_date = result[-1][0]
                if (d - prev_date).days >= 14:
                    result.append((d, record))

    return result


def _calc_max_drawdown(invest_records: list, last_price: float, total_shares: float) -> float:
    """计算定投过程中的最大回撤"""
    if not invest_records:
        return 0.0

    # 构建每个定投日的市值曲线
    cumulative_shares = 0.0
    peak_value = 0.0
    max_dd = 0.0

    for rec in invest_records:
        cumulative_shares += rec["shares"]
        current_value = cumulative_shares * rec["price"]
        if current_value > peak_value:
            peak_value = current_value
        dd = (peak_value - current_value) / peak_value * 100 if peak_value > 0 else 0
        if dd > max_dd:
            max_dd = dd

    return max_dd

import numpy as np
from datetime import date, timedelta
from sqlalchemy.orm import Session
from app.models import FundInfo, FundNav, FundKline


def _get_nav_series(fund_code: str, fund_type: str, db: Session, days: int = 730):
    """获取基金净值/收盘价序列，返回 (dates, prices)"""
    cutoff = date.today() - timedelta(days=days)

    if fund_type == "ETF":
        records = db.query(FundKline).filter(
            FundKline.fund_code == fund_code,
            FundKline.trade_date >= cutoff,
        ).order_by(FundKline.trade_date).all()
        # ETF没有K线数据时，回退到净值
        if not records:
            records = db.query(FundNav).filter(
                FundNav.fund_code == fund_code,
                FundNav.nav_date >= cutoff,
            ).order_by(FundNav.nav_date).all()
            return [r.nav_date for r in records], [r.nav for r in records]
        return [r.trade_date for r in records], [r.close for r in records]
    else:
        records = db.query(FundNav).filter(
            FundNav.fund_code == fund_code,
            FundNav.nav_date >= cutoff,
        ).order_by(FundNav.nav_date).all()
        return [r.nav_date for r in records], [r.nav for r in records]


def _calc_return_score(prices: list[float]) -> tuple[float, dict]:
    """计算收益维度得分，返回 (score, details)"""
    if len(prices) < 20:
        return 50.0, {"annual_return": None, "total_return": None}

    arr = np.array(prices, dtype=float)
    total_return = (arr[-1] / arr[0] - 1) * 100
    trading_days = len(arr)
    annual_return = ((arr[-1] / arr[0]) ** (252 / trading_days) - 1) * 100 if trading_days > 0 else 0

    # 近3月收益
    recent_3m = arr[-63:] if len(arr) >= 63 else arr
    return_3m = (recent_3m[-1] / recent_3m[0] - 1) * 100 if len(recent_3m) > 1 else 0

    # 近1月收益
    recent_1m = arr[-22:] if len(arr) >= 22 else arr
    return_1m = (recent_1m[-1] / recent_1m[0] - 1) * 100 if len(recent_1m) > 1 else 0

    # 归一化到0-100：年化收益 -30%→0, 30%→100
    score = np.clip((annual_return + 30) / 60 * 100, 0, 100)

    details = {
        "annual_return": round(annual_return, 2),
        "total_return": round(total_return, 2),
        "return_3m": round(return_3m, 2),
        "return_1m": round(return_1m, 2),
    }
    return round(float(score), 1), details


def _calc_risk_score(prices: list[float]) -> tuple[float, dict]:
    """计算风险维度得分，返回 (score, details)"""
    if len(prices) < 20:
        return 50.0, {"max_drawdown": None, "volatility": None, "sharpe": None}

    arr = np.array(prices, dtype=float)
    daily_returns = np.diff(arr) / arr[:-1]
    daily_returns = daily_returns[~np.isnan(daily_returns)]

    if len(daily_returns) < 10:
        return 50.0, {"max_drawdown": None, "volatility": None, "sharpe": None}

    # 波动率（年化）
    volatility = float(np.std(daily_returns) * np.sqrt(252) * 100)

    # 最大回撤
    cummax = np.maximum.accumulate(arr)
    drawdowns = (arr - cummax) / cummax * 100
    max_drawdown = float(np.min(drawdowns))

    # 年化收益（用于夏普）
    trading_days = len(arr)
    annual_return = (arr[-1] / arr[0]) ** (252 / trading_days) - 1 if arr[0] > 0 else 0

    # 夏普比率（无风险利率2%）
    sharpe = (annual_return - 0.02) / (volatility / 100) if volatility > 0 else 0

    # 归一化：
    # 波动率：5%→100, 40%→0
    vol_score = np.clip((40 - volatility) / 35 * 100, 0, 100)
    # 最大回撤：0%→100, -50%→0
    dd_score = np.clip((max_drawdown + 50) / 50 * 100, 0, 100)
    # 夏普：-1→0, 2→100
    sharpe_score = np.clip((sharpe + 1) / 3 * 100, 0, 100)

    score = vol_score * 0.3 + dd_score * 0.4 + sharpe_score * 0.3

    details = {
        "max_drawdown": round(max_drawdown, 2),
        "volatility": round(volatility, 2),
        "sharpe": round(float(sharpe), 2),
    }
    return round(float(score), 1), details


def _calc_basic_score(fund: FundInfo) -> tuple[float, dict]:
    """计算基本面维度得分"""
    score = 50.0
    details = {
        "fund_scale": fund.fund_scale,
        "fee_rate": fund.fee_rate,
        "manager_name": fund.manager_name,
    }

    # 规模评分：50-200亿最佳
    if fund.fund_scale:
        if 50 <= fund.fund_scale <= 200:
            scale_score = 90
        elif 20 <= fund.fund_scale < 50 or 200 < fund.fund_scale <= 500:
            scale_score = 70
        elif 5 <= fund.fund_scale < 20:
            scale_score = 55
        else:
            scale_score = 35
        score = score * 0.4 + scale_score * 0.6

    # 费率评分：越低越好
    if fund.fee_rate is not None:
        if fund.fee_rate <= 0.5:
            fee_score = 90
        elif fund.fee_rate <= 1.0:
            fee_score = 75
        elif fund.fee_rate <= 1.5:
            fee_score = 55
        else:
            fee_score = 35
        score = score * 0.5 + fee_score * 0.5

    return round(score, 1), details


def score_fund(fund: FundInfo, db: Session) -> dict:
    """对单只基金进行综合评分"""
    fund_type = fund.fund_type or "场外基金"

    # 获取价格序列
    _, prices = _get_nav_series(fund.fund_code, fund_type, db)

    # 计算各维度得分
    return_score, return_details = _calc_return_score(prices)
    risk_score, risk_details = _calc_risk_score(prices)
    basic_score, basic_details = _calc_basic_score(fund)

    # 加权综合评分
    total_score = round(return_score * 0.4 + risk_score * 0.35 + basic_score * 0.25, 1)

    return {
        "fund_code": fund.fund_code,
        "fund_name": fund.fund_name,
        "fund_type": fund_type,
        "total_score": total_score,
        "return_score": return_score,
        "risk_score": risk_score,
        "basic_score": basic_score,
        "return_details": return_details,
        "risk_details": risk_details,
        "basic_details": basic_details,
    }


def score_all_funds(db: Session) -> list[dict]:
    """对所有基金评分并排名"""
    funds = db.query(FundInfo).all()
    results = []
    for fund in funds:
        try:
            result = score_fund(fund, db)
            results.append(result)
        except Exception:
            # 跳过评分失败的基金
            results.append({
                "fund_code": fund.fund_code,
                "fund_name": fund.fund_name,
                "fund_type": fund.fund_type or "未知",
                "total_score": 0,
                "return_score": 0,
                "risk_score": 0,
                "basic_score": 0,
                "return_details": {},
                "risk_details": {},
                "basic_details": {},
            })
    results.sort(key=lambda x: x["total_score"], reverse=True)
    return results

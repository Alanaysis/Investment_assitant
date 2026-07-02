from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.database import get_db
from app.services.portfolio import backtest_portfolio_dca

router = APIRouter(prefix="/portfolio", tags=["组合"])


class HoldingItem(BaseModel):
    fund_code: str
    weight: float  # 0-1 之间，所有权重之和应为1


class PortfolioBacktestRequest(BaseModel):
    holdings: list[HoldingItem]
    period: str = "monthly"  # daily / weekly / biweekly / monthly
    total_amount: float = 1000.0
    days: int = 730


@router.post("/backtest")
def run_portfolio_backtest(req: PortfolioBacktestRequest, db: Session = Depends(get_db)):
    """组合定投回测"""
    holdings = [{"fund_code": h.fund_code, "weight": h.weight} for h in req.holdings]

    # 校验权重
    total_weight = sum(h.weight for h in req.holdings)
    if abs(total_weight - 1.0) > 0.01:
        return {"error": f"权重之和应为1.0，当前为 {round(total_weight, 2)}"}

    result = backtest_portfolio_dca(
        holdings=holdings,
        db=db,
        period=req.period,
        total_amount=req.total_amount,
        days=req.days,
    )
    return result

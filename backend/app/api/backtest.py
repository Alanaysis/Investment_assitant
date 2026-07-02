from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.database import get_db
from app.services.backtest import backtest_dca

router = APIRouter(prefix="/backtest", tags=["回测"])


class BacktestRequest(BaseModel):
    fund_code: str
    period: str = "monthly"  # weekly / biweekly / monthly
    amount: float = 1000.0
    days: int = 730


@router.post("/dca")
def run_dca_backtest(req: BacktestRequest, db: Session = Depends(get_db)):
    """执行定投回测"""
    result = backtest_dca(
        fund_code=req.fund_code,
        db=db,
        period=req.period,
        amount=req.amount,
        days=req.days,
    )
    return result

from pydantic import BaseModel
from datetime import date
from typing import Optional


class FundInfoResponse(BaseModel):
    fund_code: str
    fund_name: str
    fund_type: Optional[str] = None
    establish_date: Optional[date] = None
    manager_name: Optional[str] = None
    fund_scale: Optional[float] = None
    fee_rate: Optional[float] = None

    model_config = {"from_attributes": True}


class FundNavResponse(BaseModel):
    fund_code: str
    nav_date: date
    nav: Optional[float] = None
    acc_nav: Optional[float] = None
    nav_change: Optional[float] = None

    model_config = {"from_attributes": True}


class FundKlineResponse(BaseModel):
    fund_code: str
    trade_date: date
    open: Optional[float] = None
    close: Optional[float] = None
    high: Optional[float] = None
    low: Optional[float] = None
    volume: Optional[float] = None
    turnover: Optional[float] = None

    model_config = {"from_attributes": True}


class FetchRequest(BaseModel):
    fund_code: str
    days: int = 730  # 默认拉取近2年

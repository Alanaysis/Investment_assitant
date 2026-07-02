from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import Optional
from pydantic import BaseModel
import time
from app.database import get_db
from app.models import FundInfo, FundNav, FundKline
from app.schemas import FundInfoResponse, FundNavResponse, FundKlineResponse, FetchRequest
from app.services.data_fetcher import fetch_fund_info, fetch_fund_nav, fetch_etf_kline, detect_fund_type

router = APIRouter(prefix="/funds", tags=["基金数据"])

# 预置热门基金列表
POPULAR_FUNDS = [
    # 宽基ETF
    {"code": "510300", "name": "沪深300ETF"},
    {"code": "510500", "name": "中证500ETF"},
    {"code": "159915", "name": "创业板ETF"},
    {"code": "588000", "name": "科创50ETF"},
    {"code": "512100", "name": "中证1000ETF"},
    # 行业/主题ETF
    {"code": "512690", "name": "白酒ETF"},
    {"code": "159995", "name": "芯片ETF"},
    {"code": "512170", "name": "医疗ETF"},
    {"code": "512660", "name": "军工ETF"},
    {"code": "515790", "name": "光伏ETF"},
    # 热门场外基金
    {"code": "110011", "name": "易方达优质精选混合"},
    {"code": "003834", "name": "华夏能源革新"},
    {"code": "161725", "name": "招商中证白酒"},
    {"code": "005827", "name": "易方达蓝筹精选"},
    {"code": "001938", "name": "中欧时代先锋"},
]


class BatchFetchRequest(BaseModel):
    fund_codes: list[str] = []
    use_popular: bool = False
    days: int = 730


@router.get("/list")
def list_funds(fund_type: Optional[str] = None, db: Session = Depends(get_db)):
    """获取基金列表，附带数据条数"""
    query = db.query(FundInfo)
    if fund_type:
        query = query.filter(FundInfo.fund_type == fund_type)
    funds = query.all()
    result = []
    for f in funds:
        nav_count = db.query(FundNav).filter(FundNav.fund_code == f.fund_code).count()
        kline_count = db.query(FundKline).filter(FundKline.fund_code == f.fund_code).count()
        data_count = nav_count + kline_count
        result.append({
            "fund_code": f.fund_code,
            "fund_name": f.fund_name,
            "fund_type": f.fund_type,
            "establish_date": f.establish_date,
            "manager_name": f.manager_name,
            "fund_scale": f.fund_scale,
            "fee_rate": f.fee_rate,
            "data_count": data_count,
        })
    return result


@router.get("/{fund_code}/info", response_model=FundInfoResponse)
def get_fund_info(fund_code: str, db: Session = Depends(get_db)):
    """获取基金基本信息"""
    fund = db.query(FundInfo).filter(FundInfo.fund_code == fund_code).first()
    if not fund:
        # 自动从线上拉取
        fund = fetch_fund_info(fund_code, db)
    return fund


@router.get("/{fund_code}/nav", response_model=list[FundNavResponse])
def get_fund_nav(fund_code: str, days: int = 730, db: Session = Depends(get_db)):
    """获取场外基金净值数据"""
    cutoff = __import__("datetime").date.today() - __import__("datetime").timedelta(days=days)
    records = db.query(FundNav).filter(
        FundNav.fund_code == fund_code,
        FundNav.nav_date >= cutoff,
    ).order_by(FundNav.nav_date).all()
    return records


@router.get("/{fund_code}/kline", response_model=list[FundKlineResponse])
def get_fund_kline(fund_code: str, days: int = 730, db: Session = Depends(get_db)):
    """获取ETF K线数据"""
    cutoff = __import__("datetime").date.today() - __import__("datetime").timedelta(days=days)
    records = db.query(FundKline).filter(
        FundKline.fund_code == fund_code,
        FundKline.trade_date >= cutoff,
    ).order_by(FundKline.trade_date).all()
    return records


@router.post("/fetch")
def fetch_fund_data(req: FetchRequest, db: Session = Depends(get_db)):
    """拉取基金数据（基本信息 + 净值/K线）"""
    fund_type = detect_fund_type(req.fund_code)

    # 拉取基本信息
    fund_info = fetch_fund_info(req.fund_code, db)

    # 拉取行情数据
    if fund_type == "ETF":
        count = fetch_etf_kline(req.fund_code, req.days, db)
        return {
            "fund_code": req.fund_code,
            "fund_type": fund_type,
            "fund_name": fund_info.fund_name,
            "records_fetched": count,
            "message": f"成功拉取 {count} 条ETF K线数据",
        }
    else:
        count = fetch_fund_nav(req.fund_code, req.days, db)
        return {
            "fund_code": req.fund_code,
            "fund_type": fund_type,
            "fund_name": fund_info.fund_name,
            "records_fetched": count,
            "message": f"成功拉取 {count} 条净值数据",
        }


@router.get("/popular")
def get_popular_funds():
    """获取预置热门基金列表"""
    return POPULAR_FUNDS


@router.post("/batch-fetch")
def batch_fetch_funds(req: BatchFetchRequest, db: Session = Depends(get_db)):
    """批量拉取基金数据"""
    codes = list(req.fund_codes)
    if req.use_popular:
        codes.extend([f["code"] for f in POPULAR_FUNDS])
    codes = list(dict.fromkeys(codes))  # 去重保序

    results = []
    for code in codes:
        try:
            fund_type = detect_fund_type(code)
            fund_info = fetch_fund_info(code, db)
            if fund_type == "ETF":
                count = fetch_etf_kline(code, req.days, db)
            else:
                count = fetch_fund_nav(code, req.days, db)
            results.append({
                "fund_code": code,
                "fund_name": fund_info.fund_name,
                "fund_type": fund_type,
                "records_fetched": count,
                "status": "success",
            })
        except Exception as e:
            results.append({
                "fund_code": code,
                "fund_name": code,
                "fund_type": "未知",
                "records_fetched": 0,
                "status": f"失败: {str(e)[:80]}",
            })
        # 每只基金之间间隔2秒，避免被限流
        time.sleep(2)

    success = sum(1 for r in results if r["status"] == "success")
    return {
        "total": len(results),
        "success": success,
        "failed": len(results) - success,
        "results": results,
    }

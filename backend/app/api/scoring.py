from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import Optional
from app.database import get_db
from app.models import FundInfo
from app.services.scoring import score_fund, score_all_funds

router = APIRouter(prefix="/scoring", tags=["评分"])


@router.get("/rank")
def get_scoring_rank(
    fund_type: Optional[str] = None,
    min_score: Optional[float] = None,
    max_score: Optional[float] = None,
    sort_by: Optional[str] = None,  # total_score / return_score / risk_score / basic_score
    sort_order: Optional[str] = "desc",  # desc / asc
    db: Session = Depends(get_db),
):
    """获取综合评分排名，支持多维度筛选和排序"""
    results = score_all_funds(db)

    # 按类型筛选
    if fund_type:
        results = [r for r in results if r["fund_type"] == fund_type]

    # 按分数范围筛选
    if min_score is not None:
        results = [r for r in results if r["total_score"] >= min_score]
    if max_score is not None:
        results = [r for r in results if r["total_score"] <= max_score]

    # 排序
    sort_field = sort_by or "total_score"
    if sort_field not in ("total_score", "return_score", "risk_score", "basic_score"):
        sort_field = "total_score"
    results.sort(key=lambda x: x.get(sort_field, 0), reverse=(sort_order != "asc"))

    # 添加排名
    for i, r in enumerate(results):
        r["rank"] = i + 1
    return results


@router.get("/{fund_code}/detail")
def get_fund_score_detail(fund_code: str, db: Session = Depends(get_db)):
    """获取单只基金评分详情"""
    fund = db.query(FundInfo).filter(FundInfo.fund_code == fund_code).first()
    if not fund:
        return {"error": f"基金 {fund_code} 不存在"}
    return score_fund(fund, db)

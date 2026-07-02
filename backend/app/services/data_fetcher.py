import akshare as ak
import pandas as pd
import time
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from app.models import FundInfo, FundNav, FundKline


def _save_fund_info(fund_code: str, fund_name: str, fund_type: str,
                    establish_date, manager_name, fund_scale, fee_rate, db: Session) -> FundInfo:
    """保存或更新基金基本信息"""
    existing = db.query(FundInfo).filter(FundInfo.fund_code == fund_code).first()
    if existing:
        existing.fund_name = fund_name
        existing.fund_type = fund_type
        existing.establish_date = establish_date
        existing.manager_name = manager_name
        existing.fund_scale = fund_scale
        existing.fee_rate = fee_rate
        db.commit()
        return existing
    else:
        fund_info = FundInfo(
            fund_code=fund_code,
            fund_name=fund_name,
            fund_type=fund_type,
            establish_date=establish_date,
            manager_name=manager_name,
            fund_scale=fund_scale,
            fee_rate=fee_rate,
        )
        db.add(fund_info)
        db.commit()
        return fund_info


def _parse_optional_float(value, suffix=""):
    """解析可选浮点数"""
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        try:
            return float(value.replace(suffix, "").strip())
        except (ValueError, AttributeError):
            return None
    return None


def _parse_optional_date(value):
    """解析可选日期"""
    if value is None:
        return None
    if isinstance(value, (datetime, pd.Timestamp)):
        return value.date() if hasattr(value, 'date') else value
    if isinstance(value, str):
        try:
            return datetime.strptime(value, "%Y-%m-%d").date()
        except ValueError:
            return None
    return None


def fetch_fund_info(fund_code: str, db: Session) -> FundInfo:
    """拉取基金基本信息，自动区分场外/ETF"""
    fund_type = detect_fund_type(fund_code)

    try:
        if fund_type == "ETF":
            return _fetch_etf_info(fund_code, db)
        else:
            return _fetch_open_fund_info(fund_code, db)
    except Exception as e:
        db.rollback()
        # 回退：只保存代码和类型
        existing = db.query(FundInfo).filter(FundInfo.fund_code == fund_code).first()
        if existing:
            return existing
        fund_info = FundInfo(fund_code=fund_code, fund_name=fund_code, fund_type=fund_type)
        db.add(fund_info)
        db.commit()
        return fund_info


def _fetch_open_fund_info(fund_code: str, db: Session) -> FundInfo:
    """拉取场外基金基本信息"""
    df = ak.fund_individual_basic_info_xq(symbol=fund_code)
    info_dict = dict(zip(df["item"], df["value"]))
    fund_name = info_dict.get("基金简称", info_dict.get("基金名称", fund_code))
    fund_type = info_dict.get("基金类型", "场外基金")
    establish_date = _parse_optional_date(info_dict.get("成立日期"))
    manager_name = info_dict.get("基金经理")
    fund_scale = _parse_optional_float(info_dict.get("基金规模"), "亿元")
    fee_rate = _parse_optional_float(info_dict.get("管理费率"), "%")
    return _save_fund_info(fund_code, fund_name, fund_type,
                           establish_date, manager_name, fund_scale, fee_rate, db)


def _fetch_etf_info(fund_code: str, db: Session) -> FundInfo:
    """拉取ETF基本信息"""
    df = ak.fund_etf_spot_em()
    row = df[df["代码"] == fund_code]
    if row.empty:
        return _save_fund_info(fund_code, fund_code, "ETF", None, None, None, None, db)
    row = row.iloc[0]
    fund_name = row.get("名称", fund_code)
    fund_scale = _parse_optional_float(row.get("规模"), "亿")
    return _save_fund_info(fund_code, fund_name, "ETF", None, None, fund_scale, None, db)


def fetch_fund_nav(fund_code: str, days: int, db: Session) -> int:
    """拉取场外基金净值数据，返回新增记录数"""
    try:
        end_date = datetime.now().strftime("%Y%m%d")
        start_date = (datetime.now() - timedelta(days=days)).strftime("%Y%m%d")

        df = ak.fund_open_fund_info_em(symbol=fund_code, indicator="单位净值走势")
        df = df.rename(columns={
            "净值日期": "nav_date",
            "单位净值": "nav",
            "日增长率": "nav_change",
        })
        df["fund_code"] = fund_code
        df["nav_date"] = pd.to_datetime(df["nav_date"])

        # 过滤日期范围
        cutoff = datetime.now() - timedelta(days=days)
        df = df[df["nav_date"] >= cutoff]

        # 拉取累计净值
        try:
            df_acc = ak.fund_open_fund_info_em(symbol=fund_code, indicator="累计净值走势")
            df_acc = df_acc.rename(columns={"累计净值": "acc_nav"})
            df_acc["nav_date"] = pd.to_datetime(df_acc["净值日期"])
            df_acc = df_acc[["nav_date", "acc_nav"]]
            df = df.merge(df_acc, on="nav_date", how="left")
        except Exception:
            df["acc_nav"] = None

        count = 0
        for _, row in df.iterrows():
            exists = db.query(FundNav).filter(
                FundNav.fund_code == fund_code,
                FundNav.nav_date == row["nav_date"].date(),
            ).first()
            if not exists:
                db.add(FundNav(
                    fund_code=fund_code,
                    nav_date=row["nav_date"].date(),
                    nav=row.get("nav"),
                    acc_nav=row.get("acc_nav"),
                    nav_change=row.get("nav_change"),
                ))
                count += 1

        db.commit()
        return count
    except Exception as e:
        db.rollback()
        raise RuntimeError(f"拉取基金 {fund_code} 净值数据失败: {e}")


def fetch_etf_kline(fund_code: str, days: int, db: Session) -> int:
    """拉取ETF数据：优先用K线接口，失败则回退到净值接口"""
    max_retries = 3
    for attempt in range(max_retries):
        try:
            end_date = datetime.now().strftime("%Y%m%d")
            start_date = (datetime.now() - timedelta(days=days)).strftime("%Y%m%d")

            df = ak.fund_etf_hist_em(symbol=fund_code, period="daily",
                                      start_date=start_date, end_date=end_date, adjust="qfq")
            df = df.rename(columns={
                "日期": "trade_date",
                "开盘": "open",
                "收盘": "close",
                "最高": "high",
                "最低": "low",
                "成交量": "volume",
                "成交额": "turnover",
            })
            df["fund_code"] = fund_code
            df["trade_date"] = pd.to_datetime(df["trade_date"])

            count = 0
            for _, row in df.iterrows():
                exists = db.query(FundKline).filter(
                    FundKline.fund_code == fund_code,
                    FundKline.trade_date == row["trade_date"].date(),
                ).first()
                if not exists:
                    db.add(FundKline(
                        fund_code=fund_code,
                        trade_date=row["trade_date"].date(),
                        open=row.get("open"),
                        close=row.get("close"),
                        high=row.get("high"),
                        low=row.get("low"),
                        volume=row.get("volume"),
                        turnover=row.get("turnover"),
                    ))
                    count += 1

            db.commit()
            return count
        except Exception as e:
            db.rollback()
            if attempt < max_retries - 1:
                wait = (attempt + 1) * 3
                time.sleep(wait)
            else:
                # K线接口失败，回退到净值接口
                try:
                    return _fetch_etf_via_nav(fund_code, days, db)
                except Exception as e2:
                    raise RuntimeError(f"拉取ETF {fund_code} 数据失败(K线重试{max_retries}次，净值回退也失败): {e}; {e2}")


def _fetch_etf_via_nav(fund_code: str, days: int, db: Session) -> int:
    """ETF回退方案：用场外净值接口拉取ETF的净值数据"""
    df = ak.fund_open_fund_info_em(symbol=fund_code, indicator="单位净值走势")
    df = df.rename(columns={
        "净值日期": "nav_date",
        "单位净值": "nav",
        "日增长率": "nav_change",
    })
    df["fund_code"] = fund_code
    df["nav_date"] = pd.to_datetime(df["nav_date"])

    cutoff = datetime.now() - timedelta(days=days)
    df = df[df["nav_date"] >= cutoff]

    count = 0
    for _, row in df.iterrows():
        exists = db.query(FundNav).filter(
            FundNav.fund_code == fund_code,
            FundNav.nav_date == row["nav_date"].date(),
        ).first()
        if not exists:
            db.add(FundNav(
                fund_code=fund_code,
                nav_date=row["nav_date"].date(),
                nav=row.get("nav"),
                acc_nav=None,
                nav_change=row.get("nav_change"),
            ))
            count += 1

    db.commit()
    return count


def detect_fund_type(fund_code: str) -> str:
    """判断基金类型：
    - 51/56/58开头：上交所ETF
    - 15开头：深交所ETF
    - 16开头：LOF（上市开放式基金），按场外处理
    - 其余：场外基金
    """
    prefix2 = fund_code[:2]
    if prefix2 in ("51", "56", "58"):
        return "ETF"
    if prefix2 == "15":
        return "ETF"
    # 16开头是LOF，用场外基金接口
    return "场外基金"

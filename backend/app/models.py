from sqlalchemy import Column, Integer, String, Float, Date, DateTime, Index
from sqlalchemy.sql import func
from app.database import Base


class FundInfo(Base):
    """基金基本信息"""
    __tablename__ = "fund_info"

    id = Column(Integer, primary_key=True, autoincrement=True)
    fund_code = Column(String(10), unique=True, nullable=False, index=True)
    fund_name = Column(String(100), nullable=False)
    fund_type = Column(String(20))  # 场外基金 / ETF
    establish_date = Column(Date)
    manager_name = Column(String(50))
    fund_scale = Column(Float)  # 亿元
    fee_rate = Column(Float)  # 管理费率 %
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class FundNav(Base):
    """基金净值数据（场外基金）"""
    __tablename__ = "fund_nav"

    id = Column(Integer, primary_key=True, autoincrement=True)
    fund_code = Column(String(10), nullable=False)
    nav_date = Column(Date, nullable=False)
    nav = Column(Float)  # 单位净值
    acc_nav = Column(Float)  # 累计净值
    nav_change = Column(Float)  # 日涨跌幅 %

    __table_args__ = (
        Index("idx_fund_nav_code_date", "fund_code", "nav_date", unique=True),
    )


class FundKline(Base):
    """基金K线数据（ETF场内）"""
    __tablename__ = "fund_kline"

    id = Column(Integer, primary_key=True, autoincrement=True)
    fund_code = Column(String(10), nullable=False)
    trade_date = Column(Date, nullable=False)
    open = Column(Float)
    close = Column(Float)
    high = Column(Float)
    low = Column(Float)
    volume = Column(Float)  # 成交量
    turnover = Column(Float)  # 成交额

    __table_args__ = (
        Index("idx_fund_kline_code_date", "fund_code", "trade_date", unique=True),
    )

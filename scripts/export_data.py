#!/usr/bin/env python3
"""导出基金数据为静态 JSON 文件，用于 GitHub Pages 部署。

读取 SQLite 数据库中的基金数据，生成以下文件：
- public/data/funds.json         所有基金基本信息（含 data_count）
- public/data/popular.json       预置热门基金列表
- public/data/{fund_code}.json   每只基金的净值/K线明细数据
"""

import argparse
import json
import os
import sqlite3
import sys
from pathlib import Path

# 预置热门基金列表（与 backend/app/api/funds.py 中的 POPULAR_FUNDS 保持一致）
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


def default_db_path() -> Path:
    """默认数据库路径：相对脚本位置 ../backend/fund_data.db"""
    return Path(__file__).resolve().parent.parent / "backend" / "fund_data.db"


def default_output_dir() -> Path:
    """默认输出目录：相对脚本位置 ../frontend/public/data"""
    return Path(__file__).resolve().parent.parent / "frontend" / "public" / "data"


def connect_db(db_path: Path) -> sqlite3.Connection:
    if not db_path.exists():
        sys.exit(f"数据库文件不存在: {db_path}")
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn


def export_funds_json(conn: sqlite3.Connection, out_dir: Path) -> int:
    """导出 funds.json：所有基金基本信息（含 data_count）。"""
    rows = conn.execute(
        """
        SELECT
            fi.fund_code,
            fi.fund_name,
            fi.fund_type,
            fi.establish_date,
            fi.manager_name,
            fi.fund_scale,
            fi.fee_rate,
            (
                SELECT COUNT(*) FROM fund_nav fn WHERE fn.fund_code = fi.fund_code
            ) + (
                SELECT COUNT(*) FROM fund_kline fk WHERE fk.fund_code = fi.fund_code
            ) AS data_count
        FROM fund_info fi
        ORDER BY fi.fund_code
        """
    ).fetchall()

    funds = []
    for r in rows:
        funds.append({
            "fund_code": r["fund_code"],
            "fund_name": r["fund_name"],
            "fund_type": r["fund_type"],
            "establish_date": r["establish_date"],
            "manager_name": r["manager_name"],
            "fund_scale": r["fund_scale"],
            "fee_rate": r["fee_rate"],
            "data_count": r["data_count"],
        })

    out_path = out_dir / "funds.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(funds, f, ensure_ascii=False, indent=2)
    return len(funds)


def export_popular_json(out_dir: Path) -> int:
    """导出 popular.json：预置热门基金列表。"""
    out_path = out_dir / "popular.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(POPULAR_FUNDS, f, ensure_ascii=False, indent=2)
    return len(POPULAR_FUNDS)


def export_fund_detail(conn: sqlite3.Connection, out_dir: Path, fund_code: str,
                       fund_name: str, fund_type) -> dict:
    """导出单只基金明细 {fund_code}.json，仅包含存在的数据。"""
    detail = {
        "fund_code": fund_code,
        "fund_name": fund_name,
        "fund_type": fund_type,
    }

    nav_rows = conn.execute(
        """
        SELECT nav_date, nav, acc_nav, nav_change
        FROM fund_nav
        WHERE fund_code = ?
        ORDER BY nav_date
        """,
        (fund_code,),
    ).fetchall()

    if nav_rows:
        detail["nav_data"] = [
            {
                "date": r["nav_date"],
                "nav": r["nav"],
                "acc_nav": r["acc_nav"],
                "nav_change": r["nav_change"],
            }
            for r in nav_rows
        ]

    kline_rows = conn.execute(
        """
        SELECT trade_date, open, close, high, low, volume, turnover
        FROM fund_kline
        WHERE fund_code = ?
        ORDER BY trade_date
        """,
        (fund_code,),
    ).fetchall()

    if kline_rows:
        detail["kline_data"] = [
            {
                "date": r["trade_date"],
                "open": r["open"],
                "close": r["close"],
                "high": r["high"],
                "low": r["low"],
                "volume": r["volume"],
                "turnover": r["turnover"],
            }
            for r in kline_rows
        ]

    out_path = out_dir / f"{fund_code}.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(detail, f, ensure_ascii=False, indent=2)

    return {
        "fund_code": fund_code,
        "nav_count": len(nav_rows),
        "kline_count": len(kline_rows),
    }


def main():
    parser = argparse.ArgumentParser(description="导出基金数据为静态 JSON 文件")
    parser.add_argument("--db", default=str(default_db_path()),
                        help="SQLite 数据库路径（默认: ../backend/fund_data.db）")
    parser.add_argument("--out", default=str(default_output_dir()),
                        help="输出目录路径（默认: ../frontend/public/data）")
    args = parser.parse_args()

    db_path = Path(args.db).resolve()
    out_dir = Path(args.out).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)

    print("=" * 60)
    print("基金数据导出工具")
    print("=" * 60)
    print(f"数据库路径: {db_path}")
    print(f"输出目录  : {out_dir}")
    print("-" * 60)

    conn = connect_db(db_path)

    # 1) funds.json
    funds_count = export_funds_json(conn, out_dir)
    print(f"[funds.json] 导出 {funds_count} 只基金基本信息")

    # 2) popular.json
    popular_count = export_popular_json(out_dir)
    print(f"[popular.json] 导出 {popular_count} 条热门基金")

    # 3) {fund_code}.json
    funds = conn.execute(
        "SELECT fund_code, fund_name, fund_type FROM fund_info ORDER BY fund_code"
    ).fetchall()

    print("-" * 60)
    print("单只基金明细：")
    total_nav = 0
    total_kline = 0
    for f in funds:
        info = export_fund_detail(
            conn, out_dir, f["fund_code"], f["fund_name"], f["fund_type"]
        )
        total_nav += info["nav_count"]
        total_kline += info["kline_count"]
        print(
            f"  [{f['fund_code']}] {f['fund_name']}: "
            f"净值 {info['nav_count']} 条 / K线 {info['kline_count']} 条"
        )

    conn.close()

    print("-" * 60)
    print("导出汇总：")
    print(f"  基金数量      : {funds_count}")
    print(f"  热门基金数量  : {popular_count}")
    print(f"  净值记录总数  : {total_nav}")
    print(f"  K线记录总数   : {total_kline}")
    print(f"  输出文件目录  : {out_dir}")
    print("=" * 60)
    print("完成！")


if __name__ == "__main__":
    main()

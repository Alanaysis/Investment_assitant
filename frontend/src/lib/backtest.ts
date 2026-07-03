// 定投回测逻辑，对应后端 app/services/backtest.py
// 纯前端实现，不依赖后端服务。

import type {
  FundData,
  BacktestResponse,
  InvestRecord,
  BacktestPeriod,
} from './types';
import { detectFundType } from './fundType';

// 内部统一的价格记录（kline.close 或 nav.nav 归一化到此结构）
export interface PriceRecord {
  date: string; // "YYYY-MM-DD"
  price: number;
}

// ===== 日期工具 =====

// 解析 "YYYY-MM-DD" 为本地 Date（避免 UTC 偏移）
function parseDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

// ISO 周数，对应 Python date.isocalendar()[1]
function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = (d.getUTCDay() + 6) % 7; // 0 = Monday
  d.setUTCDate(d.getUTCDate() - dayNum + 3); // 当周四
  const firstThursday = d.getTime();
  d.setUTCMonth(0, 1);
  if (d.getUTCDay() !== 4) {
    d.setUTCMonth(0, 1 + ((4 - d.getUTCDay()) + 7) % 7);
  }
  return 1 + Math.round((firstThursday - d.getTime()) / (7 * 24 * 60 * 60 * 1000));
}

function daysBetween(a: Date, b: Date): number {
  return (a.getTime() - b.getTime()) / (24 * 60 * 60 * 1000);
}

// ===== 数值舍入（对应 Python round(x, n)） =====

function roundN(x: number, n: number): number {
  const f = Math.pow(10, n);
  return Math.round(x * f) / f;
}
const round2 = (x: number): number => roundN(x, 2);
const round4 = (x: number): number => roundN(x, 4);

// ===== 核心逻辑 =====

/**
 * 根据定投周期筛选买入日期，对应 Python _get_invest_dates。
 * records 已按日期升序排序；priceField 仅为签名对齐，统一用 record.date 取日期。
 */
export function getInvestDates(
  records: PriceRecord[],
  period: BacktestPeriod,
  priceField: 'close' | 'nav'
): PriceRecord[] {
  void priceField; // 统一记录已含 date 字段，无需区分 trade_date / nav_date
  const result: PriceRecord[] = [];
  let lastInvestMonth = -1;
  let lastInvestWeek = -1;

  for (const rec of records) {
    const d = parseDate(rec.date);

    if (period === 'daily') {
      result.push(rec);
    } else if (period === 'monthly') {
      if (d.getMonth() !== lastInvestMonth) {
        result.push(rec);
        lastInvestMonth = d.getMonth();
      }
    } else if (period === 'weekly') {
      const weekNum = getISOWeek(d);
      const lastYear = result.length
        ? parseDate(result[result.length - 1].date).getFullYear()
        : 0;
      if (weekNum !== lastInvestWeek || d.getFullYear() !== lastYear) {
        result.push(rec);
        lastInvestWeek = weekNum;
      }
    } else if (period === 'biweekly') {
      if (result.length === 0) {
        result.push(rec);
      } else {
        const prev = parseDate(result[result.length - 1].date);
        if (daysBetween(d, prev) >= 14) {
          result.push(rec);
        }
      }
    }
  }
  return result;
}

/**
 * 计算定投过程中的最大回撤，对应 Python _calc_max_drawdown。
 * lastPrice / totalShares 仅为签名对齐（Python 也未在内部使用）。
 */
export function calcMaxDrawdown(
  investRecords: InvestRecord[],
  lastPrice: number,
  totalShares: number
): number {
  void lastPrice;
  void totalShares;
  if (investRecords.length === 0) return 0.0;

  let cumulativeShares = 0.0;
  let peakValue = 0.0;
  let maxDd = 0.0;

  for (const rec of investRecords) {
    cumulativeShares += rec.shares;
    const currentValue = cumulativeShares * rec.price;
    if (currentValue > peakValue) peakValue = currentValue;
    const dd = peakValue > 0 ? ((peakValue - currentValue) / peakValue) * 100 : 0;
    if (dd > maxDd) maxDd = dd;
  }
  return maxDd;
}

function errorResponse(
  fundCode: string,
  fundType: string,
  period: string,
  amount: number,
  error: string
): BacktestResponse {
  return {
    fund_code: fundCode,
    fund_type: fundType,
    period,
    amount_per_invest: amount,
    invest_count: 0,
    total_cost: 0,
    final_value: 0,
    total_return_pct: 0,
    annual_return_pct: 0,
    max_drawdown_pct: 0,
    invest_records: [],
    error,
  };
}

/**
 * 主回测函数，对应 Python backtest_dca。
 * fundData 已包含 nav_data / kline_data；params 控制定投参数。
 */
export function runDcaBacktest(
  fundData: FundData,
  params: { period: BacktestPeriod; amount: number; days: number }
): BacktestResponse {
  const { period, amount, days } = params;
  const fundCode = fundData.fund_code;
  const fundType = fundData.fund_type || detectFundType(fundCode);

  const today = new Date();
  const cutoff = new Date(today.getFullYear(), today.getMonth(), today.getDate() - days);
  cutoff.setHours(0, 0, 0, 0);

  // 确定 price_field 与数据源（含 ETF 无 K线回退净值），对应 Python 同名逻辑
  let priceField: 'close' | 'nav';
  let records: PriceRecord[];

  if (fundType === 'ETF') {
    const klineFiltered = (fundData.kline_data || [])
      .filter((k) => parseDate(k.date) >= cutoff)
      .map((k) => ({ date: k.date, price: k.close }));
    if (klineFiltered.length > 0) {
      records = klineFiltered;
      priceField = 'close';
    } else {
      records = fundData.nav_data
        .filter((n) => parseDate(n.date) >= cutoff)
        .map((n) => ({ date: n.date, price: n.nav }));
      priceField = 'nav';
    }
  } else {
    records = fundData.nav_data
      .filter((n) => parseDate(n.date) >= cutoff)
      .map((n) => ({ date: n.date, price: n.nav }));
    priceField = 'nav';
  }

  // 按日期升序排序，对应 .order_by(trade_date / nav_date)
  records.sort((a, b) => a.date.localeCompare(b.date));

  if (records.length === 0) {
    return errorResponse(fundCode, fundType, period, amount, `基金 ${fundCode} 无数据，请先拉取数据`);
  }

  // 按周期筛选买入日
  const investDates = getInvestDates(records, period, priceField);

  // 模拟定投
  let totalShares = 0.0;
  let totalCost = 0.0;
  const investRecords: InvestRecord[] = [];

  for (const rec of investDates) {
    const price = rec.price;
    if (price && price > 0) {
      const shares = amount / price;
      totalShares += shares;
      totalCost += amount;
      investRecords.push({
        date: rec.date,
        price,
        shares: round4(shares),
        total_cost: totalCost,
      });
    }
  }

  if (totalCost === 0) {
    return errorResponse(fundCode, fundType, period, amount, '未能执行任何定投');
  }

  // 最终市值
  const lastPrice = records[records.length - 1].price;
  const finalValue = totalShares * lastPrice;

  // 收益计算
  const totalReturn = ((finalValue - totalCost) / totalCost) * 100;
  const firstDateStr = investRecords[0].date;
  const lastDateStr = investRecords[investRecords.length - 1].date;
  const years = daysBetween(parseDate(lastDateStr), parseDate(firstDateStr)) / 365.25;
  const annualReturn =
    years > 0 ? (Math.pow(finalValue / totalCost, 1 / years) - 1) * 100 : 0;

  // 最大回撤
  const maxDrawdown = calcMaxDrawdown(investRecords, lastPrice, totalShares);

  return {
    fund_code: fundCode,
    fund_type: fundType,
    period,
    amount_per_invest: amount,
    invest_count: investRecords.length,
    total_cost: round2(totalCost),
    final_value: round2(finalValue),
    total_return_pct: round2(totalReturn),
    annual_return_pct: round2(annualReturn),
    max_drawdown_pct: round2(maxDrawdown),
    invest_records: investRecords,
  };
}

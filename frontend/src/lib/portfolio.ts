// 组合定投回测逻辑，对应后端 app/services/portfolio.py
// 纯前端实现：多只基金按权重定投，计算组合整体收益与回撤。

import type {
  FundData,
  PortfolioHolding,
  PortfolioBacktestResponse,
  PortfolioRecord,
  PortfolioHoldingResult,
  BacktestPeriod,
} from './types';
import { detectFundType } from './fundType';

interface FundState {
  prices: Map<string, number>; // "YYYY-MM-DD" -> price
  weight: number;
  fundType: string;
  fundName: string;
  shares: number;
  cost: number;
}

// ===== 日期工具 =====

function parseDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - dayNum + 3);
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

function roundN(x: number, n: number): number {
  const f = Math.pow(10, n);
  return Math.round(x * f) / f;
}
const round2 = (x: number): number => roundN(x, 2);
const round4 = (x: number): number => roundN(x, 4);

/**
 * 找最近有价格的日期（向前找最多 10 天），对应 Python _find_nearest_price。
 */
function findNearestPrice(prices: Map<string, number>, targetDate: string): number | null {
  if (prices.has(targetDate)) return prices.get(targetDate) as number;
  const d = parseDate(targetDate);
  for (let i = 1; i <= 10; i++) {
    const check = new Date(d.getFullYear(), d.getMonth(), d.getDate() - i);
    const key = formatDate(check);
    if (prices.has(key)) return prices.get(key) as number;
  }
  return null;
}

/**
 * 按定投周期筛选买入日，对应 Python _get_portfolio_invest_dates。
 * allDates 为已排序的 "YYYY-MM-DD" 字符串数组。
 */
function getPortfolioInvestDates(allDates: string[], period: BacktestPeriod): string[] {
  const result: string[] = [];
  let lastInvestMonth = -1;
  let lastInvestWeek = -1;

  for (const ds of allDates) {
    const d = parseDate(ds);
    if (period === 'daily') {
      result.push(ds);
    } else if (period === 'monthly') {
      if (d.getMonth() !== lastInvestMonth) {
        result.push(ds);
        lastInvestMonth = d.getMonth();
      }
    } else if (period === 'weekly') {
      const weekNum = getISOWeek(d);
      const lastYear = result.length
        ? parseDate(result[result.length - 1]).getFullYear()
        : 0;
      if (weekNum !== lastInvestWeek || d.getFullYear() !== lastYear) {
        result.push(ds);
        lastInvestWeek = weekNum;
      }
    } else if (period === 'biweekly') {
      if (result.length === 0) {
        result.push(ds);
      } else {
        const prev = parseDate(result[result.length - 1]);
        if (daysBetween(d, prev) >= 14) {
          result.push(ds);
        }
      }
    }
  }
  return result;
}

/**
 * 组合最大回撤，对应 Python _calc_portfolio_max_drawdown。
 */
function calcPortfolioMaxDrawdown(records: PortfolioRecord[]): number {
  let peak = 0.0;
  let maxDd = 0.0;
  for (const r of records) {
    const val = r.portfolio_value;
    if (val > peak) peak = val;
    const dd = peak > 0 ? ((peak - val) / peak) * 100 : 0;
    if (dd > maxDd) maxDd = dd;
  }
  return maxDd;
}

function errorResponse(error: string): PortfolioBacktestResponse {
  return {
    holdings: [],
    period: '',
    total_amount_per_invest: 0,
    invest_count: 0,
    total_cost: 0,
    final_value: 0,
    total_return_pct: 0,
    annual_return_pct: 0,
    max_drawdown_pct: 0,
    portfolio_records: [],
    error,
  };
}

/**
 * 组合定投回测，对应 Python backtest_portfolio_dca。
 * fundsData 为各基金本地数据；holdings 指定权重；按周期投入 totalAmount。
 */
export function runPortfolioBacktest(
  fundsData: FundData[],
  holdings: PortfolioHolding[],
  period: BacktestPeriod,
  totalAmount: number,
  days: number
): PortfolioBacktestResponse {
  const fundData: Record<string, FundState> = {};
  const today = new Date();
  const cutoff = new Date(today.getFullYear(), today.getMonth(), today.getDate() - days);
  cutoff.setHours(0, 0, 0, 0);

  // 收集每只基金的价格序列
  for (const h of holdings) {
    const code = h.fund_code;
    const weight = h.weight;
    const fundType = detectFundType(code);
    const fd = fundsData.find((f) => f.fund_code === code);

    if (!fd) {
      return errorResponse(`基金 ${code} 无数据，请先拉取`);
    }

    const prices = new Map<string, number>();
    if (fundType === 'ETF') {
      // 优先 K线 close
      const klineFiltered = (fd.kline_data || []).filter(
        (k) => parseDate(k.date) >= cutoff
      );
      if (klineFiltered.length > 0) {
        for (const k of klineFiltered) prices.set(k.date, k.close);
      } else {
        // ETF 无 K线 → 回退到净值
        for (const n of fd.nav_data) {
          if (parseDate(n.date) >= cutoff) prices.set(n.date, n.nav);
        }
      }
    } else {
      for (const n of fd.nav_data) {
        if (parseDate(n.date) >= cutoff) prices.set(n.date, n.nav);
      }
    }

    if (prices.size === 0) {
      return errorResponse(`基金 ${code} 无数据，请先拉取`);
    }

    fundData[code] = {
      prices,
      weight,
      fundType,
      fundName: fd.fund_name || code,
      shares: 0.0,
      cost: 0.0,
    };
  }

  // 合并所有交易日期并排序
  const allDatesSet = new Set<string>();
  for (const fd of Object.values(fundData)) {
    for (const key of fd.prices.keys()) allDatesSet.add(key);
  }
  const allDates = Array.from(allDatesSet).sort();

  if (allDates.length === 0) {
    return errorResponse('无可用交易日期');
  }

  // 按周期筛选买入日
  const investDates = getPortfolioInvestDates(allDates, period);

  // 模拟组合定投
  const portfolioRecords: PortfolioRecord[] = [];
  let totalCost = 0.0;

  for (const investDate of investDates) {
    let dayCost = 0.0;
    let dayValue = 0.0;
    const dayDetail: NonNullable<PortfolioRecord['detail']> = {};

    for (const [code, fd] of Object.entries(fundData)) {
      const price = findNearestPrice(fd.prices, investDate);
      if (price && price > 0) {
        const amount = totalAmount * fd.weight;
        const shares = amount / price;
        fd.shares += shares;
        fd.cost += amount;
        dayCost += amount;
        dayDetail[code] = {
          price,
          amount: round2(amount),
          shares: round4(shares),
        };
      }
    }

    totalCost += dayCost;

    // 计算当日组合市值
    for (const fd of Object.values(fundData)) {
      const price = findNearestPrice(fd.prices, investDate);
      if (price) dayValue += fd.shares * price;
    }

    portfolioRecords.push({
      date: investDate,
      total_cost: round2(totalCost),
      portfolio_value: round2(dayValue),
      detail: dayDetail,
    });
  }

  if (totalCost === 0) {
    return errorResponse('未能执行任何定投');
  }

  // 最终市值
  const lastDate = allDates[allDates.length - 1];
  let finalValue = 0.0;
  for (const fd of Object.values(fundData)) {
    const price = findNearestPrice(fd.prices, lastDate);
    if (price) finalValue += fd.shares * price;
  }

  // 收益计算
  const totalReturn = ((finalValue - totalCost) / totalCost) * 100;
  const firstDateStr = portfolioRecords[0].date;
  const lastInvestDateStr = portfolioRecords[portfolioRecords.length - 1].date;
  const years =
    daysBetween(parseDate(lastInvestDateStr), parseDate(firstDateStr)) / 365.25;
  const annualReturn =
    years > 0 ? (Math.pow(finalValue / totalCost, 1 / years) - 1) * 100 : 0;

  // 最大回撤
  const maxDrawdown = calcPortfolioMaxDrawdown(portfolioRecords);

  // 各基金持仓明细
  const holdingsSummary: PortfolioHoldingResult[] = Object.entries(fundData).map(
    ([code, fd]) => {
      const lastPrice = findNearestPrice(fd.prices, lastDate);
      const marketValue = lastPrice ? fd.shares * lastPrice : 0;
      return {
        fund_code: code,
        fund_name: fd.fundName,
        fund_type: fd.fundType,
        weight: fd.weight,
        total_cost: round2(fd.cost),
        market_value: round2(marketValue),
        return_pct:
          fd.cost > 0 ? round2(((marketValue - fd.cost) / fd.cost) * 100) : 0,
      };
    }
  );

  return {
    holdings: holdingsSummary,
    period,
    total_amount_per_invest: totalAmount,
    invest_count: portfolioRecords.length,
    total_cost: round2(totalCost),
    final_value: round2(finalValue),
    total_return_pct: round2(totalReturn),
    annual_return_pct: round2(annualReturn),
    max_drawdown_pct: round2(maxDrawdown),
    portfolio_records: portfolioRecords,
  };
}

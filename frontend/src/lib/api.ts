// 静态版本 API 层：所有数据来自 public/data/*.json，全部计算在浏览器内完成。
// 不再依赖任何后端服务，适配 GitHub Pages 部署。

import type {
  FundInfo,
  FundData,
  PopularFund,
  BacktestRequest,
  BacktestResponse,
  ScoredFund,
  PortfolioHolding,
  PortfolioBacktestResponse,
  FetchRequest,
  FetchResponse,
  BatchFetchResult,
  BatchFetchResponse,
} from './types';
import { runDcaBacktest } from './backtest';
import { runPortfolioBacktest as runPortfolioBacktestLocal } from './portfolio';
import { scoreFund } from './scoring';

// ===== 类型 re-export（保持页面 import 路径不变）=====
export type {
  FundInfo,
  FundData,
  PopularFund,
  BacktestRequest,
  BacktestResponse,
  ScoredFund,
  ScoreDetail,
  PortfolioHolding,
  PortfolioHoldingResult,
  PortfolioRecord,
  PortfolioBacktestResponse,
  BacktestPeriod,
  NavRecord,
  KlineRecord,
  FetchRequest,
  FetchResponse,
  BatchFetchResult,
  BatchFetchResponse,
} from './types';

// ===== 本地数据缓存 =====
const fundDataCache = new Map<string, FundData>();

// ===== 基础数据读取 =====

/** 加载基金列表（funds.json） */
export async function fetchFunds(): Promise<FundInfo[]> {
  const res = await fetch('./data/funds.json');
  if (!res.ok) throw new Error('获取基金列表失败');
  return res.json();
}

/** 加载热门基金列表（popular.json） */
export async function fetchPopularFunds(): Promise<PopularFund[]> {
  const res = await fetch('./data/popular.json');
  if (!res.ok) throw new Error('获取热门基金失败');
  return res.json();
}

/** 加载单只基金明细数据（{code}.json），结果缓存在 Map 中避免重复请求。 */
export async function fetchFundData(code: string): Promise<FundData> {
  const cached = fundDataCache.get(code);
  if (cached) return cached;

  const res = await fetch(`./data/${code}.json`);
  if (!res.ok) {
    throw new Error(`基金 ${code} 数据未预置（静态版本不支持实时拉取）`);
  }
  const data: FundData = await res.json();
  fundDataCache.set(code, data);
  return data;
}

// ===== 定投回测 =====

/** 单基金定投回测：本地加载数据后调用 backtest.runDcaBacktest */
export async function runBacktest(req: BacktestRequest): Promise<BacktestResponse> {
  try {
    const fundData = await fetchFundData(req.fund_code);
    return runDcaBacktest(fundData, {
      period: req.period,
      amount: req.amount,
      days: req.days,
    });
  } catch (err) {
    return {
      fund_code: req.fund_code,
      fund_type: '',
      period: req.period,
      amount_per_invest: req.amount,
      invest_count: 0,
      total_cost: 0,
      final_value: 0,
      total_return_pct: 0,
      annual_return_pct: 0,
      max_drawdown_pct: 0,
      invest_records: [],
      error: err instanceof Error ? err.message : '回测失败',
    };
  }
}

// ===== 组合回测 =====

/** 组合定投回测：加载所有持仓基金数据后调用 portfolio.runPortfolioBacktest */
export async function runPortfolioBacktest(
  holdings: PortfolioHolding[],
  period: string,
  totalAmount: number,
  days: number
): Promise<PortfolioBacktestResponse> {
  try {
    const fundsData: FundData[] = [];
    for (const h of holdings) {
      const fd = await fetchFundData(h.fund_code);
      fundsData.push(fd);
    }
    return runPortfolioBacktestLocal(
      fundsData,
      holdings,
      period as 'daily' | 'weekly' | 'biweekly' | 'monthly',
      totalAmount,
      days
    );
  } catch (err) {
    return {
      holdings: [],
      period,
      total_amount_per_invest: totalAmount,
      invest_count: 0,
      total_cost: 0,
      final_value: 0,
      total_return_pct: 0,
      annual_return_pct: 0,
      max_drawdown_pct: 0,
      portfolio_records: [],
      error: err instanceof Error ? err.message : '组合回测失败',
    };
  }
}

// ===== 评分 =====

/**
 * 评分排名：加载 funds.json 与每只基金明细，调用 scoring.scoreFund 后按总分降序。
 * fundType 为可选类型过滤（'ETF' / '场外基金' / undefined）。
 */
export async function fetchScoringRank(fundType?: string): Promise<ScoredFund[]> {
  const funds = await fetchFunds();

  const scored: ScoredFund[] = [];
  for (const fund of funds) {
    try {
      const fd = await fetchFundData(fund.fund_code);
      scored.push(scoreFund(fund, fd));
    } catch {
      // 跳过缺失数据的基金
    }
  }

  // fundType === 'ETF' 仅保留 ETF；'场外基金' 保留非 ETF；undefined 保留全部
  const filtered = fundType
    ? fundType === 'ETF'
      ? scored.filter((s) => s.fund_type === 'ETF')
      : scored.filter((s) => s.fund_type !== 'ETF')
    : scored;

  filtered.sort((a, b) => b.total_score - a.total_score);
  filtered.forEach((s, i) => (s.rank = i + 1));
  return filtered;
}

/** 单只基金评分详情：加载 fund data + fund info 后调用 scoreFund。 */
export async function fetchScoreDetail(fundCode: string): Promise<ScoredFund> {
  const funds = await fetchFunds();
  const fund = funds.find((f) => f.fund_code === fundCode);
  if (!fund) throw new Error(`基金 ${fundCode} 不在列表中`);
  const fd = await fetchFundData(fundCode);
  return scoreFund(fund, fd);
}

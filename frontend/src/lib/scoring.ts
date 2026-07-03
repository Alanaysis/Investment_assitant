// 基金评分逻辑，对应后端 app/services/scoring.py
// 纯 TS 实现（不依赖 numpy），公式与权重与 Python 保持一致。

import type { FundData, FundInfo, ScoredFund, ScoreDetail } from './types';
import { detectFundType } from './fundType';

// ===== 数值工具（替代 numpy） =====

/** 总体标准差（ddof=0，对应 np.std 默认） */
export function std(arr: number[]): number {
  const n = arr.length;
  if (n === 0) return 0;
  const mean = arr.reduce((s, v) => s + v, 0) / n;
  const variance = arr.reduce((s, v) => s + (v - mean) ** 2, 0) / n;
  return Math.sqrt(variance);
}

/** 累计最大值，对应 np.maximum.accumulate */
export function cummax(arr: number[]): number[] {
  const result: number[] = [];
  let m = -Infinity;
  for (const v of arr) {
    if (v > m) m = v;
    result.push(m);
  }
  return result;
}

/** 区间截断，对应 np.clip */
export function clip(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function roundN(x: number, n: number): number {
  const f = Math.pow(10, n);
  return Math.round(x * f) / f;
}
const round1 = (x: number): number => roundN(x, 1);
const round2 = (x: number): number => roundN(x, 2);

// ===== 日期工具 =====

function parseDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

// ===== 评分维度 =====

/**
 * 收益维度得分，对应 Python _calc_return_score。
 * 归一化：年化收益 -30%→0，30%→100。
 */
export function calcReturnScore(prices: number[]): {
  score: number;
  details: Partial<ScoreDetail>;
} {
  if (prices.length < 20) {
    return {
      score: 50.0,
      details: { annual_return: null, total_return: null },
    };
  }

  const arr = prices;
  const totalReturn = (arr[arr.length - 1] / arr[0] - 1) * 100;
  const tradingDays = arr.length;
  const annualReturn =
    tradingDays > 0
      ? (Math.pow(arr[arr.length - 1] / arr[0], 252 / tradingDays) - 1) * 100
      : 0;

  // 近 3 月收益（约 63 个交易日）
  const recent3m = arr.length >= 63 ? arr.slice(-63) : arr;
  const return3m =
    recent3m.length > 1 ? (recent3m[recent3m.length - 1] / recent3m[0] - 1) * 100 : 0;

  // 近 1 月收益（约 22 个交易日）
  const recent1m = arr.length >= 22 ? arr.slice(-22) : arr;
  const return1m =
    recent1m.length > 1 ? (recent1m[recent1m.length - 1] / recent1m[0] - 1) * 100 : 0;

  // 归一化到 0-100
  const score = clip((annualReturn + 30) / 60 * 100, 0, 100);

  const details: Partial<ScoreDetail> = {
    annual_return: round2(annualReturn),
    total_return: round2(totalReturn),
    return_3m: round2(return3m),
    return_1m: round2(return1m),
  };
  return { score: round1(score), details };
}

/**
 * 风险维度得分，对应 Python _calc_risk_score。
 * 波动率权重 0.3、最大回撤权重 0.4、夏普权重 0.3。
 */
export function calcRiskScore(prices: number[]): {
  score: number;
  details: Partial<ScoreDetail>;
} {
  if (prices.length < 20) {
    return {
      score: 50.0,
      details: { max_drawdown: null, volatility: null, sharpe: null },
    };
  }

  const arr = prices;
  const dailyReturns: number[] = [];
  for (let i = 1; i < arr.length; i++) {
    dailyReturns.push((arr[i] - arr[i - 1]) / arr[i - 1]);
  }
  const filtered = dailyReturns.filter((v) => !Number.isNaN(v));

  if (filtered.length < 10) {
    return {
      score: 50.0,
      details: { max_drawdown: null, volatility: null, sharpe: null },
    };
  }

  // 波动率（年化）
  const volatility = std(filtered) * Math.sqrt(252) * 100;

  // 最大回撤
  const cm = cummax(arr);
  const drawdowns = arr.map((v, i) => ((v - cm[i]) / cm[i]) * 100);
  const maxDrawdown = Math.min(...drawdowns);

  // 年化收益（用于夏普）
  const tradingDays = arr.length;
  const annualReturn =
    arr[0] > 0 ? Math.pow(arr[arr.length - 1] / arr[0], 252 / tradingDays) - 1 : 0;

  // 夏普比率（无风险利率 2%）
  const sharpe = volatility > 0 ? (annualReturn - 0.02) / (volatility / 100) : 0;

  // 归一化
  // 波动率：5%→100，40%→0
  const volScore = clip((40 - volatility) / 35 * 100, 0, 100);
  // 最大回撤：0%→100，-50%→0
  const ddScore = clip((maxDrawdown + 50) / 50 * 100, 0, 100);
  // 夏普：-1→0，2→100
  const sharpeScore = clip((sharpe + 1) / 3 * 100, 0, 100);

  const score = volScore * 0.3 + ddScore * 0.4 + sharpeScore * 0.3;

  const details: Partial<ScoreDetail> = {
    max_drawdown: round2(maxDrawdown),
    volatility: round2(volatility),
    sharpe: round2(sharpe),
  };
  return { score: round1(score), details };
}

/**
 * 基本面维度得分，对应 Python _calc_basic_score。
 * 规模评分（50-200 亿最佳）与费率评分（越低越好）加权。
 */
export function calcBasicScore(fund: FundInfo): {
  score: number;
  details: Partial<ScoreDetail>;
} {
  let score = 50.0;
  const details: Partial<ScoreDetail> = {
    fund_scale: fund.fund_scale,
    fee_rate: fund.fee_rate,
    manager_name: fund.manager_name,
  };

  // 规模评分：50-200 亿最佳
  if (fund.fund_scale) {
    let scaleScore: number;
    if (fund.fund_scale >= 50 && fund.fund_scale <= 200) {
      scaleScore = 90;
    } else if (
      (fund.fund_scale >= 20 && fund.fund_scale < 50) ||
      (fund.fund_scale > 200 && fund.fund_scale <= 500)
    ) {
      scaleScore = 70;
    } else if (fund.fund_scale >= 5 && fund.fund_scale < 20) {
      scaleScore = 55;
    } else {
      scaleScore = 35;
    }
    score = score * 0.4 + scaleScore * 0.6;
  }

  // 费率评分：越低越好
  if (fund.fee_rate != null) {
    let feeScore: number;
    if (fund.fee_rate <= 0.5) {
      feeScore = 90;
    } else if (fund.fee_rate <= 1.0) {
      feeScore = 75;
    } else if (fund.fee_rate <= 1.5) {
      feeScore = 55;
    } else {
      feeScore = 35;
    }
    score = score * 0.5 + feeScore * 0.5;
  }

  return { score: round1(score), details };
}

/**
 * 获取基金净值/收盘价序列，对应 Python _get_nav_series。
 * ETF 优先取 kline_data.close，无 K线则回退 nav_data.nav；其它取 nav_data.nav。
 */
export function getNavSeries(
  fundData: FundData,
  days: number = 730
): { dates: string[]; prices: number[] } {
  const fundType = fundData.fund_type || detectFundType(fundData.fund_code);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  cutoff.setHours(0, 0, 0, 0);

  if (fundType === 'ETF') {
    const klineFiltered = (fundData.kline_data || []).filter(
      (k) => parseDate(k.date) >= cutoff
    );
    if (klineFiltered.length > 0) {
      return {
        dates: klineFiltered.map((k) => k.date),
        prices: klineFiltered.map((k) => k.close),
      };
    }
    // ETF 无 K线 → 回退净值
    const navFiltered = fundData.nav_data.filter((n) => parseDate(n.date) >= cutoff);
    return {
      dates: navFiltered.map((n) => n.date),
      prices: navFiltered.map((n) => n.nav),
    };
  }

  const navFiltered = fundData.nav_data.filter((n) => parseDate(n.date) >= cutoff);
  return {
    dates: navFiltered.map((n) => n.date),
    prices: navFiltered.map((n) => n.nav),
  };
}

/**
 * 对单只基金进行综合评分，对应 Python score_fund。
 * 总分 = 收益 0.4 + 风险 0.35 + 基本面 0.25。
 */
export function scoreFund(fund: FundInfo, fundData: FundData): ScoredFund {
  const fundType = fund.fund_type || '场外基金';

  const { prices } = getNavSeries(fundData, 730);

  const { score: returnScore, details: returnDetails } = calcReturnScore(prices);
  const { score: riskScore, details: riskDetails } = calcRiskScore(prices);
  const { score: basicScore, details: basicDetails } = calcBasicScore(fund);

  const totalScore = round1(
    returnScore * 0.4 + riskScore * 0.35 + basicScore * 0.25
  );

  return {
    fund_code: fund.fund_code,
    fund_name: fund.fund_name,
    fund_type: fundType,
    total_score: totalScore,
    return_score: returnScore,
    risk_score: riskScore,
    basic_score: basicScore,
    // Python 仅返回对应子集字段；这里对齐为 ScoreDetail（缺失字段为 undefined）
    return_details: returnDetails as ScoreDetail,
    risk_details: riskDetails as ScoreDetail,
    basic_details: basicDetails as ScoreDetail,
  };
}

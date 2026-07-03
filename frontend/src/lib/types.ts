// 共享类型定义
// 注：本文件为纯逻辑模块抽取的类型定义；api.ts 中仍保留同名接口以兼容现有页面调用，
// 后续接入静态部署时可让 api.ts 改为从此处 re-export。

// ===== 基金数据（前端本地计算用） =====

export interface NavRecord {
  date: string; // "YYYY-MM-DD"
  nav: number;
  acc_nav: number | null;
  nav_change: number | null;
}

export interface KlineRecord {
  date: string; // "YYYY-MM-DD"
  open: number;
  close: number;
  high: number;
  low: number;
  volume: number;
  turnover: number;
}

export interface FundData {
  fund_code: string;
  fund_name: string;
  fund_type: string; // "ETF" | "场外基金"
  nav_data: NavRecord[];
  kline_data: KlineRecord[];
}

// ===== 与后端 API 对齐的接口（从 api.ts 抽取） =====

export interface FundInfo {
  fund_code: string;
  fund_name: string;
  fund_type: string | null;
  establish_date: string | null;
  manager_name: string | null;
  fund_scale: number | null;
  fee_rate: number | null;
  data_count?: number;
}

export interface FetchRequest {
  fund_code: string;
  days: number;
}

export interface FetchResponse {
  fund_code: string;
  fund_type: string;
  fund_name: string;
  records_fetched: number;
  message: string;
}

export type BacktestPeriod = 'daily' | 'weekly' | 'biweekly' | 'monthly';

export interface BacktestRequest {
  fund_code: string;
  period: BacktestPeriod;
  amount: number;
  days: number;
}

export interface InvestRecord {
  date: string;
  price: number;
  shares: number;
  total_cost: number;
}

export interface BacktestResponse {
  fund_code: string;
  fund_type: string;
  period: string;
  amount_per_invest: number;
  invest_count: number;
  total_cost: number;
  final_value: number;
  total_return_pct: number;
  annual_return_pct: number;
  max_drawdown_pct: number;
  invest_records: InvestRecord[];
  error?: string;
}

export interface ScoreDetail {
  annual_return: number | null;
  total_return: number | null;
  return_3m: number | null;
  return_1m: number | null;
  max_drawdown: number | null;
  volatility: number | null;
  sharpe: number | null;
  fund_scale: number | null;
  fee_rate: number | null;
  manager_name: string | null;
}

export interface ScoredFund {
  fund_code: string;
  fund_name: string;
  fund_type: string;
  total_score: number;
  return_score: number;
  risk_score: number;
  basic_score: number;
  return_details: ScoreDetail;
  risk_details: ScoreDetail;
  basic_details: ScoreDetail;
  rank?: number;
}

export interface PopularFund {
  code: string;
  name: string;
}

export interface BatchFetchResult {
  fund_code: string;
  fund_name: string;
  fund_type: string;
  records_fetched: number;
  status: string;
}

export interface BatchFetchResponse {
  total: number;
  success: number;
  failed: number;
  results: BatchFetchResult[];
}

// ===== 组合回测 =====

export interface PortfolioHolding {
  fund_code: string;
  weight: number;
}

export interface PortfolioHoldingResult {
  fund_code: string;
  fund_name: string;
  fund_type: string;
  weight: number;
  total_cost: number;
  market_value: number;
  return_pct: number;
}

export interface PortfolioRecord {
  date: string;
  total_cost: number;
  portfolio_value: number;
  detail?: Record<string, { price: number; amount: number; shares: number }>;
}

export interface PortfolioBacktestResponse {
  holdings: PortfolioHoldingResult[];
  period: string;
  total_amount_per_invest: number;
  invest_count: number;
  total_cost: number;
  final_value: number;
  total_return_pct: number;
  annual_return_pct: number;
  max_drawdown_pct: number;
  portfolio_records: PortfolioRecord[];
  error?: string;
}

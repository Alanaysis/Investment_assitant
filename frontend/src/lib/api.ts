const API_BASE = 'http://localhost:8000';

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

export interface BacktestRequest {
  fund_code: string;
  period: 'daily' | 'weekly' | 'biweekly' | 'monthly';
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

export async function fetchFunds(): Promise<FundInfo[]> {
  const res = await fetch(`${API_BASE}/funds/list`);
  if (!res.ok) throw new Error('获取基金列表失败');
  return res.json();
}

export async function fetchFundData(req: FetchRequest): Promise<FetchResponse> {
  const res = await fetch(`${API_BASE}/funds/fetch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  if (!res.ok) throw new Error('拉取基金数据失败');
  return res.json();
}

export async function runBacktest(req: BacktestRequest): Promise<BacktestResponse> {
  const res = await fetch(`${API_BASE}/backtest/dca`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  if (!res.ok) throw new Error('回测请求失败');
  return res.json();
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

export async function fetchScoringRank(fundType?: string): Promise<ScoredFund[]> {
  const params = new URLSearchParams();
  if (fundType) params.set('fund_type', fundType);
  const res = await fetch(`${API_BASE}/scoring/rank?${params}`);
  if (!res.ok) throw new Error('获取评分排名失败');
  return res.json();
}

export async function fetchScoreDetail(fundCode: string): Promise<ScoredFund> {
  const res = await fetch(`${API_BASE}/scoring/${fundCode}/detail`);
  if (!res.ok) throw new Error('获取评分详情失败');
  return res.json();
}

// 热门基金
export interface PopularFund {
  code: string;
  name: string;
}

export async function fetchPopularFunds(): Promise<PopularFund[]> {
  const res = await fetch(`${API_BASE}/funds/popular`);
  if (!res.ok) throw new Error('获取热门基金失败');
  return res.json();
}

// 批量拉取
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

export async function batchFetchFunds(fundCodes: string[], usePopular: boolean, days: number): Promise<BatchFetchResponse> {
  const res = await fetch(`${API_BASE}/funds/batch-fetch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fund_codes: fundCodes, use_popular: usePopular, days }),
  });
  if (!res.ok) throw new Error('批量拉取失败');
  return res.json();
}

// 组合回测
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

export async function runPortfolioBacktest(
  holdings: PortfolioHolding[],
  period: string,
  totalAmount: number,
  days: number
): Promise<PortfolioBacktestResponse> {
  const res = await fetch(`${API_BASE}/portfolio/backtest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ holdings, period, total_amount: totalAmount, days }),
  });
  if (!res.ok) throw new Error('组合回测请求失败');
  return res.json();
}

// 基金类型识别，对应后端 data_fetcher.detect_fund_type
// - 51/56/58 开头：上交所 ETF
// - 15 开头：深交所 ETF
// - 16 开头：LOF（按场外基金处理）
// - 其余：场外基金

export function detectFundType(fundCode: string): string {
  const prefix2 = fundCode.slice(0, 2);
  if (prefix2 === '51' || prefix2 === '56' || prefix2 === '58') return 'ETF';
  if (prefix2 === '15') return 'ETF';
  // 16 开头是 LOF，按场外基金处理
  return '场外基金';
}

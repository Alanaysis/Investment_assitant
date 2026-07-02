import { useState, useEffect } from 'react';
import ReactECharts from 'echarts-for-react';
import { fetchScoringRank, fetchScoreDetail } from '@/lib/api';
import type { ScoredFund } from '@/lib/api';
import { Trophy, Filter, Loader2 } from 'lucide-react';

export default function Scoring() {
  const [scoredFunds, setScoredFunds] = useState<ScoredFund[]>([]);
  const [filterType, setFilterType] = useState<string>('all');
  const [selectedFund, setSelectedFund] = useState<ScoredFund | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchScoringRank(filterType === 'all' ? undefined : filterType)
      .then(setScoredFunds)
      .catch(() => setScoredFunds([]))
      .finally(() => setLoading(false));
  }, [filterType]);

  const handleSelectFund = async (fund: ScoredFund) => {
    setSelectedFund(fund);
    try {
      const detail = await fetchScoreDetail(fund.fund_code);
      setSelectedFund(detail);
    } catch { /* fallback to list data */ }
  };

  const radarOption = selectedFund ? {
    backgroundColor: 'transparent',
    radar: {
      indicator: [
        { name: '收益', max: 100 },
        { name: '风险控制', max: 100 },
        { name: '基本面', max: 100 },
      ],
      axisName: { color: '#8BA3AA', fontSize: 12 },
      splitArea: { areaStyle: { color: ['rgba(46,196,182,0.02)', 'rgba(46,196,182,0.05)'] } },
      splitLine: { lineStyle: { color: '#2A4550' } },
      axisLine: { lineStyle: { color: '#2A4550' } },
    },
    series: [{
      type: 'radar' as const,
      data: [{
        value: [selectedFund.return_score, selectedFund.risk_score, selectedFund.basic_score],
        areaStyle: { color: 'rgba(46,196,182,0.25)' },
        lineStyle: { color: '#2EC4B6', width: 2 },
        itemStyle: { color: '#2EC4B6' },
      }],
    }],
  } : null;

  const rankColors = ['#E8B931', '#C0C0C0', '#CD7F32'];

  const formatVal = (v: number | null | undefined, suffix = '') => {
    if (v == null) return '-';
    return `${v}${suffix}`;
  };

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-primary)' }}>
      <div className="ml-16 p-8 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <Trophy size={24} style={{ color: 'var(--gold)' }} />
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
            综合评分排名
          </h1>
        </div>

        {/* Filter */}
        <div className="flex items-center gap-3 mb-6">
          <Filter size={16} style={{ color: 'var(--text-muted)' }} />
          {['all', '场外基金', 'ETF'].map((t) => (
            <button
              key={t}
              onClick={() => setFilterType(t)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{
                background: filterType === t ? 'var(--accent)' : 'var(--bg-card)',
                color: filterType === t ? 'var(--bg-primary)' : 'var(--text-muted)',
                border: `1px solid ${filterType === t ? 'var(--accent)' : 'var(--border)'}`,
              }}
            >
              {t === 'all' ? '全部' : t}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={24} className="animate-spin" style={{ color: 'var(--accent)' }} />
          </div>
        ) : scoredFunds.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              暂无基金数据，请先在首页添加基金
            </p>
          </div>
        ) : (
          <div className="flex gap-6">
            {/* Ranking Table */}
            <div className="flex-1 min-w-0 rounded-xl overflow-hidden"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ background: 'var(--bg-secondary)' }}>
                      {['排名', '基金代码', '基金名称', '类型', '综合评分', '收益', '风险', '基本面'].map((h) => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-medium whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {scoredFunds.map((fund, i) => (
                      <tr
                        key={fund.fund_code}
                        className="cursor-pointer transition-colors"
                        style={{
                          borderBottom: '1px solid var(--border)',
                          background: selectedFund?.fund_code === fund.fund_code ? 'var(--bg-card-hover)' : 'transparent',
                        }}
                        onClick={() => handleSelectFund(fund)}
                        onMouseEnter={(e) => { if (selectedFund?.fund_code !== fund.fund_code) e.currentTarget.style.background = 'var(--bg-card-hover)'; }}
                        onMouseLeave={(e) => { if (selectedFund?.fund_code !== fund.fund_code) e.currentTarget.style.background = 'transparent'; }}
                      >
                        <td className="px-4 py-3">
                          <span className="font-data font-bold text-sm"
                            style={{ color: i < 3 ? rankColors[i] : 'var(--text-muted)' }}>
                            {fund.rank || i + 1}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-data" style={{ color: 'var(--accent)' }}>{fund.fund_code}</td>
                        <td className="px-4 py-3 whitespace-nowrap" style={{ color: 'var(--text-primary)' }}>{fund.fund_name}</td>
                        <td className="px-4 py-3">
                          <span className="text-xs px-2 py-0.5 rounded-full"
                            style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}>
                            {fund.fund_type}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-data font-bold" style={{ color: 'var(--gold)' }}>{fund.total_score}</td>
                        <td className="px-4 py-3 font-data" style={{ color: 'var(--text-secondary)' }}>{fund.return_score}</td>
                        <td className="px-4 py-3 font-data" style={{ color: 'var(--text-secondary)' }}>{fund.risk_score}</td>
                        <td className="px-4 py-3 font-data" style={{ color: 'var(--text-secondary)' }}>{fund.basic_score}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Right Panel: Radar + Details */}
            <div className="w-80 shrink-0 space-y-4">
              {/* Radar */}
              <div className="rounded-xl p-4"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                <h3 className="text-sm font-medium mb-3" style={{ color: 'var(--text-secondary)' }}>
                  {selectedFund ? selectedFund.fund_name : '选择基金查看评分'}
                </h3>
                {radarOption ? (
                  <ReactECharts option={radarOption} style={{ height: 260 }} />
                ) : (
                  <div className="h-[260px] flex items-center justify-center">
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>点击左侧基金查看雷达图</p>
                  </div>
                )}
              </div>

              {/* Detail Metrics */}
              {selectedFund && (
                <div className="rounded-xl p-4 space-y-3 animate-fade-in-up"
                  style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                  <h3 className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>收益指标</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: '年化收益', value: formatVal(selectedFund.return_details.annual_return, '%') },
                      { label: '总收益', value: formatVal(selectedFund.return_details.total_return, '%') },
                      { label: '近3月', value: formatVal(selectedFund.return_details.return_3m, '%') },
                      { label: '近1月', value: formatVal(selectedFund.return_details.return_1m, '%') },
                    ].map((m) => (
                      <div key={m.label}>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{m.label}</p>
                        <p className="font-data text-sm font-medium" style={{
                          color: m.value !== '-' && !m.value.startsWith('-') ? 'var(--gold)' : m.value.startsWith('-') ? 'var(--coral)' : 'var(--text-secondary)'
                        }}>{m.value}</p>
                      </div>
                    ))}
                  </div>

                  <h3 className="text-xs font-medium pt-2" style={{ color: 'var(--text-muted)' }}>风险指标</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: '最大回撤', value: formatVal(selectedFund.risk_details.max_drawdown, '%') },
                      { label: '波动率', value: formatVal(selectedFund.risk_details.volatility, '%') },
                      { label: '夏普比率', value: formatVal(selectedFund.risk_details.sharpe) },
                    ].map((m) => (
                      <div key={m.label}>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{m.label}</p>
                        <p className="font-data text-sm font-medium" style={{
                          color: m.label === '夏普比率'
                            ? (parseFloat(m.value) > 0 ? 'var(--accent)' : 'var(--coral)')
                            : 'var(--text-primary)'
                        }}>{m.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

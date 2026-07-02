import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import ReactECharts from 'echarts-for-react';
import { ArrowLeft, Play, Loader2, RefreshCw } from 'lucide-react';
import { runBacktest, fetchFundData } from '@/lib/api';
import { useFundStore } from '@/hooks/useFundStore';
import type { BacktestResponse } from '@/lib/api';

export default function Backtest() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const funds = useFundStore((s) => s.funds);

  const initialCode = params.get('fund') || '';
  const [fundCode, setFundCode] = useState(initialCode);
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'biweekly' | 'monthly'>('monthly');
  const [amount, setAmount] = useState(1000);
  const [days, setDays] = useState(730);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BacktestResponse | null>(null);
  const [error, setError] = useState('');
  const [refetching, setRefetching] = useState(false);

  useEffect(() => {
    if (initialCode) setFundCode(initialCode);
  }, [initialCode]);

  // 有 fund_code 参数时自动运行回测
  useEffect(() => {
    if (initialCode) {
      handleRunWithCode(initialCode);
    }
  }, [initialCode]);

  const handleRunWithCode = async (code: string) => {
    if (!code.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await runBacktest({
        fund_code: code.trim(),
        period,
        amount,
        days,
      });
      if (res.error) {
        setError(res.error);
        setResult(null);
      } else {
        setResult(res);
      }
    } catch {
      setError('回测请求失败');
    } finally {
      setLoading(false);
    }
  };

  const handleRefetchData = async () => {
    if (!fundCode.trim()) return;
    setRefetching(true);
    try {
      await fetchFundData({ fund_code: fundCode.trim(), days: 730 });
      // 重新运行回测
      await handleRun();
    } catch {
      setError('重新拉取数据失败');
    } finally {
      setRefetching(false);
    }
  };

  const handleRun = async () => {
    if (!fundCode.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await runBacktest({
        fund_code: fundCode.trim(),
        period,
        amount,
        days,
      });
      if (res.error) {
        setError(res.error);
        setResult(null);
      } else {
        setResult(res);
      }
    } catch {
      setError('回测请求失败');
    } finally {
      setLoading(false);
    }
  };

  const chartOption = result ? {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis' as const,
      backgroundColor: '#1A2F35',
      borderColor: '#2A4550',
      textStyle: { color: '#E8F0F2', fontSize: 12 },
    },
    legend: {
      data: ['累计市值', '累计成本'],
      textStyle: { color: '#8BA3AA' },
      top: 10,
    },
    grid: { left: 60, right: 30, top: 50, bottom: 30 },
    xAxis: {
      type: 'category' as const,
      data: result.invest_records.map((r) => r.date),
      axisLine: { lineStyle: { color: '#2A4550' } },
      axisLabel: { color: '#5A757D', fontSize: 10, rotate: 30 },
    },
    yAxis: {
      type: 'value' as const,
      axisLine: { lineStyle: { color: '#2A4550' } },
      axisLabel: { color: '#5A757D', fontSize: 10 },
      splitLine: { lineStyle: { color: '#1A2F35' } },
    },
    series: [
      {
        name: '累计市值',
        type: 'line' as const,
        data: result.invest_records.map((r) => {
          const idx = result.invest_records.indexOf(r);
          let shares = 0;
          for (let i = 0; i <= idx; i++) shares += result.invest_records[i].shares;
          return (shares * r.price).toFixed(2);
        }),
        smooth: true,
        lineStyle: { color: '#2EC4B6', width: 2 },
        areaStyle: {
          color: {
            type: 'linear' as const,
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(46,196,182,0.25)' },
              { offset: 1, color: 'rgba(46,196,182,0.02)' },
            ],
          },
        },
        itemStyle: { color: '#2EC4B6' },
      },
      {
        name: '累计成本',
        type: 'line' as const,
        data: result.invest_records.map((r) => r.total_cost),
        lineStyle: { color: '#E8B931', width: 2, type: 'dashed' as const },
        itemStyle: { color: '#E8B931' },
      },
    ],
  } : null;

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-primary)' }}>
      <div className="ml-16 p-8 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => navigate('/')} className="p-2 rounded-lg transition-colors"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--accent)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}>
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
            定投回测
          </h1>
        </div>

        <div className="flex gap-6">
          {/* Left Panel - Config */}
          <div className="w-72 shrink-0 space-y-5">
            <div className="rounded-xl p-5 space-y-4"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
              <div>
                <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                  基金代码
                </label>
                <input
                  value={fundCode}
                  onChange={(e) => setFundCode(e.target.value)}
                  placeholder="如 110011"
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                  style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                />
              </div>

              <div>
                <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                  定投周期
                </label>
                <div className="flex gap-2">
                  {(['daily', 'weekly', 'biweekly', 'monthly'] as const).map((p) => (
                    <button
                      key={p}
                      onClick={() => setPeriod(p)}
                      className="flex-1 py-1.5 rounded-lg text-xs font-medium transition-all"
                      style={{
                        background: period === p ? 'var(--accent)' : 'var(--bg-secondary)',
                        color: period === p ? 'var(--bg-primary)' : 'var(--text-muted)',
                        border: `1px solid ${period === p ? 'var(--accent)' : 'var(--border)'}`,
                      }}
                    >
                      {p === 'daily' ? '每日' : p === 'weekly' ? '每周' : p === 'biweekly' ? '双周' : '每月'}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                  每次金额 (元)
                </label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg text-sm font-data outline-none"
                  style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                />
              </div>

              <div>
                <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                  回测时长 (天)
                </label>
                <input
                  type="range"
                  min={180}
                  max={1825}
                  step={30}
                  value={days}
                  onChange={(e) => setDays(Number(e.target.value))}
                  className="w-full accent-[#2EC4B6]"
                />
                <p className="text-xs font-data text-right" style={{ color: 'var(--text-muted)' }}>
                  {days} 天 (~{(days / 365).toFixed(1)} 年)
                </p>
              </div>

              <button
                onClick={handleRun}
                disabled={loading}
                className="w-full py-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-all"
                style={{
                  background: loading ? 'var(--accent-dim)' : 'var(--accent)',
                  color: 'var(--bg-primary)',
                }}
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
                {loading ? '回测中...' : '开始回测'}
              </button>
            </div>
          </div>

          {/* Right Panel - Results */}
          <div className="flex-1 min-w-0 space-y-5">
            {error && (
              <div className="rounded-xl p-4" style={{ background: 'rgba(255,107,107,0.1)', border: '1px solid rgba(255,107,107,0.3)' }}>
                <p className="text-sm mb-3" style={{ color: 'var(--coral)' }}>{error}</p>
                <button
                  onClick={handleRefetchData}
                  disabled={refetching}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-all"
                  style={{ background: 'var(--accent)', color: 'var(--bg-primary)' }}
                >
                  {refetching ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                  {refetching ? '拉取中...' : '重新拉取数据并回测'}
                </button>
              </div>
            )}

            {result && (
              <>
                {/* Metric Cards */}
                <div className="grid grid-cols-4 gap-3">
                  {[
                    { label: '总收益率', value: `${result.total_return_pct}%`, color: result.total_return_pct >= 0 ? 'var(--gold)' : 'var(--coral)' },
                    { label: '年化收益率', value: `${result.annual_return_pct}%`, color: result.annual_return_pct >= 0 ? 'var(--gold)' : 'var(--coral)' },
                    { label: '最大回撤', value: `${result.max_drawdown_pct}%`, color: 'var(--coral)' },
                    { label: '定投次数', value: `${result.invest_count}次`, color: 'var(--accent)' },
                  ].map((m) => (
                    <div key={m.label} className="rounded-xl p-4"
                      style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                      <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>{m.label}</p>
                      <p className="font-data text-xl font-bold" style={{ color: m.color }}>{m.value}</p>
                    </div>
                  ))}
                </div>

                {/* Cost & Value Summary */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl p-4"
                    style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                    <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>累计投入</p>
                    <p className="font-data text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                      ¥{result.total_cost.toLocaleString()}
                    </p>
                  </div>
                  <div className="rounded-xl p-4"
                    style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                    <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>最终市值</p>
                    <p className="font-data text-lg font-bold" style={{ color: result.final_value >= result.total_cost ? 'var(--gold)' : 'var(--coral)' }}>
                      ¥{result.final_value.toLocaleString()}
                    </p>
                  </div>
                </div>

                {/* Chart */}
                {chartOption && (
                  <div className="rounded-xl p-4"
                    style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                    <ReactECharts option={chartOption} style={{ height: 360 }} />
                  </div>
                )}

                {/* Detail Table */}
                <div className="rounded-xl overflow-hidden"
                  style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                  <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
                    <h3 className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>定投明细</h3>
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr style={{ background: 'var(--bg-secondary)' }}>
                          {['日期', '价格', '买入份额', '累计成本'].map((h) => (
                            <th key={h} className="px-4 py-2 text-left font-medium" style={{ color: 'var(--text-muted)' }}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {result.invest_records.map((r, i) => (
                          <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                            <td className="px-4 py-2 font-data" style={{ color: 'var(--text-secondary)' }}>{r.date}</td>
                            <td className="px-4 py-2 font-data" style={{ color: 'var(--text-primary)' }}>{r.price}</td>
                            <td className="px-4 py-2 font-data" style={{ color: 'var(--accent)' }}>{r.shares}</td>
                            <td className="px-4 py-2 font-data" style={{ color: 'var(--text-primary)' }}>¥{r.total_cost.toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}

            {!result && !error && (
              <div className="flex items-center justify-center py-32">
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  配置参数后点击「开始回测」
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

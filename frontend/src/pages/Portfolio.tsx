import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactECharts from 'echarts-for-react';
import { fetchFunds, runPortfolioBacktest } from '@/lib/api';
import type { FundInfo, PortfolioHolding, PortfolioBacktestResponse } from '@/lib/api';
import { ArrowLeft, Plus, Trash2, Play, Loader2, PieChart } from 'lucide-react';

export default function Portfolio() {
  const navigate = useNavigate();
  const [allFunds, setAllFunds] = useState<FundInfo[]>([]);
  const [holdings, setHoldings] = useState<PortfolioHolding[]>([]);
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'biweekly' | 'monthly'>('monthly');
  const [totalAmount, setTotalAmount] = useState(1000);
  const [days, setDays] = useState(730);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PortfolioBacktestResponse | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchFunds().then(setAllFunds).catch(() => {});
  }, []);

  // 添加持仓：默认均分权重
  const addHolding = (fundCode: string) => {
    if (holdings.find((h) => h.fund_code === fundCode)) return;
    const newCount = holdings.length + 1;
    const weight = Math.round((1 / newCount) * 100) / 100;
    const newHoldings = [...holdings, { fund_code: fundCode, weight }];
    // 重新均分所有权重，确保总和为1
    const evenWeight = Math.round((1 / newCount) * 100) / 100;
    const remainder = Math.round((1 - evenWeight * newCount) * 100) / 100;
    newHoldings.forEach((h, i) => {
      h.weight = evenWeight + (i === 0 ? remainder : 0);
    });
    setHoldings(newHoldings);
  };

  const removeHolding = (fundCode: string) => {
    const newHoldings = holdings.filter((h) => h.fund_code !== fundCode);
    if (newHoldings.length > 0) {
      // 重新均分
      const evenWeight = Math.round((1 / newHoldings.length) * 100) / 100;
      const remainder = Math.round((1 - evenWeight * newHoldings.length) * 100) / 100;
      newHoldings.forEach((h, i) => {
        h.weight = evenWeight + (i === 0 ? remainder : 0);
      });
    }
    setHoldings(newHoldings);
  };

  const updateWeight = (fundCode: string, weight: number) => {
    setHoldings(holdings.map((h) => h.fund_code === fundCode ? { ...h, weight } : h));
  };

  const totalWeight = holdings.reduce((s, h) => s + h.weight, 0);

  const handleRun = async () => {
    if (holdings.length === 0) { setError('请至少添加一只基金'); return; }
    if (Math.abs(totalWeight - 1) > 0.01) { setError(`权重之和需为1.0，当前 ${totalWeight.toFixed(2)}`); return; }
    setLoading(true);
    setError('');
    try {
      const res = await runPortfolioBacktest(holdings, period, totalAmount, days);
      if (res.error) { setError(res.error); setResult(null); }
      else setResult(res);
    } catch { setError('组合回测请求失败'); }
    finally { setLoading(false); }
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
      data: ['组合市值', '累计成本'],
      textStyle: { color: '#8BA3AA' },
      top: 10,
    },
    grid: { left: 60, right: 30, top: 50, bottom: 30 },
    xAxis: {
      type: 'category' as const,
      data: result.portfolio_records.map((r) => r.date),
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
        name: '组合市值',
        type: 'line' as const,
        data: result.portfolio_records.map((r) => r.portfolio_value.toFixed(2)),
        smooth: true,
        lineStyle: { color: '#2EC4B6', width: 2 },
        areaStyle: {
          color: { type: 'linear' as const, x: 0, y: 0, x2: 0, y2: 1, colorStops: [
            { offset: 0, color: 'rgba(46,196,182,0.25)' },
            { offset: 1, color: 'rgba(46,196,182,0.02)' },
          ] },
        },
        itemStyle: { color: '#2EC4B6' },
      },
      {
        name: '累计成本',
        type: 'line' as const,
        data: result.portfolio_records.map((r) => r.total_cost),
        lineStyle: { color: '#E8B931', width: 2, type: 'dashed' as const },
        itemStyle: { color: '#E8B931' },
      },
    ],
  } : null;

  const pieOption = result ? {
    backgroundColor: 'transparent',
    tooltip: { backgroundColor: '#1A2F35', borderColor: '#2A4550', textStyle: { color: '#E8F0F2' } },
    series: [{
      type: 'pie' as const,
      radius: ['40%', '70%'],
      data: result.holdings.map((h) => ({
        name: h.fund_name,
        value: h.market_value,
      })),
      label: { color: '#8BA3AA', fontSize: 10 },
      itemStyle: { borderColor: '#1A2F35', borderWidth: 2 },
      color: ['#2EC4B6', '#E8B931', '#FF6B6B', '#7C3AED', '#3B82F6', '#F97316'],
    }],
  } : null;

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-primary)' }}>
      <div className="ml-16 p-8 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => navigate('/')} className="p-2 rounded-lg transition-colors"
            style={{ color: 'var(--text-muted)' }}>
            <ArrowLeft size={20} />
          </button>
          <PieChart size={24} style={{ color: 'var(--accent)' }} />
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
            组合回测
          </h1>
        </div>

        <div className="flex gap-6">
          {/* Left Panel - Config */}
          <div className="w-80 shrink-0 space-y-5">
            {/* Add Holdings */}
            <div className="rounded-xl p-5"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
              <h3 className="text-sm font-medium mb-3" style={{ color: 'var(--text-secondary)' }}>
                添加持仓
              </h3>
              <select
                onChange={(e) => { if (e.target.value) addHolding(e.target.value); e.target.value = ''; }}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none mb-3"
                style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                defaultValue=""
              >
                <option value="" disabled>选择基金添加到组合</option>
                {allFunds.filter((f) => !holdings.find((h) => h.fund_code === f.fund_code)).map((f) => (
                  <option key={f.fund_code} value={f.fund_code}>
                    {f.fund_code} - {f.fund_name}
                  </option>
                ))}
              </select>

              {/* Holdings List */}
              {holdings.length > 0 && (
                <div className="space-y-2">
                  {holdings.map((h) => {
                    const fund = allFunds.find((f) => f.fund_code === h.fund_code);
                    return (
                      <div key={h.fund_code} className="flex items-center gap-2 p-2 rounded-lg"
                        style={{ background: 'var(--bg-secondary)' }}>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs truncate" style={{ color: 'var(--text-primary)' }}>
                            {fund?.fund_name || h.fund_code}
                          </p>
                          <p className="text-xs font-data" style={{ color: 'var(--text-muted)' }}>{h.fund_code}</p>
                        </div>
                        <input
                          type="number"
                          value={h.weight}
                          onChange={(e) => updateWeight(h.fund_code, parseFloat(e.target.value) || 0)}
                          step={0.1}
                          min={0}
                          max={1}
                          className="w-16 px-2 py-1 rounded text-xs font-data text-center outline-none"
                          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--accent)' }}
                        />
                        <button onClick={() => removeHolding(h.fund_code)} className="p-1"
                          style={{ color: 'var(--text-muted)' }}>
                          <Trash2 size={12} />
                        </button>
                      </div>
                    );
                  })}
                  <p className="text-xs font-data text-right" style={{
                    color: Math.abs(totalWeight - 1) < 0.01 ? 'var(--accent)' : 'var(--coral)'
                  }}>
                    权重合计: {totalWeight.toFixed(2)}
                  </p>
                </div>
              )}
            </div>

            {/* Params */}
            <div className="rounded-xl p-5 space-y-4"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
              <div>
                <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                  定投周期
                </label>
                <div className="flex gap-2">
                  {(['daily', 'weekly', 'biweekly', 'monthly'] as const).map((p) => (
                    <button key={p} onClick={() => setPeriod(p)}
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
                  每次总金额 (元)
                </label>
                <input type="number" value={totalAmount}
                  onChange={(e) => setTotalAmount(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg text-sm font-data outline-none"
                  style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                />
              </div>
              <div>
                <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                  回测时长 (天)
                </label>
                <input type="range" min={180} max={1825} step={30} value={days}
                  onChange={(e) => setDays(Number(e.target.value))} className="w-full accent-[#2EC4B6]" />
                <p className="text-xs font-data text-right" style={{ color: 'var(--text-muted)' }}>
                  {days} 天 (~{(days / 365).toFixed(1)} 年)
                </p>
              </div>
              <button onClick={handleRun} disabled={loading}
                className="w-full py-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-all"
                style={{ background: loading ? 'var(--accent-dim)' : 'var(--accent)', color: 'var(--bg-primary)' }}
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
                {loading ? '回测中...' : '开始组合回测'}
              </button>
            </div>
          </div>

          {/* Right Panel - Results */}
          <div className="flex-1 min-w-0 space-y-5">
            {error && (
              <div className="rounded-xl p-4 text-sm" style={{ background: 'rgba(255,107,107,0.1)', border: '1px solid rgba(255,107,107,0.3)', color: 'var(--coral)' }}>
                {error}
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

                {/* Cost & Value */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                    <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>累计投入</p>
                    <p className="font-data text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                      ¥{result.total_cost.toLocaleString()}
                    </p>
                  </div>
                  <div className="rounded-xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                    <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>最终市值</p>
                    <p className="font-data text-lg font-bold" style={{ color: result.final_value >= result.total_cost ? 'var(--gold)' : 'var(--coral)' }}>
                      ¥{result.final_value.toLocaleString()}
                    </p>
                  </div>
                </div>

                {/* Chart + Pie */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-2 rounded-xl p-4"
                    style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                    {chartOption && <ReactECharts option={chartOption} style={{ height: 320 }} />}
                  </div>
                  <div className="rounded-xl p-4"
                    style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                    <h3 className="text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>持仓分布</h3>
                    {pieOption && <ReactECharts option={pieOption} style={{ height: 280 }} />}
                  </div>
                </div>

                {/* Holdings Detail */}
                <div className="rounded-xl overflow-hidden"
                  style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                  <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
                    <h3 className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>各基金持仓明细</h3>
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ background: 'var(--bg-secondary)' }}>
                        {['基金', '权重', '投入', '市值', '收益率'].map((h) => (
                          <th key={h} className="px-4 py-2 text-left text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {result.holdings.map((h) => (
                        <tr key={h.fund_code} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td className="px-4 py-2">
                            <p className="text-xs" style={{ color: 'var(--text-primary)' }}>{h.fund_name}</p>
                            <p className="text-xs font-data" style={{ color: 'var(--text-muted)' }}>{h.fund_code}</p>
                          </td>
                          <td className="px-4 py-2 font-data" style={{ color: 'var(--accent)' }}>{(h.weight * 100).toFixed(0)}%</td>
                          <td className="px-4 py-2 font-data" style={{ color: 'var(--text-secondary)' }}>¥{h.total_cost.toLocaleString()}</td>
                          <td className="px-4 py-2 font-data" style={{ color: 'var(--text-primary)' }}>¥{h.market_value.toLocaleString()}</td>
                          <td className="px-4 py-2 font-data font-medium" style={{ color: h.return_pct >= 0 ? 'var(--gold)' : 'var(--coral)' }}>
                            {h.return_pct}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {!result && !error && (
              <div className="flex items-center justify-center py-32">
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  添加基金并配置权重后，点击「开始组合回测」
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

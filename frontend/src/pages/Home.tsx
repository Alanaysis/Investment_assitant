import { useEffect, useState } from 'react';
import SearchBar from '@/components/SearchBar';
import FundCard from '@/components/FundCard';
import { useFundStore } from '@/hooks/useFundStore';
import { fetchFunds, fetchPopularFunds, batchFetchFunds } from '@/lib/api';
import type { PopularFund } from '@/lib/api';
import { Wallet, Download, Loader2, Sparkles } from 'lucide-react';

export default function Home() {
  const { funds, setFunds, removeFund } = useFundStore();
  const [popular, setPopular] = useState<PopularFund[]>([]);
  const [batching, setBatching] = useState(false);
  const [batchMsg, setBatchMsg] = useState('');

  useEffect(() => {
    fetchFunds().then(setFunds).catch(() => {});
    fetchPopularFunds().then(setPopular).catch(() => {});
  }, [setFunds]);

  const handleBatchFetch = async () => {
    setBatching(true);
    setBatchMsg('');
    try {
      const res = await batchFetchFunds([], true, 730);
      setBatchMsg(`成功 ${res.success} 只，失败 ${res.failed} 只`);
      const updated = await fetchFunds();
      setFunds(updated);
    } catch {
      setBatchMsg('批量拉取失败');
    } finally {
      setBatching(false);
    }
  };

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-primary)' }}>
      <div className="ml-16 p-8 max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-2">
            <Wallet size={28} style={{ color: 'var(--accent)' }} />
            <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
              基金小助手
            </h1>
          </div>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            输入基金代码拉取数据，点击卡片进入定投回测
          </p>
        </div>

        {/* Search */}
        <div className="mb-8">
          <SearchBar />
        </div>

        {/* Quick Batch Fetch */}
        <div className="mb-8 rounded-xl p-5"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Sparkles size={16} style={{ color: 'var(--gold)' }} />
              <h2 className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                热门基金一键拉取
              </h2>
            </div>
            <button
              onClick={handleBatchFetch}
              disabled={batching}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-all"
              style={{
                background: batching ? 'var(--accent-dim)' : 'var(--accent)',
                color: 'var(--bg-primary)',
              }}
            >
              {batching ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              {batching ? '拉取中...' : '一键拉取全部'}
            </button>
          </div>
          {batchMsg && (
            <p className="text-xs mb-3 animate-fade-in-up" style={{ color: 'var(--accent)' }}>{batchMsg}</p>
          )}
          <div className="flex flex-wrap gap-2">
            {popular.map((f) => {
              const exists = funds.some((fu) => fu.fund_code === f.code);
              return (
                <span
                  key={f.code}
                  className="text-xs px-2.5 py-1 rounded-full"
                  style={{
                    background: exists ? 'var(--accent-dim)' : 'var(--bg-secondary)',
                    color: exists ? 'var(--accent)' : 'var(--text-muted)',
                    border: `1px solid ${exists ? 'var(--accent)' : 'var(--border)'}`,
                  }}
                >
                  {f.name}
                  {exists && ' ✓'}
                </span>
              );
            })}
          </div>
        </div>

        {/* Fund Grid */}
        {funds.length > 0 ? (
          <div>
            <h2 className="text-sm font-medium mb-4" style={{ color: 'var(--text-secondary)' }}>
              已添加基金 ({funds.length})
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {funds.map((fund) => (
                <FundCard key={fund.fund_code} fund={fund} onRemove={removeFund} />
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-20">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
              style={{ background: 'var(--bg-card)' }}>
              <Wallet size={28} style={{ color: 'var(--text-muted)' }} />
            </div>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              还没有添加基金，输入代码或一键拉取热门基金
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

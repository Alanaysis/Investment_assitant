import { useState } from 'react';
import { Search, Loader2 } from 'lucide-react';
import { fetchFundData } from '@/lib/api';
import { useFundStore } from '@/hooks/useFundStore';

export default function SearchBar() {
  const [query, setQuery] = useState('');
  const [fetching, setFetching] = useState(false);
  const [message, setMessage] = useState('');
  const addFund = useFundStore((s) => s.addFund);
  const setFunds = useFundStore((s) => s.setFunds);
  const funds = useFundStore((s) => s.funds);

  const handleFetch = async () => {
    const code = query.trim();
    if (!code) return;
    setFetching(true);
    setMessage('');
    try {
      const res = await fetchFundData({ fund_code: code, days: 730 });
      setMessage(res.message);
      // Refresh fund list
      const { fetchFunds } = await import('@/lib/api');
      const updated = await fetchFunds();
      setFunds(updated);
    } catch (err) {
      setMessage('拉取失败，请检查基金代码');
    } finally {
      setFetching(false);
      setQuery('');
    }
  };

  return (
    <div className="w-full max-w-xl mx-auto">
      <div className="relative flex items-center">
        <Search size={18} className="absolute left-4" style={{ color: 'var(--text-muted)' }} />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleFetch()}
          placeholder="输入基金代码，如 110011 或 510300"
          className="w-full pl-11 pr-28 py-3.5 rounded-xl text-sm outline-none transition-all duration-200"
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            color: 'var(--text-primary)',
          }}
          onFocus={(e) => { e.target.style.borderColor = 'var(--accent)'; }}
          onBlur={(e) => { e.target.style.borderColor = 'var(--border)'; }}
        />
        <button
          onClick={handleFetch}
          disabled={fetching}
          className="absolute right-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2"
          style={{
            background: fetching ? 'var(--accent-dim)' : 'var(--accent)',
            color: 'var(--bg-primary)',
          }}
        >
          {fetching ? <Loader2 size={14} className="animate-spin" /> : null}
          {fetching ? '拉取中' : '拉取数据'}
        </button>
      </div>
      {message && (
        <p className="mt-2 text-xs text-center animate-fade-in-up" style={{ color: 'var(--accent)' }}>
          {message}
        </p>
      )}
    </div>
  );
}

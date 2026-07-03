import { useState } from 'react';
import { Search } from 'lucide-react';
import { useFundStore } from '@/hooks/useFundStore';

export default function SearchBar() {
  const [query, setQuery] = useState('');
  const [message, setMessage] = useState('');
  const funds = useFundStore((s) => s.funds);

  const handleSearch = () => {
    const code = query.trim();
    if (!code) return;
    const found = funds.some((f) => f.fund_code === code);
    if (found) {
      setMessage(`已找到基金 ${code}，可在下方列表点击进入回测`);
    } else {
      setMessage('该基金数据未预置，静态版本不支持实时拉取');
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
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          placeholder="输入基金代码查找，如 110011 或 510300"
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
          onClick={handleSearch}
          className="absolute right-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200"
          style={{
            background: 'var(--accent)',
            color: 'var(--bg-primary)',
          }}
        >
          查找
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

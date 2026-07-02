import { useNavigate } from 'react-router-dom';
import { TrendingUp, X, Building2, BarChart3, Database, AlertCircle } from 'lucide-react';
import type { FundInfo } from '@/lib/api';

interface FundCardProps {
  fund: FundInfo;
  onRemove: (code: string) => void;
}

export default function FundCard({ fund, onRemove }: FundCardProps) {
  const navigate = useNavigate();
  const isETF = fund.fund_type === 'ETF';
  const dataCount = fund.data_count ?? 0;
  const hasData = dataCount > 0;

  return (
    <div
      className="relative rounded-xl p-5 cursor-pointer transition-all duration-300 group animate-fade-in-up"
      style={{
        background: 'var(--bg-card)',
        border: `1px solid ${hasData ? 'var(--border)' : 'rgba(255,107,107,0.3)'}`,
        opacity: hasData ? 1 : 0.75,
      }}
      onClick={() => navigate(`/backtest?fund=${fund.fund_code}`)}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'var(--accent)';
        e.currentTarget.style.background = 'var(--bg-card-hover)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = hasData ? 'var(--border)' : 'rgba(255,107,107,0.3)';
        e.currentTarget.style.background = 'var(--bg-card)';
      }}
    >
      <button
        className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded"
        style={{ color: 'var(--text-muted)' }}
        onClick={(e) => { e.stopPropagation(); onRemove(fund.fund_code); }}
      >
        <X size={14} />
      </button>

      <div className="flex items-center gap-2 mb-3">
        {isETF ? (
          <BarChart3 size={16} style={{ color: 'var(--accent)' }} />
        ) : (
          <Building2 size={16} style={{ color: 'var(--accent)' }} />
        )}
        <span className="text-xs px-2 py-0.5 rounded-full"
          style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}>
          {fund.fund_type || '基金'}
        </span>
      </div>

      <h3 className="text-sm font-medium mb-1 truncate" style={{ color: 'var(--text-primary)' }}>
        {fund.fund_name}
      </h3>
      <p className="font-data text-xs" style={{ color: 'var(--text-muted)' }}>
        {fund.fund_code}
      </p>

      <div className="mt-3 flex items-center gap-3">
        {fund.fund_scale && (
          <div className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
            <TrendingUp size={12} />
            <span>规模 {fund.fund_scale}亿</span>
          </div>
        )}
        <div className="flex items-center gap-1 text-xs" style={{
          color: hasData ? 'var(--accent)' : 'var(--coral)'
        }}>
          {hasData ? (
            <>
              <Database size={12} />
              <span>{dataCount} 条数据</span>
            </>
          ) : (
            <>
              <AlertCircle size={12} />
              <span>无数据</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

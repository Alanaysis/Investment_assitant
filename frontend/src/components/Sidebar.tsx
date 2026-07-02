import { NavLink } from 'react-router-dom';
import { LayoutDashboard, LineChart, Trophy, TrendingUp, PieChart } from 'lucide-react';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: '仪表盘' },
  { to: '/backtest', icon: LineChart, label: '定投回测' },
  { to: '/portfolio', icon: PieChart, label: '组合回测' },
  { to: '/scoring', icon: Trophy, label: '评分排名' },
];

export default function Sidebar() {
  return (
    <aside className="fixed left-0 top-0 h-screen w-16 flex flex-col items-center py-6 gap-2 z-50"
      style={{ background: 'var(--bg-secondary)', borderRight: '1px solid var(--border)' }}>
      <div className="mb-6 flex items-center justify-center w-10 h-10 rounded-xl"
        style={{ background: 'var(--accent)' }}>
        <TrendingUp size={20} style={{ color: 'var(--bg-primary)' }} />
      </div>
      {navItems.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === '/'}
          className={({ isActive }) =>
            `w-10 h-10 flex items-center justify-center rounded-xl transition-all duration-200 group relative ${
              isActive ? 'animate-pulse-glow' : ''
            }`
          }
          style={({ isActive }) => ({
            background: isActive ? 'var(--accent-dim)' : 'transparent',
            color: isActive ? 'var(--accent)' : 'var(--text-muted)',
          })}
        >
          <item.icon size={20} />
          <span className="absolute left-14 px-2 py-1 rounded text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
            style={{ background: 'var(--bg-card)', color: 'var(--text-primary)' }}>
            {item.label}
          </span>
        </NavLink>
      ))}
    </aside>
  );
}

import React from 'react';
import { Briefcase, Search, ShieldCheck, Sparkles, TrendingUp } from 'lucide-react';

export type TabKey = 'portfolio' | 'search' | 'evaluation' | 'optimizer' | 'trends';

interface BottomTabBarProps {
  activeTab: TabKey | 'dividends';
  onTabChange: (tab: TabKey) => void;
  optimizationCount?: number;
}

export const BottomTabBar: React.FC<BottomTabBarProps> = ({
  activeTab,
  onTabChange,
  optimizationCount = 2,
}) => {
  const tabs = [
    {
      key: 'portfolio' as TabKey,
      label: 'Portofolio',
      icon: Briefcase,
    },
    {
      key: 'search' as TabKey,
      label: 'Cari Ticker',
      icon: Search,
    },
    {
      key: 'evaluation' as TabKey,
      label: 'Penilaian AI',
      icon: ShieldCheck,
    },
    {
      key: 'optimizer' as TabKey,
      label: 'Saran Optimasi',
      icon: Sparkles,
      badge: optimizationCount > 0 ? optimizationCount : undefined,
    },
    {
      key: 'trends' as TabKey,
      label: 'Tren Pasar',
      icon: TrendingUp,
    },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-slate-950/95 backdrop-blur-lg border-t border-slate-800/80 safe-area-bottom">
      <div className="max-w-md mx-auto grid grid-cols-5 h-16 px-0.5">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          const Icon = tab.icon;

          return (
            <button
              key={tab.key}
              onClick={() => onTabChange(tab.key)}
              className={`min-h-[44px] flex flex-col items-center justify-center relative py-1 px-0.5 transition-all duration-200 select-none active:scale-95 ${
                isActive ? 'text-emerald-400' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <div className="relative">
                <Icon
                  className={`w-5 h-5 transition-transform duration-200 ${
                    isActive ? 'scale-110 stroke-[2.2]' : 'stroke-[1.8]'
                  }`}
                />
                {tab.badge && !isActive && (
                  <span className="absolute -top-1 -right-2 px-1.5 py-0.2 text-[9px] font-bold bg-amber-500 text-slate-950 rounded-full leading-none min-w-[14px] text-center">
                    {tab.badge}
                  </span>
                )}
              </div>
              <span
                className={`text-[9.5px] sm:text-[10px] leading-tight tracking-tight mt-1 transition-all font-medium truncate max-w-full ${
                  isActive ? 'text-emerald-400 font-semibold' : 'text-slate-400'
                }`}
              >
                {tab.label}
              </span>
              {isActive && (
                <span className="w-1 h-1 rounded-full bg-emerald-400 mt-0.5 animate-pulse" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

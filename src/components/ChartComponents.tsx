import React from 'react';
import { useLanguage } from '../i18n/LanguageContext';

// SVG Allocation Bar / Donut
interface AllocationItem {
  name: string;
  weight: number;
  color?: string;
}

const DEFAULT_COLORS = [
  '#06b6d4', // cyan
  '#10b981', // emerald
  '#8b5cf6', // purple
  '#f59e0b', // amber
  '#3b82f6', // blue
  '#ec4899', // pink
  '#14b8a6', // teal
  '#f97316', // orange
];

export const AllocationBar: React.FC<{ items: AllocationItem[] }> = React.memo(({ items }) => {
  if (!items || items.length === 0) return null;

  return (
    <div className="w-full">
      {/* Visual Bar */}
      <div className="h-3 w-full rounded-full overflow-hidden flex bg-slate-800">
        {items.map((item, idx) => {
          const color = item.color || DEFAULT_COLORS[idx % DEFAULT_COLORS.length];
          return (
            <div
              key={item.name}
              style={{ width: `${Math.max(item.weight, 1.5)}%`, backgroundColor: color }}
              className="h-full transition-all duration-500 first:rounded-l-full last:rounded-r-full"
              title={`${item.name}: ${item.weight}%`}
            />
          );
        })}
      </div>

      {/* Legend Grid */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mt-3 text-xs">
        {items.map((item, idx) => {
          const color = item.color || DEFAULT_COLORS[idx % DEFAULT_COLORS.length];
          return (
            <div key={item.name} className="flex items-center justify-between text-slate-300">
              <div className="flex items-center gap-1.5 truncate pr-2">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                <span className="truncate">{item.name}</span>
              </div>
              <span className="tabular-nums font-semibold text-slate-200">{item.weight}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
});

// 12-Month Performance Backtest SVG Area Chart
interface HistoryPoint {
  month: string;
  portfolio: number;
  benchmark: number;
}

export const PerformanceBacktestChart: React.FC<{
  data: HistoryPoint[];
  portfolioName?: string;
}> = React.memo(({ data, portfolioName }) => {
  const { t } = useLanguage();
  const gradUid = React.useId().replace(/:/g, '');
  const gradientId = `portfolioGradient-${gradUid}`;
  const displayPortName = portfolioName || t('Portofolio', 'Portfolio');
  if (!data || data.length === 0) return null;

  const width = 500;
  const height = 180;
  const padding = { top: 20, right: 15, bottom: 25, left: 35 };

  const allValues = data.flatMap((d) => [d.portfolio, d.benchmark]);
  const minVal = Math.floor(Math.min(...allValues) * 0.95);
  const maxVal = Math.ceil(Math.max(...allValues) * 1.05);

  const getX = (idx: number) => {
    const tNorm = data.length <= 1 ? 0.5 : idx / (data.length - 1);
    return padding.left + tNorm * (width - padding.left - padding.right);
  };

  const getY = (val: number) => {
    return height - padding.bottom - ((val - minVal) / (maxVal - minVal || 1)) * (height - padding.top - padding.bottom);
  };

  // Generate SVG path for portfolio
  const portfolioPoints = data.map((d, i) => `${getX(i)},${getY(d.portfolio)}`).join(' L ');
  const portfolioArea = `M ${getX(0)},${height - padding.bottom} L ${portfolioPoints} L ${getX(data.length - 1)},${height - padding.bottom} Z`;

  // Generate SVG path for benchmark (dashed line)
  const benchmarkPoints = data.map((d, i) => `${getX(i)},${getY(d.benchmark)}`).join(' L ');

  const firstPortVal = data[0]?.portfolio || 100;
  const lastPortVal = data[data.length - 1]?.portfolio || 100;
  const returnPct = ((lastPortVal - firstPortVal) / firstPortVal) * 100;

  const firstBenchVal = data[0]?.benchmark || 100;
  const lastBenchVal = data[data.length - 1]?.benchmark || 100;
  const benchReturnPct = ((lastBenchVal - firstBenchVal) / firstBenchVal) * 100;

  return (
    <div className="w-full">
      {/* Legend & Stats */}
      <div className="flex items-center justify-between text-xs mb-3">
        <div className="flex items-center gap-2">
          <span className="w-3 h-0.5 bg-emerald-400 rounded-full" />
          <span className="text-slate-300 font-medium">{displayPortName}</span>
          <span className="tabular-nums font-semibold text-emerald-400">
            {returnPct >= 0 ? '+' : ''}
            {returnPct.toFixed(1)}%
          </span>
        </div>
        <div className="flex items-center gap-2 text-slate-400">
          <span className="w-3 h-0.5 border-t border-dashed border-slate-500" />
          <span>S&P 500 (SPY)</span>
          <span className="tabular-nums text-slate-300">
            {benchReturnPct >= 0 ? '+' : ''}
            {benchReturnPct.toFixed(1)}%
          </span>
        </div>
      </div>

      <div className="relative w-full overflow-hidden">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto overflow-visible select-none"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {[0, 0.5, 1].map((pct, i) => {
            const y = padding.top + pct * (height - padding.top - padding.bottom);
            const val = Math.round(maxVal - pct * (maxVal - minVal));
            return (
              <g key={i}>
                <line
                  x1={padding.left}
                  y1={y}
                  x2={width - padding.right}
                  y2={y}
                  stroke="rgba(148, 163, 184, 0.15)"
                  strokeDasharray="3 3"
                />
                <text
                  x={padding.left - 6}
                  y={y + 3}
                  textAnchor="end"
                  className="text-[10px] fill-slate-500 font-mono tabular-nums"
                >
                  {val}
                </text>
              </g>
            );
          })}

          {/* Portfolio Area Fill */}
          <path d={portfolioArea} fill={`url(#${gradientId})`} />

          {/* Benchmark line (S&P 500) */}
          <path
            d={`M ${benchmarkPoints}`}
            fill="none"
            stroke="#94a3b8"
            strokeWidth="1.5"
            strokeDasharray="4 4"
            opacity="0.7"
          />

          {/* Portfolio stroke */}
          <path d={`M ${portfolioPoints}`} fill="none" stroke="#10b981" strokeWidth="2.5" />

          {/* Data point nodes */}
          {data.map((d, i) => (
            <circle
              key={i}
              cx={getX(i)}
              cy={getY(d.portfolio)}
              r="3"
              className="fill-emerald-400 stroke-slate-950 stroke-[1.5]"
            />
          ))}

          {/* X Axis Labels */}
          {data.map((d, i) => {
            if (i % 2 === 0 || i === data.length - 1) {
              return (
                <text
                  key={i}
                  x={getX(i)}
                  y={height - 6}
                  textAnchor="middle"
                  className="text-[10px] fill-slate-400"
                >
                  {d.month}
                </text>
              );
            }
            return null;
          })}
        </svg>
      </div>
    </div>
  );
});

// Health Meter Gauge Circular SVG
export const ScoreGauge: React.FC<{
  score: number;
  grade: string;
  size?: number;
}> = React.memo(({ score, grade, size = 130 }) => {
  const { t } = useLanguage();
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (Math.min(Math.max(score, 0), 100) / 100) * circumference;

  let strokeColor = '#10b981'; // green
  if (score < 60) strokeColor = '#ef4444'; // red
  else if (score < 75) strokeColor = '#f59e0b'; // amber
  else if (score < 85) strokeColor = '#06b6d4'; // cyan

  return (
    <div className="relative flex flex-col items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="rgba(255, 255, 255, 0.08)"
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Progress */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          fill="none"
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-2xl font-bold tracking-tight text-white tabular-nums leading-none">
          {score}
        </span>
        <span className="text-[10px] font-semibold tracking-wider text-slate-400 mt-0.5">
          {t('PREDIKAT', 'GRADE')} {grade}
        </span>
      </div>
    </div>
  );
});

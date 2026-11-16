import React, { useState } from 'react';
import {
  Plus,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  Sparkles,
  Layers,
  ChevronDown,
  ChevronUp,
  Trash2,
  Award,
  Wallet,
  CalendarDays,
  ChevronRight,
  RotateCcw,
} from 'lucide-react';
import { AllocationBar } from './ChartComponents';
import { D3BenchmarkComparisonChart } from './D3BenchmarkComparisonChart';
import { PRESET_PORTFOLIOS, PresetPortfolio, Asset, formatShareQuantity, convertToCurrency } from '../data/marketData';

interface PortfolioTabProps {
  metrics: any;
  currency: 'IDR' | 'USD';
  usdIdrRate?: number;
  onOpenAddModal: () => void;
  onSelectHolding: (ticker: string) => void;
  onApplyPreset: (preset: PresetPortfolio) => void;
  onClearPortfolio: () => void;
  onNavigateToEvaluation: () => void;
  onOpenDividendCalendar?: () => void;
  currentPresetId: string;
  canRevertOptimization?: boolean;
  onRevertOptimization?: () => void;
}

export const PortfolioTab: React.FC<PortfolioTabProps> = ({
  metrics,
  currency,
  usdIdrRate,
  onOpenAddModal,
  onSelectHolding,
  onApplyPreset,
  onClearPortfolio,
  onNavigateToEvaluation,
  onOpenDividendCalendar,
  currentPresetId,
  canRevertOptimization = false,
  onRevertOptimization,
}) => {
  const [holdingFilter, setHoldingFilter] = useState<'ALL' | 'IDX_STOCK' | 'US_STOCK' | 'ETF'>('ALL');
  const [showPresetDrawer, setShowPresetDrawer] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  const isProfit = metrics.totalGainLoss >= 0;
  const isCustomPortfolio = currentPresetId === 'custom';

  const effectiveFilter =
    holdingFilter === 'ALL' ||
    metrics.holdings.some((h: any) => h.asset?.type === holdingFilter)
      ? holdingFilter
      : 'ALL';

  const filteredHoldings = metrics.holdings.filter((h: any) => {
    if (effectiveFilter === 'ALL') return true;
    return h.asset?.type === effectiveFilter;
  });

  const idxCount = metrics.holdings.filter((h: any) => h.asset?.type === 'IDX_STOCK').length;
  const usCount = metrics.holdings.filter((h: any) => h.asset?.type === 'US_STOCK').length;
  const etfCount = metrics.holdings.filter((h: any) => h.asset?.type === 'ETF').length;

  return (
    <div className="pb-24 pt-2 px-4 space-y-4 max-w-lg mx-auto">
      {/* Hero "Portofolio Saya" Balance Card */}
      <div className="p-5 rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border border-slate-800 shadow-xl relative overflow-hidden">
        {/* Subtle background glow */}
        <div className="absolute top-0 right-0 w-36 h-36 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
          <div className="flex items-center gap-1.5">
            <Wallet className="w-3.5 h-3.5 text-emerald-400" />
            <span className="font-bold text-slate-200 tracking-wide">Portofolio Saya</span>
            {isCustomPortfolio && (
              <span className="text-[10px] font-semibold text-cyan-300 bg-cyan-950/60 px-1.5 py-0.5 rounded border border-cyan-800/50">
                Pribadi
              </span>
            )}
          </div>
          <button
            onClick={onNavigateToEvaluation}
            className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-950/60 hover:bg-emerald-900/60 px-2.5 py-0.5 rounded-lg border border-emerald-800/50 transition-colors"
            title="Lihat Penilaian & Skor Portofolio"
          >
            <Award className="w-3 h-3" />
            <span>Skor: {metrics.healthScore}/100 ({metrics.healthGrade})</span>
          </button>
        </div>

        <div className="flex items-baseline gap-2 mt-1">
          <span className="text-3xl font-extrabold tracking-tight text-white font-mono tabular-nums">
            {currency === 'IDR' ? 'Rp ' : '$'}
            {metrics.totalValue.toLocaleString('id-ID', { maximumFractionDigits: currency === 'USD' ? 2 : 0 })}
          </span>
        </div>

        {/* P&L and Modal */}
        <div className="flex flex-wrap items-center justify-between gap-2 mt-2 text-xs font-medium">
          <div className="flex items-center gap-1.5">
            <div
              className={`flex items-center gap-1 tabular-nums font-semibold ${
                isProfit ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {isProfit ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
              <span>
                {isProfit ? '+' : '-'}
                {currency === 'IDR' ? 'Rp ' : '$'}
                {Math.abs(metrics.totalGainLoss).toLocaleString('id-ID', { maximumFractionDigits: currency === 'USD' ? 2 : 0 })} (
                {metrics.totalGainLossPct >= 0 ? '+' : ''}
                {metrics.totalGainLossPct.toFixed(1)}%)
              </span>
            </div>
            <span className="text-slate-500">· P&L</span>
          </div>

          <span className="text-[11px] text-slate-400 font-mono tabular-nums">
            Modal: {currency === 'IDR' ? 'Rp ' : '$'}
            {metrics.totalCost.toLocaleString('id-ID', { maximumFractionDigits: currency === 'USD' ? 2 : 0 })}
          </span>
        </div>

        {/* 3 Quick KPI Boxes */}
        <div className="grid grid-cols-3 gap-2 mt-4 pt-3.5 border-t border-slate-800/80 text-center">
          <div className="p-2 rounded-xl bg-slate-950/50 border border-slate-800/60">
            <span className="text-[10px] text-slate-400 block">Beta Portofolio</span>
            <span className="text-xs font-bold text-slate-200 font-mono mt-0.5 block">
              {metrics.weightedBeta}
            </span>
          </div>
          <div className="p-2 rounded-xl bg-slate-950/50 border border-slate-800/60">
            <span className="text-[10px] text-slate-400 block">Return 1 Tahun</span>
            <span
              className={`text-xs font-bold font-mono mt-0.5 block ${
                metrics.portfolio1YReturn >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {metrics.portfolio1YReturn >= 0 ? '+' : ''}
              {metrics.portfolio1YReturn}%
            </span>
          </div>
          <button
            type="button"
            onClick={onOpenDividendCalendar}
            className="p-2 rounded-xl bg-slate-950/50 hover:bg-slate-900 border border-slate-800/60 hover:border-cyan-500/40 transition-colors text-center"
            title="Buka Kalender Dividen & Passive Income"
          >
            <span className="text-[10px] text-slate-400 block">Div. Yield</span>
            <span className="text-xs font-bold text-cyan-400 font-mono mt-0.5 block">
              {metrics.portfolioDividendYield}%
            </span>
          </button>
        </div>

        {/* Primary Action Bar for My Portfolio */}
        <div className="flex items-center gap-2 mt-3.5">
          <button
            onClick={onOpenAddModal}
            className="flex-1 h-11 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-500/20 active:scale-[0.98] transition-all"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Tambah Aset ke Portofolio Saya</span>
          </button>

          {metrics.holdings.length > 0 && !confirmClear && (
            <button
              onClick={() => setConfirmClear(true)}
              className="h-11 px-3 rounded-xl bg-slate-800/90 hover:bg-slate-800 text-slate-300 hover:text-rose-400 border border-slate-700/80 text-xs font-medium flex items-center justify-center gap-1 transition-colors"
              title="Kosongkan portofolio untuk input dari awal"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Dividend Calendar Quick Banner */}
        {onOpenDividendCalendar && (
          <button
            type="button"
            onClick={onOpenDividendCalendar}
            className="w-full mt-2.5 px-3.5 py-2.5 rounded-xl bg-slate-950/70 hover:bg-slate-950 border border-slate-800/90 hover:border-emerald-500/40 flex items-center justify-between text-xs transition-colors"
          >
            <div className="flex items-center gap-2 min-w-0">
              <CalendarDays className="w-4 h-4 text-emerald-400 shrink-0" />
              <div className="text-left min-w-0">
                <span className="font-semibold text-slate-100 block truncate">
                  Kalender Dividen & Passive Income
                </span>
                <span className="text-[10px] text-slate-400 block truncate">
                  Pantau ex-date mendatang & estimasi dividen bulanan/tahunan
                </span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />
          </button>
        )}

        {/* Inline Clear Confirmation */}
        {confirmClear && (
          <div className="mt-2.5 p-2.5 rounded-xl bg-rose-950/40 border border-rose-800/70 flex items-center justify-between gap-2 text-xs">
            <span className="text-rose-200 font-medium">Kosongkan semua aset & mulai dari nol?</span>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => setConfirmClear(false)}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-[11px]"
              >
                Batal
              </button>
              <button
                onClick={() => {
                  onClearPortfolio();
                  setConfirmClear(false);
                }}
                className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-[11px]"
              >
                Ya, Kosongkan
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Revert Optimization Banner (only shown after optimization has been applied) */}
      {canRevertOptimization && onRevertOptimization && (
        <div className="p-3.5 rounded-2xl bg-amber-950/30 border border-amber-500/40 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <span className="text-xs font-bold text-amber-300 block">
              Optimasi Portofolio Sedang Diterapkan
            </span>
            <span className="text-[11px] text-slate-300 block">
              Kurang cocok dengan hasilnya? Kembalikan komposisi awal Anda.
            </span>
          </div>
          <button
            type="button"
            onClick={onRevertOptimization}
            className="shrink-0 px-3 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/50 text-amber-200 text-[11px] font-bold flex items-center gap-1.5 transition-colors active:scale-[0.98]"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Kembalikan Sebelum Optimasi</span>
          </button>
        </div>
      )}

      {/* My Holdings List (Front and Center!) */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-bold text-slate-200">
            Aset Saya ({metrics.holdings.length})
          </h3>
          <span className="text-[11px] text-slate-400">Ketuk aset untuk edit / analisis AI</span>
        </div>

        {/* Category Filter Tabs for Holdings */}
        {metrics.holdings.length > 0 && (
          <div className="flex items-center gap-1.5 mb-2.5 overflow-x-auto no-scrollbar pb-0.5">
            <button
              onClick={() => setHoldingFilter('ALL')}
              className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg border whitespace-nowrap transition-colors ${
                effectiveFilter === 'ALL'
                  ? 'bg-slate-800 border-slate-600 text-white'
                  : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              Semua ({metrics.holdings.length})
            </button>
            {idxCount > 0 && (
              <button
                onClick={() => setHoldingFilter('IDX_STOCK')}
                className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg border whitespace-nowrap transition-colors ${
                  effectiveFilter === 'IDX_STOCK'
                    ? 'bg-emerald-500/20 border-emerald-500/60 text-emerald-300'
                    : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                IHSG ({idxCount})
              </button>
            )}
            {usCount > 0 && (
              <button
                onClick={() => setHoldingFilter('US_STOCK')}
                className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg border whitespace-nowrap transition-colors ${
                  effectiveFilter === 'US_STOCK'
                    ? 'bg-cyan-500/20 border-cyan-500/60 text-cyan-300'
                    : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                Saham AS ({usCount})
              </button>
            )}
            {etfCount > 0 && (
              <button
                onClick={() => setHoldingFilter('ETF')}
                className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg border whitespace-nowrap transition-colors ${
                  effectiveFilter === 'ETF'
                    ? 'bg-amber-500/20 border-amber-500/60 text-amber-300'
                    : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                ETF ({etfCount})
              </button>
            )}
          </div>
        )}

        {/* Holdings Cards */}
        <div className="space-y-2">
          {filteredHoldings.map((h: any) => {
            const asset: Asset = h.asset;
            const isItemProfit = h.gainLossVal >= 0;
            // Strict per-market price currency: IHSG -> Rupiah (IDR), ETF & Wall Street -> Dollar (USD)
            const nativeCurrency: 'IDR' | 'USD' = asset.type === 'IDX_STOCK' ? 'IDR' : 'USD';
            const avgBuyPriceInNative =
              h.buyCurrency === nativeCurrency
                ? h.avgBuyPrice
                : convertToCurrency(h.avgBuyPrice, h.buyCurrency, nativeCurrency, usdIdrRate);
            const safeChange1D =
              typeof asset.change1D === 'number' && Number.isFinite(asset.change1D) ? asset.change1D : 0;

            const formatPriceInNative = (val: number, maxDecimalsOverride?: number) => {
              const prefix = nativeCurrency === 'USD' ? '$' : 'Rp ';
              if (!Number.isFinite(val)) return `${prefix}0`;
              if (nativeCurrency === 'IDR') {
                return `${prefix}${val.toLocaleString('id-ID', { maximumFractionDigits: 0 })}`;
              }
              const maxDec = maxDecimalsOverride ?? (val < 1 ? 4 : 2);
              return `${prefix}${val.toLocaleString('id-ID', {
                minimumFractionDigits: 2,
                maximumFractionDigits: maxDec,
              })}`;
            };

            const marketTag =
              asset.type === 'IDX_STOCK' ? 'IHSG' : asset.type === 'US_STOCK' ? 'Wall Street' : 'ETF';

            return (
              <button
                key={h.ticker}
                onClick={() => onSelectHolding(h.ticker)}
                className="w-full p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800/90 hover:border-slate-700 hover:bg-slate-800/40 text-left transition-all active:scale-[0.99]"
              >
                {/* Top row: Ticker, Name, Shares & Total Value / P&L */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-11 h-11 rounded-xl bg-slate-950 flex flex-col items-center justify-center font-bold text-white border border-slate-800 shrink-0 ${
                        h.ticker.length > 4 ? 'text-[10px]' : 'text-xs'
                      }`}
                    >
                      <span className="truncate max-w-[40px]">{h.ticker}</span>
                      <span className="text-[9px] font-normal text-slate-400 mt-0.5 font-mono">
                        {h.weight.toFixed(0)}%
                      </span>
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-sm text-slate-100 truncate">{asset.name}</span>
                      </div>
                      <p className="text-[11px] text-slate-400 truncate mt-0.5 font-mono">
                        {formatShareQuantity(h.shares)} lbr
                        {asset.type === 'IDX_STOCK'
                          ? ` (${(h.shares / 100).toLocaleString('id-ID', { maximumFractionDigits: 2 })} lot)`
                          : ''}{' '}
                        · <span className="font-sans text-slate-500">{marketTag}</span>
                      </p>
                    </div>
                  </div>

                  {/* Right: Total Value & Gain/Loss */}
                  <div className="text-right shrink-0">
                    <p className="text-xs font-bold text-slate-100 tabular-nums font-mono">
                      {currency === 'IDR' ? 'Rp ' : '$'}
                      {h.currentValInView.toLocaleString('id-ID', {
                        maximumFractionDigits: currency === 'USD' ? 2 : 0,
                      })}
                    </p>
                    <p
                      className={`text-[11px] tabular-nums font-semibold mt-0.5 flex items-center justify-end gap-0.5 font-mono ${
                        isItemProfit ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {isItemProfit ? '+' : '-'}
                      {currency === 'IDR' ? 'Rp ' : '$'}
                      {Math.abs(h.gainLossVal).toLocaleString('id-ID', {
                        maximumFractionDigits: currency === 'USD' ? 2 : 0,
                      })}
                    </p>
                    <p
                      className={`text-[10px] tabular-nums font-semibold flex items-center justify-end gap-0.5 ${
                        isItemProfit ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      ({isItemProfit ? '+' : ''}
                      {h.gainLossPct.toFixed(1)}%)
                      <ArrowUpRight className={`w-3 h-3 ${!isItemProfit && 'rotate-90'}`} />
                    </p>
                  </div>
                </div>

                {/* Bottom row: Avg Harga Beli vs Harga Saat Ini (IDR for IHSG, USD for ETF & Wall Street) */}
                <div className="mt-2.5 pt-2 border-t border-slate-800/70 grid grid-cols-2 gap-2 text-[11px]">
                  <div className="min-w-0">
                    <span className="text-[10px] text-slate-400 block">Avg Harga Beli</span>
                    <span className="font-mono font-semibold text-slate-200 truncate block">
                      {formatPriceInNative(avgBuyPriceInNative, nativeCurrency === 'USD' ? 4 : 0)}
                    </span>
                  </div>
                  <div className="min-w-0 text-right">
                    <span className="text-[10px] text-slate-400 block">Harga Saat Ini</span>
                    <div className="font-mono font-bold text-white flex items-center justify-end gap-1 flex-wrap">
                      <span>{formatPriceInNative(asset.price)}</span>
                      <span
                        className={`text-[10px] font-semibold ${
                          safeChange1D >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        ({safeChange1D >= 0 ? '+' : ''}
                        {safeChange1D.toFixed(2)}%)
                      </span>
                    </div>
                  </div>
                </div>
              </button>
            );
          })}

          {metrics.holdings.length === 0 && (
            <div className="p-8 rounded-2xl bg-slate-900/50 border border-dashed border-slate-800 text-center space-y-3">
              <p className="text-sm font-semibold text-slate-200">Portofolio Anda masih kosong</p>
              <p className="text-xs text-slate-400 max-w-xs mx-auto leading-relaxed">
                Tambahkan saham IHSG, saham Wall Street AS, atau ETF global yang Anda miliki untuk mulai analisis risiko & valuasi.
              </p>
              <button
                onClick={onOpenAddModal}
                className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs inline-flex items-center gap-1.5 shadow-lg shadow-emerald-500/20"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                Tambah Aset Pertama Saya
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Asset Allocation Breakdown of My Portfolio */}
      {metrics.holdings.length > 0 && (
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-cyan-400" />
              Alokasi Sektor & Kategori Saya
            </h3>
            <span className="text-[11px] text-slate-400">
              Skor Diversifikasi:{' '}
              <span className="font-mono text-emerald-400 font-semibold">
                {metrics.diversificationScore}/100
              </span>
            </span>
          </div>

          {/* Visual Allocation Bar */}
          <AllocationBar
            items={(() => {
              const top = metrics.sectorBreakdown.slice(0, 5).map((s: any) => ({
                name: s.name,
                weight: s.weight,
              }));
              if (metrics.sectorBreakdown.length > 5) {
                const restWeight = Number(
                  metrics.sectorBreakdown
                    .slice(5)
                    .reduce((sum: number, s: any) => sum + (Number(s.weight) || 0), 0)
                    .toFixed(1)
                );
                if (restWeight > 0) {
                  top.push({ name: 'Lainnya', weight: restWeight });
                }
              }
              return top;
            })()}
          />

          {/* Asset Category Badges (US Stock vs IDX vs ETF) */}
          <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-slate-800/80 text-[11px]">
            {metrics.typeBreakdown.map((t: any) => (
              <div key={t.type} className="text-center p-1.5 rounded-lg bg-slate-950/40">
                <span className="text-slate-400 block text-[10px] truncate">{t.label}</span>
                <span className="font-bold text-slate-200 font-mono mt-0.5 block">{t.weight}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* D3 Portfolio vs Market Indices Comparison Chart */}
      <D3BenchmarkComparisonChart
        holdings={metrics?.holdings || []}
        portfolioName="Portofolio Saya"
        compact
      />

      {/* Optional Collapsible Preset Simulator (Tucked away at bottom) */}
      <div className="pt-1">
        <button
          type="button"
          onClick={() => setShowPresetDrawer((prev) => !prev)}
          className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/60 hover:bg-slate-900 border border-slate-800/80 flex items-center justify-between text-xs text-slate-400 hover:text-slate-200 transition-colors"
        >
          <span className="flex items-center gap-1.5 font-medium">
            <Sparkles className="w-3.5 h-3.5 text-amber-400/80" />
            <span>Simulasi & Contoh Portofolio Preset (Opsional)</span>
          </span>
          {showPresetDrawer ? (
            <ChevronUp className="w-4 h-4 text-slate-500" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-500" />
          )}
        </button>

        {showPresetDrawer && (
          <div className="mt-2 p-3 rounded-2xl bg-slate-900/70 border border-slate-800/80 space-y-2 animate-in fade-in">
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Pilih preset di bawah ini hanya jika Anda ingin mengganti portofolio saat ini dengan template simulasi cepat:
            </p>
            <div className="grid grid-cols-2 gap-2">
              {PRESET_PORTFOLIOS.map((preset) => {
                const isCurrent = currentPresetId === preset.id;
                return (
                  <button
                    key={preset.id}
                    onClick={() => {
                      onApplyPreset(preset);
                      setShowPresetDrawer(false);
                    }}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      isCurrent
                        ? 'bg-emerald-500/10 border-emerald-500/60 text-white'
                        : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-bold truncate">{preset.name}</span>
                      {isCurrent && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />}
                    </div>
                    <span className="text-[10px] text-slate-400 block mt-0.5 truncate">
                      {preset.badge}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

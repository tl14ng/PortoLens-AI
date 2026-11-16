import React, { useState, useEffect, useMemo } from 'react';
import confetti from 'canvas-confetti';
import {
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Zap,
  Layers,
  AlertCircle,
  Wallet,
  RotateCcw,
  ArrowUpRight,
  ArrowDownRight,
  Check,
  Scale,
} from 'lucide-react';
import {
  RiskProfile,
  OptimizationApplyResult,
  PortfolioHolding,
  RebalanceMode,
  USD_TO_IDR_RATE,
  calculateAutoRebalancePlan,
  formatShareQuantity,
} from '../data/marketData';

interface OptimizationTabProps {
  metrics: any;
  holdings?: PortfolioHolding[];
  currentProfile: RiskProfile;
  currency: 'IDR' | 'USD';
  usdIdrRate?: number;
  liveQuotes?: Record<string, { price: number; changePercent?: number; isLiveFound?: boolean }>;
  onApplyOptimization: (mode?: RebalanceMode) => OptimizationApplyResult | null;
  onNavigateToPortfolio?: () => void;
  canRevertOptimization?: boolean;
  lastAppliedResult?: OptimizationApplyResult | null;
  lastAppliedResultProfileId?: string | null;
  onRevertOptimization?: () => void;
}

function formatCompactMoney(value: number, curr: 'IDR' | 'USD'): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (curr === 'USD') {
    if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
    if (abs >= 10_000) return `${sign}$${(abs / 1_000).toFixed(1)}k`;
    return `${sign}$${abs.toLocaleString('id-ID', {
      minimumFractionDigits: abs > 0 && abs < 1 ? 2 : 0,
      maximumFractionDigits: abs > 0 && abs < 1 ? 4 : 2,
    })}`;
  }
  if (abs >= 1_000_000_000) return `${sign}Rp ${(abs / 1_000_000_000).toFixed(2)}M`;
  if (abs >= 1_000_000) return `${sign}Rp ${(abs / 1_000_000).toFixed(1)}jt`;
  return `${sign}Rp ${Math.round(abs).toLocaleString('id-ID')}`;
}

function formatExactMoney(value: number, curr: 'IDR' | 'USD'): string {
  const abs = Math.abs(value);
  if (curr === 'USD') {
    return `$${abs.toLocaleString('id-ID', {
      minimumFractionDigits: abs > 0 && abs < 1 ? 4 : 2,
      maximumFractionDigits: abs > 0 && abs < 1 ? 4 : 2,
    })}`;
  }
  return `Rp ${Math.round(abs).toLocaleString('id-ID')}`;
}

export const OptimizationTab: React.FC<OptimizationTabProps> = ({
  metrics,
  holdings,
  currentProfile,
  currency,
  usdIdrRate = USD_TO_IDR_RATE,
  liveQuotes,
  onApplyOptimization,
  onNavigateToPortfolio,
  canRevertOptimization = false,
  lastAppliedResult = null,
  lastAppliedResultProfileId = null,
  onRevertOptimization,
}) => {
  const [rebalanceMode, setRebalanceMode] = useState<RebalanceMode>(() =>
    lastAppliedResult && lastAppliedResultProfileId === currentProfile.id && lastAppliedResult.mode
      ? lastAppliedResult.mode
      : 'SELL_AND_BUY'
  );
  const [showOnlyTrades, setShowOnlyTrades] = useState(false);
  const [appliedResult, setAppliedResult] = useState<OptimizationApplyResult | null>(null);
  const [revertedNotice, setRevertedNotice] = useState(false);

  useEffect(() => {
    setAppliedResult(null);
  }, [currentProfile.id, rebalanceMode]);

  useEffect(() => {
    if (
      lastAppliedResult &&
      lastAppliedResultProfileId === currentProfile.id &&
      lastAppliedResult.mode
    ) {
      setRebalanceMode(lastAppliedResult.mode);
    }
  }, [lastAppliedResult, lastAppliedResultProfileId, currentProfile.id]);

  useEffect(() => {
    if (canRevertOptimization) {
      setRevertedNotice(false);
    }
  }, [canRevertOptimization]);

  useEffect(() => {
    if (!revertedNotice) return;
    const timer = window.setTimeout(() => setRevertedNotice(false), 4500);
    return () => window.clearTimeout(timer);
  }, [revertedNotice]);

  // Fallback gracefully if holdings prop is omitted by deriving from metrics.holdings
  const resolvedHoldings: PortfolioHolding[] = useMemo(() => {
    if (Array.isArray(holdings) && holdings.length > 0) return holdings;
    if (!Array.isArray(metrics?.holdings)) return [];
    return metrics.holdings.map((h: any, idx: number) => ({
      id: h.id || `h-derived-${h.ticker}-${idx}`,
      ticker: h.ticker,
      shares: h.shares,
      avgBuyPrice: h.avgBuyPrice ?? h.asset?.price ?? 0,
      buyCurrency: h.buyCurrency ?? h.asset?.currency ?? 'USD',
    }));
  }, [holdings, metrics?.holdings]);

  const rebalancePlan = useMemo(() => {
    if (resolvedHoldings.length === 0) return null;
    return calculateAutoRebalancePlan(
      resolvedHoldings,
      currentProfile,
      currency,
      liveQuotes,
      usdIdrRate,
      rebalanceMode
    );
  }, [resolvedHoldings, currentProfile, currency, liveQuotes, usdIdrRate, rebalanceMode]);

  const isEmptyPortfolio = !metrics?.holdings || metrics.holdings.length === 0;

  const handleApply = () => {
    if (isEmptyPortfolio) return;
    setRevertedNotice(false);
    const result = onApplyOptimization(rebalanceMode);
    if (result) {
      setAppliedResult(result);
    }
    if (result && result.applied) {
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#10b981', '#06b6d4', '#f59e0b'],
        });
      } catch {
        // ignore canvas-confetti environment errors
      }
    }
  };

  const handleRevert = () => {
    if (!canRevertOptimization || !onRevertOptimization) return;
    onRevertOptimization();
    setAppliedResult(null);
    setRevertedNotice(true);
  };

  const profileMatchedLastResult =
    lastAppliedResult &&
    lastAppliedResultProfileId === currentProfile.id &&
    (!lastAppliedResult.mode || lastAppliedResult.mode === rebalanceMode)
      ? lastAppliedResult
      : null;
  const activeAppliedResult = appliedResult || profileMatchedLastResult || null;

  if (isEmptyPortfolio || !rebalancePlan) {
    return (
      <div className="pb-24 pt-2 px-4 space-y-4 max-w-lg mx-auto">
        <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6 text-amber-400" />
          </div>
          <h2 className="text-sm font-bold text-white">Portofolio Belum Memiliki Aset</h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            Tambahkan minimal 1 aset saham atau ETF di tab <strong className="text-slate-200">Portofolio</strong> atau{' '}
            <strong className="text-slate-200">Cari</strong> untuk melihat kalkulasi Auto-Rebalance dan rencana bobot ideal profil{' '}
            <strong className="text-white">{currentProfile.name}</strong>.
          </p>
        </div>
      </div>
    );
  }

  const beforeBeta = rebalancePlan.beforeBeta;
  const afterBeta = rebalancePlan.afterBeta;
  const betaReductionPct = Math.max(
    0,
    Math.round(((beforeBeta - afterBeta) / (beforeBeta || 1)) * 100)
  );
  const currentEtfWeight =
    metrics.typeBreakdown?.find((t: any) => t.type === 'ETF')?.weight || 0;
  const hasSufficientEtf = currentEtfWeight >= currentProfile.suggestedEtfWeight;

  const visibleItems = showOnlyTrades
    ? rebalancePlan.items.filter((item) => item.action !== 'HOLD')
    : rebalancePlan.items;

  return (
    <div className="pb-24 pt-2 px-4 space-y-4 max-w-lg mx-auto">
      {/* Strategy Overview Header */}
      <div className="p-5 rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border border-slate-800 shadow-xl space-y-3">
        <div className="flex items-center justify-between gap-2 text-xs text-slate-400">
          <span className="flex items-center gap-1.5 font-bold text-slate-200">
            <Scale className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Auto-Rebalance & Optimasi</span>
          </span>
          <span
            className="text-[11px] font-semibold truncate"
            style={{ color: currentProfile.color }}
          >
            Profil: {currentProfile.name}
          </span>
        </div>

        <div>
          <h2 className="text-base font-extrabold text-white">
            Penyelarasan Bobot & Shares Otomatis
          </h2>
          <p className="text-xs text-slate-300 mt-1 leading-relaxed">
            Target otomatis profil <strong className="text-white">{currentProfile.name}</strong>: batas maks{' '}
            <span className="font-mono font-semibold text-white">{currentProfile.maxSingleAssetAllocation}%</span> per aset,
            porsi ETF minimal <span className="font-mono font-semibold text-white">{currentProfile.suggestedEtfWeight}%</span>,
            dan rentang beta <span className="font-mono font-semibold text-white">{currentProfile.targetBetaRange}</span>.
            {beforeBeta > currentProfile.maxTargetBeta && betaReductionPct > 0 && (
              <>
                {' '}Rencana ini menurunkan sensitivitas risiko sebesar{' '}
                <span className="text-emerald-400 font-bold">{betaReductionPct}%</span>.
              </>
            )}
          </p>
        </div>

        {/* Summary KPI Strip */}
        <div className="grid grid-cols-2 gap-2 pt-3 border-t border-slate-800/80 text-xs">
          <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
            <span className="text-[10px] text-slate-400 block">Target Beta Portofolio</span>
            <span className="text-sm font-bold text-emerald-400 font-mono tabular-nums mt-0.5 block">
              {beforeBeta.toFixed(2)} → {afterBeta.toFixed(2)}
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
            <span className="text-[10px] text-slate-400 block">Proyeksi Skor Finansial</span>
            <span className="text-sm font-bold text-cyan-400 font-mono tabular-nums mt-0.5 block">
              {rebalancePlan.beforeScore} → {rebalancePlan.afterScore}/100
            </span>
          </div>
        </div>
      </div>

      {/* Auto-Rebalance Shares Calculator Section */}
      <div className="p-4 rounded-3xl bg-slate-900 border border-slate-800 space-y-3.5">
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>Rencana Transaksi Auto-Rebalance</span>
            </h3>
            <span className="text-[11px] text-slate-400 font-mono tabular-nums">
              {rebalancePlan.sellCount} Jual · {rebalancePlan.buyCount} Beli
            </span>
          </div>

          {/* Mode Segmented Control */}
          <div
            role="tablist"
            aria-label="Mode Auto-Rebalance"
            className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-slate-950 border border-slate-800"
          >
            <button
              type="button"
              role="tab"
              aria-selected={rebalanceMode === 'SELL_AND_BUY'}
              onClick={() => setRebalanceMode('SELL_AND_BUY')}
              className={`min-h-[40px] px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                rebalanceMode === 'SELL_AND_BUY'
                  ? 'bg-emerald-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Jual & Beli (Modal Tetap)
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={rebalanceMode === 'BUY_ONLY'}
              onClick={() => setRebalanceMode('BUY_ONLY')}
              className={`min-h-[40px] px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                rebalanceMode === 'BUY_ONLY'
                  ? 'bg-cyan-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Top-Up Saja (Tanpa Jual)
            </button>
          </div>

          <p className="text-[11px] text-slate-400 leading-snug">
            {rebalanceMode === 'SELL_AND_BUY'
              ? 'Dana dari penjualan aset overweight & berisiko tinggi dialokasikan untuk membeli aset penyeimbang tanpa menambah modal.'
              : 'Seluruh posisi lama dipertahankan. Menghitung jumlah shares tambahan yang harus dibeli agar bobot aset selaras dengan profil risiko.'}
          </p>
        </div>

        {/* Cash Flow & Trade Summary */}
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800/80">
            <span className="text-[10px] text-slate-400 block">Estimasi Jual</span>
            <span className="font-mono tabular-nums font-bold text-rose-400 mt-0.5 block truncate">
              {rebalancePlan.totalSellValueInView > 0
                ? formatCompactMoney(rebalancePlan.totalSellValueInView, currency)
                : formatCompactMoney(0, currency)}
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800/80">
            <span className="text-[10px] text-slate-400 block">Estimasi Beli</span>
            <span className="font-mono tabular-nums font-bold text-emerald-400 mt-0.5 block truncate">
              {rebalancePlan.totalBuyValueInView > 0
                ? formatCompactMoney(rebalancePlan.totalBuyValueInView, currency)
                : formatCompactMoney(0, currency)}
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800/80">
            <span className="text-[10px] text-slate-400 block">
              {rebalancePlan.netCashRequiredInView > 0 ? 'Modal Tambahan' : 'Selisih Kas'}
            </span>
            <span className="font-mono tabular-nums font-bold text-cyan-300 mt-0.5 block truncate">
              {Math.abs(rebalancePlan.netCashRequiredInView) <
              Math.max(1, rebalancePlan.totalPortfolioBeforeInView * 0.015)
                ? 'Netral'
                : `${rebalancePlan.netCashRequiredInView > 0 ? '+' : ''}${formatCompactMoney(
                    rebalancePlan.netCashRequiredInView,
                    currency
                  )}`}
            </span>
          </div>
        </div>

        {/* Filter toggle */}
        <div className="flex items-center justify-between gap-2 pt-0.5">
          <span className="text-[11px] font-medium text-slate-400">
            Rincian Penyesuaian per Aset
          </span>
          <div className="flex items-center gap-1 p-0.5 rounded-lg bg-slate-950 border border-slate-800">
            <button
              type="button"
              onClick={() => setShowOnlyTrades(false)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors whitespace-nowrap ${
                !showOnlyTrades ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Semua ({rebalancePlan.items.length})
            </button>
            <button
              type="button"
              onClick={() => setShowOnlyTrades(true)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors whitespace-nowrap ${
                showOnlyTrades ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Perlu Aksi ({rebalancePlan.sellCount + rebalancePlan.buyCount})
            </button>
          </div>
        </div>

        {/* Asset Rebalance Rows */}
        <div className="divide-y divide-slate-800/80 border-t border-slate-800/80">
          {visibleItems.map((item) => {
            const isSell = item.action === 'SELL';
            const isBuy = item.action === 'BUY';
            const absDeltaShares = Math.abs(item.deltaShares);
            const assetClassLabel =
              item.assetType === 'IDX_STOCK'
                ? 'IHSG'
                : item.assetType === 'US_STOCK'
                ? 'Wall Street'
                : 'ETF';
            const maxBarW = Math.max(
              item.currentWeight,
              item.projectedWeight,
              currentProfile.maxSingleAssetAllocation,
              1
            );

            return (
              <div key={item.ticker} className="py-3 first:pt-2.5 last:pb-1 space-y-2">
                {/* Row Header: Ticker + Metadata | Action Directive */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-white font-mono">
                        {item.ticker}
                      </span>
                      <span className="text-[11px] text-slate-400 truncate">
                        {assetClassLabel} · {item.nativeCurrency}
                        {item.isNewAsset ? ' · Aset Baru' : ''}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 truncate max-w-[210px]">
                      {item.name}
                    </p>
                  </div>

                  <div className="text-right shrink-0">
                    <div
                      className={`inline-flex items-center gap-1 text-xs font-extrabold font-mono tabular-nums ${
                        isSell
                          ? 'text-rose-400'
                          : isBuy
                          ? 'text-emerald-400'
                          : 'text-slate-400'
                      }`}
                    >
                      {isSell && <ArrowDownRight className="w-3.5 h-3.5 shrink-0" />}
                      {isBuy && <ArrowUpRight className="w-3.5 h-3.5 shrink-0" />}
                      {!isSell && !isBuy && <Check className="w-3.5 h-3.5 shrink-0" />}
                      <span>
                        {isSell
                          ? `JUAL ${formatShareQuantity(absDeltaShares)} lbr`
                          : isBuy
                          ? `BELI +${formatShareQuantity(absDeltaShares)} lbr`
                          : 'TAHAN'}
                      </span>
                    </div>
                    {item.action !== 'HOLD' && (
                      <div className="text-[10px] font-mono tabular-nums text-slate-400 mt-0.5">
                        {isSell ? '+' : '-'}
                        {formatExactMoney(item.tradeValueInView, currency)}
                        {item.nativeCurrency !== currency && (
                          <span className="text-slate-500">
                            {' '}
                            ({formatExactMoney(item.tradeValueNative, item.nativeCurrency)})
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Shares & Weight Transformation Metrics */}
                <div className="grid grid-cols-2 gap-3 text-[11px] pt-0.5">
                  <div>
                    <div className="flex items-center justify-between text-slate-400 mb-1">
                      <span>Bobot</span>
                      <span className="font-mono tabular-nums text-slate-200 font-semibold">
                        {item.currentWeight.toFixed(1)}% →{' '}
                        <span
                          className={
                            isSell
                              ? 'text-amber-300'
                              : isBuy
                              ? 'text-emerald-400'
                              : 'text-slate-200'
                          }
                        >
                          {item.projectedWeight.toFixed(1)}%
                        </span>
                      </span>
                    </div>
                    {/* Visual Current vs Projected Weight Bar */}
                    <div className="space-y-1">
                      <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-slate-500/80"
                          style={{
                            width: `${Math.min(100, (item.currentWeight / maxBarW) * 100)}%`,
                          }}
                        />
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            isSell
                              ? 'bg-amber-400'
                              : isBuy
                              ? 'bg-emerald-400'
                              : 'bg-cyan-400'
                          }`}
                          style={{
                            width: `${Math.min(100, (item.projectedWeight / maxBarW) * 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col justify-center">
                    <div className="flex items-center justify-between text-slate-400">
                      <span>Jumlah Shares</span>
                      <span className="font-mono tabular-nums text-white font-semibold">
                        {formatShareQuantity(item.currentShares)} →{' '}
                        {formatShareQuantity(item.targetShares)} lbr
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-slate-500 mt-1">
                      <span>Target Ideal</span>
                      <span className="font-mono tabular-nums">
                        {item.idealTargetWeight.toFixed(1)}% (β {item.beta})
                      </span>
                    </div>
                  </div>
                </div>

                {/* Concise Rationale */}
                <p className="text-[11px] text-slate-400 leading-snug">{item.reason}</p>
              </div>
            );
          })}

          {visibleItems.length === 0 && (
            <div className="py-5 text-center text-xs text-slate-400">
              Seluruh bobot aset portofolio Anda sudah selaras dengan target profil{' '}
              <strong className="text-slate-200">{currentProfile.name}</strong>.
            </div>
          )}
        </div>

        {/* ETF Anchor Note */}
        <div className="pt-2 border-t border-slate-800/80 text-[11px] text-slate-400 leading-relaxed flex items-start gap-2">
          <CheckCircle2
            className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${
              hasSufficientEtf ? 'text-emerald-400' : 'text-cyan-400'
            }`}
          />
          <span>
            Porsi ETF saat ini <strong className="text-slate-200">{currentEtfWeight.toFixed(1)}%</strong>{' '}
            vs target profil {currentProfile.name}{' '}
            <strong className="text-slate-200">{currentProfile.suggestedEtfWeight}%</strong>.
            {!hasSufficientEtf &&
              ' Auto-Rebalance otomatis menambahkan/menambah porsi ETF jangkar (seperti VOO / SCHD) untuk menekan risiko non-sistematis.'}
          </span>
        </div>
      </div>

      {/* Before vs After Simulation Card */}
      <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-3">
        <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5 text-emerald-400" />
          Komparasi Dampak Auto-Rebalance
        </h3>

        <div className="space-y-2.5 text-xs">
          {/* Metric 1: Beta */}
          <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between">
            <div>
              <span className="text-slate-400 block text-[11px]">Tingkat Sensitivitas (Beta)</span>
              <span className="text-xs font-medium text-slate-200">Volatilitas terhadap pasar</span>
            </div>
            <div className="flex items-center gap-3 font-mono tabular-nums">
              <span className="text-slate-400 line-through">{beforeBeta.toFixed(2)}</span>
              <ArrowRight className="w-3 h-3 text-emerald-400" />
              <span className="font-bold text-emerald-400 text-sm">{afterBeta.toFixed(2)}</span>
            </div>
          </div>

          {/* Metric 2: Diversification */}
          <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between">
            <div>
              <span className="text-slate-400 block text-[11px]">Skor Diversifikasi HHI</span>
              <span className="text-xs font-medium text-slate-200">Penyebaran multi-aset</span>
            </div>
            <div className="flex items-center gap-3 font-mono tabular-nums">
              <span className="text-slate-400 line-through">
                {rebalancePlan.beforeDiversification}
              </span>
              <ArrowRight className="w-3 h-3 text-emerald-400" />
              <span className="font-bold text-emerald-400 text-sm">
                {rebalancePlan.afterDiversification}
              </span>
            </div>
          </div>

          {/* Metric 3: Max Drawdown Risk */}
          <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between">
            <div>
              <span className="text-slate-400 block text-[11px]">Estimasi Penurunan (Drawdown Risk)</span>
              <span className="text-xs font-medium text-slate-200">Saat koreksi pasar -15%</span>
            </div>
            <div className="flex items-center gap-3 font-mono tabular-nums">
              {(() => {
                const beforeDd = beforeBeta * 15;
                const afterDd = afterBeta * 15;
                return (
                  <>
                    <span className="text-rose-400 line-through">
                      -{beforeDd.toFixed(1)}%
                    </span>
                    <ArrowRight className="w-3 h-3 text-emerald-400" />
                    <span className="font-bold text-emerald-400 text-sm">
                      -{afterDd.toFixed(1)}%
                    </span>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      </div>

      {/* 1-Click Apply Auto-Rebalance Button & Immediate Result Feedback */}
      <div className="pt-1 space-y-3">
        <button
          type="button"
          onClick={handleApply}
          className="w-full min-h-[48px] py-3.5 px-4 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-500 hover:opacity-95 text-slate-950 font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 active:scale-[0.98] transition-all"
        >
          <Sparkles className="w-4 h-4 fill-slate-950 shrink-0" />
          <span>
            {!rebalancePlan.needsRebalance
              ? 'Portofolio Sudah Seimbang'
              : activeAppliedResult?.applied
              ? 'Terapkan Ulang Auto-Rebalance'
              : rebalanceMode === 'BUY_ONLY'
              ? `Terapkan Auto-Rebalance Top-Up (${rebalancePlan.buyCount} Aksi Beli)`
              : `Terapkan Auto-Rebalance (${rebalancePlan.sellCount} Jual · ${rebalancePlan.buyCount} Beli)`}
          </span>
        </button>

        {canRevertOptimization && onRevertOptimization && (
          <button
            type="button"
            onClick={handleRevert}
            className="w-full min-h-[44px] py-3 px-4 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-amber-500/40 text-amber-300 font-bold text-xs flex items-center justify-center gap-2 transition-colors active:scale-[0.98]"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Kembalikan Portofolio Sebelum Optimasi</span>
          </button>
        )}

        {revertedNotice && !canRevertOptimization && (
          <div className="p-3.5 rounded-2xl bg-amber-950/30 border border-amber-500/40 flex items-center gap-2 text-xs text-amber-200">
            <RotateCcw className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Portofolio berhasil dikembalikan ke kondisi sebelum Auto-Rebalance.</span>
          </div>
        )}

        {activeAppliedResult && (
          <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 space-y-2.5 animate-in fade-in">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-emerald-300 font-bold text-xs">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>
                  {activeAppliedResult.applied
                    ? 'Auto-Rebalance Berhasil Diterapkan ke Portofolio!'
                    : 'Portofolio Sudah Optimal'}
                </span>
              </div>
              {activeAppliedResult.applied && (
                <span className="text-[11px] font-mono tabular-nums font-bold text-emerald-300">
                  Skor {activeAppliedResult.beforeScore} → {activeAppliedResult.afterScore}
                </span>
              )}
            </div>

            <ul className="space-y-1 text-[11px] text-slate-200">
              {activeAppliedResult.changes.map((chg, idx) => (
                <li key={idx} className="flex items-start gap-1.5">
                  <span className="text-emerald-400 font-bold">•</span>
                  <span>{chg}</span>
                </li>
              ))}
            </ul>

            {onNavigateToPortfolio && (
              <button
                type="button"
                onClick={onNavigateToPortfolio}
                className="w-full min-h-[44px] py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
              >
                <Wallet className="w-3.5 h-3.5" />
                <span>Lihat Hasil di Portofolio Saya</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

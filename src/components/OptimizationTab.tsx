import React, { useState } from 'react';
import confetti from 'canvas-confetti';
import { Sparkles, ArrowRight, CheckCircle2, Zap, Layers, AlertCircle } from 'lucide-react';
import { RiskProfile } from '../data/marketData';

interface OptimizationTabProps {
  metrics: any;
  currentProfile: RiskProfile;
  currency: 'IDR' | 'USD';
  onApplyOptimization: () => void;
}

export const OptimizationTab: React.FC<OptimizationTabProps> = ({
  metrics,
  currentProfile,
  onApplyOptimization,
}) => {
  const [isApplied, setIsApplied] = useState(false);

  const isEmptyPortfolio = !metrics?.holdings || metrics.holdings.length === 0;

  const handleApply = () => {
    if (isEmptyPortfolio) return;
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#10b981', '#06b6d4', '#f59e0b'],
    });
    setIsApplied(true);
    onApplyOptimization();
  };

  if (isEmptyPortfolio) {
    return (
      <div className="pb-24 pt-2 px-4 space-y-4 max-w-lg mx-auto">
        <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6 text-amber-400" />
          </div>
          <h2 className="text-sm font-bold text-white">Portofolio Belum Memiliki Aset</h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            Tambahkan minimal 1 aset saham atau ETF di tab <strong className="text-slate-200">Portofolio</strong> atau{' '}
            <strong className="text-slate-200">Cari</strong> untuk melihat rencana rebalancing otomatis sesuai profil risiko{' '}
            <strong className="text-white">{currentProfile.name}</strong>.
          </p>
        </div>
      </div>
    );
  }

  // Simulated After metrics
  const targetBeta = ((currentProfile.minTargetBeta + currentProfile.maxTargetBeta) / 2).toFixed(2);
  const projectedHealthScore = Math.min(98, Math.max(metrics.healthScore, 88, metrics.healthScore + 12));
  const projectedDiversification = Math.min(98, Math.max(metrics.diversificationScore, 84, metrics.diversificationScore + 18));
  const isOverBeta = metrics.weightedBeta > Number(targetBeta);
  const betaReductionPct = Math.round(
    ((metrics.weightedBeta - Number(targetBeta)) / (metrics.weightedBeta || 1)) * 100
  );
  const currentEtfWeight =
    metrics.typeBreakdown?.find((t: any) => t.type === 'ETF')?.weight || 0;
  const hasSufficientEtf = currentEtfWeight >= currentProfile.suggestedEtfWeight;

  return (
    <div className="pb-24 pt-2 px-4 space-y-4 max-w-lg mx-auto">
      {/* Strategy Header Card */}
      <div className="p-5 rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border border-slate-800 shadow-xl relative overflow-hidden">
        <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
          <span className="flex items-center gap-1.5 font-bold text-slate-200">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            Rencana Optimasi & Rebalancing
          </span>
          <span
            className="text-[11px] font-semibold px-2 py-0.5 rounded-full border"
            style={{
              borderColor: `${currentProfile.color}60`,
              color: currentProfile.color,
              backgroundColor: `${currentProfile.color}15`,
            }}
          >
            Manajemen Risiko: {currentProfile.name}
          </span>
        </div>

        <h2 className="text-base font-extrabold text-white mt-1">
          Formula Penyelarasan Portofolio Ideal
        </h2>
        <p className="text-xs text-slate-300 mt-1 leading-relaxed">
          {isOverBeta ? (
            <>
              Berdasarkan profil <strong className="text-white">{currentProfile.name}</strong>, portofolio
              Anda ditata ulang untuk meredam risiko penurunan (downside risk) sebesar{' '}
              <span className="text-emerald-400 font-bold">{betaReductionPct}%</span> tanpa
              mengorbankan potensi pertumbuhan jangka panjang.
            </>
          ) : (
            <>
              Berdasarkan profil <strong className="text-white">{currentProfile.name}</strong>, volatilitas
              portofolio Anda sudah terkendali dan diselaraskan dengan jangkar ETF agar return lebih optimal dalam jangka panjang.
            </>
          )}
        </p>

        {/* Quick summary stats */}
        <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-slate-800/80 text-xs">
          <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
            <span className="text-[10px] text-slate-400 block">Target Beta Portofolio</span>
            <span className="text-sm font-bold text-emerald-400 font-mono mt-0.5 block">
              {metrics.weightedBeta} → {targetBeta}
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
            <span className="text-[10px] text-slate-400 block">Proyeksi Skor Finansial</span>
            <span className="text-sm font-bold text-cyan-400 font-mono mt-0.5 block">
              {metrics.healthScore} → {projectedHealthScore}/100
            </span>
          </div>
        </div>
      </div>

      {/* Step-by-Step Actionable Recommendations */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            Langkah Tindakan Rebalancing & Alasan
          </h3>
          <span className="text-[11px] text-slate-500">Berbasis Data</span>
        </div>

        <div className="space-y-3">
          {/* Action 1: Trim Overweight */}
          {metrics.optimizationSuggestions.length > 0 ? (
            metrics.optimizationSuggestions.map((sug: any, idx: number) => (
              <div
                key={idx}
                className="p-4 rounded-2xl bg-slate-900 border border-slate-800/90 space-y-2 hover:border-slate-700 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                        sug.action === 'PANGKAS'
                          ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                          : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                      }`}
                    >
                      {sug.action}
                    </span>
                    <span className="text-sm font-bold text-white">{sug.ticker}</span>
                    <span className="text-xs text-slate-400 truncate max-w-[150px]">
                      {sug.name}
                    </span>
                  </div>
                  <span className="text-xs font-bold text-slate-200 font-mono">
                    {sug.targetChange}
                  </span>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/60 text-xs text-slate-300 leading-relaxed">
                  <strong className="text-slate-200">Alasan & Data Pendukung: </strong>
                  {sug.rationale}
                </div>
              </div>
            ))
          ) : (
            <div className="p-4 rounded-2xl bg-emerald-950/20 border border-emerald-900/40 text-xs text-slate-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                Portofolio Anda saat ini sudah sangat mendekati ambang batas alokasi optimal profil{' '}
                {currentProfile.name}.
              </span>
            </div>
          )}

          {/* Action 2: Defensive ETF Allocation Anchor */}
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800/90 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                  ANCHOR ETF
                </span>
                <span className="text-sm font-bold text-white">VOO / SCHD</span>
                <span className="text-xs text-slate-400">S&P 500 & Dividend</span>
              </div>
              <span className="text-xs font-bold text-slate-200 font-mono">
                {hasSufficientEtf
                  ? `Pertahankan (${currentEtfWeight.toFixed(0)}%)`
                  : `Target ${currentProfile.suggestedEtfWeight}%`}
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/60 text-xs text-slate-300 leading-relaxed">
              <strong className="text-slate-200">Alasan & Data Pendukung: </strong>
              Berdasarkan teori portofolio modern (MPT Markowitz), kepemilikan minimal {currentProfile.suggestedEtfWeight}% ETF indeks broad-market menurunkan non-systematic risk hingga 70% dibanding memegang saham individual saja (saat ini: {currentEtfWeight.toFixed(1)}%).
            </div>
          </div>
        </div>
      </div>

      {/* Before vs After Simulation Card */}
      <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-3">
        <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5 text-emerald-400" />
          Komparasi Simulasi: Sebelum vs Sesudah Optimasi
        </h3>

        <div className="space-y-2.5 text-xs">
          {/* Comparison Metric 1: Beta */}
          <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between">
            <div>
              <span className="text-slate-400 block text-[11px]">Tingkat Sensitivitas (Beta)</span>
              <span className="text-xs font-medium text-slate-200">Volatilitas terhadap pasar</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-mono text-slate-400 line-through">{metrics.weightedBeta}</span>
              <ArrowRight className="w-3 h-3 text-emerald-400" />
              <span className="font-mono font-bold text-emerald-400 text-sm">{targetBeta}</span>
            </div>
          </div>

          {/* Comparison Metric 2: Diversification */}
          <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between">
            <div>
              <span className="text-slate-400 block text-[11px]">Skor Diversifikasi HHI</span>
              <span className="text-xs font-medium text-slate-200">Penyebaran multi-sektor</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-mono text-slate-400 line-through">
                {metrics.diversificationScore}
              </span>
              <ArrowRight className="w-3 h-3 text-emerald-400" />
              <span className="font-mono font-bold text-emerald-400 text-sm">
                {projectedDiversification}
              </span>
            </div>
          </div>

          {/* Comparison Metric 3: Max Drawdown Risk */}
          <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between">
            <div>
              <span className="text-slate-400 block text-[11px]">Estimasi Penurunan (Drawdown Risk)</span>
              <span className="text-xs font-medium text-slate-200">Saat koreksi pasar -15%</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-mono text-rose-400 line-through">
                -{(metrics.weightedBeta * 15).toFixed(1)}%
              </span>
              <ArrowRight className="w-3 h-3 text-emerald-400" />
              <span className="font-mono font-bold text-emerald-400 text-sm">
                -{(Number(targetBeta) * 12).toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 1-Click Apply Button */}
      <div className="pt-2">
        <button
          onClick={handleApply}
          className="w-full h-13 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-500 hover:opacity-95 text-slate-950 font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 active:scale-[0.98] transition-all"
        >
          <Sparkles className="w-4 h-4 fill-slate-950" />
          <span>{isApplied ? 'Terapkan Ulang Optimasi' : 'Terapkan Rekomendasi Optimasi Ini'}</span>
        </button>
        {isApplied && (
          <p className="text-center text-[11px] text-emerald-400 mt-2 font-medium">
            ✓ Alokasi portofolio berhasil disimulasikan sesuai profil risiko optimal!
          </p>
        )}
      </div>
    </div>
  );
};

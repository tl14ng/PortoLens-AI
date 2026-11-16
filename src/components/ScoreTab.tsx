import React, { useState, useEffect } from 'react';
import { ScoreGauge } from './ChartComponents';
import { ShieldCheck, AlertTriangle, Sparkles, RefreshCw, CheckCircle2, ChevronRight, BarChart2 } from 'lucide-react';
import { RiskProfile } from '../data/marketData';

interface ScoreTabProps {
  metrics: any;
  currentProfile: RiskProfile;
  currency: 'IDR' | 'USD';
  onNavigateToOptimizer: () => void;
}

const SCORE_AI_CACHE_MAX = 20;
const scoreAiClientCache = new Map<string, any>();

function setScoreAiCache(key: string, value: any) {
  if (scoreAiClientCache.has(key)) scoreAiClientCache.delete(key);
  scoreAiClientCache.set(key, value);
  if (scoreAiClientCache.size > SCORE_AI_CACHE_MAX) {
    const oldest = scoreAiClientCache.keys().next().value;
    if (oldest !== undefined) scoreAiClientCache.delete(oldest);
  }
}

export const ScoreTab: React.FC<ScoreTabProps> = ({
  metrics,
  currentProfile,
  currency,
  onNavigateToOptimizer,
}) => {
  const holdingsSignature = (metrics?.holdings || [])
    .map((h: any) => `${h.ticker}:${h.shares}`)
    .sort()
    .join('|');
  const cacheKey = `${holdingsSignature}|${currentProfile.id}|${currency}`;

  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<any>(() => scoreAiClientCache.get(cacheKey) || null);
  const [aiError, setAiError] = useState<string | null>(null);

  const aiRequestIdRef = React.useRef(0);

  useEffect(() => {
    aiRequestIdRef.current += 1;
    setIsAiLoading(false);
    setAiAnalysis(scoreAiClientCache.get(cacheKey) || null);
    setAiError(null);
  }, [cacheKey]);

  const handleRunAiAnalysis = async () => {
    if (!metrics.holdings || metrics.holdings.length === 0) {
      setAiError('Portofolio Anda masih kosong. Tambahkan minimal 1 saham atau ETF terlebih dahulu untuk dianalisis.');
      return;
    }
    const reqId = ++aiRequestIdRef.current;
    const reqCacheKey = cacheKey;
    setIsAiLoading(true);
    setAiError(null);
    try {
      const payload = {
        portfolio: metrics.holdings.map((h: any) => ({
          ticker: h.ticker,
          name: h.asset.name,
          type: h.asset.type,
          sector: h.asset.sector,
          allocation: Number(h.weight.toFixed(1)),
          totalValue: h.currentValInView,
          return1Y: h.asset.return1Y,
          beta: h.asset.beta,
        })),
        riskProfile: {
          name: currentProfile.name,
          description: currentProfile.description,
          volatilityTolerance: currentProfile.volatilityTolerance,
          targetBetaRange: currentProfile.targetBetaRange,
        },
        currency,
        totalValue: metrics.totalValue,
      };

      const res = await fetch('/api/analyze-portfolio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData?.error || 'Gagal menghubungi server analisis.');
      }

      const data = await res.json();
      setScoreAiCache(reqCacheKey, data);
      if (aiRequestIdRef.current !== reqId) return;
      setAiAnalysis(data);
    } catch (err: any) {
      if (aiRequestIdRef.current !== reqId) return;
      console.error(err);
      setAiError(err?.message || 'Tidak dapat memproses analisis AI saat ini. Silakan coba kembali.');
    } finally {
      if (aiRequestIdRef.current === reqId) {
        setIsAiLoading(false);
      }
    }
  };

  // Determine pillar status
  const getPillarStatus = (score: number) => {
    if (score >= 80) return { label: 'Sangat Baik', color: 'text-emerald-400' };
    if (score >= 65) return { label: 'Cukup Baik', color: 'text-cyan-400' };
    if (score >= 50) return { label: 'Perlu Perhatian', color: 'text-amber-400' };
    return { label: 'Kritis', color: 'text-rose-400' };
  };

  const isBetaAligned =
    metrics.weightedBeta >= currentProfile.minTargetBeta &&
    metrics.weightedBeta <= currentProfile.maxTargetBeta;

  const hasHoldings = Boolean(metrics?.holdings && metrics.holdings.length > 0);
  const sharpeValue = hasHoldings
    ? metrics.portfolio1YReturn / Math.max(1, metrics.weightedBeta * 15)
    : 0;
  const sharpeStatus = !hasHoldings
    ? { label: 'Belum Ada Aset', color: 'text-slate-500' }
    : sharpeValue >= 1.0
    ? { label: 'Risk-Adjusted Optimal', color: 'text-emerald-400' }
    : sharpeValue >= 0.5
    ? { label: 'Cukup Efisien', color: 'text-cyan-400' }
    : sharpeValue >= 0
    ? { label: 'Imbal Hasil Rendah', color: 'text-amber-400' }
    : { label: 'Rugi Risiko Tinggi', color: 'text-rose-400' };

  return (
    <div className="pb-24 pt-2 px-4 space-y-4 max-w-lg mx-auto">
      {/* Overall Score Card */}
      <div className="p-5 rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border border-slate-800 shadow-xl relative overflow-hidden">
        <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
          <span className="flex items-center gap-1.5 font-bold text-slate-200">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            Audit Penilaian Portofolio
          </span>
          <span
            className="text-[11px] font-semibold px-2 py-0.5 rounded-full border"
            style={{
              borderColor: `${currentProfile.color}60`,
              color: currentProfile.color,
              backgroundColor: `${currentProfile.color}15`,
            }}
          >
            Profil: {currentProfile.name}
          </span>
        </div>

        {/* Gauge & Main Rating */}
        {(() => {
          const rawAiScore =
            aiAnalysis?.skorKesehatan !== undefined ? Number(aiAnalysis.skorKesehatan) : NaN;
          const displayedScore = hasHoldings
            ? Number.isFinite(rawAiScore)
              ? Math.min(100, Math.max(0, Math.round(rawAiScore)))
              : metrics.healthScore
            : 0;
          const displayedGrade = hasHoldings
            ? typeof aiAnalysis?.predikat === 'string' && aiAnalysis.predikat.trim()
              ? aiAnalysis.predikat.trim()
              : metrics.healthGrade
            : 'N/A';
          return (
            <div className="flex items-center justify-between gap-4 py-2">
              <div className="space-y-1">
                <span className="text-xs text-slate-400">Skor Kesehatan Finansial</span>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-extrabold text-white tracking-tight font-mono">
                    {displayedScore}
                  </span>
                  <span className="text-sm text-slate-400 font-mono">/ 100</span>
                </div>
                <p className="text-xs text-slate-300 font-medium leading-snug">
                  {!hasHoldings
                    ? 'Portofolio masih kosong. Tambahkan saham atau ETF terlebih dahulu untuk audit risiko.'
                    : displayedScore >= 80
                    ? 'Portofolio kokoh dan selaras dengan toleransi risiko Anda.'
                    : displayedScore >= 65
                    ? 'Fondasi portofolio baik, namun ada konsentrasi risiko yang perlu dipangkas.'
                    : 'Tingkat risiko melampaui batas profil Anda. Disarankan segera rebalancing.'}
                </p>
              </div>
              <div className="shrink-0">
                <ScoreGauge
                  score={displayedScore}
                  grade={displayedGrade}
                  size={110}
                />
              </div>
            </div>
          );
        })()}

        {/* Beta vs Target Range Indicator */}
        <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
          <div>
            <span className="text-slate-400">Beta Portofolio: </span>
            <span
              className={`font-mono font-bold ${
                !hasHoldings
                  ? 'text-slate-500'
                  : isBetaAligned
                  ? 'text-emerald-400'
                  : 'text-amber-400'
              }`}
            >
              {hasHoldings ? metrics.weightedBeta : '—'}
            </span>
          </div>
          <div className="text-right">
            <span className="text-slate-400">Target Profil {currentProfile.name}: </span>
            <span className="font-mono text-slate-200 font-medium">
              {currentProfile.targetBetaRange}
            </span>
          </div>
        </div>
      </div>

      {/* 4 Pillars Evaluation Grid */}
      <div>
        <h3 className="text-xs font-bold text-slate-300 mb-2">4 Pilar Evaluasi Manajemen Risiko</h3>
        <div className="grid grid-cols-2 gap-2.5">
          {/* Pillar 1: Diversifikasi */}
          <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
            <div>
              <span className="text-[11px] text-slate-400 block">1. Diversifikasi Sektor</span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-lg font-bold text-white font-mono">
                  {hasHoldings ? metrics.diversificationScore : '—'}
                </span>
                {hasHoldings && <span className="text-[10px] text-slate-500 font-mono">/100</span>}
              </div>
            </div>
            <span
              className={`text-[10px] font-semibold mt-2 ${
                hasHoldings ? getPillarStatus(metrics.diversificationScore).color : 'text-slate-500'
              }`}
            >
              ● {hasHoldings ? getPillarStatus(metrics.diversificationScore).label : 'Belum Ada Aset'}
            </span>
          </div>

          {/* Pillar 2: Manajemen Risiko & Beta */}
          <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
            <div>
              <span className="text-[11px] text-slate-400 block">2. Kontrol Risiko Beta</span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-lg font-bold text-white font-mono">
                  {hasHoldings ? metrics.riskManagementScore : '—'}
                </span>
                {hasHoldings && <span className="text-[10px] text-slate-500 font-mono">/100</span>}
              </div>
            </div>
            <span
              className={`text-[10px] font-semibold mt-2 ${
                hasHoldings ? getPillarStatus(metrics.riskManagementScore).color : 'text-slate-500'
              }`}
            >
              ● {hasHoldings ? (isBetaAligned ? 'Terkendali' : 'Sensitif Volatilitas') : 'Belum Ada Aset'}
            </span>
          </div>

          {/* Pillar 3: Pendapatan & Dividen */}
          <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
            <div>
              <span className="text-[11px] text-slate-400 block">3. Imbal Hasil Dividen</span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-lg font-bold text-cyan-400 font-mono">
                  {hasHoldings ? `${metrics.portfolioDividendYield}%` : '—'}
                </span>
                {hasHoldings && <span className="text-[10px] text-slate-500">/thn</span>}
              </div>
            </div>
            <span className={`text-[10px] font-semibold mt-2 ${hasHoldings ? 'text-slate-400' : 'text-slate-500'}`}>
              ●{' '}
              {!hasHoldings
                ? 'Belum Ada Aset'
                : metrics.portfolioDividendYield > 2
                ? 'Cashflow Kuat'
                : 'Fokus Capital Gain'}
            </span>
          </div>

          {/* Pillar 4: Rasio Sharpe & Stabilitas */}
          <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
            <div>
              <span className="text-[11px] text-slate-400 block">4. Est. Sharpe Ratio</span>
              <div className="flex items-baseline gap-1 mt-1">
                <span
                  className={`text-lg font-bold font-mono ${
                    !hasHoldings
                      ? 'text-slate-400'
                      : sharpeValue >= 0.5
                      ? 'text-emerald-400'
                      : sharpeValue >= 0
                      ? 'text-amber-400'
                      : 'text-rose-400'
                  }`}
                >
                  {hasHoldings ? sharpeValue.toFixed(2) : '—'}
                </span>
                {hasHoldings && <span className="text-[10px] text-slate-500">rasio</span>}
              </div>
            </div>
            <span className={`text-[10px] font-semibold mt-2 ${sharpeStatus.color}`}>
              ● {sharpeStatus.label}
            </span>
          </div>
        </div>
      </div>

      {/* Identified Risk Alerts / Red Flags */}
      {metrics.issuesDetected.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" />
            Catatan Kritis Manajemen Risiko ({metrics.issuesDetected.length})
          </h3>
          {metrics.issuesDetected.map((issue: any, idx: number) => (
            <div
              key={idx}
              className={`p-3.5 rounded-2xl border text-xs leading-relaxed ${
                issue.severity === 'high'
                  ? 'bg-rose-950/30 border-rose-900/60 text-rose-200'
                  : 'bg-amber-950/30 border-amber-900/60 text-amber-200'
              }`}
            >
              <div className="font-bold flex items-center justify-between mb-1 text-slate-100">
                <span>{issue.title}</span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.2 rounded bg-slate-900/80">
                  {issue.severity === 'high' ? 'Prioritas Tinggi' : 'Perhatian'}
                </span>
              </div>
              <p className="text-slate-300 text-[11px]">{issue.desc}</p>
            </div>
          ))}
        </div>
      )}

      {/* Gemini AI Deep Analysis Trigger & Display */}
      <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-500 to-cyan-500 flex items-center justify-center text-slate-950 font-bold">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-white">Analisis Portofolio Mendalam (AI)</h3>
              <p className="text-[10px] text-slate-400">Diagnosis kualitatif & makro berstandar analis CFA</p>
            </div>
          </div>
          <button
            onClick={handleRunAiAnalysis}
            disabled={isAiLoading}
            className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 text-xs font-bold flex items-center gap-1.5 transition-colors shadow-md shadow-emerald-500/20"
          >
            {isAiLoading ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Memproses...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                <span>{aiAnalysis ? 'Perbarui Analisis' : 'Mulai Analisis AI'}</span>
              </>
            )}
          </button>
        </div>

        {aiError && (
          <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-900 text-xs text-rose-300">
            {aiError}
          </div>
        )}

        {aiAnalysis ? (
          <div className="space-y-4 pt-2 border-t border-slate-800 text-xs">
            {/* Executive Summary */}
            <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800/80 leading-relaxed text-slate-200">
              <span className="font-bold text-white block mb-1">📋 Ringkasan Eksekutif:</span>
              <p>{aiAnalysis.ringkasanEksekutif}</p>
            </div>

            {/* Profile Alignment Commentary */}
            <div className="p-3 rounded-xl bg-slate-950/40 border border-slate-800/80 text-slate-300">
              <span className="font-semibold text-emerald-400 block mb-1">
                🎯 Evaluasi Keselarasan Profil {currentProfile.name}:
              </span>
              <p className="text-[11px] leading-relaxed">{aiAnalysis.analisisKesesuaianProfil}</p>
            </div>

            {/* Strengths & Weaknesses SWOT */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Strengths */}
              <div className="p-3.5 rounded-2xl bg-emerald-950/20 border border-emerald-900/40">
                <span className="font-bold text-emerald-400 flex items-center gap-1 mb-2">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Kekuatan Utama
                </span>
                <ul className="space-y-1.5 text-[11px] text-slate-300">
                  {aiAnalysis.kekuatanPortofolio?.map((k: string, i: number) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <span className="text-emerald-400 mt-0.5">•</span>
                      <span>{k}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Weaknesses */}
              <div className="p-3.5 rounded-2xl bg-rose-950/20 border border-rose-900/40">
                <span className="font-bold text-rose-400 flex items-center gap-1 mb-2">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Kelemahan & Titik Rawan
                </span>
                <ul className="space-y-1.5 text-[11px] text-slate-300">
                  {aiAnalysis.kelemahanDanRisiko?.map((w: string, i: number) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <span className="text-rose-400 mt-0.5">•</span>
                      <span>{w}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Macro & Market Trends View */}
            <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 text-[11px] text-slate-300 leading-relaxed">
              <span className="font-bold text-cyan-400 flex items-center gap-1 mb-1">
                <BarChart2 className="w-3.5 h-3.5" />
                Dampak Tren Pasar & Makroekonomi Terkini:
              </span>
              <p>{aiAnalysis.pandanganTrenPasarTerkait}</p>
            </div>

            {/* Quick Navigation to Optimizer */}
            <button
              onClick={onNavigateToOptimizer}
              className="w-full py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-[0.98] transition-transform"
            >
              <span>Lihat Saran Optimasi & Simulasi Rebalancing</span>
              <ChevronRight className="w-4 h-4 stroke-[3]" />
            </button>
          </div>
        ) : (
          <div className="text-center py-4 text-xs text-slate-400">
            Ketuk tombol di atas untuk menjalankan audit portofolio AI berbasis data riwayat, valuasi, dan tren pasar terkini.
          </div>
        )}
      </div>
    </div>
  );
};

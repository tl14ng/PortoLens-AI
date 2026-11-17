import React, { useState, useEffect } from 'react';
import { ScoreGauge } from './ChartComponents';
import { ShieldCheck, AlertTriangle, Sparkles, RefreshCw, CheckCircle2, ChevronRight, BarChart2 } from 'lucide-react';
import { RiskProfile } from '../data/marketData';
import { fetchJsonSafe } from '../utils/safeFetch';
import { useLanguage } from '../i18n/LanguageContext';

interface ScoreTabProps {
  metrics: any;
  currentProfile: RiskProfile;
  currency: 'IDR' | 'USD';
  usdIdrRate?: number;
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

export const ScoreTab: React.FC<ScoreTabProps> = React.memo(({
  metrics,
  currentProfile,
  currency,
  usdIdrRate,
  onNavigateToOptimizer,
}) => {
  const { language, t } = useLanguage();

  const holdingsSignature = (metrics?.holdings || [])
    .map((h: any) => `${h.ticker}:${h.shares}`)
    .sort()
    .join('|');
  const cacheKey = `${holdingsSignature}|${currentProfile.id}|${currency}|${language}`;

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
      setAiError(
        t(
          'Portofolio Anda masih kosong. Tambahkan minimal 1 saham atau ETF terlebih dahulu untuk dianalisis.',
          'Your portfolio is empty. Add at least 1 stock or ETF first to run analysis.'
        )
      );
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
        usdIdrRate,
        lang: language,
      };

      const result = await fetchJsonSafe<any>('/api/analyze-portfolio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!result.ok || !result.data) {
        throw new Error(
          result.errorMessage || t('Gagal menghubungi server analisis.', 'Failed to reach analysis server.')
        );
      }

      const data = result.data;
      setScoreAiCache(reqCacheKey, data);
      if (aiRequestIdRef.current !== reqId) return;
      setAiAnalysis(data);
    } catch (err: any) {
      if (aiRequestIdRef.current !== reqId) return;
      console.error(err);
      setAiError(
        err?.message ||
          t(
            'Tidak dapat memproses analisis AI saat ini. Silakan coba kembali.',
            'Unable to run AI analysis right now. Please try again.'
          )
      );
    } finally {
      if (aiRequestIdRef.current === reqId) {
        setIsAiLoading(false);
      }
    }
  };

  // Determine pillar status
  const getPillarStatus = (score: number) => {
    if (score >= 80) return { label: t('Sangat Baik', 'Excellent'), color: 'text-emerald-400' };
    if (score >= 65) return { label: t('Cukup Baik', 'Good'), color: 'text-cyan-400' };
    if (score >= 50) return { label: t('Perlu Perhatian', 'Needs Attention'), color: 'text-amber-400' };
    return { label: t('Kritis', 'Critical'), color: 'text-rose-400' };
  };

  const isBetaAligned =
    metrics.weightedBeta >= currentProfile.minTargetBeta &&
    metrics.weightedBeta <= currentProfile.maxTargetBeta;

  const hasHoldings = Boolean(metrics?.holdings && metrics.holdings.length > 0);
  const sharpeValue = hasHoldings
    ? metrics.portfolio1YReturn / Math.max(1, metrics.weightedBeta * 15)
    : 0;
  const sharpeStatus = !hasHoldings
    ? { label: t('Belum Ada Aset', 'No Holdings'), color: 'text-slate-500' }
    : sharpeValue >= 1.0
    ? { label: t('Risk-Adjusted Optimal', 'Optimal Risk-Adjusted'), color: 'text-emerald-400' }
    : sharpeValue >= 0.5
    ? { label: t('Cukup Efisien', 'Moderately Efficient'), color: 'text-cyan-400' }
    : sharpeValue >= 0
    ? { label: t('Imbal Hasil Rendah', 'Low Return Efficiency'), color: 'text-amber-400' }
    : { label: t('Rugi Risiko Tinggi', 'Negative Risk-Adjusted'), color: 'text-rose-400' };

  return (
    <div className="pb-24 pt-2 px-4 space-y-4 max-w-lg mx-auto">
      {/* Overall Score Card */}
      <div className="p-5 rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border border-slate-800 shadow-xl relative overflow-hidden">
        <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
          <span className="flex items-center gap-1.5 font-bold text-slate-200">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            {t('Audit Penilaian Portofolio', 'Portfolio Health Audit')}
          </span>
          <span
            className="text-[11px] font-semibold px-2 py-0.5 rounded-full border"
            style={{
              borderColor: `${currentProfile.color}60`,
              color: currentProfile.color,
              backgroundColor: `${currentProfile.color}15`,
            }}
          >
            {t('Profil', 'Profile')}: {currentProfile.name}
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
                <span className="text-xs text-slate-400">
                  {t('Skor Kesehatan Finansial', 'Financial Health Score')}
                </span>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-extrabold text-white tracking-tight font-mono">
                    {displayedScore}
                  </span>
                  <span className="text-sm text-slate-400 font-mono">/ 100</span>
                </div>
                <p className="text-xs text-slate-300 font-medium leading-snug">
                  {!hasHoldings
                    ? t(
                        'Portofolio masih kosong. Tambahkan saham atau ETF terlebih dahulu untuk audit risiko.',
                        'Portfolio is empty. Add stocks or ETFs first to run a risk audit.'
                      )
                    : displayedScore >= 80
                    ? t(
                        'Portofolio kokoh dan selaras dengan toleransi risiko Anda.',
                        'Solid portfolio well-aligned with your risk tolerance.'
                      )
                    : displayedScore >= 65
                    ? t(
                        'Fondasi portofolio baik, namun ada konsentrasi risiko yang perlu dipangkas.',
                        'Good core foundation, though concentration risk should be trimmed.'
                      )
                    : t(
                        'Tingkat risiko melampaui batas profil Anda. Disarankan segera rebalancing.',
                        'Risk exposure exceeds your target band. Immediate rebalancing is recommended.'
                      )}
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
            <span className="text-slate-400">{t('Beta Portofolio', 'Portfolio Beta')}: </span>
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
            <span className="text-slate-400">
              {t(`Target Profil ${currentProfile.name}`, `${currentProfile.name} Target`)}:{' '}
            </span>
            <span className="font-mono text-slate-200 font-medium">
              {currentProfile.targetBetaRange}
            </span>
          </div>
        </div>
      </div>

      {/* 4 Pillars Evaluation Grid */}
      <div>
        <h3 className="text-xs font-bold text-slate-300 mb-2">
          {t('4 Pilar Evaluasi Manajemen Risiko', '4 Pillars of Risk Evaluation')}
        </h3>
        <div className="grid grid-cols-2 gap-2.5">
          {/* Pillar 1: Diversifikasi */}
          <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
            <div>
              <span className="text-[11px] text-slate-400 block">
                {t('1. Diversifikasi Sektor', '1. Sector Diversification')}
              </span>
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
              ● {hasHoldings ? getPillarStatus(metrics.diversificationScore).label : t('Belum Ada Aset', 'No Holdings')}
            </span>
          </div>

          {/* Pillar 2: Kontrol Risiko Beta */}
          <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
            <div>
              <span className="text-[11px] text-slate-400 block">
                {t('2. Kontrol Risiko Beta', '2. Beta Risk Control')}
              </span>
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
              ●{' '}
              {hasHoldings
                ? isBetaAligned
                  ? t('Terkendali', 'Controlled')
                  : t('Sensitif Volatilitas', 'Volatility Sensitive')
                : t('Belum Ada Aset', 'No Holdings')}
            </span>
          </div>

          {/* Pillar 3: Pendapatan & Dividen */}
          <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
            <div>
              <span className="text-[11px] text-slate-400 block">
                {t('3. Imbal Hasil Dividen', '3. Dividend Yield')}
              </span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-lg font-bold text-cyan-400 font-mono">
                  {hasHoldings ? `${metrics.portfolioDividendYield}%` : '—'}
                </span>
                {hasHoldings && <span className="text-[10px] text-slate-500">{t('/thn', '/yr')}</span>}
              </div>
            </div>
            <span className={`text-[10px] font-semibold mt-2 ${hasHoldings ? 'text-slate-400' : 'text-slate-500'}`}>
              ●{' '}
              {!hasHoldings
                ? t('Belum Ada Aset', 'No Holdings')
                : metrics.portfolioDividendYield > 2
                ? t('Cashflow Kuat', 'Strong Cash Flow')
                : t('Fokus Capital Gain', 'Growth-Focused')}
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
                {hasHoldings && <span className="text-[10px] text-slate-500">{t('rasio', 'ratio')}</span>}
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
            {t('Catatan Kritis Manajemen Risiko', 'Critical Risk Management Flags')} ({metrics.issuesDetected.length})
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
                  {issue.severity === 'high' ? t('Prioritas Tinggi', 'High Priority') : t('Perhatian', 'Watch')}
                </span>
              </div>
              <p className="text-slate-300 text-[11px]">{issue.desc}</p>
            </div>
          ))}
        </div>
      )}

      {/* Gemini AI Deep Analysis Trigger & Display */}
      <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-500 to-cyan-500 flex items-center justify-center text-slate-950 font-bold shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-xs font-bold text-white truncate">
                {t('Analisis Portofolio Mendalam (AI)', 'Deep AI Portfolio Audit')}
              </h3>
              <p className="text-[10px] text-slate-400 truncate">
                {t('Diagnosis kualitatif & makro berstandar analis CFA', 'CFA-grade qualitative & macro diagnosis')}
              </p>
            </div>
          </div>
          <button
            onClick={handleRunAiAnalysis}
            disabled={isAiLoading}
            className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 text-xs font-bold flex items-center gap-1.5 transition-colors shadow-md shadow-emerald-500/20 shrink-0"
          >
            {isAiLoading ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>{t('Memproses...', 'Analyzing...')}</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                <span>
                  {aiAnalysis
                    ? t('Perbarui Analisis', 'Refresh Analysis')
                    : t('Mulai Analisis AI', 'Run AI Analysis')}
                </span>
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
              <span className="font-bold text-white block mb-1">
                {t('Ringkasan Eksekutif:', 'Executive Summary:')}
              </span>
              <p>{aiAnalysis.ringkasanEksekutif}</p>
            </div>

            {/* Profile Alignment Commentary */}
            <div className="p-3 rounded-xl bg-slate-950/40 border border-slate-800/80 text-slate-300">
              <span className="font-semibold text-emerald-400 block mb-1">
                {t(
                  `Evaluasi Keselarasan Profil ${currentProfile.name}:`,
                  `${currentProfile.name} Profile Alignment Check:`
                )}
              </span>
              <p className="text-[11px] leading-relaxed">{aiAnalysis.analisisKesesuaianProfil}</p>
            </div>

            {/* Strengths & Weaknesses SWOT */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Strengths */}
              <div className="p-3.5 rounded-2xl bg-emerald-950/20 border border-emerald-900/40">
                <span className="font-bold text-emerald-400 flex items-center gap-1 mb-2">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {t('Kekuatan Utama', 'Key Strengths')}
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
                  {t('Kelemahan & Titik Rawan', 'Weaknesses & Risks')}
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
                {t('Dampak Tren Pasar & Makroekonomi Terkini:', 'Macro & Current Market Trend Impact:')}
              </span>
              <p>{aiAnalysis.pandanganTrenPasarTerkait}</p>
            </div>

            {/* Quick Navigation to Optimizer */}
            <button
              onClick={onNavigateToOptimizer}
              className="w-full py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-[0.98] transition-transform"
            >
              <span>
                {t('Lihat Saran Optimasi & Simulasi Rebalancing', 'View Optimization & Rebalance Plan')}
              </span>
              <ChevronRight className="w-4 h-4 stroke-[3]" />
            </button>
          </div>
        ) : (
          <div className="text-center py-4 text-xs text-slate-400">
            {t(
              'Ketuk tombol di atas untuk menjalankan audit portofolio AI berbasis data riwayat, valuasi, dan tren pasar terkini.',
              'Tap the button above to run an AI portfolio audit based on history, valuation, and current macro trends.'
            )}
          </div>
        )}
      </div>
    </div>
  );
});

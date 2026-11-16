import React, { useState, useEffect } from 'react';
import {
  X,
  Briefcase,
  Search,
  Sparkles,
  Bell,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  ShieldCheck,
} from 'lucide-react';
import type { TabKey } from './BottomTabBar';
import { useLanguage } from '../i18n/LanguageContext';

interface OnboardingTutorialModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateTab?: (tab: TabKey) => void;
}

interface OnboardingStep {
  id: string;
  badge: string;
  title: string;
  subtitle: string;
  description: string;
  tips: string[];
  icon: React.FC<{ className?: string }>;
  accentClass: string;
  badgeClass: string;
  actionLabel?: string;
  targetTab?: TabKey;
}

const STEPS_ID: OnboardingStep[] = [
  {
    id: 'portfolio',
    badge: 'Langkah 1 dari 4 · Portofolio',
    title: 'Kelola Portofolio Saham & ETF',
    subtitle: 'Saham IHSG (Rp), Wall Street AS ($), dan ETF Global',
    description:
      'Catat aset Anda di satu tempat dengan perhitungan nilai pasar, modal rata-rata, dan laba/rugi real-time dalam Rupiah (Rp) maupun Dollar (USD).',
    tips: [
      'Ketuk tombol + Tambah Aset untuk memilih dari 5.000+ ticker atau pakai template portofolio siap pakai.',
      'Mendukung jumlah lembar pecahan desimal (misal 3,8955) untuk saham AS & ETF.',
      'Ketuk aset di daftar untuk mengubah jumlah lembar atau harga beli rata-rata.',
    ],
    icon: Briefcase,
    accentClass: 'from-emerald-500/20 to-cyan-500/10 border-emerald-500/30 text-emerald-400',
    badgeClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    actionLabel: 'Lihat Tab Portofolio',
    targetTab: 'portfolio',
  },
  {
    id: 'search',
    badge: 'Langkah 2 dari 4 · Pencarian 5.000+ Ticker',
    title: 'Cari & Deteksi Ticker Otomatis',
    subtitle: 'Menu Cari Ticker di bilah navigasi bawah',
    description:
      'Gunakan tombol Cari Ticker di bagian bawah untuk mengeksplorasi 5.000+ emiten & ETF atau membedah saham sebelum membelinya.',
    tips: [
      'Cari berdasarkan kode ticker (BBCA, NVDA, QQQI), nama perusahaan, atau sektor.',
      'Jika ticker belum ada di katalog, tekan Cari untuk deteksi otomatis bursa & harga pasarnya.',
      'Ketuk emiten mana saja untuk melihat profil risiko, harga wajar, dan memasukkannya ke portofolio.',
    ],
    icon: Search,
    accentClass: 'from-cyan-500/20 to-indigo-500/10 border-cyan-500/30 text-cyan-400',
    badgeClass: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
    actionLabel: 'Coba Tab Cari Ticker',
    targetTab: 'search',
  },
  {
    id: 'ai',
    badge: 'Langkah 3 dari 4 · Fitur AI Cerdas',
    title: 'Analisis AI Real-Time & Audit Risiko',
    subtitle: 'Bedah fundamental emiten & skor kesehatan portofolio',
    description:
      'Manfaatkan AI untuk menilai apakah portofolio terlalu terkonsentrasi dan dapatkan analisis mendalam setiap saham atau ETF.',
    tips: [
      'Buka detail aset lalu tekan Analisis Mendalam dengan AI untuk estimasi harga wajar, katalis, & risiko.',
      'Cek tab Penilaian AI untuk skor diversifikasi, Beta portofolio, dan kesesuaian profil risiko Anda.',
      'Gunakan tab Saran Optimasi untuk rekomendasi rebalancing otomatis agar risiko tetap terjaga.',
    ],
    icon: Sparkles,
    accentClass: 'from-indigo-500/20 to-purple-500/10 border-indigo-500/30 text-indigo-400',
    badgeClass: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
    actionLabel: 'Buka Penilaian AI',
    targetTab: 'evaluation',
  },
  {
    id: 'alerts',
    badge: 'Langkah 4 dari 4 · Target & Profil',
    title: 'Pantau Target Harga & Profil Risiko',
    subtitle: 'Notifikasi otomatis Entry (Beli) & Exit (Take Profit)',
    description:
      'Atur profil risiko Anda (Konservatif s/d Sangat Agresif) di header atas dan aktifkan pengingat harga agar tidak ketinggalan momentum.',
    tips: [
      'Ketuk ikon Lonceng di pojok kanan atas untuk memasang atau menguji notifikasi target harga.',
      'Gunakan tombol Rp / USD di header atas untuk beralih mata uang tampilan kapan saja.',
      'Anda bisa membuka ulang panduan ini lewat tombol (?) di bagian atas layar.',
    ],
    icon: Bell,
    accentClass: 'from-amber-500/20 to-emerald-500/10 border-amber-500/30 text-amber-400',
    badgeClass: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  },
];

const STEPS_EN: OnboardingStep[] = [
  {
    id: 'portfolio',
    badge: 'Step 1 of 4 · Portfolio',
    title: 'Manage Stocks & ETFs',
    subtitle: 'IDX Stocks (Rp), US Wall Street ($), and Global ETFs',
    description:
      'Track your holdings in one place with live market valuation, cost basis, and unrealized P&L in either IDR (Rp) or USD ($).',
    tips: [
      'Tap + Add Asset to pick from 5,000+ tickers or load a ready-made portfolio template.',
      'Supports fractional decimal shares (e.g. 3.8955) for US stocks & ETFs.',
      'Tap any holding in your list to edit share count or average buy price.',
    ],
    icon: Briefcase,
    accentClass: 'from-emerald-500/20 to-cyan-500/10 border-emerald-500/30 text-emerald-400',
    badgeClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    actionLabel: 'View Portfolio Tab',
    targetTab: 'portfolio',
  },
  {
    id: 'search',
    badge: 'Step 2 of 4 · 5,000+ Ticker Search',
    title: 'Search & Auto-Detect Tickers',
    subtitle: 'Search Tab in the bottom navigation bar',
    description:
      'Use the Search tab below to explore 5,000+ global equities & ETFs or research an asset before buying.',
    tips: [
      'Filter by ticker symbol (BBCA, NVDA, QQQI), company name, or sector.',
      'If a ticker is missing from the catalog, press Search to auto-detect its exchange and live quote.',
      'Tap any ticker to inspect its risk profile, fair value range, and add it to your portfolio.',
    ],
    icon: Search,
    accentClass: 'from-cyan-500/20 to-indigo-500/10 border-cyan-500/30 text-cyan-400',
    badgeClass: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
    actionLabel: 'Try Search Tab',
    targetTab: 'search',
  },
  {
    id: 'ai',
    badge: 'Step 3 of 4 · Smart AI Insights',
    title: 'Real-Time AI Research & Risk Audit',
    subtitle: 'Deep asset fundamentals & portfolio health score',
    description:
      'Spot single-stock concentration early and generate deep fundamental & risk breakdowns for any stock or ETF.',
    tips: [
      'Open any asset detail sheet and tap Deep AI Analysis for fair value estimates, catalysts, & risks.',
      'Visit the AI Score tab to inspect diversification, portfolio Beta, and risk-profile alignment.',
      'Use the Optimize tab for automated share-level rebalancing recommendations.',
    ],
    icon: Sparkles,
    accentClass: 'from-indigo-500/20 to-purple-500/10 border-indigo-500/30 text-indigo-400',
    badgeClass: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
    actionLabel: 'Open AI Score',
    targetTab: 'evaluation',
  },
  {
    id: 'alerts',
    badge: 'Step 4 of 4 · Alerts & Profile',
    title: 'Price Target Alerts & Risk Profile',
    subtitle: 'Automated Entry (Buy Dip) & Exit (Take Profit) alerts',
    description:
      'Choose your risk profile (Conservative to Very Aggressive) in the top header and set price targets so you never miss a move.',
    tips: [
      'Tap the Bell icon at the top right to create or test simulated price alerts.',
      'Toggle Rp / USD or ID / EN in the header bar anytime.',
      'Reopen this quick guide anytime via the (?) button in the header.',
    ],
    icon: Bell,
    accentClass: 'from-amber-500/20 to-emerald-500/10 border-amber-500/30 text-amber-400',
    badgeClass: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  },
];

export const OnboardingTutorialModal: React.FC<OnboardingTutorialModalProps> = ({
  isOpen,
  onClose,
  onNavigateTab,
}) => {
  const { language, t } = useLanguage();
  const [stepIdx, setStepIdx] = useState(0);

  useEffect(() => {
    if (isOpen) {
      setStepIdx(0);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const steps = language === 'en' ? STEPS_EN : STEPS_ID;
  const step = steps[stepIdx];
  const Icon = step.icon;
  const isLast = stepIdx === steps.length - 1;

  const handleJumpToTab = () => {
    if (step.targetTab && onNavigateTab) {
      onNavigateTab(step.targetTab);
    }
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
    >
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-t-3xl sm:rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Top bar */}
        <div className="px-5 pt-4 pb-3 border-b border-slate-800/90 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold text-slate-200 tracking-wide">
              {t('Panduan Singkat PortoLens AI', 'PortoLens AI Quick Guide')}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-medium text-slate-400 hover:text-white px-2 py-1 rounded-lg hover:bg-slate-800 transition-colors flex items-center gap-1"
          >
            <span>{t('Lewati', 'Skip')}</span>
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Step Content */}
        <div className="p-5 overflow-y-auto space-y-4">
          <div className="flex items-start gap-3.5">
            <div
              className={`w-12 h-12 rounded-2xl bg-gradient-to-br border flex items-center justify-center shrink-0 ${step.accentClass}`}
            >
              <Icon className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <span
                className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full border mb-1.5 ${step.badgeClass}`}
              >
                {step.badge}
              </span>
              <h2 id="onboarding-title" className="text-base font-bold text-white leading-snug">
                {step.title}
              </h2>
              <p className="text-[11px] text-slate-400 mt-0.5">{step.subtitle}</p>
            </div>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed">{step.description}</p>

          {/* Practical bullet tips */}
          <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800/90 space-y-2.5">
            {step.tips.map((tip, idx) => (
              <div key={idx} className="flex items-start gap-2 text-xs text-slate-200">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                <span className="leading-relaxed text-[11.5px]">{tip}</span>
              </div>
            ))}
          </div>

          {/* Optional direct shortcut to that tab */}
          {step.actionLabel && step.targetTab && onNavigateTab && (
            <button
              type="button"
              onClick={handleJumpToTab}
              className="w-full py-2 px-3 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 text-[11px] font-semibold text-emerald-300 flex items-center justify-center gap-1 transition-colors"
            >
              <span>{step.actionLabel}</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Footer navigation */}
        <div className="px-5 py-3.5 border-t border-slate-800 bg-slate-950/50 flex items-center justify-between gap-3">
          {/* Step indicators */}
          <div className="flex items-center gap-1.5">
            {steps.map((s, idx) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setStepIdx(idx)}
                aria-label={`${t('Langkah', 'Step')} ${idx + 1}`}
                className={`h-1.5 rounded-full transition-all ${
                  idx === stepIdx
                    ? 'w-5 bg-emerald-400'
                    : idx < stepIdx
                    ? 'w-2 bg-emerald-500/40'
                    : 'w-2 bg-slate-700'
                }`}
              />
            ))}
          </div>

          {/* Prev / Next / Finish buttons */}
          <div className="flex items-center gap-2">
            {stepIdx > 0 && (
              <button
                type="button"
                onClick={() => setStepIdx((prev) => Math.max(0, prev - 1))}
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 flex items-center gap-1 transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>{t('Kembali', 'Back')}</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                if (isLast) {
                  onClose();
                } else {
                  setStepIdx((prev) => Math.min(steps.length - 1, prev + 1));
                }
              }}
              className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold flex items-center gap-1 shadow-md shadow-emerald-500/20 transition-all active:scale-[0.98]"
            >
              <span>{isLast ? t('Mulai Sekarang', 'Get Started') : t('Lanjut', 'Next')}</span>
              {!isLast && <ChevronRight className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

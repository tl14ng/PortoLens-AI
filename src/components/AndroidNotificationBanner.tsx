import React, { useEffect, useState } from 'react';
import { Bell, ArrowUpRight, ArrowDownRight, X, ChevronRight, ShieldCheck } from 'lucide-react';
import { PriceAlert } from '../data/marketData';

interface AndroidNotificationBannerProps {
  alert: PriceAlert | null;
  onDismiss: (alertId: string) => void;
  onViewAsset: (ticker: string) => void;
}

export const AndroidNotificationBanner: React.FC<AndroidNotificationBannerProps> = ({
  alert,
  onDismiss,
  onViewAsset,
}) => {
  const [isVisible, setIsVisible] = useState(false);

  const dismissDelayTimerRef = React.useRef<number | null>(null);

  useEffect(() => {
    if (dismissDelayTimerRef.current) {
      window.clearTimeout(dismissDelayTimerRef.current);
      dismissDelayTimerRef.current = null;
    }
    if (alert) {
      setIsVisible(true);
      // Auto dismiss after 7 seconds if not interacted
      const timer = window.setTimeout(() => {
        setIsVisible(false);
        dismissDelayTimerRef.current = window.setTimeout(() => onDismiss(alert.id), 300);
      }, 7000);
      return () => {
        window.clearTimeout(timer);
        if (dismissDelayTimerRef.current) {
          window.clearTimeout(dismissDelayTimerRef.current);
          dismissDelayTimerRef.current = null;
        }
      };
    } else {
      setIsVisible(false);
    }
  }, [alert]);

  const scheduleDismiss = (alertId: string) => {
    if (dismissDelayTimerRef.current) {
      window.clearTimeout(dismissDelayTimerRef.current);
      dismissDelayTimerRef.current = null;
    }
    setIsVisible(false);
    dismissDelayTimerRef.current = window.setTimeout(() => onDismiss(alertId), 200);
  };

  if (!alert || !isVisible) return null;

  const isEntry = alert.type === 'ENTRY';

  return (
    <div className="absolute top-2 left-2 right-2 z-50 pointer-events-auto transition-all duration-300 ease-out animate-in slide-in-from-top-6">
      <div className="bg-slate-900/95 backdrop-blur-xl border border-slate-700/80 rounded-2xl p-3.5 shadow-2xl shadow-black/80 ring-1 ring-white/10">
        {/* Android notification header bar */}
        <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1.5">
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-4 rounded-md bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <ShieldCheck className="w-2.5 h-2.5" />
            </div>
            <span className="font-semibold text-slate-200">PortoLens AI</span>
            <span>·</span>
            <span className="text-[10px] text-emerald-400 font-medium">TARGET HARGA TERCAPAI</span>
          </div>
          <button
            onClick={() => scheduleDismiss(alert.id)}
            className="w-5 h-5 rounded-full hover:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white"
          >
            <X className="w-3 h-3" />
          </button>
        </div>

        {/* Notification Body */}
        <div className="flex items-start gap-3">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 border ${
              isEntry
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
            }`}
          >
            {isEntry ? <ArrowDownRight className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-baseline justify-between gap-1">
              <h4 className="text-xs font-bold text-white truncate">
                {isEntry ? '🎯 Target Beli (Entry) Terpenuhi:' : '🚀 Target Jual (Exit) Terpenuhi:'}{' '}
                <span className="font-mono text-emerald-400">{alert.ticker}</span>
              </h4>
            </div>

            <p className="text-[11px] text-slate-300 mt-0.5 leading-snug">
              Harga pasar menyentuh{' '}
              <strong className="text-white font-mono">
                {alert.currency === 'USD' ? '$' : 'Rp '}
                {alert.targetPrice.toLocaleString('id-ID', {
                  maximumFractionDigits:
                    alert.currency === 'USD' ? (alert.targetPrice < 1 ? 4 : 2) : 0,
                })}
              </strong>
              . {alert.note ? `"${alert.note}"` : 'Sesuai dengan target batas yang Anda pasang.'}
            </p>

            {/* Quick Actions */}
            <div className="flex items-center gap-2 mt-2 pt-1.5 border-t border-slate-800/80">
              <button
                onClick={() => {
                  onViewAsset(alert.ticker);
                  scheduleDismiss(alert.id);
                }}
                className="px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-[11px] flex items-center gap-1 transition-colors"
              >
                <span>Lihat Portofolio</span>
                <ChevronRight className="w-3 h-3" />
              </button>
              <button
                onClick={() => scheduleDismiss(alert.id)}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-medium transition-colors"
              >
                Abaikan
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

import React from 'react';
import {
  X,
  Bell,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Trash2,
  Plus,
  Play,
  RotateCcw,
} from 'lucide-react';
import { PriceAlert, getAssetByTicker, convertToCurrency } from '../data/marketData';
import { useLanguage } from '../i18n/LanguageContext';

interface PriceAlertDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  alerts: PriceAlert[];
  onOpenCreateModal: () => void;
  onRemoveAlert: (alertId: string) => void;
  onSimulatePriceChange: (ticker: string, newPrice: number) => void;
  onResetSimulatedPrices: () => void;
  simulatedPrices: Record<string, number>;
  liveQuotes?: Record<string, { price: number; currency?: string; isLiveFound?: boolean }>;
  usdIdrRate?: number;
}

export const PriceAlertDrawer: React.FC<PriceAlertDrawerProps> = ({
  isOpen,
  onClose,
  alerts,
  onOpenCreateModal,
  onRemoveAlert,
  onSimulatePriceChange,
  onResetSimulatedPrices,
  simulatedPrices,
  liveQuotes,
  usdIdrRate,
}) => {
  const { locale, t } = useLanguage();

  if (!isOpen) return null;

  const triggeredAlerts = alerts.filter((a) => a.status === 'TRIGGERED');
  const activeAlerts = alerts.filter((a) => a.status === 'ACTIVE');

  const formatPrice = (val: number | undefined | null, curr: 'USD' | 'IDR') => {
    const safeVal = typeof val === 'number' && Number.isFinite(val) ? val : 0;
    return safeVal.toLocaleString(locale, {
      maximumFractionDigits: curr === 'USD' ? (safeVal > 0 && safeVal < 1 ? 4 : 2) : 0,
    });
  };

  const getBasePrice = (ticker: string, fallback: number) => {
    const upper = ticker.toUpperCase();
    const asset = getAssetByTicker(upper);
    const live =
      liveQuotes?.[ticker] ||
      liveQuotes?.[upper] ||
      (asset?.type === 'IDX_STOCK' ? liveQuotes?.[`${upper}.JK`] : undefined);
    if (
      typeof live?.price === 'number' &&
      Number.isFinite(live.price) &&
      live.price > 0 &&
      live.isLiveFound !== false
    ) {
      return live.price;
    }
    return asset?.price || fallback;
  };

  const nvdaBase = getBasePrice('NVDA', 170);
  const nvdaExitAlert = activeAlerts.find((a) => a.ticker === 'NVDA' && a.type === 'EXIT');
  const nvdaUpTarget = Number(
    Math.max(nvdaBase * 1.1, nvdaExitAlert ? nvdaExitAlert.targetPrice * 1.02 : 0).toFixed(2)
  );
  const nvdaUpPct = nvdaBase > 0 ? ((nvdaUpTarget - nvdaBase) / nvdaBase) * 100 : 10;

  const nvdaEntryAlert = activeAlerts.find((a) => a.ticker === 'NVDA' && a.type === 'ENTRY');
  const nvdaDownTarget = Number(
    Math.min(
      nvdaBase * 0.9,
      nvdaEntryAlert ? nvdaEntryAlert.targetPrice * 0.98 : nvdaBase * 0.9
    ).toFixed(2)
  );
  const nvdaDownPct = nvdaBase > 0 ? ((nvdaDownTarget - nvdaBase) / nvdaBase) * 100 : -10;

  const bbcaBase = getBasePrice('BBCA', 5350);
  const bbcaEntryAlert = activeAlerts.find((a) => a.ticker === 'BBCA' && a.type === 'ENTRY');
  const bbcaDownTarget = Math.max(
    100,
    Math.round(
      Math.min(
        bbcaBase * 0.92,
        bbcaEntryAlert ? bbcaEntryAlert.targetPrice * 0.98 : bbcaBase * 0.92
      )
    )
  );
  const bbcaDownPct = bbcaBase > 0 ? ((bbcaDownTarget - bbcaBase) / bbcaBase) * 100 : -8;

  const vooBase = getBasePrice('VOO', 550);
  const vooExitAlert = activeAlerts.find((a) => a.ticker === 'VOO' && a.type === 'EXIT');
  const vooUpTarget = Number(
    Math.max(vooBase * 1.05, vooExitAlert ? vooExitAlert.targetPrice * 1.02 : 0).toFixed(2)
  );
  const vooUpPct = vooBase > 0 ? ((vooUpTarget - vooBase) / vooBase) * 100 : 5;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-t-3xl sm:rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-5 pt-4 pb-3 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                {t('Pusat Notifikasi Harga', 'Price Alert Center')}
              </h2>
              <p className="text-xs text-slate-400">
                {t(
                  `${triggeredAlerts.length} terpicu · ${activeAlerts.length} aktif dipantau`,
                  `${triggeredAlerts.length} triggered · ${activeAlerts.length} actively watched`
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onOpenCreateModal}
              className="px-2.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{t('Pasang Baru', 'New Alert')}</span>
            </button>
            <button
              onClick={onClose}
              aria-label={t('Tutup', 'Close')}
              className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="p-4 space-y-4 overflow-y-auto">
          {/* SIMULATOR BOX: Immediate testing for user */}
          <div className="p-3.5 rounded-2xl bg-gradient-to-r from-emerald-950/30 via-slate-900 to-cyan-950/30 border border-emerald-800/40 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-emerald-400 flex items-center gap-1.5">
                <Play className="w-3.5 h-3.5 fill-emerald-400" />
                {t('Uji Coba Pemicu Notifikasi (Simulator Harga)', 'Alert Trigger Test (Price Simulator)')}
              </span>
              {Object.keys(simulatedPrices || {}).length > 0 && (
                <button
                  onClick={onResetSimulatedPrices}
                  className="flex items-center gap-1 text-[11px] text-amber-400 hover:text-amber-300 font-medium"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>{t('Reset Harga Normal', 'Reset Live Prices')}</span>
                </button>
              )}
            </div>
            <p className="text-[11px] text-slate-300 leading-snug">
              {t(
                'Ketuk tombol simulasi di bawah untuk menggerakkan harga pasar seketika dan melihat notifikasi Android muncul di layar:',
                'Tap a simulation button below to move market prices instantly and preview the heads-up notification banner:'
              )}
            </p>

            <div className="grid grid-cols-2 gap-2 pt-1 text-[11px]">
              <button
                onClick={() => onSimulatePriceChange('NVDA', nvdaUpTarget)}
                className="p-2 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-emerald-500 text-left transition-colors"
              >
                <div className="flex items-center justify-between font-bold text-slate-200">
                  <span>{t('NVDA Naik', 'NVDA Rally')}</span>
                  <span className="text-emerald-400 font-mono">+{nvdaUpPct.toFixed(1)}%</span>
                </div>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  {t('Uji pemicu Target Exit', 'Test Exit Target')} ${nvdaUpTarget.toFixed(2)}
                </span>
              </button>

              <button
                onClick={() => onSimulatePriceChange('NVDA', nvdaDownTarget)}
                className="p-2 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-emerald-500 text-left transition-colors"
              >
                <div className="flex items-center justify-between font-bold text-slate-200">
                  <span>{t('NVDA Turun', 'NVDA Dip')}</span>
                  <span className="text-rose-400 font-mono">{nvdaDownPct.toFixed(1)}%</span>
                </div>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  {t('Uji pemicu Buy on Dip', 'Test Buy on Dip')} ${nvdaDownTarget.toFixed(2)}
                </span>
              </button>

              <button
                onClick={() => onSimulatePriceChange('BBCA', bbcaDownTarget)}
                className="p-2 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-emerald-500 text-left transition-colors"
              >
                <div className="flex items-center justify-between font-bold text-slate-200">
                  <span>{t('BBCA Koreksi', 'BBCA Pullback')}</span>
                  <span className="text-rose-400 font-mono">{bbcaDownPct.toFixed(1)}%</span>
                </div>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  {t('Uji Buy on Dip', 'Test Buy on Dip')} Rp {bbcaDownTarget.toLocaleString(locale)}
                </span>
              </button>

              <button
                onClick={() => onSimulatePriceChange('VOO', vooUpTarget)}
                className="p-2 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-emerald-500 text-left transition-colors"
              >
                <div className="flex items-center justify-between font-bold text-slate-200">
                  <span>VOO ATH</span>
                  <span className="text-emerald-400 font-mono">+{vooUpPct.toFixed(1)}%</span>
                </div>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  {t('Uji pemicu Target Exit', 'Test Exit Target')} ${vooUpTarget.toFixed(2)}
                </span>
              </button>
            </div>
          </div>

          {/* Triggered Alerts Section */}
          {triggeredAlerts.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-emerald-400 flex items-center gap-1.5 mb-2">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {t(`Notifikasi Terpicu (${triggeredAlerts.length})`, `Triggered Alerts (${triggeredAlerts.length})`)}
              </h3>

              <div className="space-y-2">
                {triggeredAlerts.map((alert) => {
                  const isEntry = alert.type === 'ENTRY';
                  return (
                    <div
                      key={alert.id}
                      className="p-3.5 rounded-2xl bg-emerald-950/20 border border-emerald-800/60 flex items-start justify-between gap-3 text-xs"
                    >
                      <div className="flex items-start gap-2.5">
                        <div
                          className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                            isEntry
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : 'bg-amber-500/20 text-amber-400'
                          }`}
                        >
                          {isEntry ? (
                            <ArrowDownRight className="w-4 h-4" />
                          ) : (
                            <ArrowUpRight className="w-4 h-4" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white text-sm">{alert.ticker}</span>
                            <span className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider bg-emerald-900/40 px-1.5 py-0.2 rounded">
                              {isEntry ? t('Entry Terpenuhi', 'Entry Hit') : t('Exit Terpenuhi', 'Exit Hit')}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-300 mt-0.5">
                            {t('Target:', 'Target:')}{' '}
                            <strong className="text-white font-mono">
                              {alert.currency === 'USD' ? '$' : 'Rp '}
                              {formatPrice(alert.targetPrice, alert.currency)}
                            </strong>
                          </p>
                          {alert.note && (
                            <p className="text-[10px] text-slate-400 italic mt-0.5">
                              "{alert.note}"
                            </p>
                          )}
                          <span className="text-[9px] text-slate-500 block mt-1">
                            {t('Terpicu:', 'Triggered:')} {alert.triggeredAt || t('Baru saja', 'Just now')}
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => onRemoveAlert(alert.id)}
                        className="text-slate-500 hover:text-rose-400 p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
                        title={t('Hapus notifikasi', 'Delete alert')}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Active Alerts Section */}
          <div>
            <h3 className="text-xs font-bold text-slate-300 flex items-center gap-1.5 mb-2">
              <Clock className="w-3.5 h-3.5 text-cyan-400" />
              {t(`Target Aktif Sedang Dipantau (${activeAlerts.length})`, `Active Watched Targets (${activeAlerts.length})`)}
            </h3>

            <div className="space-y-2">
              {activeAlerts.map((alert) => {
                const upper = alert.ticker.toUpperCase();
                const asset = getAssetByTicker(upper);
                const liveQ =
                  liveQuotes?.[alert.ticker] ||
                  liveQuotes?.[upper] ||
                  (asset?.type === 'IDX_STOCK' ? liveQuotes?.[`${upper}.JK`] : undefined);
                const hasValidLive =
                  typeof liveQ?.price === 'number' &&
                  Number.isFinite(liveQ.price) &&
                  liveQ.price > 0 &&
                  liveQ.isLiveFound !== false;
                const simPrice = simulatedPrices?.[alert.ticker] ?? simulatedPrices?.[upper];
                const nativeCurrency: 'IDR' | 'USD' =
                  asset?.type === 'IDX_STOCK'
                    ? 'IDR'
                    : liveQ?.currency === 'IDR' || asset?.currency === 'IDR'
                    ? 'IDR'
                    : 'USD';
                const rawCurrentPrice = hasValidLive
                  ? liveQ.price
                  : asset?.price ?? alert.currentPriceAtCreation ?? 0;
                const currentPrice =
                  typeof simPrice === 'number' &&
                  Number.isFinite(simPrice) &&
                  simPrice > 0
                    ? convertToCurrency(simPrice, nativeCurrency, alert.currency, usdIdrRate)
                    : convertToCurrency(rawCurrentPrice, nativeCurrency, alert.currency, usdIdrRate);
                const isEntry = alert.type === 'ENTRY';
                const distPct =
                  currentPrice > 0 ? ((alert.targetPrice - currentPrice) / currentPrice) * 100 : 0;

                return (
                  <div
                    key={alert.id}
                    className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 flex items-start justify-between gap-3 text-xs"
                  >
                    <div className="flex items-start gap-2.5 min-w-0">
                      <div
                        className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                          isEntry
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        }`}
                      >
                        {isEntry ? (
                          <ArrowDownRight className="w-4 h-4" />
                        ) : (
                          <ArrowUpRight className="w-4 h-4" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white text-sm">{alert.ticker}</span>
                          <span className="text-[10px] text-slate-400 truncate">
                            {isEntry ? t('Target Beli (Entry)', 'Buy Target (Entry)') : t('Target Jual (Exit)', 'Sell Target (Exit)')}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-1 font-mono text-[11px] flex-wrap">
                          <span className="text-slate-400">
                            {t('Harga Saat Ini:', 'Current Price:')}{' '}
                            <strong className="text-slate-200">
                              {alert.currency === 'USD' ? '$' : 'Rp '}
                              {formatPrice(currentPrice, alert.currency)}
                            </strong>
                          </span>
                          <span>→</span>
                          <span className="text-slate-400">
                            {t('Target:', 'Target:')}{' '}
                            <strong className="text-emerald-400">
                              {alert.currency === 'USD' ? '$' : 'Rp '}
                              {formatPrice(alert.targetPrice, alert.currency)}
                            </strong>
                          </span>
                        </div>
                        <span className="text-[10px] text-cyan-400 block mt-1 font-medium">
                          {t('Selisih:', 'Gap:')} {distPct >= 0 ? '+' : ''}
                          {distPct.toFixed(1)}% {t('menuju target batas', 'to threshold target')}
                        </span>
                        {alert.note && (
                          <p className="text-[10px] text-slate-400 italic mt-0.5">
                            "{alert.note}"
                          </p>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => onRemoveAlert(alert.id)}
                      className="text-slate-500 hover:text-rose-400 p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
                      title={t('Hapus target', 'Delete target')}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}

              {activeAlerts.length === 0 && (
                <div className="p-6 rounded-2xl bg-slate-950/40 border border-dashed border-slate-800 text-center">
                  <p className="text-xs text-slate-400">
                    {t('Belum ada target harga aktif yang dipasang.', 'No active price targets set yet.')}
                  </p>
                  <button
                    onClick={onOpenCreateModal}
                    className="mt-2.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs inline-flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    {t('Pasang Target Pertama', 'Create First Alert')}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

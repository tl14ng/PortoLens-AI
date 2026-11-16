import React, { useState, useEffect, useMemo } from 'react';
import { X, Bell, ArrowDownRight, ArrowUpRight, Search } from 'lucide-react';
import {
  getAllAssets,
  getAssetByTicker,
  searchCatalogAssets,
  PriceAlert,
  parseDecimalInput,
} from '../data/marketData';

interface PriceAlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTicker?: string;
  onSaveAlert: (alert: Omit<PriceAlert, 'id' | 'createdAt' | 'status'>) => void;
  availableHoldingsTickers: string[];
  liveQuotes?: Record<string, { price: number; isLiveFound?: boolean }>;
}

export const PriceAlertModal: React.FC<PriceAlertModalProps> = ({
  isOpen,
  onClose,
  initialTicker,
  onSaveAlert,
  availableHoldingsTickers,
  liveQuotes,
}) => {
  const [selectedTicker, setSelectedTicker] = useState<string>(initialTicker || 'NVDA');
  const [tickerSearch, setTickerSearch] = useState<string>('');
  const [alertType, setAlertType] = useState<'ENTRY' | 'EXIT'>('EXIT');
  const [targetPrice, setTargetPrice] = useState<string>('');
  const [note, setNote] = useState<string>('');

  const allAssets = getAllAssets();
  const baseAsset = getAssetByTicker(selectedTicker) || allAssets[0];
  const upperTicker = baseAsset ? baseAsset.ticker.toUpperCase() : '';
  const liveQuote = baseAsset
    ? liveQuotes?.[baseAsset.ticker] ||
      liveQuotes?.[upperTicker] ||
      (baseAsset.type === 'IDX_STOCK' ? liveQuotes?.[`${upperTicker}.JK`] : undefined)
    : undefined;
  const hasValidLive =
    typeof liveQuote?.price === 'number' &&
    Number.isFinite(liveQuote.price) &&
    liveQuote.price > 0 &&
    liveQuote.isLiveFound !== false;
  const currentAsset = baseAsset
    ? { ...baseAsset, price: hasValidLive ? liveQuote.price : baseAsset.price }
    : allAssets[0];

  const holdingSet = useMemo(
    () => new Set(availableHoldingsTickers.map((t) => t.toUpperCase())),
    [availableHoldingsTickers]
  );

  const matchingHoldingsTickers = useMemo(() => {
    const q = tickerSearch.toLowerCase().trim();
    if (!q) return availableHoldingsTickers;
    return availableHoldingsTickers.filter((t) => {
      const asset = getAssetByTicker(t);
      return t.toLowerCase().includes(q) || (asset?.name || '').toLowerCase().includes(q);
    });
  }, [availableHoldingsTickers, tickerSearch]);

  const matchingCatalogAssets = useMemo(() => {
    return searchCatalogAssets(tickerSearch, 'ALL', {
      excludeTickers: holdingSet,
      limit: 120,
    });
  }, [allAssets, holdingSet, tickerSearch]);

  useEffect(() => {
    if (!isOpen || !tickerSearch.trim()) return;
    const upperSel = selectedTicker.toUpperCase();
    const inFilteredHoldings = matchingHoldingsTickers.some((t) => t.toUpperCase() === upperSel);
    const inFilteredCatalog = matchingCatalogAssets.some((a) => a.ticker.toUpperCase() === upperSel);
    if (!inFilteredHoldings && !inFilteredCatalog) {
      const firstMatch = matchingHoldingsTickers[0] || matchingCatalogAssets[0]?.ticker;
      if (firstMatch) {
        setSelectedTicker(firstMatch);
      }
    }
  }, [isOpen, tickerSearch, matchingHoldingsTickers, matchingCatalogAssets, selectedTicker]);

  useEffect(() => {
    if (isOpen) {
      setTickerSearch('');
      if (initialTicker) {
        setSelectedTicker(initialTicker);
      }
    }
  }, [initialTicker, isOpen]);

  // Set default target price whenever modal opens, asset or type changes
  useEffect(() => {
    if (isOpen && currentAsset) {
      const decimals = currentAsset.price < 1 ? 4 : 2;
      if (alertType === 'ENTRY') {
        const defaultVal = currentAsset.currency === 'USD'
          ? (currentAsset.price * 0.95).toFixed(decimals)
          : Math.round(currentAsset.price * 0.95).toString();
        setTargetPrice(defaultVal);
        setNote('Buy on dip / Tambah muatan saat harga koreksi');
      } else {
        const defaultVal = currentAsset.currency === 'USD'
          ? (currentAsset.price * 1.1).toFixed(decimals)
          : Math.round(currentAsset.price * 1.1).toString();
        setTargetPrice(defaultVal);
        setNote('Amankan profit (Take Profit) bertahap');
      }
    }
  }, [isOpen, selectedTicker, alertType]);

  if (!isOpen) return null;

  const currentPrice = currentAsset.price;
  const parsedTarget = parseDecimalInput(targetPrice, {
    thousandsDotForIntegerLocale: currentAsset.currency === 'IDR',
  });
  const targetNum = !isNaN(parsedTarget) && parsedTarget > 0 ? parsedTarget : 0;
  const diffPct = currentPrice > 0 ? ((targetNum - currentPrice) / currentPrice) * 100 : 0;

  const handleApplyPresetPct = (pct: number) => {
    const calculated = currentPrice * (1 + pct / 100);
    const decimals = calculated < 1 ? 4 : 2;
    const formatted = currentAsset.currency === 'USD'
      ? calculated.toFixed(decimals)
      : Math.round(calculated).toString();
    setTargetPrice(formatted);
  };

  const handleSave = () => {
    if (isNaN(targetNum) || targetNum <= 0) return;

    onSaveAlert({
      ticker: currentAsset.ticker,
      assetName: currentAsset.name,
      type: alertType,
      condition: alertType === 'ENTRY' ? 'BELOW_OR_EQUAL' : 'ABOVE_OR_EQUAL',
      targetPrice: targetNum,
      currentPriceAtCreation: currentPrice,
      currency: currentAsset.currency,
      note: note.trim() || undefined,
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-t-3xl sm:rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-5 pt-4 pb-3 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/30 flex items-center justify-center">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Pasang Notifikasi Target Harga</h2>
              <p className="text-xs text-slate-400">Peringatan otomatis saat harga menyentuh batas</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4 overflow-y-auto">
          {/* Ticker Selector */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-300">
              Pilih Emiten / ETF
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                value={tickerSearch}
                onChange={(e) => setTickerSearch(e.target.value)}
                placeholder="Filter cepat ticker (mis: AMZN, BBRI, SCHD)..."
                className="w-full pl-8 pr-3 py-2 rounded-xl bg-slate-950/70 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>
            <select
              value={selectedTicker}
              onChange={(e) => setSelectedTicker(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white font-medium text-sm focus:outline-none focus:border-emerald-500"
            >
              {matchingHoldingsTickers.length > 0 && (
                <optgroup label="Aset di Portofolio Anda">
                  {matchingHoldingsTickers.map((t) => {
                    const asset = getAssetByTicker(t);
                    return (
                      <option key={t} value={t}>
                        {t} - {asset?.name || t}
                      </option>
                    );
                  })}
                </optgroup>
              )}
              {matchingCatalogAssets.length > 0 && (
                <optgroup label={`Katalog Lainnya (${matchingCatalogAssets.length} ditampilkan)`}>
                  {matchingCatalogAssets.map((a) => (
                    <option key={a.ticker} value={a.ticker}>
                      {a.ticker} - {a.name} ({a.type})
                    </option>
                  ))}
                </optgroup>
              )}
              {matchingHoldingsTickers.length === 0 && matchingCatalogAssets.length === 0 && (
                <option value={selectedTicker}>
                  {selectedTicker} - Tidak ada hasil filter lain
                </option>
              )}
            </select>
          </div>

          {/* Alert Type (Target Entry vs Target Exit) */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Tipe Sasaran Harga (Strategi)
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setAlertType('ENTRY')}
                className={`min-h-[44px] p-3 rounded-xl border flex items-center gap-2.5 transition-all text-left ${
                  alertType === 'ENTRY'
                    ? 'bg-emerald-500/10 border-emerald-500 text-white shadow-sm'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                    alertType === 'ENTRY' ? 'bg-emerald-500 text-slate-950 font-bold' : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  <ArrowDownRight className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-bold block text-white">Target Entry (Beli)</span>
                  <span className="text-[10px] text-slate-400">Peringatan harga turun / Buy Dip</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setAlertType('EXIT')}
                className={`min-h-[44px] p-3 rounded-xl border flex items-center gap-2.5 transition-all text-left ${
                  alertType === 'EXIT'
                    ? 'bg-amber-500/10 border-amber-500 text-white shadow-sm'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                    alertType === 'EXIT' ? 'bg-amber-500 text-slate-950 font-bold' : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  <ArrowUpRight className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-bold block text-white">Target Exit (Jual)</span>
                  <span className="text-[10px] text-slate-400">Take Profit atau Stop Loss</span>
                </div>
              </button>
            </div>
          </div>

          {/* Current Market Price Reference */}
          <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between text-xs">
            <div>
              <span className="text-slate-400 text-[11px]">Harga Pasar Terkini:</span>
              <p className="font-bold text-white font-mono text-sm mt-0.5">
                {currentAsset.currency === 'USD' ? '$' : 'Rp '}
                {currentAsset.price.toLocaleString('id-ID', {
                  maximumFractionDigits:
                    currentAsset.currency === 'USD' ? (currentAsset.price < 1 ? 4 : 2) : 0,
                })}
              </p>
            </div>
            <div className="text-right">
              <span className="text-slate-400 text-[11px]">Kondisi Pemicu:</span>
              <p className="font-bold text-emerald-400 mt-0.5">
                {alertType === 'ENTRY' ? 'Harga ≤ Target' : 'Harga ≥ Target'}
              </p>
            </div>
          </div>

          {/* Target Price Input */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Nominal Harga Sasaran ({currentAsset.currency})
            </label>
            <div className="relative">
              <input
                type="text"
                inputMode="decimal"
                value={targetPrice}
                onChange={(e) => setTargetPrice(e.target.value)}
                className="w-full pl-4 pr-20 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono text-base font-bold focus:outline-none focus:border-emerald-500"
                placeholder={currentAsset.currency === 'IDR' ? 'Contoh: 5250' : 'Contoh: 150,00'}
              />
              <span
                className={`absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono font-bold ${
                  diffPct >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {diffPct >= 0 ? '+' : ''}
                {diffPct.toFixed(1)}%
              </span>
            </div>
          </div>

          {/* Quick Percentage Shortcuts */}
          <div>
            <span className="block text-[11px] text-slate-400 mb-1.5">
              Pintas Cepat Target Persentase:
            </span>
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {alertType === 'ENTRY' ? (
                <>
                  <button
                    type="button"
                    onClick={() => handleApplyPresetPct(-3)}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-mono text-slate-200"
                  >
                    -3% Dip
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyPresetPct(-5)}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-mono text-slate-200"
                  >
                    -5% Dip
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyPresetPct(-10)}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-mono text-slate-200"
                  >
                    -10% Koreksi
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyPresetPct(-15)}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-mono text-slate-200"
                  >
                    -15% Diskon Besar
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => handleApplyPresetPct(5)}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-mono text-slate-200"
                  >
                    +5% TP 1
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyPresetPct(10)}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-mono text-slate-200"
                  >
                    +10% TP 2
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyPresetPct(20)}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-mono text-slate-200"
                  >
                    +20% Rally
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyPresetPct(35)}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-mono text-slate-200"
                  >
                    +35% Bull
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Memo Note */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Catatan Rencana Transaksi (Opsional)
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-emerald-500"
              placeholder="Contoh: Amankan cuan 25% untuk modal rebalance ke VOO"
            />
          </div>

          {targetNum <= 0 && (
            <p className="text-[11px] text-rose-400 font-medium">
              Nominal harga target harus lebih dari 0.
            </p>
          )}

          {/* Action Buttons */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 transition-colors"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={targetNum <= 0}
              className={`flex-1 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-colors ${
                targetNum > 0
                  ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-500/20'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
              }`}
            >
              <Bell className={`w-4 h-4 ${targetNum > 0 ? 'fill-slate-950' : ''}`} />
              <span>Aktifkan Notifikasi</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

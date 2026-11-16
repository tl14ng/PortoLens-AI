import React, { useState, useMemo, useEffect } from 'react';
import {
  Search,
  Sparkles,
  Loader2,
  PlusCircle,
  AlertCircle,
  ChevronRight,
  X,
  TrendingUp,
  Layers,
} from 'lucide-react';
import {
  getAllAssets,
  getAssetByTicker,
  getCatalogCategoryCounts,
  searchCatalogAssets,
  Asset,
  registerCustomAsset,
} from '../data/marketData';
import { fetchJsonSafe } from '../utils/safeFetch';

interface SearchTickerTabProps {
  existingTickers: string[];
  liveQuotes: Record<string, { price: number; change?: number; changePercent?: number; isLiveFound?: boolean }>;
  onSelectAssetToView: (asset: Asset) => void;
}

type AssetClassification = 'IDX_STOCK' | 'US_STOCK' | 'ETF';

const QUICK_POPULAR_TICKERS = [
  'BBCA',
  'BBRI',
  'BREN',
  'BYAN',
  'NVDA',
  'AAPL',
  'TSLA',
  'VOO',
  'QQQ',
  'SCHD',
  'QQQI',
];

export const SearchTickerTab: React.FC<SearchTickerTabProps> = ({
  existingTickers,
  liveQuotes,
  onSelectAssetToView,
}) => {
  const [catalogVersion, setCatalogVersion] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'IDX_STOCK' | 'US_STOCK' | 'ETF'>('ALL');
  const [displayLimit, setDisplayLimit] = useState(50);

  const [isDetecting, setIsDetecting] = useState(false);
  const [detectionResult, setDetectionResult] = useState<{
    ticker: string;
    found: boolean;
    detectedType: AssetClassification | null;
    classificationLabel: string | null;
    name: string | null;
    price: number | null;
    changePercent: number;
    currency: 'USD' | 'IDR' | null;
    exchangeName: string | null;
    candidates: Array<{
      type: AssetClassification;
      label: string;
      name: string;
      price: number;
      changePercent: number;
      currency: 'IDR' | 'USD';
      exchangeName: string;
    }>;
  } | null>(null);
  const [selectedCandidateIdx, setSelectedCandidateIdx] = useState<number>(0);

  const catalogAssets = getAllAssets();

  useEffect(() => {
    setDisplayLimit(50);
  }, [searchQuery, filterType]);

  const existingSet = useMemo(
    () => new Set(existingTickers.map((t) => t.toUpperCase())),
    [existingTickers]
  );

  const normalizedSearchTicker = useMemo(() => {
    return searchQuery
      .toUpperCase()
      .trim()
      .replace(/\.JK$/i, '')
      .replace(/[^A-Z0-9.-]/g, '');
  }, [searchQuery]);

  const isExactInCatalog = useMemo(() => {
    if (!normalizedSearchTicker) return false;
    return Boolean(getAssetByTicker(normalizedSearchTicker));
  }, [catalogAssets, normalizedSearchTicker, catalogVersion]);

  const categoryCounts = useMemo(() => getCatalogCategoryCounts(), [catalogAssets, catalogVersion]);

  const filteredAssets = useMemo(() => {
    return searchCatalogAssets(searchQuery, filterType, { prioritizeTickerMatch: true });
  }, [catalogAssets, searchQuery, filterType, catalogVersion]);

  const visibleAssets = useMemo(() => {
    return filteredAssets.slice(0, displayLimit).map((asset) => {
      const upper = asset.ticker.toUpperCase();
      const live =
        liveQuotes?.[asset.ticker] ||
        liveQuotes?.[upper] ||
        (asset.type === 'IDX_STOCK' ? liveQuotes?.[`${upper}.JK`] : undefined);
      const hasValidLive =
        typeof live?.price === 'number' &&
        Number.isFinite(live.price) &&
        live.price > 0 &&
        live.isLiveFound !== false;
      return hasValidLive
        ? {
            ...asset,
            price: live.price,
            change1D:
              typeof live.changePercent === 'number' && Number.isFinite(live.changePercent)
                ? live.changePercent
                : asset.change1D,
          }
        : asset;
    });
  }, [filteredAssets, displayLimit, liveQuotes]);

  const quickPickAssets = useMemo(() => {
    return QUICK_POPULAR_TICKERS.map((t) => getAssetByTicker(t)).filter(Boolean) as Asset[];
  }, [catalogAssets, catalogVersion]);

  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!normalizedSearchTicker) return;

    if (isExactInCatalog) {
      setDetectionResult(null);
      setFilterType('ALL');
      const exactAsset = getAssetByTicker(normalizedSearchTicker);
      if (exactAsset) {
        onSelectAssetToView(exactAsset);
      }
      return;
    }

    setIsDetecting(true);
    setDetectionResult(null);
    setSelectedCandidateIdx(0);
    try {
      const result = await fetchJsonSafe<any>(
        `/api/detect-ticker?ticker=${encodeURIComponent(searchQuery.trim() || normalizedSearchTicker)}`
      );
      if (result.ok && result.data) {
        setDetectionResult(result.data);
      } else {
        setDetectionResult({
          ticker: normalizedSearchTicker,
          found: false,
          detectedType: null,
          classificationLabel: null,
          name: null,
          price: null,
          changePercent: 0,
          currency: null,
          exchangeName: null,
          candidates: [],
        });
      }
    } catch {
      setDetectionResult({
        ticker: normalizedSearchTicker,
        found: false,
        detectedType: null,
        classificationLabel: null,
        name: null,
        price: null,
        changePercent: 0,
        currency: null,
        exchangeName: null,
        candidates: [],
      });
    } finally {
      setIsDetecting(false);
    }
  };

  const handleRegisterAndInspect = () => {
    if (!detectionResult || !detectionResult.found) return;
    const candidate =
      detectionResult.candidates[selectedCandidateIdx] ||
      detectionResult.candidates[0] ||
      (detectionResult.detectedType
        ? {
            type: detectionResult.detectedType,
            label: detectionResult.classificationLabel || 'ETF Global',
            name: detectionResult.name || detectionResult.ticker,
            price: detectionResult.price || 100,
            changePercent: detectionResult.changePercent || 0,
            currency: detectionResult.currency || 'USD',
            exchangeName: detectionResult.exchangeName || 'Global',
          }
        : null);

    if (!candidate) return;

    const regType = candidate.type;
    const defaultSector =
      regType === 'IDX_STOCK'
        ? 'Bursa Efek Indonesia'
        : regType === 'US_STOCK'
        ? 'Wall Street Global'
        : 'ETF Indeks & Sektoral';

    const newAsset: Asset = {
      ticker: detectionResult.ticker,
      name: candidate.name,
      type: regType,
      sector: defaultSector,
      currency: candidate.currency,
      price: candidate.price,
      change1D: candidate.changePercent || 0,
      return1Y: 10.0,
      return3Y: 12.0,
      beta: regType === 'ETF' ? 0.95 : 1.1,
      dividendYield: regType === 'ETF' ? 2.0 : 1.0,
      peRatio: regType !== 'ETF' ? 18.0 : undefined,
      expenseRatio: regType === 'ETF' ? 0.15 : undefined,
      marketCap:
        regType === 'IDX_STOCK'
          ? 'Emiten IDX'
          : regType === 'ETF'
          ? 'ETF Global'
          : 'Emiten AS',
      riskRating: 'Moderat',
      history12M: [90, 92, 94, 95, 97, 99, 98, 100, 101, 102, 103, 105],
      description: `Instrumen ${candidate.label} (${candidate.exchangeName || 'Global'}) yang didaftarkan otomatis ke katalog PortoLens AI.`,
    };

    registerCustomAsset(newAsset);
    setCatalogVersion((v) => v + 1);
    setDetectionResult(null);
    onSelectAssetToView(newAsset);
  };

  return (
    <div className="pb-24 pt-2 px-4 space-y-3.5 max-w-lg mx-auto">
      {/* Header Search Card */}
      <div className="p-4 rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border border-slate-800 shadow-xl space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-1.5">
              <Search className="w-4 h-4 text-emerald-400" />
              <span>Cari Emiten & Analisa AI</span>
            </h2>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Jelajahi {categoryCounts.all.toLocaleString('id-ID')} ticker Saham IHSG, Wall Street & ETF
            </p>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            5.000+ Aset
          </span>
        </div>

        {/* Search Form */}
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                const val = e.target.value;
                setSearchQuery(val);
                const nextNorm = val
                  .toUpperCase()
                  .trim()
                  .replace(/\.JK$/i, '')
                  .replace(/[^A-Z0-9.-]/g, '');
                if (detectionResult && nextNorm !== detectionResult.ticker) {
                  setDetectionResult(null);
                }
              }}
              placeholder="Ketik ticker / nama emiten (mis: BBCA, NVDA, VOO)..."
              className="w-full pl-10 pr-8 py-2.5 rounded-xl bg-slate-950/90 border border-slate-800 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setDetectionResult(null);
                }}
                aria-label="Hapus pencarian"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-200 p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <button
            type="submit"
            disabled={!normalizedSearchTicker || isDetecting}
            className={`px-3.5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 shrink-0 transition-all ${
              normalizedSearchTicker && !isDetecting
                ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-md shadow-emerald-500/20 active:scale-[0.98]'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed'
            }`}
          >
            {isDetecting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Search className="w-3.5 h-3.5" />
            )}
            <span>{isExactInCatalog ? 'Analisa' : 'Cari'}</span>
          </button>
        </form>

        {/* Popular Quick-Pick Chips when search is empty */}
        {!searchQuery && (
          <div className="space-y-1.5 pt-0.5">
            <span className="text-[10px] font-semibold text-slate-400 flex items-center gap-1">
              <TrendingUp className="w-3 h-3 text-cyan-400" />
              <span>Akses Cepat Populer:</span>
            </span>
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
              {quickPickAssets.map((asset) => (
                <button
                  key={asset.ticker}
                  type="button"
                  onClick={() => onSelectAssetToView(asset)}
                  className="px-2.5 py-1 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-emerald-500/50 text-[11px] font-mono font-bold text-slate-200 shrink-0 transition-colors"
                >
                  {asset.ticker}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Auto-detect card when ticker is not in catalog */}
      {isDetecting && (
        <div className="p-3.5 rounded-2xl bg-slate-900 border border-indigo-700/50 text-xs text-slate-200 flex items-center gap-2.5">
          <Loader2 className="w-4 h-4 animate-spin text-indigo-400 shrink-0" />
          <div>
            <span className="font-bold block">Mencari "{normalizedSearchTicker}" di bursa global...</span>
            <span className="text-[11px] text-slate-400">
              Mendeteksi kategori otomatis (Saham IHSG, Wall Street AS, atau ETF Global).
            </span>
          </div>
        </div>
      )}

      {!isDetecting && normalizedSearchTicker && !isExactInCatalog && (
        <>
          {detectionResult && detectionResult.ticker === normalizedSearchTicker ? (
            detectionResult.found ? (() => {
              const activeCandidate =
                detectionResult.candidates[selectedCandidateIdx] ||
                detectionResult.candidates[0] || {
                  type: detectionResult.detectedType || 'ETF',
                  label: detectionResult.classificationLabel || 'ETF Global',
                  name: detectionResult.name || detectionResult.ticker,
                  price: detectionResult.price || 100,
                  changePercent: detectionResult.changePercent || 0,
                  currency: detectionResult.currency || 'USD',
                  exchangeName: detectionResult.exchangeName || 'Global',
                };
              return (
              <div className="p-3.5 rounded-2xl bg-indigo-950/40 border border-indigo-600/60 space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-bold text-white">{detectionResult.ticker}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                        {activeCandidate.label}
                      </span>
                    </div>
                    <p className="text-xs text-slate-200 font-medium mt-1">{activeCandidate.name}</p>
                    <p className="text-[10px] text-slate-400">
                      Bursa: {activeCandidate.exchangeName}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-xs font-bold text-white font-mono">
                      {activeCandidate.currency === 'USD' ? '$' : 'Rp '}
                      {(activeCandidate.price || 0).toLocaleString('id-ID', {
                        maximumFractionDigits:
                          activeCandidate.currency === 'USD'
                            ? (activeCandidate.price || 0) < 1
                              ? 4
                              : 2
                            : 0,
                      })}
                    </span>
                    <span
                      className={`block text-[10px] font-mono ${
                        (Number.isFinite(activeCandidate.changePercent) ? activeCandidate.changePercent : 0) >= 0
                          ? 'text-emerald-400'
                          : 'text-rose-400'
                      }`}
                    >
                      {(Number.isFinite(activeCandidate.changePercent) ? activeCandidate.changePercent : 0) >= 0 ? '+' : ''}
                      {(Number.isFinite(activeCandidate.changePercent) ? activeCandidate.changePercent : 0).toFixed(2)}%
                    </span>
                  </div>
                </div>

                {detectionResult.candidates.length > 1 && (
                  <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                    <span className="text-[10px] text-slate-400">Pilih bursa cocok:</span>
                    {detectionResult.candidates.map((cand, idx) => (
                      <button
                        key={`${cand.type}-${idx}`}
                        type="button"
                        onClick={() => setSelectedCandidateIdx(idx)}
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold border transition-colors ${
                          selectedCandidateIdx === idx
                            ? 'bg-indigo-500 text-white border-indigo-400'
                            : 'bg-slate-900 text-slate-300 border-slate-700 hover:border-slate-600'
                        }`}
                      >
                        {cand.label} ({cand.currency})
                      </button>
                    ))}
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleRegisterAndInspect}
                  className="w-full py-2 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>Daftarkan ke Katalog & Lihat Analisa</span>
                </button>
              </div>
              );
            })() : (
              <div className="p-3 rounded-2xl bg-amber-950/30 border border-amber-700/60 flex items-center gap-2 text-xs text-amber-200">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>
                  Ticker <b>{normalizedSearchTicker}</b> tidak ditemukan di bursa global maupun daftar di bawah.
                </span>
              </div>
            )
          ) : (
            <div className="p-3 rounded-2xl bg-indigo-950/35 border border-indigo-700/50 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-bold text-indigo-300">
                  Ticker "{normalizedSearchTicker}" belum tercatat exact
                </p>
                <p className="text-[11px] text-slate-400">
                  Tekan <b>Cari</b> untuk deteksi langsung dari bursa.
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleSearchSubmit({ preventDefault: () => {} } as React.FormEvent)}
                className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shrink-0 flex items-center gap-1"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Deteksi</span>
              </button>
            </div>
          )}
        </>
      )}

      {/* Category Filter Pills */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-0.5">
          <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-cyan-400" />
            <span>Hasil Katalog ({filteredAssets.length.toLocaleString('id-ID')})</span>
          </span>
          <span className="text-[10px] text-slate-500">Ketuk emiten untuk buka analisa</span>
        </div>

        <div className="flex items-center gap-1.5 p-1 bg-slate-950/80 rounded-xl border border-slate-800/80 overflow-x-auto no-scrollbar">
          {(['ALL', 'IDX_STOCK', 'US_STOCK', 'ETF'] as const).map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setFilterType(cat)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-colors ${
                filterType === cat
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {cat === 'ALL'
                ? `Semua (${categoryCounts.all.toLocaleString('id-ID')})`
                : cat === 'IDX_STOCK'
                ? `Saham IHSG (${categoryCounts.idx.toLocaleString('id-ID')})`
                : cat === 'US_STOCK'
                ? `Saham AS (${categoryCounts.us.toLocaleString('id-ID')})`
                : `ETF Global (${categoryCounts.etf.toLocaleString('id-ID')})`}
            </button>
          ))}
        </div>
      </div>

      {/* Results List */}
      <div className="space-y-2">
        {visibleAssets.map((asset) => {
          const isHeld = existingSet.has(asset.ticker.toUpperCase());
          return (
            <button
              key={asset.ticker}
              type="button"
              onClick={() => onSelectAssetToView(asset)}
              className="w-full p-3 rounded-2xl bg-slate-900 border border-slate-800/90 hover:border-emerald-500/40 flex items-center justify-between text-left transition-colors"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-11 h-10 rounded-xl bg-slate-950 text-white font-bold text-xs flex items-center justify-center border border-slate-800 shrink-0">
                  {asset.ticker}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-xs text-slate-100 truncate">
                      {asset.name}
                    </span>
                    {isHeld && (
                      <span className="text-[9px] font-bold text-emerald-400 bg-emerald-950/60 px-1.5 py-0.2 rounded border border-emerald-800/50 shrink-0">
                        Dimiliki
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-400 truncate mt-0.5">
                    {asset.type === 'IDX_STOCK'
                      ? 'Saham IHSG'
                      : asset.type === 'US_STOCK'
                      ? 'Saham AS'
                      : 'ETF Global'}{' '}
                    · {asset.sector}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 pl-2">
                <div className="text-right">
                  <p className="text-xs font-semibold text-slate-200 font-mono">
                    {asset.currency === 'USD' ? '$' : 'Rp '}
                    {asset.price.toLocaleString('id-ID', {
                      maximumFractionDigits: asset.currency === 'USD' ? (asset.price < 1 ? 4 : 2) : 0,
                    })}
                  </p>
                  {(() => {
                    const chg = typeof asset.change1D === 'number' && Number.isFinite(asset.change1D) ? asset.change1D : 0;
                    return (
                      <p
                        className={`text-[11px] font-semibold font-mono ${
                          chg >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {chg >= 0 ? '+' : ''}
                        {chg.toFixed(2)}%
                      </p>
                    );
                  })()}
                </div>
                <ChevronRight className="w-4 h-4 text-slate-600" />
              </div>
            </button>
          );
        })}

        {visibleAssets.length < filteredAssets.length && (
          <button
            type="button"
            onClick={() => setDisplayLimit((prev) => prev + 50)}
            className="w-full py-2.5 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-semibold text-slate-200 transition-colors"
          >
            Muat Lebih Banyak ({visibleAssets.length.toLocaleString('id-ID')} dari{' '}
            {filteredAssets.length.toLocaleString('id-ID')})
          </button>
        )}

        {filteredAssets.length === 0 && (
          <div className="text-center py-8 text-slate-400 text-xs">
            Tidak ada ticker yang cocok dengan filter saat ini.
          </div>
        )}
      </div>
    </div>
  );
};

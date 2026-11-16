import React, { useState, useEffect, useMemo, useDeferredValue } from 'react';
import { D3BenchmarkComparisonChart } from './D3BenchmarkComparisonChart';
import { Globe, BarChart3, Layers, Search } from 'lucide-react';
import {
  getCatalogCategoryCounts,
  searchCatalogAssets,
  Asset,
} from '../data/marketData';
import { fetchJsonSafe } from '../utils/safeFetch';
import { AppLanguage, useLanguage } from '../i18n/LanguageContext';

interface MarketTrendsTabProps {
  metrics: any;
  currency: 'IDR' | 'USD';
  liveQuotes?: Record<string, { price: number; changePercent?: number; isLiveFound?: boolean }>;
  usdIdrRate?: number;
  onSelectAssetToView: (asset: Asset) => void;
}

const MARKET_TRENDS_CLIENT_TTL_MS = 5 * 60 * 1000;
const cachedMarketTrendsByLang = new Map<AppLanguage, { data: any; fetchedAt: number }>();
const marketTrendsInFlightByLang = new Map<AppLanguage, Promise<any>>();

function getFreshMarketTrends(lang: AppLanguage): any | null {
  const entry = cachedMarketTrendsByLang.get(lang);
  if (!entry) return null;
  if (Date.now() - entry.fetchedAt > MARKET_TRENDS_CLIENT_TTL_MS) return null;
  return entry.data;
}

function loadMarketTrends(lang: AppLanguage): Promise<any> {
  const cached = getFreshMarketTrends(lang);
  if (cached) return Promise.resolve(cached);
  const existing = marketTrendsInFlightByLang.get(lang);
  if (existing) return existing;

  const task = fetchJsonSafe<any>(`/api/market-trends?lang=${lang}`)
    .then((result) => {
      if (!result.ok || !result.data) {
        throw new Error(result.errorMessage || `HTTP ${result.status}`);
      }
      cachedMarketTrendsByLang.set(lang, { data: result.data, fetchedAt: Date.now() });
      return result.data;
    })
    .finally(() => {
      marketTrendsInFlightByLang.delete(lang);
    });

  marketTrendsInFlightByLang.set(lang, task);
  return task;
}

export const MarketTrendsTab: React.FC<MarketTrendsTabProps> = ({
  metrics,
  liveQuotes,
  usdIdrRate,
  onSelectAssetToView,
}) => {
  const { language, locale, t } = useLanguage();
  const [marketTrends, setMarketTrends] = useState<any>(() => getFreshMarketTrends(language));
  const [selectedCategory, setSelectedCategory] = useState<'ALL' | 'US_STOCK' | 'IDX_STOCK' | 'ETF'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [displayLimit, setDisplayLimit] = useState(50);

  useEffect(() => {
    const cached = getFreshMarketTrends(language);
    if (cached) {
      setMarketTrends(cached);
      return;
    }
    let cancelled = false;
    loadMarketTrends(language)
      .then((data) => {
        if (!cancelled) setMarketTrends(data);
      })
      .catch((err) => {
        if (!cancelled) console.error('Error fetching market trends:', err);
      });
    return () => {
      cancelled = true;
    };
  }, [language]);

  useEffect(() => {
    setDisplayLimit(50);
  }, [selectedCategory, deferredSearchQuery]);

  const categoryCounts = useMemo(() => getCatalogCategoryCounts(), []);

  const filteredAssets = useMemo(() => {
    return searchCatalogAssets(deferredSearchQuery, selectedCategory);
  }, [selectedCategory, deferredSearchQuery]);

  const visibleAssets = useMemo(
    () =>
      filteredAssets.slice(0, displayLimit).map((asset) => {
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
      }),
    [filteredAssets, displayLimit, liveQuotes]
  );

  return (
    <div className="pb-24 pt-2 px-4 space-y-4 max-w-lg mx-auto">
      {/* Interactive D3 Portfolio vs Market Indices Comparison Chart */}
      <D3BenchmarkComparisonChart
        holdings={metrics?.holdings || []}
        portfolioName={t('Portofolio Anda', 'Your Portfolio')}
      />

      {/* Real-Time Macro Indicators */}
      <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
            <Globe className="w-4 h-4 text-cyan-400" />
            {t('Indikator Makro & Suku Bunga Terkini', 'Macro & Interest Rate Indicators')}
          </h3>
          <span className="text-[10px] text-slate-500">Live Updates</span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800/80">
            <span className="text-[10px] text-slate-400 block">US Fed Funds Rate</span>
            <span className="text-sm font-bold text-white font-mono mt-0.5 block">
              {marketTrends?.macroIndicators?.[0]?.value || '4.50% - 4.75%'}
            </span>
            <span className="text-[10px] text-emerald-400 mt-1 block">
              {t('Siklus transisi moneter The Fed', 'Fed monetary transition cycle')}
            </span>
          </div>

          <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800/80">
            <span className="text-[10px] text-slate-400 block">
              {t('Valuasi S&P 500 Fwd P/E', 'S&P 500 Forward P/E')}
            </span>
            <span className="text-sm font-bold text-amber-400 font-mono mt-0.5 block">
              {marketTrends?.macroIndicators?.[1]?.value || '21.4x'}
            </span>
            <span className="text-[10px] text-slate-400 mt-1 block">
              {t('Di atas rata-rata 10-thn (18.2x)', 'Above 10-yr average (18.2x)')}
            </span>
          </div>

          <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800/80">
            <span className="text-[10px] text-slate-400 block">BI 7-Day Reverse Repo</span>
            <span className="text-sm font-bold text-white font-mono mt-0.5 block">
              {marketTrends?.macroIndicators?.[2]?.value || '6.00%'}
            </span>
            <span className="text-[10px] text-cyan-400 mt-1 block">
              {t('Stabil mendukung margin bank', 'Supports Indonesian bank margins')}
            </span>
          </div>

          <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800/80">
            <span className="text-[10px] text-slate-400 block">
              {t('Kurs USD / IDR', 'USD / IDR Rate')}
            </span>
            <span className="text-sm font-bold text-white font-mono mt-0.5 block">
              {usdIdrRate
                ? `Rp ${Math.round(usdIdrRate).toLocaleString(locale)}`
                : marketTrends?.macroIndicators?.[3]?.value || (language === 'en' ? 'Rp 15,840' : 'Rp 15.840')}
            </span>
            <span className="text-[10px] text-slate-400 mt-1 block">
              {t('Hedge valuta asing menguntungkan', 'Favorable USD currency hedge')}
            </span>
          </div>
        </div>
      </div>

      {/* Sector Trends Analysis */}
      <div>
        <h3 className="text-xs font-bold text-slate-300 mb-2 flex items-center gap-1.5">
          <BarChart3 className="w-3.5 h-3.5 text-emerald-400" />
          {t('Analisis Tren Sektoral & Peluang Pasar', 'Sector Trends & Market Opportunities')}
        </h3>

        <div className="space-y-2.5">
          {marketTrends?.sectorTrends?.map((sec: any, idx: number) => (
            <div
              key={idx}
              className="p-4 rounded-2xl bg-slate-900 border border-slate-800/90 space-y-2 text-xs"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-white text-sm">{sec.sector}</span>
                <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-800/50 shrink-0">
                  {sec.sentiment}
                </span>
              </div>

              <p className="text-slate-300 text-[11px] leading-relaxed">{sec.rationale}</p>

              <div className="flex items-center gap-1.5 pt-1 text-[11px] text-slate-400 flex-wrap">
                <span>{t('Pilihan Utama (Top Picks):', 'Top Picks:')} </span>
                {sec.topPicks?.map((tick: string) => (
                  <span
                    key={tick}
                    className="font-mono font-bold text-slate-200 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800"
                  >
                    {tick}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Market Asset Screener / Explorer */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-cyan-400" />
            {t('Katalog Saham AS, IDX, & ETF', 'US, IDX & ETF Catalog')} (
            {filteredAssets.length.toLocaleString(locale)})
          </h3>
          <span className="text-[11px] text-slate-500">
            {t('Sentuh untuk analisa', 'Tap to analyze')}
          </span>
        </div>

        {/* Search input */}
        <div className="relative mb-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t(
              'Cari ticker / nama emiten / sektor (5.000 aset)...',
              'Search ticker / company / sector (5,000+ assets)...'
            )}
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
        </div>

        {/* Filter chips */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-950/60 rounded-xl border border-slate-800/80 mb-2 overflow-x-auto">
          {(['ALL', 'US_STOCK', 'IDX_STOCK', 'ETF'] as const).map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1 text-xs font-medium rounded-lg whitespace-nowrap transition-colors ${
                selectedCategory === cat
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {cat === 'ALL'
                ? `${t('Semua', 'All')} (${categoryCounts.all.toLocaleString(locale)})`
                : cat === 'US_STOCK'
                ? `${t('Saham AS', 'US Stocks')} (${categoryCounts.us.toLocaleString(locale)})`
                : cat === 'IDX_STOCK'
                ? `${t('Saham IDX', 'IDX Stocks')} (${categoryCounts.idx.toLocaleString(locale)})`
                : `${t('ETF Global', 'Global ETFs')} (${categoryCounts.etf.toLocaleString(locale)})`}
            </button>
          ))}
        </div>

        {/* Asset Cards */}
        <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1">
          {visibleAssets.map((asset) => (
            <button
              key={asset.ticker}
              onClick={() => onSelectAssetToView(asset)}
              className="w-full p-3 rounded-2xl bg-slate-900 border border-slate-800/80 hover:border-slate-700 flex items-center justify-between text-left transition-colors"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-10 h-9 rounded-xl bg-slate-950 text-white font-bold text-xs flex items-center justify-center border border-slate-800 shrink-0">
                  {asset.ticker}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-xs text-slate-100 truncate">{asset.name}</span>
                  </div>
                  <p className="text-[10px] text-slate-400 truncate">{asset.sector}</p>
                </div>
              </div>

              <div className="text-right shrink-0 pl-2">
                <p className="text-xs font-semibold text-slate-200 font-mono">
                  {asset.currency === 'USD' ? '$' : 'Rp '}
                  {asset.price.toLocaleString(locale, {
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
            </button>
          ))}

          {filteredAssets.length === 0 && (
            <div className="text-center py-8 text-slate-400 text-xs">
              {t('Tidak ada ticker yang cocok dengan filter saat ini.', 'No tickers match the current filter.')}
            </div>
          )}

          {visibleAssets.length < filteredAssets.length && (
            <button
              type="button"
              onClick={() => setDisplayLimit((prev) => prev + 50)}
              className="w-full py-2.5 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-semibold text-slate-200 transition-colors"
            >
              {t('Tampilkan Lebih Banyak', 'Load More')} ({visibleAssets.length.toLocaleString(locale)}{' '}
              {t('dari', 'of')} {filteredAssets.length.toLocaleString(locale)})
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

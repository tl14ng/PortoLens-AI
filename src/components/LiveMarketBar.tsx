import React from 'react';
import { RefreshCw, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';

interface LiveMarketBarProps {
  lastUpdated: string;
  isFetching: boolean;
  onRefresh: () => void;
  liveQuotes: Record<string, { price: number; change?: number; changePercent?: number; currency: string }>;
  usdIdrRate: number;
  onSelectTicker: (ticker: string) => void;
}

const FEATURED_TICKERS = [
  'NVDA', 'BBCA', 'VOO', 'PLTR', 'BBNI', 'AAPL', 'BBRI', 'SCHD', 'ANTM', 'SPY', 'TSLA', 'QQQ', 'ASII', 'AMMN',
];

export const LiveMarketBar: React.FC<LiveMarketBarProps> = React.memo(({
  lastUpdated,
  isFetching,
  onRefresh,
  liveQuotes,
  usdIdrRate,
  onSelectTicker,
}) => {
  const { locale, t } = useLanguage();

  const parsedDate = lastUpdated ? new Date(lastUpdated) : null;
  const formattedTime =
    parsedDate && !isNaN(parsedDate.getTime())
      ? parsedDate.toLocaleTimeString(locale, {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      : 'Live';

  const safeFx =
    typeof usdIdrRate === 'number' && Number.isFinite(usdIdrRate) && usdIdrRate > 0
      ? usdIdrRate
      : 15840;

  return (
    <div className="w-full bg-slate-950/90 border-b border-slate-800/80 px-3 py-1.5 select-none overflow-hidden">
      <div className="flex items-center justify-between gap-2">
        {/* Live Status indicator */}
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-400 font-mono">
            LIVE
          </span>
          <span className="text-[10px] text-slate-500 font-mono hidden xs:inline">
            · {formattedTime}
          </span>
        </div>

        {/* Streaming Live Ticker Carousel */}
        <div className="flex items-center gap-3 overflow-x-auto no-scrollbar py-0.5 text-xs">
          {/* USD/IDR currency tick */}
          <div className="flex items-center gap-1 text-[11px] shrink-0 font-mono bg-slate-900/60 px-2 py-0.5 rounded-md border border-slate-800">
            <span className="text-slate-400">USD/IDR:</span>
            <span className="font-bold text-slate-200">
              Rp {Math.round(safeFx).toLocaleString(locale)}
            </span>
          </div>

          {/* Featured Stock & ETF Ticks */}
          {FEATURED_TICKERS.map((ticker) => {
            const quote = liveQuotes[ticker];
            if (!quote || typeof quote.price !== 'number' || !Number.isFinite(quote.price)) return null;
            const pct =
              typeof quote.changePercent === 'number' && Number.isFinite(quote.changePercent)
                ? quote.changePercent
                : 0;
            const isUp = pct >= 0;

            return (
              <button
                key={ticker}
                onClick={() => onSelectTicker(ticker)}
                className="flex items-center gap-1 text-[11px] shrink-0 font-mono bg-slate-900/80 hover:bg-slate-800 px-2 py-0.5 rounded-md border border-slate-800/80 transition-colors"
              >
                <span className="font-bold text-slate-300">{ticker}</span>
                <span className="text-slate-100 font-medium">
                  {quote.currency === 'USD' ? '$' : 'Rp '}
                  {quote.price.toLocaleString(locale, {
                    maximumFractionDigits: quote.currency === 'USD' ? (quote.price < 1 ? 4 : 2) : 0,
                  })}
                </span>
                <span
                  className={`flex items-center text-[10px] font-bold ${
                    isUp ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {isUp ? '+' : ''}
                  {pct.toFixed(1)}%
                  {isUp ? <ArrowUpRight className="w-2.5 h-2.5" /> : <ArrowDownRight className="w-2.5 h-2.5" />}
                </span>
              </button>
            );
          })}
        </div>

        {/* Manual Refresh Button */}
        <button
          onClick={onRefresh}
          disabled={isFetching}
          className="w-6 h-6 rounded-md bg-slate-900 hover:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-slate-200 border border-slate-800 shrink-0 transition-colors"
          title={t('Segarkan data pasar real-time sekarang', 'Refresh real-time market data now')}
        >
          <RefreshCw className={`w-3 h-3 ${isFetching ? 'animate-spin text-emerald-400' : ''}`} />
        </button>
      </div>
    </div>
  );
});

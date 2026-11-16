import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import {
  CalendarDays,
  ArrowLeft,
  TrendingUp,
  Clock,
  ChevronRight,
  Coins,
  Info,
  X,
} from 'lucide-react';
import {
  Asset,
  convertToCurrency,
  formatShareQuantity,
} from '../data/marketData';

interface LiveDividendEvent {
  date: string;
  timestamp: number;
  amount: number;
}

interface LiveDividendRecord {
  ticker: string;
  currency: 'IDR' | 'USD';
  cadence: 'MONTHLY' | 'QUARTERLY' | 'SEMI_ANNUAL' | 'ANNUAL' | 'NONE';
  events: LiveDividendEvent[];
  annualDividendPerShare: number;
  lastExDate: string | null;
  lastAmount: number;
  source: 'live' | 'fallback';
}

interface ProjectedDividendEvent {
  id: string;
  ticker: string;
  name: string;
  assetType: 'US_STOCK' | 'IDX_STOCK' | 'ETF';
  exDate: Date;
  exDateIso: string;
  payDate: Date;
  daysUntil: number;
  monthKey: string;
  monthShort: string;
  cadenceLabel: string;
  perShareAmount: number;
  nativeCurrency: 'IDR' | 'USD';
  shares: number;
  totalNative: number;
  totalInView: number;
  yieldPct: number;
  source: 'live' | 'estimated';
}

interface DividendCalendarTabProps {
  metrics: any;
  currency: 'IDR' | 'USD';
  usdIdrRate: number;
  onBack: () => void;
  onSelectAsset: (ticker: string) => void;
  onOpenAddModal: () => void;
}

const CADENCE_LABELS: Record<string, string> = {
  MONTHLY: 'Bulanan',
  QUARTERLY: 'Kuartalan',
  SEMI_ANNUAL: 'Semesteran',
  ANNUAL: 'Tahunan',
  NONE: 'Tanpa Dividen',
};

function formatCompactMoney(value: number, currency: 'IDR' | 'USD'): string {
  if (currency === 'USD') {
    if (Math.abs(value) >= 1000) return `$${(value / 1000).toFixed(1)}k`;
    return `$${value.toFixed(value < 10 ? 2 : 0)}`;
  }
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `Rp ${(value / 1_000_000_000).toFixed(1)}M`;
  if (abs >= 1_000_000) return `Rp ${(value / 1_000_000).toFixed(1)}jt`;
  if (abs >= 1_000) return `Rp ${Math.round(value / 1_000)}rb`;
  return `Rp ${Math.round(value)}`;
}

function formatFullMoney(value: number, currency: 'IDR' | 'USD'): string {
  if (currency === 'USD') {
    return `$${value.toLocaleString('id-ID', {
      minimumFractionDigits: value < 10 ? 2 : 2,
      maximumFractionDigits: 2,
    })}`;
  }
  return `Rp ${Math.round(value).toLocaleString('id-ID')}`;
}

const DIVIDEND_CLIENT_TTL_MS = 10 * 60 * 1000;
const dividendClientCache = new Map<
  string,
  { dividends: Record<string, LiveDividendRecord>; fetchedAt: number }
>();
const dividendInFlight = new Map<string, Promise<Record<string, LiveDividendRecord>>>();

function getCachedDividends(symbolsKey: string): Record<string, LiveDividendRecord> | null {
  const entry = dividendClientCache.get(symbolsKey);
  if (!entry) return null;
  if (Date.now() - entry.fetchedAt > DIVIDEND_CLIENT_TTL_MS) return null;
  return entry.dividends;
}

function loadDividendCalendar(symbols: string[], symbolsKey: string): Promise<Record<string, LiveDividendRecord>> {
  const cached = getCachedDividends(symbolsKey);
  if (cached) return Promise.resolve(cached);
  const existing = dividendInFlight.get(symbolsKey);
  if (existing) return existing;

  const promise = fetch(`/api/dividend-calendar?symbols=${encodeURIComponent(symbols.join(','))}`)
    .then((res) => (res.ok ? res.json() : null))
    .then((json) => {
      if (json?.dividends && typeof json.dividends === 'object') {
        const dividends = json.dividends as Record<string, LiveDividendRecord>;
        dividendClientCache.set(symbolsKey, { dividends, fetchedAt: Date.now() });
        return dividends;
      }
      return {};
    })
    .catch(() => ({}))
    .finally(() => {
      dividendInFlight.delete(symbolsKey);
    });

  dividendInFlight.set(symbolsKey, promise);
  return promise;
}

export const DividendCalendarTab: React.FC<DividendCalendarTabProps> = ({
  metrics,
  currency,
  usdIdrRate,
  onBack,
  onSelectAsset,
  onOpenAddModal,
}) => {
  const holdingsList: Array<{
    ticker: string;
    shares: number;
    weight: number;
    currentValInView: number;
    asset: Asset;
  }> = metrics?.holdings || [];

  const yahooSymbols = useMemo(
    () =>
      Array.from(
        new Set(holdingsList.map((h) => (h.asset.type === 'IDX_STOCK' ? `${h.ticker}.JK` : h.ticker)))
      ).sort(),
    [holdingsList]
  );
  const symbolsKey = yahooSymbols.join(',');
  const holdingsTickersKey = holdingsList.map((h) => h.ticker).join(',');

  const [liveDividends, setLiveDividends] = useState<Record<string, LiveDividendRecord>>(() =>
    symbolsKey ? getCachedDividends(symbolsKey) || {} : {}
  );
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [filterMode, setFilterMode] = useState<'ALL' | 'SOON_30' | 'IDX' | 'GLOBAL'>('ALL');
  const [selectedMonthKey, setSelectedMonthKey] = useState<string | null>(null);

  const chartContainerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [containerWidth, setContainerWidth] = useState<number>(360);

  // Measure responsive width for D3 monthly bar chart
  useEffect(() => {
    const el = chartContainerRef.current;
    if (!el) return;
    const update = () => {
      const next = Math.max(260, Math.floor(el.getBoundingClientRect().width));
      setContainerWidth((prev) => (prev === next ? prev : next));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Fetch real historical ex-dates & payouts for user holdings (with shared client cache)
  useEffect(() => {
    if (!symbolsKey) {
      setLiveDividends({});
      setIsLoading(false);
      return;
    }
    const cached = getCachedDividends(symbolsKey);
    if (cached) {
      setLiveDividends(cached);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    loadDividendCalendar(yahooSymbols, symbolsKey)
      .then((dividends) => {
        if (cancelled) return;
        if (Object.keys(dividends).length > 0) {
          setLiveDividends(dividends);
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [symbolsKey]);

  // Reset month filter when portfolio holdings set changes
  useEffect(() => {
    setSelectedMonthKey(null);
  }, [holdingsTickersKey]);

  const { projectedEvents, nonDividendHoldings, annualPassiveIncome, monthlyAverageIncome, monthlyBuckets } =
    useMemo(() => {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const horizonEnd = new Date(
        todayStart.getFullYear() + 1,
        todayStart.getMonth(),
        todayStart.getDate()
      );

      // Build 12 rolling monthly buckets keyed by YYYY-MM so every event in the next 12 months maps 1:1
      const buckets: Array<{
        monthKey: string;
        monthShort: string;
        monthFull: string;
        totalInView: number;
        eventCount: number;
      }> = [];
      for (let m = 0; m < 12; m++) {
        const d = new Date(todayStart.getFullYear(), todayStart.getMonth() + m, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        buckets.push({
          monthKey: key,
          monthShort: d.toLocaleDateString('id-ID', { month: 'short' }),
          monthFull: d.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }),
          totalInView: 0,
          eventCount: 0,
        });
      }
      const bucketMap = new Map(buckets.map((b) => [b.monthKey, b]));

      const events: ProjectedDividendEvent[] = [];
      const nonDiv: Array<{ ticker: string; name: string }> = [];

      for (const h of holdingsList) {
        const tickerUpper = h.ticker.toUpperCase();
        const liveRec = liveDividends[tickerUpper];
        const hasLiveEvents = liveRec && liveRec.events && liveRec.events.length > 0;

        if (hasLiveEvents) {
          // Use trailing ~12-month cycle (360 days) of actual ex-dates shifted into upcoming 12 months, deduplicated by YYYY-MM
          const latestTs = liveRec.events[liveRec.events.length - 1].timestamp;
          const cycleStart = latestTs - 360 * 86400000;
          const templateEvents = liveRec.events
            .filter((e) => e.timestamp >= cycleStart)
            .sort((a, b) => b.timestamp - a.timestamp);
          const seedEvents = templateEvents.length > 0 ? templateEvents : liveRec.events.slice(-1);

          const cadenceLabel = CADENCE_LABELS[liveRec.cadence] || 'Berkala';
          const nativeCurr = liveRec.currency || h.asset.currency;
          const annualPerShare =
            liveRec.annualDividendPerShare > 0
              ? liveRec.annualDividendPerShare
              : seedEvents.reduce((s, e) => s + e.amount, 0);
          const yieldPct =
            h.asset.price > 0
              ? Number(((annualPerShare / h.asset.price) * 100).toFixed(2))
              : h.asset.dividendYield;

          const seenEventKeys = new Set<string>();
          seedEvents.forEach((ev, idx) => {
            const [yr, mo, dy] = ev.date.split('-').map(Number);
            const projected =
              yr && mo && dy ? new Date(yr, mo - 1, dy) : new Date(ev.timestamp);
            let safety = 0;
            while (projected < todayStart && safety < 5) {
              projected.setFullYear(projected.getFullYear() + 1);
              safety++;
            }
            if (projected >= horizonEnd) return;
            const mm = String(projected.getMonth() + 1).padStart(2, '0');
            const rawMonthKey = `${projected.getFullYear()}-${mm}`;
            const bucketKey = bucketMap.has(rawMonthKey) ? rawMonthKey : buckets[0].monthKey;
            const iso = `${rawMonthKey}-${String(projected.getDate()).padStart(2, '0')}`;
            const evDedupKey = `${iso}-${Math.round(ev.amount * 10000)}`;
            if (seenEventKeys.has(evDedupKey)) return;
            seenEventKeys.add(evDedupKey);
            const payDate = new Date(projected.getFullYear(), projected.getMonth(), projected.getDate() + 18);
            const daysUntil = Math.max(
              0,
              Math.round((projected.getTime() - todayStart.getTime()) / 86400000)
            );
            const totalNative = ev.amount * h.shares;
            const totalInView = convertToCurrency(totalNative, nativeCurr, currency, usdIdrRate);

            events.push({
              id: `${tickerUpper}-live-${iso}-${idx}`,
              ticker: h.ticker,
              name: h.asset.name,
              assetType: h.asset.type,
              exDate: projected,
              exDateIso: iso,
              payDate,
              daysUntil,
              monthKey: bucketKey,
              monthShort: projected.toLocaleDateString('id-ID', { month: 'short' }),
              cadenceLabel,
              perShareAmount: ev.amount,
              nativeCurrency: nativeCurr,
              shares: h.shares,
              totalNative,
              totalInView,
              yieldPct,
              source: 'live',
            });

            const b = bucketMap.get(bucketKey);
            if (b) {
              b.totalInView += totalInView;
              b.eventCount += 1;
            }
          });
        } else if (h.asset.dividendYield > 0) {
          // Estimate cadence & payouts from asset's catalog dividendYield
          const annualPerShare = h.asset.price * (h.asset.dividendYield / 100);
          const schedule: Array<{ month: number; day: number; shareWeight: number }> =
            h.asset.type === 'IDX_STOCK'
              ? [
                  { month: 3, day: 18, shareWeight: 0.75 }, // April Final Dividend
                  { month: 11, day: 12, shareWeight: 0.25 }, // December Interim Dividend
                ]
              : [
                  { month: 2, day: 20, shareWeight: 0.25 }, // March
                  { month: 5, day: 20, shareWeight: 0.25 }, // June
                  { month: 8, day: 20, shareWeight: 0.25 }, // September
                  { month: 11, day: 20, shareWeight: 0.25 }, // December
                ];

          const cadenceLabel = h.asset.type === 'IDX_STOCK' ? 'Semesteran' : 'Kuartalan';

          schedule.forEach((slot, idx) => {
            const projected = new Date(todayStart.getFullYear(), slot.month, slot.day);
            if (projected < todayStart) {
              projected.setFullYear(projected.getFullYear() + 1);
            }
            if (projected >= horizonEnd) return;

            const perShareAmt = annualPerShare * slot.shareWeight;
            const totalNative = perShareAmt * h.shares;
            const totalInView = convertToCurrency(totalNative, h.asset.currency, currency, usdIdrRate);
            const payDate = new Date(projected.getFullYear(), projected.getMonth(), projected.getDate() + 18);
            const daysUntil = Math.max(
              0,
              Math.round((projected.getTime() - todayStart.getTime()) / 86400000)
            );
            const mm = String(projected.getMonth() + 1).padStart(2, '0');
            const rawMonthKey = `${projected.getFullYear()}-${mm}`;
            const bucketKey = bucketMap.has(rawMonthKey) ? rawMonthKey : buckets[0].monthKey;
            const iso = `${rawMonthKey}-${String(projected.getDate()).padStart(2, '0')}`;

            events.push({
              id: `${tickerUpper}-est-${iso}-${idx}`,
              ticker: h.ticker,
              name: h.asset.name,
              assetType: h.asset.type,
              exDate: projected,
              exDateIso: iso,
              payDate,
              daysUntil,
              monthKey: bucketKey,
              monthShort: projected.toLocaleDateString('id-ID', { month: 'short' }),
              cadenceLabel,
              perShareAmount: perShareAmt,
              nativeCurrency: h.asset.currency,
              shares: h.shares,
              totalNative,
              totalInView,
              yieldPct: h.asset.dividendYield,
              source: 'estimated',
            });

            const b = bucketMap.get(bucketKey);
            if (b) {
              b.totalInView += totalInView;
              b.eventCount += 1;
            }
          });
        } else {
          nonDiv.push({ ticker: h.ticker, name: h.asset.name });
        }
      }

      events.sort((a, b) => a.exDate.getTime() - b.exDate.getTime());
      const annualTotal = events.reduce((s, e) => s + e.totalInView, 0);

      return {
        projectedEvents: events,
        nonDividendHoldings: nonDiv,
        annualPassiveIncome: annualTotal,
        monthlyAverageIncome: annualTotal / 12,
        monthlyBuckets: buckets,
      };
    }, [holdingsList, liveDividends, currency, usdIdrRate]);

  // Render 12-Month Passive Income Bar Chart with D3.js
  useEffect(() => {
    const svgEl = svgRef.current;
    if (!svgEl || monthlyBuckets.length === 0) return;

    const actualMax = Math.max(...monthlyBuckets.map((b) => b.totalInView));
    const maxVal = actualMax > 0 ? actualMax : currency === 'USD' ? 10 : 100000;
    const leftMargin = currency === 'IDR' && maxVal >= 1_000_000 ? 52 : 46;

    const width = containerWidth;
    const height = 165;
    const margin = { top: 16, right: 8, bottom: 26, left: leftMargin };
    const innerWidth = Math.max(120, width - margin.left - margin.right);
    const innerHeight = Math.max(70, height - margin.top - margin.bottom);

    const svg = d3.select(svgEl);
    svg.selectAll('*').remove();
    svg.attr('viewBox', `0 0 ${width} ${height}`).attr('width', width).attr('height', height);

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const xScale = d3
      .scaleBand<string>()
      .domain(monthlyBuckets.map((b) => b.monthKey))
      .range([0, innerWidth])
      .padding(0.28);

    const yScale = d3.scaleLinear().domain([0, maxVal * 1.15]).nice(3).range([innerHeight, 0]);

    // Gridlines
    g.append('g')
      .selectAll('line')
      .data(yScale.ticks(3))
      .join('line')
      .attr('x1', 0)
      .attr('x2', innerWidth)
      .attr('y1', (d) => yScale(d))
      .attr('y2', (d) => yScale(d))
      .attr('stroke', 'rgba(148, 163, 184, 0.12)')
      .attr('stroke-dasharray', '3,3');

    // Y Axis
    const yAxis = d3
      .axisLeft(yScale)
      .ticks(3)
      .tickSize(0)
      .tickPadding(6)
      .tickFormat((d) => formatCompactMoney(Number(d), currency).replace('Rp ', ''));

    g.append('g')
      .call(yAxis)
      .call((axisG) => axisG.select('.domain').remove())
      .selectAll('text')
      .attr('fill', '#64748b')
      .style('font-size', '9.5px')
      .style('font-family', 'ui-monospace, SFMono-Regular, Menlo, monospace');

    // X Axis
    const labelMap = new Map(monthlyBuckets.map((b) => [b.monthKey, b.monthShort]));
    const xAxis = d3
      .axisBottom(xScale)
      .tickSize(0)
      .tickPadding(8)
      .tickFormat((k) => labelMap.get(String(k)) || '');

    g.append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(xAxis)
      .call((axisG) => axisG.select('.domain').attr('stroke', 'rgba(148, 163, 184, 0.18)'))
      .selectAll('text')
      .attr('fill', (k) => (selectedMonthKey === k ? '#10b981' : '#94a3b8'))
      .style('font-size', '9.5px')
      .style('font-weight', (k) => (selectedMonthKey === k ? '700' : '500'));

    // Interactive Bars
    g.selectAll('rect.div-bar')
      .data(monthlyBuckets)
      .join('rect')
      .attr('class', 'div-bar')
      .attr('x', (d) => xScale(d.monthKey) || 0)
      .attr('y', (d) => yScale(d.totalInView))
      .attr('width', xScale.bandwidth())
      .attr('height', (d) => Math.max(d.totalInView > 0 ? 4 : 0, innerHeight - yScale(d.totalInView)))
      .attr('rx', 4)
      .attr('fill', (d) => {
        if (d.totalInView <= 0) return 'rgba(51, 65, 85, 0.25)';
        if (selectedMonthKey && selectedMonthKey !== d.monthKey) return 'rgba(16, 185, 129, 0.32)';
        return '#10b981';
      })
      .style('cursor', (d) => (d.eventCount > 0 ? 'pointer' : 'default'))
      .on('click', (_event, d) => {
        if (d.eventCount === 0) return;
        setSelectedMonthKey((prev) => (prev === d.monthKey ? null : d.monthKey));
      });
  }, [monthlyBuckets, containerWidth, currency, selectedMonthKey]);

  const filteredEvents = useMemo(() => {
    return projectedEvents.filter((ev) => {
      if (selectedMonthKey && ev.monthKey !== selectedMonthKey) return false;
      if (filterMode === 'SOON_30') return ev.daysUntil <= 30;
      if (filterMode === 'IDX') return ev.assetType === 'IDX_STOCK';
      if (filterMode === 'GLOBAL') return ev.assetType !== 'IDX_STOCK';
      return true;
    });
  }, [projectedEvents, filterMode, selectedMonthKey]);

  const nextExEvent = projectedEvents[0] || null;
  const effectivePortfolioYield =
    metrics?.totalValue > 0 ? (annualPassiveIncome / metrics.totalValue) * 100 : 0;

  return (
    <div className="pb-24 pt-2 px-4 space-y-4 max-w-lg mx-auto">
      {/* Top Sub-Page Header */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-semibold text-slate-200 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Kembali</span>
        </button>

        <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
          <CalendarDays className="w-4 h-4 text-emerald-400" />
          <span>Kalender Dividen</span>
        </span>
      </div>

      {/* Empty State when Portfolio is Empty */}
      {holdingsList.length === 0 ? (
        <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-center mx-auto">
            <Coins className="w-6 h-6 text-emerald-400" />
          </div>
          <h2 className="text-sm font-bold text-white">Portofolio Belum Memiliki Aset</h2>
          <p className="text-xs text-slate-400 leading-relaxed max-w-xs mx-auto">
            Tambahkan saham atau ETF pembagi dividen (seperti BBCA, BBRI, SCHD, VOO, atau QQQI) untuk memantau jadwal ex-date dan estimasi passive income bulanan Anda.
          </p>
          <button
            type="button"
            onClick={onOpenAddModal}
            className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs inline-flex items-center gap-1.5 shadow-lg shadow-emerald-500/20"
          >
            <span>Tambah Aset Sekarang</span>
          </button>
        </div>
      ) : (
        <>
          {/* Passive Income Hero Summary Card */}
          <div className="p-5 rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border border-slate-800 shadow-xl space-y-4">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-bold text-slate-200 flex items-center gap-1.5">
                <Coins className="w-4 h-4 text-emerald-400" />
                Estimasi Passive Income Dividen
              </span>
              <span className="text-[11px] font-mono text-cyan-400 font-semibold">
                Yield {effectivePortfolioYield.toFixed(2)}%
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-[11px] text-slate-400 block">Estimasi Tahunan</span>
                <p className="text-xl sm:text-2xl font-extrabold text-white font-mono tabular-nums mt-0.5">
                  {formatFullMoney(annualPassiveIncome, currency)}
                </p>
              </div>
              <div className="border-l border-slate-800 pl-3">
                <span className="text-[11px] text-slate-400 block">Rata-Rata Bulanan</span>
                <p className="text-xl sm:text-2xl font-extrabold text-emerald-400 font-mono tabular-nums mt-0.5">
                  {formatFullMoney(monthlyAverageIncome, currency)}
                </p>
              </div>
            </div>

            {/* Next Upcoming Ex-Date Highlight */}
            {nextExEvent ? (
              <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span className="text-slate-300 truncate">
                    Ex-Date terdekat: <strong className="text-white">{nextExEvent.ticker}</strong> ({nextExEvent.exDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })})
                  </span>
                </div>
                <span className="font-mono font-bold text-amber-400 shrink-0">
                  {nextExEvent.daysUntil === 0 ? 'Hari ini' : `${nextExEvent.daysUntil} hari lagi`}
                </span>
              </div>
            ) : (
              <div className="pt-3 border-t border-slate-800/80 text-xs text-slate-400">
                Belum ada aset di portofolio Anda yang memiliki jadwal dividen aktif.
              </div>
            )}
          </div>

          {/* 12-Month Passive Income Projection Bar Chart (D3.js) */}
          <div className="p-4 sm:p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                  <span>Proyeksi Dividen 12 Bulan Mendatang</span>
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Ketuk batang bulan untuk memfilter jadwal payout
                </p>
              </div>
              {selectedMonthKey && (
                <button
                  type="button"
                  onClick={() => setSelectedMonthKey(null)}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[10px] font-semibold text-emerald-300"
                >
                  <span>{monthlyBuckets.find((b) => b.monthKey === selectedMonthKey)?.monthShort}</span>
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            <div ref={chartContainerRef} className="relative w-full">
              {isLoading && (
                <div className="absolute top-1 right-1 z-10 text-[10px] text-slate-400 bg-slate-950/80 px-2 py-0.5 rounded border border-slate-800">
                  Menyelaraskan jadwal...
                </div>
              )}
              <svg ref={svgRef} className="w-full block select-none overflow-visible" />
            </div>
          </div>

          {/* Filter Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {[
              { key: 'ALL' as const, label: `Semua (${projectedEvents.length})` },
              {
                key: 'SOON_30' as const,
                label: `30 Hari (${projectedEvents.filter((e) => e.daysUntil <= 30).length})`,
              },
              {
                key: 'IDX' as const,
                label: `Saham IDX (${projectedEvents.filter((e) => e.assetType === 'IDX_STOCK').length})`,
              },
              {
                key: 'GLOBAL' as const,
                label: `AS & ETF (${projectedEvents.filter((e) => e.assetType !== 'IDX_STOCK').length})`,
              },
            ].map((chip) => (
              <button
                key={chip.key}
                type="button"
                onClick={() => setFilterMode(chip.key)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold border whitespace-nowrap transition-colors ${
                  filterMode === chip.key
                    ? 'bg-slate-800 border-slate-600 text-white'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {chip.label}
              </button>
            ))}
          </div>

          {/* Upcoming Ex-Dates Schedule List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between px-0.5">
              <h3 className="text-xs font-bold text-slate-200">
                Jadwal Ex-Date & Estimasi Payout ({filteredEvents.length})
              </h3>
              <span className="text-[10px] text-slate-500">Ketuk untuk detail aset</span>
            </div>

            {filteredEvents.length > 0 ? (
              filteredEvents.map((ev) => (
                <button
                  key={ev.id}
                  type="button"
                  onClick={() => onSelectAsset(ev.ticker)}
                  className="w-full p-3.5 rounded-2xl bg-slate-900 border border-slate-800/90 hover:border-emerald-500/40 flex items-center justify-between gap-2 text-left transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Date Badge Box */}
                    <div className="w-11 h-12 rounded-xl bg-slate-950 border border-slate-800 flex flex-col items-center justify-center shrink-0">
                      <span className="text-[9px] font-bold uppercase text-emerald-400 leading-none">
                        {ev.monthShort}
                      </span>
                      <span className="text-sm font-extrabold text-white font-mono leading-tight mt-0.5">
                        {ev.exDate.getDate()}
                      </span>
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-white">{ev.ticker}</span>
                        <span className="text-[10px] text-slate-400 truncate">
                          · {ev.cadenceLabel} · {ev.source === 'live' ? 'Histori Bursa' : 'Estimasi Yield'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-300 truncate mt-0.5">{ev.name}</p>
                      <p className="text-[10px] text-slate-400 font-mono mt-0.5 truncate">
                        {formatShareQuantity(ev.shares)} lbr ×{' '}
                        {ev.nativeCurrency === 'USD'
                          ? `$${ev.perShareAmount.toFixed(ev.perShareAmount < 0.1 ? 4 : 2)}`
                          : `Rp ${Math.round(ev.perShareAmount).toLocaleString('id-ID')}`}{' '}
                        · Pay est. {ev.payDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 pl-1">
                    <div className="text-right">
                      <p className="text-xs font-bold text-emerald-400 font-mono tabular-nums">
                        +{formatFullMoney(ev.totalInView, currency)}
                      </p>
                      <p className="text-[10px] text-amber-400/90 font-medium mt-0.5">
                        {ev.daysUntil === 0 ? 'Ex-Date Hari Ini' : `${ev.daysUntil} hari lagi`}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-600" />
                  </div>
                </button>
              ))
            ) : (
              <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 text-center text-xs text-slate-400">
                Tidak ada jadwal ex-date dividen yang cocok dengan filter saat ini.
              </div>
            )}
          </div>

          {/* Non-Dividend Holdings Note */}
          {nonDividendHoldings.length > 0 && (
            <div className="p-3.5 rounded-2xl bg-slate-900/70 border border-slate-800/80 flex items-start gap-2.5 text-[11px] text-slate-400">
              <Info className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                Aset tanpa pembagian dividen saat ini:{' '}
                <strong className="text-slate-200">
                  {nonDividendHoldings.map((n) => n.ticker).join(', ')}
                </strong>
                . Fokus aset ini adalah pertumbuhan kapital atau lindung nilai.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
};

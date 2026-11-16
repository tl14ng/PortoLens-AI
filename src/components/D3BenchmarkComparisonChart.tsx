import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import { Activity, TrendingUp, TrendingDown } from 'lucide-react';
import {
  BenchmarkHistoryPoint,
  BenchmarkRangeKey,
  ComparisonSeriesPoint,
  buildFallbackBenchmarkHistory,
  computePortfolioComparisonSeries,
} from '../data/marketData';

export type BenchmarkMode = 'SP500' | 'IHSG' | 'BOTH' | 'NASDAQ';

interface D3BenchmarkComparisonChartProps {
  holdings: Array<{ weight: number; asset: any }>;
  portfolioName?: string;
  compact?: boolean;
}

const BENCHMARK_CLIENT_LIVE_TTL_MS = 5 * 60 * 1000;
const BENCHMARK_CLIENT_FALLBACK_TTL_MS = 30 * 1000;

interface BenchmarkCacheEntry {
  points: BenchmarkHistoryPoint[];
  source: 'live' | 'fallback';
  fetchedAt: number;
}

const benchmarkClientCache = new Map<BenchmarkRangeKey, BenchmarkCacheEntry>();
const benchmarkInFlight = new Map<
  BenchmarkRangeKey,
  Promise<{ points: BenchmarkHistoryPoint[]; source: 'live' | 'fallback' }>
>();

function getFreshCachedBenchmark(range: BenchmarkRangeKey): BenchmarkCacheEntry | null {
  const entry = benchmarkClientCache.get(range);
  if (!entry) return null;
  const ttl = entry.source === 'live' ? BENCHMARK_CLIENT_LIVE_TTL_MS : BENCHMARK_CLIENT_FALLBACK_TTL_MS;
  if (Date.now() - entry.fetchedAt > ttl) return null;
  return entry;
}

function loadBenchmarkHistory(
  range: BenchmarkRangeKey
): Promise<{ points: BenchmarkHistoryPoint[]; source: 'live' | 'fallback' }> {
  const cached = getFreshCachedBenchmark(range);
  if (cached) {
    return Promise.resolve({ points: cached.points, source: cached.source });
  }
  const existing = benchmarkInFlight.get(range);
  if (existing) return existing;

  const promise = fetch(`/api/benchmark-history?range=${range}`)
    .then((res) => (res.ok ? res.json() : null))
    .then((json) => {
      if (json?.points && Array.isArray(json.points) && json.points.length >= 2) {
        const result = {
          points: json.points as BenchmarkHistoryPoint[],
          source: (json.source === 'live' ? 'live' : 'fallback') as 'live' | 'fallback',
        };
        benchmarkClientCache.set(range, { ...result, fetchedAt: Date.now() });
        return result;
      }
      const fallback = {
        points: buildFallbackBenchmarkHistory(range),
        source: 'fallback' as const,
      };
      benchmarkClientCache.set(range, { ...fallback, fetchedAt: Date.now() });
      return fallback;
    })
    .catch(() => ({
      points: buildFallbackBenchmarkHistory(range),
      source: 'fallback' as const,
    }))
    .finally(() => {
      benchmarkInFlight.delete(range);
    });

  benchmarkInFlight.set(range, promise);
  return promise;
}

const TIMEFRAME_OPTIONS: Array<{ key: BenchmarkRangeKey; label: string; fullLabel: string }> = [
  { key: '1M', label: '1B', fullLabel: '1 Bulan' },
  { key: '3M', label: '3B', fullLabel: '3 Bulan' },
  { key: '6M', label: '6B', fullLabel: '6 Bulan' },
  { key: '1Y', label: '1T', fullLabel: '1 Tahun' },
  { key: '5Y', label: '5T', fullLabel: '5 Tahun' },
  { key: '10Y', label: '10T', fullLabel: '10 Tahun' },
];

const BENCHMARK_OPTIONS: Array<{ key: BenchmarkMode; label: string }> = [
  { key: 'SP500', label: 'S&P 500' },
  { key: 'IHSG', label: 'IHSG' },
  { key: 'BOTH', label: 'S&P 500 & IHSG' },
  { key: 'NASDAQ', label: 'Nasdaq' },
];

export const D3BenchmarkComparisonChart: React.FC<D3BenchmarkComparisonChartProps> = ({
  holdings,
  portfolioName = 'Portofolio Anda',
  compact = false,
}) => {
  const [range, setRange] = useState<BenchmarkRangeKey>('1Y');
  const [benchmarkMode, setBenchmarkMode] = useState<BenchmarkMode>('BOTH');
  const initialCache = getFreshCachedBenchmark('1Y');
  const [benchmarkPoints, setBenchmarkPoints] = useState<BenchmarkHistoryPoint[]>(() =>
    initialCache ? initialCache.points : buildFallbackBenchmarkHistory('1Y')
  );
  const [dataSource, setDataSource] = useState<'live' | 'fallback'>(() =>
    initialCache ? initialCache.source : 'fallback'
  );
  const [isLoading, setIsLoading] = useState<boolean>(() => !initialCache);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const crosshairLayerRef = useRef<SVGGElement | null>(null);
  const chartLayoutRef = useRef<{
    xScale: d3.ScaleLinear<number, number>;
    yScale: d3.ScaleLinear<number, number>;
    innerHeight: number;
  } | null>(null);

  const [containerWidth, setContainerWidth] = useState<number>(360);
  const gradUid = React.useId().replace(/:/g, '');
  const gradientId = `d3-port-grad-${gradUid}`;

  // Measure container width dynamically so D3 redraws crisply on mobile & desktop
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const updateWidth = () => {
      const next = Math.max(260, Math.floor(el.getBoundingClientRect().width));
      setContainerWidth((prev) => (prev === next ? prev : next));
    };
    updateWidth();
    const ro = new ResizeObserver(updateWidth);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Fetch historical index curves whenever timeframe changes (with shared client cache)
  useEffect(() => {
    const cached = getFreshCachedBenchmark(range);
    if (cached) {
      setBenchmarkPoints(cached.points);
      setDataSource(cached.source);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    loadBenchmarkHistory(range)
      .then((res) => {
        if (cancelled) return;
        setBenchmarkPoints(res.points);
        setDataSource(res.source);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [range]);

  const seriesData: ComparisonSeriesPoint[] = useMemo(() => {
    return computePortfolioComparisonSeries(holdings, benchmarkPoints, range);
  }, [holdings, benchmarkPoints, range]);

  const hasPortfolio = holdings && holdings.length > 0;
  const showSp500 = benchmarkMode === 'SP500' || benchmarkMode === 'BOTH';
  const showIhsg = benchmarkMode === 'IHSG' || benchmarkMode === 'BOTH';
  const showNasdaq = benchmarkMode === 'NASDAQ';

  const chartHeight = compact ? 190 : 225;

  // Render D3 SVG chart base (axes, gridlines, paths, interactive overlay) without activeIndex dependency
  useEffect(() => {
    const svgEl = svgRef.current;
    if (!svgEl || seriesData.length < 2) return;

    const visibleValues: number[] = [0];
    seriesData.forEach((d) => {
      if (hasPortfolio && d.portfolioPct !== null && Number.isFinite(d.portfolioPct)) visibleValues.push(d.portfolioPct);
      if (showSp500 && Number.isFinite(d.sp500Pct)) visibleValues.push(d.sp500Pct);
      if (showIhsg && Number.isFinite(d.ihsgPct)) visibleValues.push(d.ihsgPct);
      if (showNasdaq && Number.isFinite(d.nasdaqPct)) visibleValues.push(d.nasdaqPct);
    });

    const rawMin = Math.min(...visibleValues);
    const rawMax = Math.max(...visibleValues);
    const span = Math.max(4, rawMax - rawMin);
    const yMin = rawMin - span * 0.14;
    const yMax = rawMax + span * 0.14;
    const maxAbsY = Math.max(Math.abs(yMin), Math.abs(yMax));
    const leftMargin = maxAbsY >= 900 ? 56 : maxAbsY >= 90 ? 48 : 42;

    const width = containerWidth;
    const height = chartHeight;
    const margin = { top: 14, right: 24, bottom: 26, left: leftMargin };
    const innerWidth = Math.max(100, width - margin.left - margin.right);
    const innerHeight = Math.max(80, height - margin.top - margin.bottom);

    const svg = d3.select(svgEl);
    svg.selectAll('*').remove();

    svg.attr('viewBox', `0 0 ${width} ${height}`).attr('width', width).attr('height', height);

    const defs = svg.append('defs');
    const areaGrad = defs
      .append('linearGradient')
      .attr('id', gradientId)
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '0%')
      .attr('y2', '100%');
    areaGrad.append('stop').attr('offset', '0%').attr('stop-color', '#10b981').attr('stop-opacity', 0.28);
    areaGrad.append('stop').attr('offset', '100%').attr('stop-color', '#10b981').attr('stop-opacity', 0.0);

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    // Scales
    const xScale = d3
      .scaleLinear()
      .domain([0, seriesData.length - 1])
      .range([0, innerWidth]);

    const yScale = d3.scaleLinear().domain([yMin, yMax]).nice(4).range([innerHeight, 0]);
    chartLayoutRef.current = { xScale, yScale, innerHeight };

    // Horizontal grid lines
    const yTicks = yScale.ticks(4);
    g.append('g')
      .selectAll('line.grid-line')
      .data(yTicks)
      .join('line')
      .attr('x1', 0)
      .attr('x2', innerWidth)
      .attr('y1', (d) => yScale(d))
      .attr('y2', (d) => yScale(d))
      .attr('stroke', (d) => (d === 0 ? 'rgba(148, 163, 184, 0.42)' : 'rgba(148, 163, 184, 0.12)'))
      .attr('stroke-dasharray', (d) => (d === 0 ? 'none' : '3,3'))
      .attr('stroke-width', 1);

    // Y Axis
    const hasFractionalTick = yTicks.some((t) => Math.abs(t - Math.round(t)) > 0.01);
    const yAxis = d3
      .axisLeft(yScale)
      .ticks(4)
      .tickSize(0)
      .tickPadding(6)
      .tickFormat((d) => {
        const num = Number(d);
        const clean = Math.abs(num) < 0.05 ? 0 : num;
        return `${clean > 0 ? '+' : ''}${clean.toFixed(hasFractionalTick ? 1 : 0)}%`;
      });

    g.append('g')
      .call(yAxis)
      .call((axisG) => axisG.select('.domain').remove())
      .selectAll('text')
      .attr('fill', '#64748b')
      .style('font-size', '10px')
      .style('font-family', 'ui-monospace, SFMono-Regular, Menlo, monospace');

    // X Axis ticks (4-5 evenly spaced indices)
    const tickIndices = Array.from(
      new Set([
        0,
        Math.round((seriesData.length - 1) * 0.33),
        Math.round((seriesData.length - 1) * 0.66),
        seriesData.length - 1,
      ])
    );

    const xAxis = d3
      .axisBottom(xScale)
      .tickValues(tickIndices)
      .tickSize(0)
      .tickPadding(8)
      .tickFormat((idx) => seriesData[Number(idx)]?.label || '');

    g.append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(xAxis)
      .call((axisG) => axisG.select('.domain').attr('stroke', 'rgba(148, 163, 184, 0.18)'))
      .selectAll('text')
      .attr('fill', '#94a3b8')
      .style('font-size', '10px');

    // Line generators
    const makeLine = (accessor: (d: ComparisonSeriesPoint) => number) =>
      d3
        .line<ComparisonSeriesPoint>()
        .x((_, i) => xScale(i))
        .y((d) => yScale(accessor(d)))
        .curve(d3.curveMonotoneX);

    // Portfolio area + line
    if (hasPortfolio) {
      const portfolioArea = d3
        .area<ComparisonSeriesPoint>()
        .x((_, i) => xScale(i))
        .y0(yScale(0))
        .y1((d) => yScale(d.portfolioPct ?? 0))
        .curve(d3.curveMonotoneX);

      g.append('path')
        .datum(seriesData)
        .attr('fill', `url(#${gradientId})`)
        .attr('d', portfolioArea);
    }

    // Index lines (drawn underneath portfolio line)
    if (showIhsg) {
      g.append('path')
        .datum(seriesData)
        .attr('fill', 'none')
        .attr('stroke', '#f59e0b')
        .attr('stroke-width', 2)
        .attr('stroke-dasharray', showSp500 ? '5,3' : 'none')
        .attr('opacity', 0.92)
        .attr('d', makeLine((d) => d.ihsgPct));
    }

    if (showSp500) {
      g.append('path')
        .datum(seriesData)
        .attr('fill', 'none')
        .attr('stroke', '#38bdf8')
        .attr('stroke-width', 2)
        .attr('opacity', 0.95)
        .attr('d', makeLine((d) => d.sp500Pct));
    }

    if (showNasdaq) {
      g.append('path')
        .datum(seriesData)
        .attr('fill', 'none')
        .attr('stroke', '#a78bfa')
        .attr('stroke-width', 2)
        .attr('opacity', 0.95)
        .attr('d', makeLine((d) => d.nasdaqPct));
    }

    // Portfolio main line on top
    if (hasPortfolio) {
      g.append('path')
        .datum(seriesData)
        .attr('fill', 'none')
        .attr('stroke', '#10b981')
        .attr('stroke-width', 2.6)
        .attr('d', makeLine((d) => d.portfolioPct ?? 0));
    }

    // Dedicated lightweight crosshair layer (updated independently on hover/scrub)
    const crosshairGroup = g
      .append('g')
      .attr('class', 'crosshair-layer')
      .attr('pointer-events', 'none');
    crosshairLayerRef.current = crosshairGroup.node();

    // Interactive pointer/touch scrubbing overlay
    const handleScrub = (clientX: number) => {
      const rect = svgEl.getBoundingClientRect();
      const scaleX = rect.width > 0 ? width / rect.width : 1;
      const relX = (clientX - rect.left) * scaleX - margin.left;
      const clampedX = Math.max(0, Math.min(innerWidth, relX));
      const idx = Math.round(xScale.invert(clampedX));
      const nextIdx = Math.min(seriesData.length - 1, Math.max(0, idx));
      setActiveIndex((prev) => (prev === nextIdx ? prev : nextIdx));
    };

    g.append('rect')
      .attr('width', innerWidth)
      .attr('height', innerHeight)
      .attr('fill', 'transparent')
      .style('cursor', 'crosshair')
      .style('touch-action', 'pan-y')
      .on('mousemove', (event: MouseEvent) => handleScrub(event.clientX))
      .on('touchstart', (event: TouchEvent) => {
        if (event.touches[0]) handleScrub(event.touches[0].clientX);
      })
      .on('touchmove', (event: TouchEvent) => {
        if (event.touches[0]) handleScrub(event.touches[0].clientX);
      })
      .on('mouseleave', () => setActiveIndex((prev) => (prev === null ? prev : null)));
  }, [
    seriesData,
    containerWidth,
    chartHeight,
    gradientId,
    hasPortfolio,
    showSp500,
    showIhsg,
    showNasdaq,
  ]);

  // Lightweight crosshair & marker update on scrub (zero full-SVG teardown)
  useEffect(() => {
    const layerEl = crosshairLayerRef.current;
    const layout = chartLayoutRef.current;
    if (!layerEl || !layout || seriesData.length < 2) return;

    const layer = d3.select(layerEl);
    layer.selectAll('*').remove();

    const focusIdx =
      activeIndex !== null
        ? Math.min(seriesData.length - 1, Math.max(0, activeIndex))
        : seriesData.length - 1;
    const focusPt = seriesData[focusIdx];
    const focusX = layout.xScale(focusIdx);

    if (activeIndex !== null) {
      layer
        .append('line')
        .attr('x1', focusX)
        .attr('x2', focusX)
        .attr('y1', 0)
        .attr('y2', layout.innerHeight)
        .attr('stroke', 'rgba(226, 232, 240, 0.38)')
        .attr('stroke-dasharray', '3,3')
        .attr('stroke-width', 1);
    }

    const addMarkerDot = (val: number, color: string) => {
      layer
        .append('circle')
        .attr('cx', focusX)
        .attr('cy', layout.yScale(val))
        .attr('r', activeIndex !== null ? 4.5 : 3.5)
        .attr('fill', color)
        .attr('stroke', '#020617')
        .attr('stroke-width', 1.8);
    };

    if (showIhsg) addMarkerDot(focusPt.ihsgPct, '#f59e0b');
    if (showSp500) addMarkerDot(focusPt.sp500Pct, '#38bdf8');
    if (showNasdaq) addMarkerDot(focusPt.nasdaqPct, '#a78bfa');
    if (hasPortfolio && focusPt.portfolioPct !== null) addMarkerDot(focusPt.portfolioPct, '#10b981');
  }, [
    activeIndex,
    seriesData,
    containerWidth,
    chartHeight,
    hasPortfolio,
    showSp500,
    showIhsg,
    showNasdaq,
  ]);

  const inspectedPoint =
    seriesData[
      activeIndex !== null
        ? Math.min(seriesData.length - 1, Math.max(0, activeIndex))
        : seriesData.length - 1
    ] || null;

  const latestPoint = seriesData[seriesData.length - 1] || null;

  // Primary benchmark metric for Alpha calculation
  const primaryBenchmarkLabel =
    benchmarkMode === 'IHSG'
      ? 'IHSG'
      : benchmarkMode === 'NASDAQ'
      ? 'Nasdaq'
      : 'S&P 500';

  const latestPortfolioRet = latestPoint?.portfolioPct ?? 0;
  const latestPrimaryBenchRet = latestPoint
    ? benchmarkMode === 'IHSG'
      ? latestPoint.ihsgPct
      : benchmarkMode === 'NASDAQ'
      ? latestPoint.nasdaqPct
      : latestPoint.sp500Pct
    : 0;
  const alphaDiff = Number((latestPortfolioRet - latestPrimaryBenchRet).toFixed(2));
  const isOutperforming = alphaDiff >= 0;

  const formatSignedPct = (val: number | null | undefined) => {
    if (val === null || val === undefined) return '—';
    return `${val >= 0 ? '+' : ''}${val.toFixed(1)}%`;
  };

  return (
    <div className="p-4 sm:p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3.5">
      {/* Top Header & Timeframe Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
            <Activity className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Perbandingan Portofolio vs Indeks Pasar</span>
          </h3>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {TIMEFRAME_OPTIONS.find((t) => t.key === range)?.fullLabel} ·{' '}
            {dataSource === 'live' ? 'Data historis bursa terkini' : 'Kurva simulasi historis'}
          </p>
        </div>

        {/* Timeframe Segmented Buttons */}
        <div
          className="flex items-center gap-0.5 sm:gap-1 p-1 bg-slate-950 rounded-xl border border-slate-800 max-w-full overflow-x-auto no-scrollbar"
          role="group"
          aria-label="Pilih jangka waktu perbandingan"
        >
          {TIMEFRAME_OPTIONS.map((tf) => {
            const active = range === tf.key;
            return (
              <button
                key={tf.key}
                type="button"
                onClick={() => {
                  setActiveIndex(null);
                  setRange(tf.key);
                }}
                className={`px-2 py-1 text-[10.5px] sm:text-[11px] font-bold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                  active
                    ? 'bg-emerald-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-slate-100'
                }`}
              >
                {tf.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Benchmark Selector Buttons */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
        {BENCHMARK_OPTIONS.map((opt) => {
          const active = benchmarkMode === opt.key;
          return (
            <button
              key={opt.key}
              type="button"
              onClick={() => {
                setActiveIndex(null);
                setBenchmarkMode(opt.key);
              }}
              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border transition-colors whitespace-nowrap shrink-0 ${
                active
                  ? 'bg-slate-800 border-slate-600 text-white'
                  : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      {/* Interactive Crosshair Readout Strip */}
      {inspectedPoint && (
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-800/80 text-[11px]">
          <span className="text-slate-400 font-medium">
            {(() => {
              const [y, m, d] = (inspectedPoint.date || '').split('-').map(Number);
              const fullDateStr =
                y && m && d
                  ? new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('id-ID', {
                      day: 'numeric',
                      month: 'short',
                      year: '2-digit',
                      timeZone: 'UTC',
                    })
                  : inspectedPoint.label;
              return activeIndex !== null
                ? `Tanggal ${fullDateStr}`
                : `Akhir periode (${fullDateStr})`;
            })()}
          </span>
          <div className="flex flex-wrap items-center gap-3 font-mono tabular-nums">
            {hasPortfolio && (
              <span className="flex items-center gap-1.5 text-emerald-400 font-bold">
                <span className="w-2.5 h-0.5 bg-emerald-400 rounded-full" />
                {portfolioName}: {formatSignedPct(inspectedPoint.portfolioPct)}
              </span>
            )}
            {showSp500 && (
              <span className="flex items-center gap-1.5 text-sky-400 font-semibold">
                <span className="w-2.5 h-0.5 bg-sky-400 rounded-full" />
                S&P 500: {formatSignedPct(inspectedPoint.sp500Pct)}
              </span>
            )}
            {showIhsg && (
              <span className="flex items-center gap-1.5 text-amber-400 font-semibold">
                <span className="w-2.5 h-0.5 border-t-2 border-dashed border-amber-400" />
                IHSG: {formatSignedPct(inspectedPoint.ihsgPct)}
              </span>
            )}
            {showNasdaq && (
              <span className="flex items-center gap-1.5 text-violet-400 font-semibold">
                <span className="w-2.5 h-0.5 bg-violet-400 rounded-full" />
                Nasdaq: {formatSignedPct(inspectedPoint.nasdaqPct)}
              </span>
            )}
          </div>
        </div>
      )}

      {/* D3 Chart Canvas */}
      <div ref={containerRef} className="relative w-full">
        {isLoading && (
          <div className="absolute top-2 right-2 z-10 text-[10px] text-slate-400 bg-slate-950/80 px-2 py-0.5 rounded border border-slate-800">
            Memuat data...
          </div>
        )}
        <svg ref={svgRef} className="w-full block select-none overflow-visible" />
      </div>

      {/* Outperformance / Alpha Summary Strip */}
      {hasPortfolio ? (
        <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-800/80 text-xs">
          <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/70">
            <span className="text-[10px] text-slate-400 block truncate">Return Portofolio</span>
            <span
              className={`text-xs font-bold font-mono tabular-nums mt-0.5 block ${
                latestPortfolioRet >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {formatSignedPct(latestPortfolioRet)}
            </span>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/70">
            <span className="text-[10px] text-slate-400 block truncate">
              {benchmarkMode === 'BOTH' ? 'S&P 500 / IHSG' : primaryBenchmarkLabel}
            </span>
            {benchmarkMode === 'BOTH' && latestPoint ? (
              <span className="text-[11px] font-bold font-mono tabular-nums mt-0.5 flex flex-wrap items-baseline gap-x-1 text-slate-200 leading-tight">
                <span className="text-sky-400">{formatSignedPct(latestPoint.sp500Pct)}</span>
                <span className="text-slate-600">/</span>
                <span className="text-amber-400">{formatSignedPct(latestPoint.ihsgPct)}</span>
              </span>
            ) : (
              <span
                className={`text-xs font-bold font-mono tabular-nums mt-0.5 block ${
                  benchmarkMode === 'IHSG'
                    ? 'text-amber-400'
                    : benchmarkMode === 'NASDAQ'
                    ? 'text-violet-400'
                    : 'text-sky-400'
                }`}
              >
                {formatSignedPct(latestPrimaryBenchRet)}
              </span>
            )}
          </div>

          <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/70">
            <span className="text-[10px] text-slate-400 block truncate">
              Selisih vs {primaryBenchmarkLabel}
            </span>
            <span
              className={`text-[11px] font-bold font-mono tabular-nums mt-0.5 flex items-start gap-1 leading-tight ${
                isOutperforming ? 'text-emerald-400' : 'text-amber-400'
              }`}
            >
              {isOutperforming ? (
                <TrendingUp className="w-3 h-3 shrink-0 mt-0.5" />
              ) : (
                <TrendingDown className="w-3 h-3 shrink-0 mt-0.5" />
              )}
              <span className="break-words">
                {formatSignedPct(alphaDiff)} {isOutperforming ? 'Unggul' : 'Tertinggal'}
              </span>
            </span>
          </div>
        </div>
      ) : (
        <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 text-[11px] text-slate-400 text-center">
          Tambahkan aset ke portofolio Anda untuk membandingkan kinerja portofolio secara langsung terhadap indeks{' '}
          <strong className="text-slate-200">S&P 500</strong> dan <strong className="text-slate-200">IHSG</strong>.
        </div>
      )}
    </div>
  );
};

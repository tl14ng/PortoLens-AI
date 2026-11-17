import {
  AVAILABLE_ASSETS,
  Asset,
  BenchmarkHistoryPoint,
  BenchmarkRangeKey,
  USD_TO_IDR_RATE,
  buildFallbackBenchmarkHistory,
  getAssetByTicker,
} from '../data/marketData';
import type { AppLanguage } from '../i18n/LanguageContext';
import { SafeJsonResult, fetchJsonSafe } from '../utils/safeFetch';

const FX_STORAGE_KEY = 'portolens_usd_idr_v1';
const API_BASE_STORAGE_KEY = 'portolens_api_base_url';
const EXPRESS_HTML_COOLDOWN_MS = 10 * 60 * 1000;
const EXPRESS_NET_COOLDOWN_MS = 30 * 1000;

let sameOriginUnavailableUntil = 0;

export const KNOWN_MONTHLY_DIVIDEND_TICKERS = new Set<string>([
  'QQQI',
  'SPYI',
  'JEPI',
  'JEPQ',
  'DIVO',
  'MAIN',
  'O',
  'STAG',
  'AGNC',
  'NLY',
  'XYLD',
  'RYLD',
  'QYLD',
  'TLT',
  'IEF',
  'SHY',
  'BND',
  'AGG',
  'HYG',
  'LQD',
  'JNK',
  'PFF',
  'SDIV',
  'SRET',
  'PEY',
  'SPHD',
  'EPR',
  'ADC',
  'SLG',
  'GLAD',
  'GAIN',
  'FEPI',
  'AIPI',
  'IWMI',
]);

const KNOWN_IDX_TICKER_SET = new Set<string>();
const CATALOG_PRICE_MAP = new Map<string, { price: number; currency: 'USD' | 'IDR' }>();
for (const item of AVAILABLE_ASSETS) {
  const upper = item.ticker.toUpperCase();
  CATALOG_PRICE_MAP.set(upper, { price: item.price, currency: item.currency });
  if (item.type === 'IDX_STOCK') {
    KNOWN_IDX_TICKER_SET.add(upper);
  }
}

export function isKnownMonthlyDividendTicker(ticker: string): boolean {
  const clean = ticker.toUpperCase().replace(/\.JK$/i, '').trim();
  return KNOWN_MONTHLY_DIVIDEND_TICKERS.has(clean);
}

/**
 * Resolves an optional explicit backend base URL (used if an APK is configured to talk to a
 * deployed Node/Express API server via VITE_API_BASE_URL, runtime global, or localStorage).
 */
export function getConfiguredApiBaseUrl(): string {
  const winBase =
    typeof window !== 'undefined' && typeof (window as any).__PORTOLENS_API_BASE__ === 'string'
      ? String((window as any).__PORTOLENS_API_BASE__)
      : '';
  let storedBase = '';
  if (typeof window !== 'undefined') {
    try {
      storedBase = window.localStorage.getItem(API_BASE_STORAGE_KEY) || '';
    } catch {
      storedBase = '';
    }
  }
  const envBase =
    typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_BASE_URL
      ? String((import.meta as any).env.VITE_API_BASE_URL)
      : '';

  const chosen = (winBase || storedBase || envBase).trim();
  return chosen ? chosen.replace(/\/+$/, '') : '';
}

function isPackagedNonHttpOrigin(): boolean {
  if (typeof window === 'undefined') return false;
  const proto = window.location.protocol.toLowerCase();
  return proto === 'file:' || proto === 'capacitor:' || proto === 'ionic:' || proto === 'app:';
}

function decodeHtmlEntities(raw: string): string {
  return raw
    .replace(/&amp;/g, '&')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}

function getCapacitorHttpPlugin():
  | {
      get: (options: {
        url: string;
        headers?: Record<string, string>;
        connectTimeout?: number;
        readTimeout?: number;
      }) => Promise<{ status: number; data: any }>;
    }
  | null {
  if (typeof globalThis === 'undefined') return null;
  const cap = (globalThis as any).Capacitor;
  const http = cap?.Plugins?.CapacitorHttp;
  if (http && typeof http.get === 'function') {
    return http;
  }
  return null;
}

async function capacitorGetJson(url: string, timeoutMs = 4500): Promise<any | null> {
  const capHttp = getCapacitorHttpPlugin();
  if (!capHttp) return null;
  try {
    const res = await capHttp.get({
      url,
      headers: {
        Accept: 'application/json',
        'User-Agent':
          'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
      },
      connectTimeout: timeoutMs,
      readTimeout: timeoutMs,
    });
    if (res.status >= 200 && res.status < 300 && res.data !== undefined && res.data !== null) {
      return typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
    }
    return null;
  } catch {
    return null;
  }
}

async function fetchPublicJsonWithTimeout(url: string, timeoutMs = 3800): Promise<any | null> {
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal ? AbortSignal.timeout(timeoutMs) : undefined,
    });
    if (!res.ok) return null;
    const text = await res.text();
    const trimmed = text.trim();
    if (!trimmed || trimmed.startsWith('<')) return null;
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

// ---------- Direct CORS-safe / CapacitorHttp Live FX Rate ----------
interface DirectFxResult {
  price: number;
  changePercent: number;
  isLive: boolean;
  source: string;
  updatedAt: string;
  fetchedAt: number;
}

let cachedDirectFx: DirectFxResult | null = null;
let inFlightDirectFx: Promise<DirectFxResult> | null = null;
const DIRECT_FX_TTL_MS = 15_000;

function readStoredUsdIdr(): number | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(FX_STORAGE_KEY);
    if (!raw) return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 1000 ? parsed : null;
  } catch {
    return null;
  }
}

function saveStoredUsdIdr(rate: number) {
  if (typeof window === 'undefined' || !Number.isFinite(rate) || rate <= 1000) return;
  try {
    window.localStorage.setItem(FX_STORAGE_KEY, String(rate));
  } catch {
    // ignore storage errors
  }
}

export async function fetchDirectLiveUsdIdrRate(): Promise<DirectFxResult> {
  if (cachedDirectFx && Date.now() - cachedDirectFx.fetchedAt < DIRECT_FX_TTL_MS) {
    return cachedDirectFx;
  }
  if (inFlightDirectFx) return inFlightDirectFx;

  const task = (async (): Promise<DirectFxResult> => {
    // 1. Native CapacitorHttp Yahoo USDIDR=X when running inside Capacitor APK
    if (getCapacitorHttpPlugin()) {
      for (const host of ['query1.finance.yahoo.com', 'query2.finance.yahoo.com']) {
        const yJson = await capacitorGetJson(
          `https://${host}/v8/finance/chart/USDIDR=X?interval=1m&range=1d`,
          3500
        );
        const meta = yJson?.chart?.result?.[0]?.meta;
        const closes: Array<number | null> = yJson?.chart?.result?.[0]?.indicators?.quote?.[0]?.close || [];
        let candlePrice: number | null = null;
        for (let i = closes.length - 1; i >= 0; i--) {
          const c = closes[i];
          if (typeof c === 'number' && Number.isFinite(c) && c > 1000) {
            candlePrice = c;
            break;
          }
        }
        const rawPrice =
          typeof meta?.regularMarketPrice === 'number' &&
          Number.isFinite(meta.regularMarketPrice) &&
          meta.regularMarketPrice > 1000
            ? meta.regularMarketPrice
            : candlePrice;
        if (rawPrice && rawPrice > 1000) {
          const prev = meta?.chartPreviousClose || meta?.previousClose || rawPrice;
          const pct =
            typeof meta?.regularMarketChangePercent === 'number' &&
            Number.isFinite(meta.regularMarketChangePercent)
              ? meta.regularMarketChangePercent
              : prev > 0
              ? ((rawPrice - prev) / prev) * 100
              : 0;
          const res: DirectFxResult = {
            price: Number(rawPrice.toFixed(2)),
            changePercent: Number(pct.toFixed(2)),
            isLive: true,
            source: 'Yahoo Finance',
            updatedAt: meta?.regularMarketTime
              ? new Date(meta.regularMarketTime * 1000).toISOString()
              : new Date().toISOString(),
            fetchedAt: Date.now(),
          };
          cachedDirectFx = res;
          saveStoredUsdIdr(res.price);
          return res;
        }
      }
    }

    // 2. CORS-enabled public FX providers (work inside plain Android WebView & browser!)
    const erJson = await fetchPublicJsonWithTimeout('https://open.er-api.com/v6/latest/USD', 3500);
    if (typeof erJson?.rates?.IDR === 'number' && Number.isFinite(erJson.rates.IDR) && erJson.rates.IDR > 1000) {
      const res: DirectFxResult = {
        price: Number(erJson.rates.IDR.toFixed(2)),
        changePercent: 0,
        isLive: true,
        source: 'ExchangeRate-API',
        updatedAt: erJson?.time_last_update_utc
          ? new Date(erJson.time_last_update_utc).toISOString()
          : new Date().toISOString(),
        fetchedAt: Date.now(),
      };
      cachedDirectFx = res;
      saveStoredUsdIdr(res.price);
      return res;
    }

    const ffJson = await fetchPublicJsonWithTimeout(
      'https://api.frankfurter.dev/v1/latest?from=USD&to=IDR',
      3500
    );
    if (typeof ffJson?.rates?.IDR === 'number' && Number.isFinite(ffJson.rates.IDR) && ffJson.rates.IDR > 1000) {
      const res: DirectFxResult = {
        price: Number(ffJson.rates.IDR.toFixed(2)),
        changePercent: 0,
        isLive: true,
        source: 'ECB Frankfurter',
        updatedAt: new Date().toISOString(),
        fetchedAt: Date.now(),
      };
      cachedDirectFx = res;
      saveStoredUsdIdr(res.price);
      return res;
    }

    const jsdJson = await fetchPublicJsonWithTimeout(
      'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json',
      3500
    );
    if (typeof jsdJson?.usd?.idr === 'number' && Number.isFinite(jsdJson.usd.idr) && jsdJson.usd.idr > 1000) {
      const res: DirectFxResult = {
        price: Number(jsdJson.usd.idr.toFixed(2)),
        changePercent: 0,
        isLive: true,
        source: 'Currency-API',
        updatedAt: new Date().toISOString(),
        fetchedAt: Date.now(),
      };
      cachedDirectFx = res;
      saveStoredUsdIdr(res.price);
      return res;
    }

    if (cachedDirectFx) return cachedDirectFx;

    const stored = readStoredUsdIdr();
    return {
      price: stored ?? USD_TO_IDR_RATE,
      changePercent: 0,
      isLive: false,
      source: stored ? 'cached-local' : 'baseline',
      updatedAt: new Date().toISOString(),
      fetchedAt: Date.now(),
    };
  })().finally(() => {
    inFlightDirectFx = null;
  });

  inFlightDirectFx = task;
  return task;
}

// ---------- Direct CapacitorHttp Yahoo Quote / History / Dividend Support ----------
interface DirectQuoteEntry {
  price: number;
  change: number;
  changePercent: number;
  currency: string;
  shortName?: string;
  instrumentType?: string;
  exchangeName?: string;
  isLiveFound: boolean;
  regularMarketTime: number;
  isLive: boolean;
  fetchedAt: number;
}

const directQuoteCache = new Map<string, DirectQuoteEntry>();
const inFlightDirectQuotes = new Map<string, Promise<DirectQuoteEntry>>();

function resolveYahooSymbol(rawTicker: string, exactSymbol = false): string {
  const ticker = rawTicker.toUpperCase().trim();
  const baseSymbol =
    exactSymbol || ticker.endsWith('.JK') || ticker.includes('=')
      ? ticker
      : KNOWN_IDX_TICKER_SET.has(ticker)
      ? `${ticker}.JK`
      : ticker;
  return !baseSymbol.endsWith('.JK') && !baseSymbol.includes('=') && baseSymbol.includes('.')
    ? baseSymbol.replace(/\./g, '-')
    : baseSymbol;
}

function buildCatalogFallbackQuote(rawTicker: string, exactSymbol = false): DirectQuoteEntry {
  const yahooSymbol = resolveYahooSymbol(rawTicker, exactSymbol);
  const cleanTicker = yahooSymbol.replace(/\.JK$/i, '');
  const catalogAsset = getAssetByTicker(cleanTicker);
  const isIdx = yahooSymbol.endsWith('.JK') || catalogAsset?.type === 'IDX_STOCK';
  const base = CATALOG_PRICE_MAP.get(cleanTicker);

  return {
    price: base?.price ?? (isIdx ? 1000 : 100),
    change: 0,
    changePercent: catalogAsset?.change1D ?? 0,
    currency: base?.currency ?? (isIdx ? 'IDR' : 'USD'),
    shortName: catalogAsset?.name,
    instrumentType: catalogAsset?.type === 'ETF' ? 'ETF' : catalogAsset ? 'EQUITY' : undefined,
    exchangeName:
      catalogAsset?.type === 'IDX_STOCK'
        ? 'Jakarta (IDX)'
        : catalogAsset?.type === 'ETF'
        ? 'US ETF'
        : catalogAsset
        ? 'Wall Street'
        : undefined,
    isLiveFound: false,
    regularMarketTime: Math.floor(Date.now() / 1000),
    isLive: false,
    fetchedAt: Date.now(),
  };
}

async function fetchDirectQuote(rawTicker: string, exactSymbol = false): Promise<DirectQuoteEntry> {
  const yahooSymbol = resolveYahooSymbol(rawTicker, exactSymbol);
  const cached = directQuoteCache.get(yahooSymbol);
  const ttl = cached?.isLiveFound === false ? 30_000 : 4_000;
  if (cached && Date.now() - cached.fetchedAt < ttl) {
    return cached;
  }

  if (!getCapacitorHttpPlugin()) {
    return buildCatalogFallbackQuote(rawTicker, exactSymbol);
  }

  const inflight = inFlightDirectQuotes.get(yahooSymbol);
  if (inflight) return inflight;

  const task = (async (): Promise<DirectQuoteEntry> => {
    for (const host of ['query1.finance.yahoo.com', 'query2.finance.yahoo.com']) {
      const json = await capacitorGetJson(
        `https://${host}/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?interval=1d&range=1d`,
        3500
      );
      const meta = json?.chart?.result?.[0]?.meta;
      if (meta && typeof meta.regularMarketPrice === 'number' && Number.isFinite(meta.regularMarketPrice) && meta.regularMarketPrice > 0) {
        const price = meta.regularMarketPrice;
        const prevClose = meta.chartPreviousClose || meta.previousClose || price;
        const change = price - prevClose;
        const changePercent = prevClose > 0 ? (change / prevClose) * 100 : 0;
        const rawName = typeof meta.shortName === 'string' ? meta.shortName : typeof meta.longName === 'string' ? meta.longName : '';
        const entry: DirectQuoteEntry = {
          price: Number(price.toFixed(price > 100 ? 2 : 4)),
          change: Number(change.toFixed(2)),
          changePercent: Number(changePercent.toFixed(2)),
          currency: meta.currency || (yahooSymbol.endsWith('.JK') ? 'IDR' : 'USD'),
          shortName: rawName ? decodeHtmlEntities(rawName) : undefined,
          instrumentType: meta.instrumentType || undefined,
          exchangeName: meta.fullExchangeName || meta.exchangeName || undefined,
          isLiveFound: true,
          regularMarketTime: meta.regularMarketTime || Math.floor(Date.now() / 1000),
          isLive: true,
          fetchedAt: Date.now(),
        };
        directQuoteCache.set(yahooSymbol, entry);
        return entry;
      }
    }
    const fb = buildCatalogFallbackQuote(rawTicker, exactSymbol);
    directQuoteCache.set(yahooSymbol, fb);
    return fb;
  })().finally(() => {
    inFlightDirectQuotes.delete(yahooSymbol);
  });

  inFlightDirectQuotes.set(yahooSymbol, task);
  return task;
}

// ---------- Endpoint Bridges (Mirroring server.ts JSON Contracts) ----------

async function bridgeLiveQuotes(searchParams: URLSearchParams) {
  const symbolsParam = searchParams.get('symbols') || '';
  const extraParam = searchParams.get('extraSymbols') || '';
  const defaultSymbols = [
    'NVDA', 'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'META', 'PLTR',
    'BBCA', 'BBRI', 'BMRI', 'BBNI', 'TLKM', 'BREN', 'ASII', 'ANTM', 'AMMN', 'GOTO',
    'VOO', 'QQQ', 'SCHD', 'GLD', 'SMH', 'VIG', 'SPY', 'JNJ', 'ARKK',
  ];
  const baseSymbols = symbolsParam
    ? symbolsParam.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean)
    : defaultSymbols;
  const extraSymbols = extraParam
    ? extraParam.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean)
    : [];
  const requestedSymbols = Array.from(new Set([...baseSymbols, ...extraSymbols])).slice(0, 60);

  const [fx, ...quoteResults] = await Promise.all([
    fetchDirectLiveUsdIdrRate(),
    ...requestedSymbols.map(async (sym) => ({
      ticker: sym,
      ...(await fetchDirectQuote(sym)),
    })),
  ]);

  const quotesMap: Record<string, any> = {};
  for (const q of quoteResults) {
    const payload = {
      price: q.price,
      change: q.change,
      changePercent: q.changePercent,
      currency: q.currency,
      shortName: q.shortName,
      instrumentType: q.instrumentType,
      exchangeName: q.exchangeName,
      isLiveFound: q.isLiveFound,
      regularMarketTime: q.regularMarketTime,
      isLive: q.isLive,
    };
    quotesMap[q.ticker] = payload;
    if (q.ticker.endsWith('.JK')) {
      quotesMap[q.ticker.replace(/\.JK$/, '')] = payload;
    }
  }

  return {
    timestamp: Date.now(),
    lastUpdated: new Date().toISOString(),
    exchangeRateUSDIDR: fx.price,
    exchangeRateChange: fx.changePercent,
    exchangeRateIsLive: fx.isLive,
    exchangeRateSource: fx.source,
    exchangeRateUpdatedAt: fx.updatedAt,
    quotes: quotesMap,
  };
}

async function bridgeDetectTicker(searchParams: URLSearchParams) {
  const isEn = searchParams.get('lang') === 'en';
  const rawInput = (searchParams.get('ticker') || '').toUpperCase().trim();
  const hadJkSuffix = /\.JK$/i.test(rawInput);
  const cleanTicker = rawInput.replace(/\.JK$/i, '').replace(/[^A-Z0-9.-]/g, '');

  if (!cleanTicker) {
    return {
      ticker: '',
      found: false,
      detectedType: null,
      classificationLabel: null,
      name: null,
      price: null,
      changePercent: 0,
      currency: null,
      exchangeName: null,
      instrumentType: null,
      candidates: [],
    };
  }

  // 1. Check live CapacitorHttp if running in Capacitor APK
  if (getCapacitorHttpPlugin()) {
    const [globalQ, idxQ] = await Promise.all([
      fetchDirectQuote(cleanTicker, true),
      fetchDirectQuote(`${cleanTicker}.JK`, true),
    ]);

    const classifyGlobal = (q: DirectQuoteEntry): 'ETF' | 'US_STOCK' | 'IDX_STOCK' => {
      const inst = (q.instrumentType || '').toUpperCase();
      const name = (q.shortName || '').toUpperCase();
      const exch = (q.exchangeName || '').toUpperCase();
      if (q.currency === 'IDR' || exch.includes('JAKARTA') || exch === 'JKT') return 'IDX_STOCK';
      if (
        inst === 'ETF' ||
        inst === 'MUTUALFUND' ||
        name.includes(' ETF') ||
        name.includes('INDEX FUND') ||
        name.includes('TRUST')
      ) {
        return 'ETF';
      }
      return 'US_STOCK';
    };

    const candidates: any[] = [];
    if (globalQ.isLiveFound) {
      const gType = classifyGlobal(globalQ);
      candidates.push({
        type: gType,
        label: isEn
          ? gType === 'ETF'
            ? 'Global ETF'
            : gType === 'IDX_STOCK'
            ? 'IDX Stock (Indonesia)'
            : 'US Stock (Wall Street)'
          : gType === 'ETF'
          ? 'ETF Global'
          : gType === 'IDX_STOCK'
          ? 'Saham IHSG (IDX)'
          : 'Saham Wall Street (AS)',
        name: globalQ.shortName || cleanTicker,
        price: globalQ.price,
        changePercent: globalQ.changePercent,
        currency: globalQ.currency === 'IDR' ? 'IDR' : 'USD',
        exchangeName: globalQ.exchangeName || 'Wall Street / Global',
        instrumentType: globalQ.instrumentType || (gType === 'ETF' ? 'ETF' : 'EQUITY'),
      });
    }
    if (idxQ.isLiveFound && !candidates.some((c) => c.type === 'IDX_STOCK')) {
      candidates.push({
        type: 'IDX_STOCK',
        label: isEn ? 'IDX Stock (Indonesia)' : 'Saham IHSG (IDX)',
        name: idxQ.shortName || `${cleanTicker} Tbk`,
        price: idxQ.price,
        changePercent: idxQ.changePercent,
        currency: 'IDR',
        exchangeName: idxQ.exchangeName || 'Jakarta (IDX)',
        instrumentType: idxQ.instrumentType || 'EQUITY',
      });
    }

    if (candidates.length > 0) {
      let primary = candidates[0];
      if (candidates.length > 1) {
        if (hadJkSuffix) {
          primary = candidates.find((c) => c.type === 'IDX_STOCK') || candidates[0];
        } else {
          primary = KNOWN_IDX_TICKER_SET.has(cleanTicker)
            ? candidates.find((c) => c.type === 'IDX_STOCK') || candidates[0]
            : candidates.find((c) => c.type !== 'IDX_STOCK') || candidates[0];
        }
      }
      return {
        ticker: cleanTicker,
        found: true,
        detectedType: primary.type,
        classificationLabel: primary.label,
        name: primary.name,
        price: primary.price,
        changePercent: primary.changePercent,
        currency: primary.currency,
        exchangeName: primary.exchangeName,
        instrumentType: primary.instrumentType,
        candidates,
      };
    }
  }

  // 2. Fallback to built-in 5,000+ catalog asset recognition
  const catalogMatch = getAssetByTicker(cleanTicker) || getAssetByTicker(rawInput);
  if (catalogMatch) {
    const label = isEn
      ? catalogMatch.type === 'ETF'
        ? 'Global ETF'
        : catalogMatch.type === 'IDX_STOCK'
        ? 'IDX Stock (Indonesia)'
        : 'US Stock (Wall Street)'
      : catalogMatch.type === 'ETF'
      ? 'ETF Global'
      : catalogMatch.type === 'IDX_STOCK'
      ? 'Saham IHSG (IDX)'
      : 'Saham Wall Street (AS)';

    const candidate = {
      type: catalogMatch.type,
      label,
      name: catalogMatch.name,
      price: catalogMatch.price,
      changePercent: catalogMatch.change1D,
      currency: catalogMatch.currency,
      exchangeName:
        catalogMatch.type === 'IDX_STOCK'
          ? 'Jakarta (IDX)'
          : catalogMatch.type === 'ETF'
          ? 'US ETF (Catalog)'
          : 'Wall Street (Catalog)',
      instrumentType: catalogMatch.type === 'ETF' ? 'ETF' : 'EQUITY',
    };
    return {
      ticker: catalogMatch.ticker,
      found: true,
      detectedType: candidate.type,
      classificationLabel: candidate.label,
      name: candidate.name,
      price: candidate.price,
      changePercent: candidate.changePercent,
      currency: candidate.currency,
      exchangeName: candidate.exchangeName,
      instrumentType: candidate.instrumentType,
      candidates: [candidate],
    };
  }

  return {
    ticker: cleanTicker,
    found: false,
    detectedType: null,
    classificationLabel: null,
    name: null,
    price: null,
    changePercent: 0,
    currency: null,
    exchangeName: null,
    instrumentType: null,
    candidates: [],
  };
}

async function bridgeMarketTrends(searchParams: URLSearchParams) {
  const isEn = searchParams.get('lang') === 'en';
  const fx = await fetchDirectLiveUsdIdrRate();
  const formattedUsdIdr = isEn
    ? `Rp ${Math.round(fx.price).toLocaleString('en-US')}`
    : `Rp ${Math.round(fx.price).toLocaleString('id-ID')}`;

  return {
    updatedAt: new Date().toISOString(),
    exchangeRateUSDIDR: fx.price,
    exchangeRateChange: fx.changePercent,
    exchangeRateIsLive: fx.isLive,
    exchangeRateSource: fx.source,
    macroIndicators: isEn
      ? [
          {
            indicator: 'US Fed Funds Rate',
            value: '3.75% - 4.00%',
            trend: 'neutral',
            impact: 'Moderate rate level supports growth equity multiples while keeping markets selective on earnings.',
          },
          {
            indicator: 'S&P 500 Forward P/E',
            value: '18.3x',
            trend: 'neutral',
            impact: 'Below the 10-year average (19.1x) as corporate earnings growth catches up to index levels.',
          },
          {
            indicator: 'BI-Rate (BI 7-Day Repo)',
            value: '5.75%',
            trend: 'stable',
            impact: 'Balances Rupiah currency stability with solid NIM for Indonesian blue-chip banks.',
          },
          {
            indicator: 'USD/IDR Exchange Rate',
            value: formattedUsdIdr,
            trend: fx.changePercent > 0.25 ? 'elevated' : 'stable',
            impact: fx.isLive
              ? `Live ${fx.source} spot rate; USD assets continue to provide strong Rupiah purchasing-power protection.`
              : 'Local reference FX rate; USD assets continue to provide Rupiah purchasing-power protection.',
          },
        ]
      : [
          {
            indicator: 'US Fed Funds Rate',
            value: '3.75% - 4.00%',
            trend: 'neutral',
            impact: 'Suku bunga moderat mendukung valuasi saham pertumbuhan namun tetap menuntut kualitas laba.',
          },
          {
            indicator: 'S&P 500 Forward P/E',
            value: '18.3x',
            trend: 'neutral',
            impact: 'Berada di bawah rata-rata 10 tahun (19.1x) seiring pertumbuhan laba emiten mengimbangi reli indeks.',
          },
          {
            indicator: 'BI-Rate (BI 7-Day Repo)',
            value: '5.75%',
            trend: 'stable',
            impact: 'Menjaga stabilitas nilai tukar Rupiah sekaligus menopang margin perbankan besar Indonesia.',
          },
          {
            indicator: 'USD/IDR Exchange Rate',
            value: formattedUsdIdr,
            trend: fx.changePercent > 0.25 ? 'elevated' : 'stable',
            impact: fx.isLive
              ? `Kurs spot terkini (${fx.source}); aset berdenominasi USD memberi lindung nilai daya beli terhadap pelemahan Rupiah.`
              : 'Kurs referensi lokal (mode offline); aset berdenominasi USD memberi lindung nilai terhadap fluktuasi Rupiah.',
          },
        ],
    sectorTrends: isEn
      ? [
          {
            sector: 'US Tech & Semiconductors',
            sentiment: 'Medium-Term Bullish',
            rationale: 'Structural demand for AI compute chips and cloud data center infrastructure remains robust.',
            topPicks: ['NVDA', 'MSFT', 'SMH'],
          },
          {
            sector: 'Indonesian Blue-Chip Banks',
            sentiment: 'Accumulate & Dividend',
            rationale: 'Healthy credit quality, ROE consistently above 18%, and dependable annual dividend payouts.',
            topPicks: ['BBCA', 'BBRI', 'BMRI'],
          },
          {
            sector: 'Broad Market & Dividend ETFs',
            sentiment: 'Core Risk Anchor',
            rationale: 'Best risk-management foundation to smooth portfolio volatility without sacrificing steady returns.',
            topPicks: ['VOO', 'SCHD', 'QQQ'],
          },
        ]
      : [
          {
            sector: 'Teknologi & Semikonduktor AS',
            sentiment: 'Bullish Jangka Menengah',
            rationale: 'Permintaan chip AI dan infrastruktur cloud data center terus bertumbuh secara struktural.',
            topPicks: ['NVDA', 'MSFT', 'SMH'],
          },
          {
            sector: 'Perbankan Bluechip Indonesia',
            sentiment: 'Akumulasi & Dividen',
            rationale: 'Kualitas kredit kuat, rasio ROE tinggi di atas 18%, dan pembagian dividen konsisten.',
            topPicks: ['BBCA', 'BBRI', 'BMRI'],
          },
          {
            sector: 'Broad Market & Dividend ETF',
            sentiment: 'Rekomendasi Utama Risiko',
            rationale: 'Fondasi manajemen risiko terbaik untuk meredam volatilitas portofolio tanpa kehilangan imbal hasil.',
            topPicks: ['VOO', 'SCHD', 'QQQ'],
          },
        ],
  };
}

async function fetchDirectYahooHistorySeries(
  symbol: string,
  yahooRange: string,
  yahooInterval: string
): Promise<Array<{ dateKey: string; timestamp: number; close: number }> | null> {
  if (!getCapacitorHttpPlugin()) return null;
  for (const host of ['query1.finance.yahoo.com', 'query2.finance.yahoo.com']) {
    const json = await capacitorGetJson(
      `https://${host}/v8/finance/chart/${encodeURIComponent(symbol)}?range=${yahooRange}&interval=${yahooInterval}`,
      4500
    );
    const result = json?.chart?.result?.[0];
    const timestamps: number[] = result?.timestamp || [];
    const closes: Array<number | null> = result?.indicators?.quote?.[0]?.close || [];
    if (!timestamps.length || !closes.length) continue;

    const points: Array<{ dateKey: string; timestamp: number; close: number }> = [];
    for (let i = 0; i < timestamps.length; i++) {
      const c = closes[i];
      if (typeof c === 'number' && Number.isFinite(c) && c > 0) {
        const d = new Date(timestamps[i] * 1000);
        points.push({ dateKey: d.toISOString().slice(0, 10), timestamp: timestamps[i] * 1000, close: c });
      }
    }
    if (points.length >= 2) return points;
  }
  return null;
}

async function bridgeBenchmarkHistory(searchParams: URLSearchParams) {
  const rawRange = (searchParams.get('range') || '1Y').toUpperCase();
  const lang: AppLanguage = searchParams.get('lang') === 'en' ? 'en' : 'id';
  const rangeKey: BenchmarkRangeKey =
    rawRange === '1M' ||
    rawRange === '3M' ||
    rawRange === '6M' ||
    rawRange === '1Y' ||
    rawRange === '5Y' ||
    rawRange === '10Y'
      ? rawRange
      : '1Y';

  if (getCapacitorHttpPlugin()) {
    const yahooConfig: Record<BenchmarkRangeKey, { yRange: string; yInterval: string }> = {
      '1M': { yRange: '1mo', yInterval: '1d' },
      '3M': { yRange: '3mo', yInterval: '1d' },
      '6M': { yRange: '6mo', yInterval: '1wk' },
      '1Y': { yRange: '1y', yInterval: '1wk' },
      '5Y': { yRange: '5y', yInterval: '1mo' },
      '10Y': { yRange: '10y', yInterval: '1mo' },
    };
    const cfg = yahooConfig[rangeKey];
    const [spSeries, ihsgSeries, ndxSeries] = await Promise.all([
      fetchDirectYahooHistorySeries('^GSPC', cfg.yRange, cfg.yInterval),
      fetchDirectYahooHistorySeries('^JKSE', cfg.yRange, cfg.yInterval),
      fetchDirectYahooHistorySeries('^IXIC', cfg.yRange, cfg.yInterval),
    ]);

    if (spSeries || ihsgSeries) {
      const baseTimeline = spSeries || ihsgSeries!;
      const showYearLabel = rangeKey === '1Y' || rangeKey === '5Y' || rangeKey === '10Y';
      const dateLocale = lang === 'en' ? 'en-US' : 'id-ID';
      const lookupNearestPct = (
        series: Array<{ dateKey: string; timestamp: number; close: number }> | null,
        targetTs: number,
        fallbackPct: number
      ) => {
        if (!series || series.length === 0 || !(series[0].close > 0)) return fallbackPct;
        const firstClose = series[0].close;
        let best = series[0];
        let minDiff = Math.abs(series[0].timestamp - targetTs);
        for (let i = 1; i < series.length; i++) {
          const diff = Math.abs(series[i].timestamp - targetTs);
          if (diff < minDiff) {
            minDiff = diff;
            best = series[i];
          }
        }
        return Number((((best.close - firstClose) / firstClose) * 100).toFixed(2));
      };

      const points: BenchmarkHistoryPoint[] = baseTimeline.map((pt, idx) => {
        const [y, m, day] = pt.dateKey.split('-').map(Number);
        const d = y && m && day ? new Date(Date.UTC(y, m - 1, day)) : new Date(pt.timestamp);
        const label = showYearLabel
          ? d.toLocaleDateString(dateLocale, { month: 'short', year: '2-digit', timeZone: 'UTC' })
          : d.toLocaleDateString(dateLocale, { day: 'numeric', month: 'short', timeZone: 'UTC' });

        const ihsgPct =
          idx === 0
            ? 0
            : ihsgSeries
            ? spSeries
              ? lookupNearestPct(ihsgSeries, pt.timestamp, 0)
              : Number((((pt.close - ihsgSeries[0].close) / ihsgSeries[0].close) * 100).toFixed(2))
            : 0;
        const ndxRaw = idx === 0 ? 0 : ndxSeries ? lookupNearestPct(ndxSeries, pt.timestamp, 0) : null;
        const sp500Pct =
          idx === 0
            ? 0
            : spSeries
            ? Number((((pt.close - spSeries[0].close) / spSeries[0].close) * 100).toFixed(2))
            : ndxRaw !== null
            ? Number((ndxRaw * 0.78).toFixed(2))
            : Number((ihsgPct * 1.15).toFixed(2));
        const finalIhsgPct = idx === 0 ? 0 : ihsgSeries ? ihsgPct : Number((sp500Pct * 0.55).toFixed(2));
        const nasdaqPct = idx === 0 ? 0 : ndxRaw !== null ? ndxRaw : Number((sp500Pct * 1.25).toFixed(2));

        return {
          date: pt.dateKey,
          timestamp: pt.timestamp,
          label,
          sp500Pct,
          ihsgPct: finalIhsgPct,
          nasdaqPct,
        };
      });

      return {
        range: rangeKey,
        source: 'live',
        updatedAt: new Date().toISOString(),
        points,
      };
    }
  }

  return {
    range: rangeKey,
    source: 'fallback',
    points: buildFallbackBenchmarkHistory(rangeKey, lang),
  };
}

function synthesizeCatalogDividendRecord(rawSym: string) {
  const tickerUpper = rawSym.toUpperCase().trim();
  const cleanTicker = tickerUpper.replace(/\.JK$/i, '');
  const asset: Asset | undefined = getAssetByTicker(cleanTicker);
  const isIdx = tickerUpper.endsWith('.JK') || asset?.type === 'IDX_STOCK' || KNOWN_IDX_TICKER_SET.has(cleanTicker);
  const nativeCurrency: 'IDR' | 'USD' = isIdx ? 'IDR' : asset?.currency || 'USD';

  if (!asset || !(asset.dividendYield > 0)) {
    return {
      ticker: cleanTicker,
      currency: nativeCurrency,
      cadence: 'NONE' as const,
      events: [],
      annualDividendPerShare: 0,
      lastExDate: null,
      lastAmount: 0,
      source: 'fallback' as const,
    };
  }

  const annualPerShare = asset.price * (asset.dividendYield / 100);
  const cadence: 'MONTHLY' | 'QUARTERLY' | 'SEMI_ANNUAL' = isKnownMonthlyDividendTicker(cleanTicker)
    ? 'MONTHLY'
    : isIdx
    ? 'SEMI_ANNUAL'
    : 'QUARTERLY';

  const today = new Date();
  const events: Array<{ date: string; timestamp: number; amount: number }> = [];

  if (cadence === 'MONTHLY') {
    const perEvent = Number((annualPerShare / 12).toFixed(4));
    for (let i = 11; i >= 0; i--) {
      const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - i, 24));
      events.push({
        date: d.toISOString().slice(0, 10),
        timestamp: d.getTime(),
        amount: perEvent,
      });
    }
  } else if (cadence === 'SEMI_ANNUAL') {
    const slots = [
      { monthOffset: 9, weight: 0.25 },
      { monthOffset: 3, weight: 0.75 },
    ];
    for (const s of slots) {
      const d = new Date(Date.UTC(today.getUTCFullYear() - (s.monthOffset > today.getUTCMonth() ? 1 : 0), s.monthOffset, 18));
      events.push({
        date: d.toISOString().slice(0, 10),
        timestamp: d.getTime(),
        amount: Number((annualPerShare * s.weight).toFixed(2)),
      });
    }
    events.sort((a, b) => a.timestamp - b.timestamp);
  } else {
    const perQ = Number((annualPerShare / 4).toFixed(4));
    for (let i = 3; i >= 0; i--) {
      const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - i * 3, 20));
      events.push({
        date: d.toISOString().slice(0, 10),
        timestamp: d.getTime(),
        amount: perQ,
      });
    }
  }

  const lastEv = events[events.length - 1] || null;
  return {
    ticker: cleanTicker,
    currency: nativeCurrency,
    cadence,
    events,
    annualDividendPerShare: Number(annualPerShare.toFixed(nativeCurrency === 'IDR' ? 2 : 4)),
    lastExDate: lastEv ? lastEv.date : null,
    lastAmount: lastEv ? lastEv.amount : 0,
    source: 'fallback' as const,
  };
}

async function fetchDirectYahooDividends(rawTicker: string) {
  const ticker = rawTicker.toUpperCase().trim();
  const cleanTicker = ticker.replace(/\.JK$/i, '');
  const yahooSymbol = resolveYahooSymbol(ticker);

  if (getCapacitorHttpPlugin()) {
    const json = await capacitorGetJson(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?range=2y&interval=1mo&events=div`,
      4500
    );
    const result = json?.chart?.result?.[0];
    const meta = result?.meta;
    const rawDivs = result?.events?.dividends || {};
    const events = Object.values(rawDivs)
      .map((ev: any) => ({
        date: new Date((ev.date || 0) * 1000).toISOString().slice(0, 10),
        timestamp: (ev.date || 0) * 1000,
        amount: Number(ev.amount || 0),
      }))
      .filter((ev) => ev.timestamp > 0 && ev.amount > 0)
      .sort((a, b) => a.timestamp - b.timestamp);

    if (result && (events.length > 0 || meta?.symbol)) {
      const oneYearAgo = Date.now() - 364 * 86400000;
      const trailingEvents = events.filter((e) => e.timestamp >= oneYearAgo);
      const count1Y = trailingEvents.length;
      const annualDividendPerShare = Number(
        trailingEvents.reduce((s, e) => s + e.amount, 0).toFixed(4)
      );
      let cadence: 'MONTHLY' | 'QUARTERLY' | 'SEMI_ANNUAL' | 'ANNUAL' | 'NONE' = 'NONE';
      if (count1Y >= 10) cadence = 'MONTHLY';
      else if (count1Y >= 3) cadence = 'QUARTERLY';
      else if (count1Y === 2) cadence = 'SEMI_ANNUAL';
      else if (count1Y === 1 || events.length > 0) cadence = 'ANNUAL';

      const lastEv = events[events.length - 1] || null;
      return {
        ticker: cleanTicker,
        currency: (meta?.currency === 'IDR' || yahooSymbol.endsWith('.JK') ? 'IDR' : 'USD') as 'IDR' | 'USD',
        cadence,
        events,
        annualDividendPerShare,
        lastExDate: lastEv ? lastEv.date : null,
        lastAmount: lastEv ? lastEv.amount : 0,
        source: 'live' as const,
      };
    }
  }

  return synthesizeCatalogDividendRecord(ticker);
}

async function bridgeDividendCalendar(searchParams: URLSearchParams) {
  const symbolsParam = (searchParams.get('symbols') || '').trim();
  if (!symbolsParam) {
    return { dividends: {}, updatedAt: new Date().toISOString() };
  }
  const requested = Array.from(
    new Set(
      symbolsParam
        .split(',')
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean)
    )
  ).slice(0, 40);

  const results = await Promise.all(requested.map((sym) => fetchDirectYahooDividends(sym)));
  const dividendsMap: Record<string, any> = {};
  results.forEach((info) => {
    dividendsMap[info.ticker] = info;
  });

  return {
    dividends: dividendsMap,
    updatedAt: new Date().toISOString(),
  };
}

// ---------- Local Quantitative Portfolio & Asset Analyzers (APK / Offline Engine) ----------
async function bridgeAnalyzePortfolio(body: any) {
  const lang: AppLanguage = body?.lang === 'en' ? 'en' : 'id';
  const isEn = lang === 'en';
  const rawPortfolio = Array.isArray(body?.portfolio)
    ? body.portfolio
    : Array.isArray(body?.metrics?.holdings)
    ? body.metrics.holdings
    : [];

  if (rawPortfolio.length === 0) {
    throw new Error(isEn ? 'Portfolio cannot be empty.' : 'Portofolio tidak boleh kosong.');
  }

  const fx = await fetchDirectLiveUsdIdrRate();
  const clientRate = Number(body?.usdIdrRate);
  const activeUsdIdr = fx.isLive
    ? fx.price
    : Number.isFinite(clientRate) && clientRate > 1000
    ? clientRate
    : fx.price;

  const riskProfile = body?.riskProfile || {};
  const profileName = String(riskProfile.name || (isEn ? 'Moderate' : 'Moderat'));
  const targetRangeStr = String(riskProfile.targetBetaRange || '0.85 - 1.10');
  const rangeMatches = targetRangeStr.match(/(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)/);
  const minTargetBeta = rangeMatches ? Number(rangeMatches[1]) : 0.85;
  const maxTargetBeta = rangeMatches ? Number(rangeMatches[2]) : 1.1;

  interface NormalizedQuantHolding {
    ticker: string;
    name: string;
    alloc: number;
    beta: number;
    return1Y: number;
    dividendYield: number;
    type: string;
    sector: string;
  }

  const normalizedHoldings: NormalizedQuantHolding[] = (rawPortfolio as any[]).map((item: any) => {
    const ticker = String(item.ticker || item.asset?.ticker || 'ASSET').toUpperCase();
    const cat = getAssetByTicker(ticker);
    const alloc = Math.max(0, Number(item.allocation ?? item.weight ?? 0));
    const beta = Number(item.beta ?? item.asset?.beta ?? cat?.beta ?? 1.0);
    const return1Y = Number(item.return1Y ?? item.asset?.return1Y ?? cat?.return1Y ?? 10.0);
    const dividendYield = Number(item.dividendYield ?? item.asset?.dividendYield ?? cat?.dividendYield ?? 0);
    const type = String(item.type || item.asset?.type || cat?.type || 'US_STOCK');
    const sector = String(item.sector || item.asset?.sector || cat?.sector || 'Equities');
    return { ticker, name: String(item.name || cat?.name || ticker), alloc, beta, return1Y, dividendYield, type, sector };
  });

  const sortedByAlloc = [...normalizedHoldings].sort((a, b) => b.alloc - a.alloc);
  const topHolding = sortedByAlloc[0];
  const highestBetaHolding = [...normalizedHoldings].sort((a, b) => b.beta - a.beta)[0];
  const totalAlloc = normalizedHoldings.reduce((s: number, h: NormalizedQuantHolding) => s + h.alloc, 0) || 100;

  let weightedBeta = 0;
  let weightedReturn1Y = 0;
  let weightedDiv = 0;
  let etfAlloc = 0;
  let idxAlloc = 0;
  let usdAlloc = 0;
  let hhi = 0;
  const sectorMap = new Map<string, number>();

  for (const h of normalizedHoldings) {
    const w = h.alloc / totalAlloc;
    weightedBeta += w * h.beta;
    weightedReturn1Y += w * h.return1Y;
    weightedDiv += w * h.dividendYield;
    if (h.type === 'ETF') etfAlloc += w * 100;
    if (h.type === 'IDX_STOCK') idxAlloc += w * 100;
    else usdAlloc += w * 100;
    hhi += w * w;
    sectorMap.set(h.sector, (sectorMap.get(h.sector) || 0) + w * 100);
  }

  let topSector = { sector: 'Global Equities', alloc: 0 };
  sectorMap.forEach((alloc, sector) => {
    if (alloc > topSector.alloc) topSector = { sector, alloc };
  });

  const actualBeta = Number((weightedBeta > 0 ? weightedBeta : 1.0).toFixed(2));
  const diversificationScore = Math.round(Math.max(15, Math.min(98, (1 - hhi) * 112)));
  const midTargetBeta = (minTargetBeta + maxTargetBeta) / 2;
  const betaDistance =
    actualBeta < minTargetBeta
      ? minTargetBeta - actualBeta
      : actualBeta > maxTargetBeta
      ? actualBeta - maxTargetBeta
      : 0;
  const riskScore = Math.round(Math.max(25, Math.min(98, 94 - betaDistance * 55)));
  const returnScore = Math.round(Math.max(30, Math.min(98, 56 + weightedReturn1Y * 0.9)));
  const divBonus = Math.min(10, weightedDiv * 2);
  const rawHealthScore = Math.round(
    Math.max(28, Math.min(98, riskScore * 0.4 + diversificationScore * 0.35 + returnScore * 0.25 + divBonus * 0.25))
  );

  const predikat =
    rawHealthScore >= 90
      ? 'A+'
      : rawHealthScore >= 82
      ? 'A'
      : rawHealthScore >= 75
      ? 'B+'
      : rawHealthScore >= 65
      ? 'B'
      : rawHealthScore >= 52
      ? 'C'
      : 'D';

  const betaStatus =
    actualBeta > maxTargetBeta
      ? 'above'
      : actualBeta < minTargetBeta
      ? 'below'
      : 'aligned';

  const projectedTargetBeta =
    actualBeta > maxTargetBeta
      ? Number(Math.max(midTargetBeta, actualBeta * 0.84).toFixed(2))
      : actualBeta < minTargetBeta
      ? Number(Math.min(midTargetBeta, actualBeta * 1.12).toFixed(2))
      : actualBeta;

  const numLocale = isEn ? 'en-US' : 'id-ID';
  const formattedRate = Math.round(activeUsdIdr).toLocaleString(numLocale);
  const hasDualCurrency = idxAlloc >= 8 && usdAlloc >= 8;
  const isOverConcentrated = topHolding && topHolding.alloc > 25;
  const needsEtf = etfAlloc < 20;

  const drawdownDeltaPct = Math.max(8, Math.min(30, Math.round(Math.abs(actualBeta - projectedTargetBeta) * 45 + (isOverConcentrated ? 8 : 5))));
  const divDeltaPts = Math.max(4, Math.min(24, Math.round((100 - diversificationScore) * 0.45)));

  const saranOptimasiKonkret: any[] = [];
  if (isOverConcentrated) {
    saranOptimasiKonkret.push(
      isEn
        ? {
            tindakan: 'TRIM',
            ticker: topHolding.ticker,
            persentase: `Trim ${Math.min(12, Math.max(4, Math.round(topHolding.alloc - 22)))}%`,
            alasan: `${topHolding.ticker} represents ${topHolding.alloc.toFixed(1)}% of capital, elevating single-asset drawdown exposure.`,
          }
        : {
            tindakan: 'PANGKAS',
            ticker: topHolding.ticker,
            persentase: `Kurangi ${Math.min(12, Math.max(4, Math.round(topHolding.alloc - 22)))}%`,
            alasan: `${topHolding.ticker} mendominasi ${topHolding.alloc.toFixed(1)}% modal, sehingga meningkatkan risiko konsentrasi tunggal.`,
          }
    );
  }
  if (betaStatus === 'above' || needsEtf) {
    const anchorTickers = idxAlloc > 60 ? 'BBCA / BBRI' : 'VOO / SCHD';
    saranOptimasiKonkret.push(
      isEn
        ? {
            tindakan: 'ADD',
            ticker: anchorTickers,
            persentase: 'Add 10-15%',
            alasan: `Lower portfolio beta from ${actualBeta} toward ${profileName} range (${targetRangeStr}) and strengthen defensive cash flow.`,
          }
        : {
            tindakan: 'TAMBAH',
            ticker: anchorTickers,
            persentase: 'Tambah 10-15%',
            alasan: `Menurunkan beta portofolio (${actualBeta}) menuju rentang ideal ${profileName} (${targetRangeStr}) serta memperkuat dividen defensif.`,
          }
    );
  } else if (betaStatus === 'below') {
    saranOptimasiKonkret.push(
      isEn
        ? {
            tindakan: 'ADD',
            ticker: 'QQQ / NVDA',
            persentase: 'Add 8-12%',
            alasan: `Current beta (${actualBeta}) sits below your ${profileName} growth band (${targetRangeStr}); adding selective growth boosts return velocity.`,
          }
        : {
            tindakan: 'TAMBAH',
            ticker: 'QQQ / NVDA',
            persentase: 'Tambah 8-12%',
            alasan: `Beta saat ini (${actualBeta}) di bawah target agresivitas ${profileName} (${targetRangeStr}); porsi aset bertumbuh dapat mengoptimalkan imbal hasil.`,
          }
    );
  }
  if (saranOptimasiKonkret.length < 3) {
    saranOptimasiKonkret.push(
      isEn
        ? {
            tindakan: 'REBALANCE',
            ticker: topSector.alloc > 40 ? `${topSector.sector} Rotation` : 'Core-Satellite Weights',
            persentase: 'Target ±5% band',
            alasan: `Maintain disciplined weighting across ${normalizedHoldings.length} positions with USD/IDR around Rp ${formattedRate}.`,
          }
        : {
            tindakan: 'REBALANCE',
            ticker: topSector.alloc > 40 ? `Rotasi ${topSector.sector}` : 'Bobot Inti-Satelit',
            persentase: 'Toleransi ±5%',
            alasan: `Pertahankan keseimbangan antar ${normalizedHoldings.length} aset di tengah kurs USD/IDR kisaran Rp ${formattedRate}.`,
          }
    );
  }

  return isEn
    ? {
        source: 'algorithm',
        skorKesehatan: rawHealthScore,
        predikat,
        ringkasanEksekutif: `Quant audit across ${normalizedHoldings.length} holdings shows a weighted beta of ${actualBeta}, 1Y historical return of ${weightedReturn1Y.toFixed(1)}%, and a ${weightedDiv.toFixed(1)}% dividend yield. ${
          betaStatus === 'aligned'
            ? `Overall risk posture aligns well with your ${profileName} mandate.`
            : betaStatus === 'above'
            ? `Portfolio volatility runs hotter than your ${profileName} ceiling (${maxTargetBeta}), led by ${highestBetaHolding?.ticker || topHolding?.ticker}.`
            : `Portfolio volatility sits below your ${profileName} target (${targetRangeStr}), leaving upside growth capacity unused.`
        }`,
        analisisKesesuaianProfil: `For the ${profileName} profile (target beta ${targetRangeStr}), your measured beta is ${actualBeta} with a diversification score of ${diversificationScore}/100. Top holding ${topHolding?.ticker || 'Asset'} accounts for ${topHolding?.alloc.toFixed(1) || 0}% while ${topSector.sector} carries ${topSector.alloc.toFixed(1)}% sector exposure.`,
        kekuatanPortofolio: [
          weightedReturn1Y >= 12
            ? `Strong 1Y weighted momentum (${weightedReturn1Y.toFixed(1)}%) driven by core market leaders.`
            : `Measured risk profile keeping drawdown swings contained across ${normalizedHoldings.length} assets.`,
          hasDualCurrency
            ? `Natural USD/IDR dual-currency hedge (${usdAlloc.toFixed(0)}% USD vs ${idxAlloc.toFixed(0)}% IDX) at Rp ${formattedRate}/USD.`
            : `Clear capital focus allowing streamlined monitoring at live USD/IDR Rp ${formattedRate}.`,
          weightedDiv >= 1.8
            ? `Portfolio generates ~${weightedDiv.toFixed(2)}% annual dividend yield for recurring cash flow.`
            : `High market liquidity enables quick portfolio rebalancing with minimal slippage.`,
        ],
        kelemahanDanRisiko: [
          isOverConcentrated
            ? `Single-asset concentration: ${topHolding.ticker} at ${topHolding.alloc.toFixed(1)}% exceeds recommended 25% prudent cap.`
            : `Sector exposure led by ${topSector.sector} (${topSector.alloc.toFixed(1)}%) remains sensitive to macro cycle shifts.`,
          highestBetaHolding && highestBetaHolding.beta > 1.35
            ? `High-beta sensitivity in ${highestBetaHolding.ticker} (beta ${highestBetaHolding.beta.toFixed(2)}) can amplify short-term pullbacks.`
            : `Interest-rate and USD/IDR volatility can affect short-term cross-market valuation multiples.`,
          needsEtf
            ? `Core broad-market ETF sleeve is only ${etfAlloc.toFixed(1)}%, below optimal shock-absorber levels.`
            : `Periodic rebalancing discipline is required as winners drift past target weights.`,
        ],
        saranOptimasiKonkret,
        proyeksiHasilOptimasi: {
          betaSebelum: actualBeta,
          betaSesudah: projectedTargetBeta,
          penurunanRisikoDrawdown: `${drawdownDeltaPct}% lower drawdown sensitivity`,
          skorDiversifikasiNaik: `+${divDeltaPts} pts`,
        },
        pandanganTrenPasarTerkait: `With Fed Funds at 3.75%-4.00%, BI-Rate at 5.75%, and USD/IDR near Rp ${formattedRate}, balancing AI/growth equities against profitable IDX blue-chips and broad ETFs preserves resilient risk-adjusted returns.`,
      }
    : {
        source: 'algorithm',
        skorKesehatan: rawHealthScore,
        predikat,
        ringkasanEksekutif: `Audit kuantitatif atas ${normalizedHoldings.length} aset mencatat beta tertimbang ${actualBeta}, return historis 1 tahun ${weightedReturn1Y.toFixed(1)}%, dan dividend yield ${weightedDiv.toFixed(1)}%. ${
          betaStatus === 'aligned'
            ? `Profil risiko portofolio sudah selaras dengan target ${profileName}.`
            : betaStatus === 'above'
            ? `Volatilitas portofolio melampaui batas profil ${profileName} (${maxTargetBeta}), dipicu bobot ${highestBetaHolding?.ticker || topHolding?.ticker}.`
            : `Eksposur risiko masih di bawah rentang target ${profileName} (${targetRangeStr}), menyisakan ruang akselerasi pertumbuhan.`
        }`,
        analisisKesesuaianProfil: `Untuk profil ${profileName} (target beta ${targetRangeStr}), beta terukur berada di ${actualBeta} dengan skor diversifikasi ${diversificationScore}/100. Posisi terbesar ${topHolding?.ticker || 'Aset'} berbobot ${topHolding?.alloc.toFixed(1) || 0}% dengan eksposur sektor utama ${topSector.sector} (${topSector.alloc.toFixed(1)}%).`,
        kekuatanPortofolio: [
          weightedReturn1Y >= 12
            ? `Momentum imbal hasil 1 tahun terukur kuat (${weightedReturn1Y.toFixed(1)}%) ditopang emiten pemimpin pasar.`
            : `Struktur portofolio terukur menjaga kestabilan nilai pada ${normalizedHoldings.length} instrumen aktif.`,
          hasDualCurrency
            ? `Lindung nilai dua mata uang alami (${usdAlloc.toFixed(0)}% USD vs ${idxAlloc.toFixed(0)}% IDX) pada kurs Rp ${formattedRate}/USD.`
            : `Konsentrasi fokus memudahkan pemantauan eksekusi di tengah kurs USD/IDR Rp ${formattedRate}.`,
          weightedDiv >= 1.8
            ? `Menghasilkan estimasi dividen ${weightedDiv.toFixed(2)}% per tahun sebagai arus kas pasif.`
            : `Likuiditas institusional tinggi memudahkan eksekusi rebalancing kapan saja.`,
        ],
        kelemahanDanRisiko: [
          isOverConcentrated
            ? `Konsentrasi aset tunggal: porsi ${topHolding.ticker} (${topHolding.alloc.toFixed(1)}%) melampaui ambang aman 25%.`
            : `Dominasi sektor ${topSector.sector} (${topSector.alloc.toFixed(1)}%) rentan terhadap rotasi siklus pasar.`,
          highestBetaHolding && highestBetaHolding.beta > 1.35
            ? `Saham ber-beta tinggi ${highestBetaHolding.ticker} (beta ${highestBetaHolding.beta.toFixed(2)}) memperbesar ayunan koreksi.`
            : `Sensitivitas suku bunga acuan dan fluktuasi USD/IDR memengaruhi valuasi aset lintas bursa.`,
          needsEtf
            ? `Porsi ETF broad-market baru ${etfAlloc.toFixed(1)}%, sehingga bantalan penahan gejolak pasar masih tipis.`
            : `Membutuhkan disiplin rebalancing berkala saat bobot pemenang melampaui target awal.`,
        ],
        saranOptimasiKonkret,
        proyeksiHasilOptimasi: {
          betaSebelum: actualBeta,
          betaSesudah: projectedTargetBeta,
          penurunanRisikoDrawdown: `${drawdownDeltaPct}% lebih tahan koreksi pasar`,
          skorDiversifikasiNaik: `+${divDeltaPts} poin`,
        },
        pandanganTrenPasarTerkait: `Di tengah Fed Rate 3,75%-4,00%, BI-Rate 5,75%, serta USD/IDR di kisaran Rp ${formattedRate}, memadukan saham bertumbuh dengan bank bluechip IDX atau ETF dividen menjadi strategi penyeimbang risiko paling efektif.`,
      };
}

async function bridgeAnalyzeAsset(body: any) {
  const lang: AppLanguage = body?.lang === 'en' ? 'en' : 'id';
  const isEn = lang === 'en';
  const numLocale = isEn ? 'en-US' : 'id-ID';
  const asset = body?.asset;
  const holding = body?.holding;
  const riskProfile = body?.riskProfile;

  if (!asset || !asset.ticker) {
    throw new Error(isEn ? 'Invalid asset payload.' : 'Data aset tidak valid.');
  }

  // Enrich live quote via CapacitorHttp if running in Capacitor APK
  const liveQuote = await fetchDirectQuote(
    asset.type === 'IDX_STOCK' && !String(asset.ticker).toUpperCase().endsWith('.JK')
      ? `${String(asset.ticker).toUpperCase()}.JK`
      : String(asset.ticker).toUpperCase()
  );

  const effectivePrice =
    liveQuote.isLiveFound && liveQuote.price > 0
      ? liveQuote.price
      : typeof asset.price === 'number' && asset.price > 0
      ? asset.price
      : 100;

  const safeBeta = typeof asset.beta === 'number' ? asset.beta : 1.0;
  const safeReturn1Y = typeof asset.return1Y === 'number' ? asset.return1Y : 10.0;
  const safeDividend = typeof asset.dividendYield === 'number' ? asset.dividendYield : 0;
  const safeSector = asset.sector || (isEn ? 'Global Capital Markets' : 'Pasar Modal Global');
  const safeName = asset.name || asset.ticker;
  const isUsd = asset.currency === 'USD';
  const currSymbol = isUsd ? '$' : 'Rp ';

  const dipDiscount = Math.min(0.11, Math.max(0.05, 0.04 + safeBeta * 0.025));
  const upsideTarget = Math.min(0.24, Math.max(0.10, 0.08 + safeBeta * 0.045));

  const targetEntryPrice = isUsd
    ? Number((effectivePrice * (1 - dipDiscount)).toFixed(effectivePrice < 5 ? 4 : 2))
    : Math.round(effectivePrice * (1 - dipDiscount));
  const targetExitPrice = isUsd
    ? Number((effectivePrice * (1 + upsideTarget)).toFixed(effectivePrice < 5 ? 4 : 2))
    : Math.round(effectivePrice * (1 + upsideTarget));

  const fairLow = isUsd
    ? `$${(effectivePrice * 0.94).toFixed(effectivePrice < 5 ? 2 : 1)}`
    : `Rp ${Math.round(effectivePrice * 0.94).toLocaleString(numLocale)}`;
  const fairHigh = isUsd
    ? `$${(effectivePrice * (1 + upsideTarget * 0.85)).toFixed(effectivePrice < 5 ? 2 : 1)}`
    : `Rp ${Math.round(effectivePrice * (1 + upsideTarget * 0.85)).toLocaleString(numLocale)}`;

  const peNote =
    typeof asset.peRatio === 'number'
      ? `P/E ${asset.peRatio}x`
      : typeof asset.expenseRatio === 'number'
      ? `Expense Ratio ${asset.expenseRatio}%`
      : 'ETF / Equity';

  let unrealizedPct: number | null = null;
  if (holding && holding.shares > 0 && holding.avgBuyPrice > 0) {
    const fx = await fetchDirectLiveUsdIdrRate();
    const rate = body?.usdIdrRate && Number(body.usdIdrRate) > 1000 ? Number(body.usdIdrRate) : fx.price;
    const avgInAssetCurr =
      holding.buyCurrency === asset.currency
        ? holding.avgBuyPrice
        : holding.buyCurrency === 'USD' && asset.currency === 'IDR'
        ? holding.avgBuyPrice * rate
        : holding.avgBuyPrice / rate;
    if (avgInAssetCurr > 0) {
      unrealizedPct = ((effectivePrice - avgInAssetCurr) / avgInAssetCurr) * 100;
    }
  }

  const isHighBeta = safeBeta > 1.3;
  const isDividend = safeDividend >= 2.0;
  const profileMaxBeta = Number(riskProfile?.maxTargetBeta ?? 1.15);
  const fitsProfile = safeBeta <= profileMaxBeta + 0.15;

  const rekomendasi =
    unrealizedPct !== null && unrealizedPct > 35 && isHighBeta
      ? isEn
        ? 'TRIM / TAKE PROFIT'
        : 'PANGKAS / AMANKAN PROFIT'
      : isHighBeta && !fitsProfile
      ? isEn
        ? 'WAIT FOR DIP'
        : 'TUNGGU KOREKSI'
      : isDividend || fitsProfile
      ? isEn
        ? 'BUY / ACCUMULATE'
        : 'BELI / AKUMULASI'
      : isEn
      ? 'HOLD'
      : 'TAHAN (HOLD)';

  const sentimen =
    safeReturn1Y >= 20
      ? isEn
        ? 'Very Bullish'
        : 'Sangat Bullish'
      : safeReturn1Y >= 6
      ? 'Bullish'
      : isHighBeta
      ? isEn
        ? 'Cautious / Defensive'
        : 'Hati-hati / Defensif'
      : isEn
      ? 'Neutral'
      : 'Netral';

  if (isEn) {
    return {
      source: 'algorithm',
      rekomendasi,
      sentimen,
      ringkasanEksekutif: `${safeName} (${asset.ticker}) trades at ${currSymbol}${effectivePrice.toLocaleString(numLocale)} (${peNote}, beta ${safeBeta}) in ${safeSector}. With a 1Y trajectory of ${safeReturn1Y}%${safeDividend > 0 ? ` and a ${safeDividend}% yield` : ''}, its quantitative risk-reward posture supports disciplined sizing.`,
      estimasiHargaWajar: {
        rentangNilai: `${fairLow} - ${fairHigh}`,
        statusValuasi:
          typeof asset.peRatio === 'number' && asset.peRatio > 32
            ? 'Premium Growth Multiple'
            : isHighBeta
            ? 'Elevated Beta Valuation'
            : 'Fair Value Zone',
      },
      katalisPositif: [
        `Sustained competitive positioning across ${safeSector} supporting institutional capital flows.`,
        safeDividend > 0
          ? `Recurring ${safeDividend}% annual dividend yield bolsters total return through volatility.`
          : 'Reinvested earnings expand long-term market share and operating leverage.',
        `Trailing 1Y momentum of ${safeReturn1Y}% backed by liquid market depth (${asset.marketCap || 'Large-Cap'}).`,
      ],
      risikoDanTantangan: [
        'Sensitivity to US Fed / Bank Indonesia rate trajectories and USD/IDR swings.',
        isHighBeta
          ? `High beta (${safeBeta}) amplifies drawdowns during broad risk-off rotations.`
          : 'Mature capitalization pace can moderate near-term multiple expansion.',
        `Sector-specific competition and regulatory shifts within ${safeSector}.`,
      ],
      kesesuaianProfil: fitsProfile
        ? `Well-aligned for your ${riskProfile?.name || 'Moderate'} profile (beta ${safeBeta}); sizing 5%-15% preserves healthy portfolio balance.`
        : `Volatility (beta ${safeBeta}) runs hotter than the ${riskProfile?.name || 'Moderate'} ceiling (${profileMaxBeta}); cap position size under 10% or pair with core ETFs.`,
      saranStrategi: `${
        unrealizedPct !== null
          ? `Current position sits at ${unrealizedPct >= 0 ? '+' : ''}${unrealizedPct.toFixed(1)}% unrealized P&L. `
          : ''
      }Stage limit buys (DCA) near ${currSymbol}${targetEntryPrice.toLocaleString(numLocale)} support and scale out partial profits approaching ${currSymbol}${targetExitPrice.toLocaleString(numLocale)}.`,
      targetEntryPrice,
      targetExitPrice,
    };
  }

  return {
    source: 'algorithm',
    rekomendasi,
    sentimen,
    ringkasanEksekutif: `${safeName} (${asset.ticker}) diperdagangkan di ${currSymbol}${effectivePrice.toLocaleString(numLocale)} (${peNote}, beta ${safeBeta}) pada sektor ${safeSector}. Dengan rekam jejak 1 tahun ${safeReturn1Y}%${safeDividend > 0 ? ` dan dividen ${safeDividend}%` : ''}, profil risk-reward instrumen ini menarik dengan ukuran posisi terukur.`,
    estimasiHargaWajar: {
      rentangNilai: `${fairLow} - ${fairHigh}`,
      statusValuasi:
        typeof asset.peRatio === 'number' && asset.peRatio > 32
          ? 'Valuasi Growth Premium'
          : isHighBeta
          ? 'Valuasi Sensitif Volatilitas'
          : 'Area Harga Wajar (Fair Value)',
    },
    katalisPositif: [
      `Posisi kompetitif kokoh di sektor ${safeSector} yang menjaga minat dana institusional.`,
      safeDividend > 0
        ? `Dividend yield ${safeDividend}% per tahun memberi bantalan arus kas saat pasar bergejolak.`
        : 'Reinvestasi laba terus memperkuat ekspansi pangsa pasar jangka panjang.',
      `Kinerja 1 tahun ${safeReturn1Y}% didukung likuiditas transaksi prima (${asset.marketCap || 'Kapitalisasi Besar'}).`,
    ],
    risikoDanTantangan: [
      'Sensitivitas terhadap arah kebijakan suku bunga global dan nilai tukar USD/IDR.',
      isHighBeta
        ? `Beta tinggi (${safeBeta}) membuat penurunan harian lebih tajam saat rotasi risk-off terjadi.`
        : 'Laju pertumbuhan laba relatif moderat karena skala kapitalisasi pasar sudah besar.',
      `Dinamika persaingan industri serta risiko regulasi di sektor ${safeSector}.`,
    ],
    kesesuaianProfil: fitsProfile
      ? `Sesuai untuk profil ${riskProfile?.name || 'Moderat'} (beta ${safeBeta}); alokasi ideal 5%-15% dari total portofolio.`
      : `Volatilitas aset (beta ${safeBeta}) lebih agresif dari batas profil ${riskProfile?.name || 'Moderat'} (${profileMaxBeta}); batasi porsi maksimal 10% atau imbangi dengan ETF defensif.`,
    saranStrategi: `${
      unrealizedPct !== null
        ? `Posisi Anda saat ini mencatat P&L belum terealisasi ${unrealizedPct >= 0 ? '+' : ''}${unrealizedPct.toFixed(1)}%. `
        : ''
    }Terapkan akumulasi bertahap (DCA) di area support ${currSymbol}${targetEntryPrice.toLocaleString(numLocale)} dan pertimbangkan take profit sebagian mendekati ${currSymbol}${targetExitPrice.toLocaleString(numLocale)}.`,
    targetEntryPrice,
    targetExitPrice,
  };
}

async function resolveLocalBridge<T>(pathAndQuery: string, init?: RequestInit): Promise<SafeJsonResult<T>> {
  const urlObj = new URL(pathAndQuery, 'https://portolens.local');
  const pathname = urlObj.pathname;
  const searchParams = urlObj.searchParams;

  let body: any = undefined;
  if (init?.body && typeof init.body === 'string') {
    try {
      body = JSON.parse(init.body);
    } catch {
      body = undefined;
    }
  }

  try {
    let data: any;
    if (pathname === '/api/live-quotes') {
      data = await bridgeLiveQuotes(searchParams);
    } else if (pathname === '/api/detect-ticker') {
      data = await bridgeDetectTicker(searchParams);
    } else if (pathname === '/api/market-trends') {
      data = await bridgeMarketTrends(searchParams);
    } else if (pathname === '/api/benchmark-history') {
      data = await bridgeBenchmarkHistory(searchParams);
    } else if (pathname === '/api/dividend-calendar') {
      data = await bridgeDividendCalendar(searchParams);
    } else if (pathname === '/api/analyze-portfolio') {
      data = await bridgeAnalyzePortfolio(body);
    } else if (pathname === '/api/analyze-asset') {
      data = await bridgeAnalyzeAsset(body);
    } else {
      return {
        ok: false,
        status: 404,
        data: null,
        isHtml: false,
        errorMessage: 'Local APK bridge route not found.',
      };
    }

    return {
      ok: true,
      status: 200,
      data: data as T,
      isHtml: false,
    };
  } catch (err: any) {
    return {
      ok: false,
      status: 400,
      data: null,
      isHtml: false,
      errorMessage: err?.message || 'Offline bridge error.',
    };
  }
}

function withRequestTimeout(init: RequestInit | undefined, timeoutMs: number): {
  finalInit: RequestInit;
  cleanup: () => void;
} {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const callerSignal = init?.signal;
  const onAbort = () => controller.abort();
  if (callerSignal) {
    if (callerSignal.aborted) {
      controller.abort();
    } else {
      callerSignal.addEventListener('abort', onAbort, { once: true });
    }
  }

  return {
    finalInit: {
      ...init,
      signal: controller.signal,
    },
    cleanup: () => {
      clearTimeout(timer);
      if (callerSignal) {
        callerSignal.removeEventListener('abort', onAbort);
      }
    },
  };
}

/**
 * Unified API fetcher for both hosted Express mode and standalone APK / offline mode:
 * 1. If a hosted Express backend (explicit VITE_API_BASE_URL or same-origin Express) responds with JSON, use it.
 * 2. In packaged APKs (file://, capacitor://, static https://localhost without Node/Express, or offline),
 *    seamlessly switch to the client-side APK bridge with live CORS FX APIs, optional CapacitorHttp Yahoo calls,
 *    and the local quantitative engine — zero HTML/JSON parse errors or dead network loops.
 */
export async function fetchAppApi<T = any>(
  pathAndQuery: string,
  init?: RequestInit
): Promise<SafeJsonResult<T>> {
  const normalizedPath = pathAndQuery.startsWith('/') ? pathAndQuery : `/${pathAndQuery}`;
  const explicitBase = getConfiguredApiBaseUrl();
  const hasExplicitBase = Boolean(explicitBase);

  const canTryBackend =
    hasExplicitBase ||
    (!isPackagedNonHttpOrigin() && Date.now() >= sameOriginUnavailableUntil);

  if (canTryBackend && !init?.signal?.aborted) {
    const targetUrl = hasExplicitBase ? `${explicitBase}${normalizedPath}` : normalizedPath;
    const isPost = (init?.method || 'GET').toUpperCase() === 'POST';
    const { finalInit, cleanup } = withRequestTimeout(init, isPost ? 14_000 : 6_500);
    try {
      const result = await fetchJsonSafe<T>(targetUrl, finalInit);
      if (result.ok && result.data) {
        if (!hasExplicitBase) {
          sameOriginUnavailableUntil = 0;
        }
        return result;
      }

      // If caller aborted explicitly, propagate clean abort failure
      if (init?.signal?.aborted) {
        return result;
      }

      // If Express returned a real client validation 4xx error (not 404/405 SPA route miss & not HTML), surface it cleanly
      const isStaticHostMiss =
        result.isHtml ||
        result.status === 404 ||
        result.status === 405;
      const isConnectivityOrServerFailure =
        result.status === 0 ||
        result.status >= 500;

      if (!hasExplicitBase) {
        if (isStaticHostMiss) {
          sameOriginUnavailableUntil = Date.now() + EXPRESS_HTML_COOLDOWN_MS;
        } else if (isConnectivityOrServerFailure) {
          sameOriginUnavailableUntil = Date.now() + EXPRESS_NET_COOLDOWN_MS;
        }
      }

      if (!isStaticHostMiss && !isConnectivityOrServerFailure && result.status >= 400 && result.status < 500) {
        return result;
      }
    } finally {
      cleanup();
    }
  }

  return resolveLocalBridge<T>(normalizedPath, init);
}

/**
 * Helper for tests/debugging: resets same-origin backend availability cache.
 */
export function resetApiBridgeCooldown() {
  sameOriginUnavailableUntil = 0;
}

import type { AppLanguage } from '../i18n/LanguageContext';
export type { AppLanguage };

export interface Asset {
  ticker: string;
  name: string;
  type: 'US_STOCK' | 'IDX_STOCK' | 'ETF';
  sector: string;
  currency: 'USD' | 'IDR';
  price: number;
  change1D: number;
  return1Y: number;
  return3Y: number;
  beta: number;
  dividendYield: number;
  peRatio?: number;
  expenseRatio?: number;
  marketCap: string;
  riskRating: 'Rendah' | 'Moderat' | 'Tinggi' | 'Sangat Tinggi';
  history12M: number[]; // relative price monthly normalized to 100
  description: string;
}

export interface PortfolioHolding {
  id: string;
  ticker: string;
  shares: number;
  avgBuyPrice: number;
  buyCurrency: 'USD' | 'IDR';
}

export interface PriceAlert {
  id: string;
  ticker: string;
  assetName: string;
  type: 'ENTRY' | 'EXIT'; // Target Entry (Beli) atau Target Exit (Jual / Take Profit / Stop Loss)
  condition: 'ABOVE_OR_EQUAL' | 'BELOW_OR_EQUAL';
  targetPrice: number;
  currentPriceAtCreation: number;
  currency: 'USD' | 'IDR';
  note?: string;
  status: 'ACTIVE' | 'TRIGGERED' | 'DISMISSED';
  createdAt: string;
  triggeredAt?: string;
  isRead?: boolean;
}

export interface RiskProfile {
  id: 'konservatif' | 'moderat' | 'agresif' | 'sangat_agresif';
  name: string;
  subtitle: string;
  description: string;
  volatilityTolerance: string;
  targetBetaRange: string;
  maxTargetBeta: number;
  minTargetBeta: number;
  maxSingleAssetAllocation: number; // e.g. 15%
  maxSingleSectorAllocation: number; // e.g. 35%
  suggestedEtfWeight: number; // e.g. 40%
  color: string;
}

export const USD_TO_IDR_RATE = 18220;

export const RISK_PROFILES: Record<string, RiskProfile> = {
  konservatif: {
    id: 'konservatif',
    name: 'Konservatif',
    subtitle: 'Prioritas Keamanan Modal & Pendapatan Dividen',
    description: 'Fokus mempertahankan modal, meminimalkan risiko penurunan, mengutamakan dividen rutin dan ETF indeks defensif.',
    volatilityTolerance: 'Rendah (Maks penurunan sementara < 8%)',
    targetBetaRange: '0.60 - 0.85',
    minTargetBeta: 0.6,
    maxTargetBeta: 0.85,
    maxSingleAssetAllocation: 15,
    maxSingleSectorAllocation: 30,
    suggestedEtfWeight: 50,
    color: '#10b981', // Emerald
  },
  moderat: {
    id: 'moderat',
    name: 'Moderat',
    subtitle: 'Keseimbangan Pertumbuhan & Kontrol Risiko',
    description: 'Menyeimbangkan pertumbuhan modal jangka panjang dengan diversifikasi sektor dan instrumen defensif.',
    volatilityTolerance: 'Menengah (Toleransi fluktuasi 10% - 15%)',
    targetBetaRange: '0.85 - 1.10',
    minTargetBeta: 0.85,
    maxTargetBeta: 1.1,
    maxSingleAssetAllocation: 20,
    maxSingleSectorAllocation: 40,
    suggestedEtfWeight: 35,
    color: '#06b6d4', // Cyan
  },
  agresif: {
    id: 'agresif',
    name: 'Agresif',
    subtitle: 'Maksimalkan Pertumbuhan Modal Jangka Panjang',
    description: 'Mengejar imbal hasil tinggi dari saham pertumbuhan AS dan Indonesia, siap menerima volatilitas lebih besar.',
    volatilityTolerance: 'Tinggi (Toleransi koreksi 20% - 25%)',
    targetBetaRange: '1.10 - 1.35',
    minTargetBeta: 1.1,
    maxTargetBeta: 1.35,
    maxSingleAssetAllocation: 25,
    maxSingleSectorAllocation: 50,
    suggestedEtfWeight: 20,
    color: '#f59e0b', // Amber
  },
  sangat_agresif: {
    id: 'sangat_agresif',
    name: 'Sangat Agresif',
    subtitle: 'Fokus Penuh pada Inovasi & Momentum Spekulatif',
    description: 'Konsentrasi pada saham teknologi terdepan, disrupsi AI, dan momentum tanpa banyak instrumen penahan.',
    volatilityTolerance: 'Sangat Tinggi (Fluktuasi > 30% wajar)',
    targetBetaRange: '1.35 - 1.80',
    minTargetBeta: 1.35,
    maxTargetBeta: 1.8,
    maxSingleAssetAllocation: 35,
    maxSingleSectorAllocation: 65,
    suggestedEtfWeight: 10,
    color: '#ef4444', // Red
  },
};

export const RISK_PROFILES_EN: Record<string, RiskProfile> = {
  konservatif: {
    ...RISK_PROFILES.konservatif,
    name: 'Conservative',
    subtitle: 'Capital Preservation & Dividend Income Priority',
    description:
      'Focuses on capital preservation, minimizing downside risk, prioritizing steady dividends and defensive index ETFs.',
    volatilityTolerance: 'Low (Max drawdown tolerance < 8%)',
  },
  moderat: {
    ...RISK_PROFILES.moderat,
    name: 'Moderate',
    subtitle: 'Balanced Growth & Risk Control',
    description:
      'Balances long-term capital appreciation with sector diversification and defensive dividend holdings.',
    volatilityTolerance: 'Medium (10% - 15% volatility tolerance)',
  },
  agresif: {
    ...RISK_PROFILES.agresif,
    name: 'Aggressive',
    subtitle: 'Maximize Long-Term Capital Growth',
    description:
      'Pursues strong returns from US & Indonesian growth equities while accepting higher market swings.',
    volatilityTolerance: 'High (20% - 25% drawdown tolerance)',
  },
  sangat_agresif: {
    ...RISK_PROFILES.sangat_agresif,
    name: 'Very Aggressive',
    subtitle: 'Full Focus on Innovation & High-Beta Momentum',
    description:
      'Concentrated in frontier tech, AI disruption, and momentum leaders with minimal defensive buffer.',
    volatilityTolerance: 'Very High (> 30% volatility expected)',
  },
};

export function getLocalizedRiskProfile(
  profileId: string,
  lang: AppLanguage = 'id'
): RiskProfile {
  const dict = lang === 'en' ? RISK_PROFILES_EN : RISK_PROFILES;
  return dict[profileId] || dict.moderat;
}

export function getLocalizedRiskProfiles(lang: AppLanguage = 'id'): RiskProfile[] {
  const dict = lang === 'en' ? RISK_PROFILES_EN : RISK_PROFILES;
  return Object.values(dict);
}

import { CATALOG_ASSETS } from './assetsCatalog';

export const AVAILABLE_ASSETS: Asset[] = CATALOG_ASSETS;


export interface PresetPortfolio {
  id: string;
  name: string;
  badge: string;
  description: string;
  recommendedRiskProfile: 'konservatif' | 'moderat' | 'agresif' | 'sangat_agresif';
  holdings: { ticker: string; shares: number; avgBuyPrice: number; buyCurrency: 'USD' | 'IDR' }[];
}

export const PRESET_PORTFOLIOS: PresetPortfolio[] = [
  {
    id: 'tech_us_growth',
    name: 'Wall Street Mega-Cap Tech',
    badge: 'Pertumbuhan Tinggi',
    description: 'Portofolio saham teknologi AS terkemuka (Nvidia, Microsoft, Apple, Amazon) ditambah ETF QQQ untuk menangkap tren AI global.',
    recommendedRiskProfile: 'agresif',
    holdings: [
      { ticker: 'NVDA', shares: 25, avgBuyPrice: 138.0, buyCurrency: 'USD' },
      { ticker: 'MSFT', shares: 8, avgBuyPrice: 475.0, buyCurrency: 'USD' },
      { ticker: 'AAPL', shares: 12, avgBuyPrice: 315.0, buyCurrency: 'USD' },
      { ticker: 'QQQ', shares: 10, avgBuyPrice: 605.0, buyCurrency: 'USD' },
      { ticker: 'AMZN', shares: 15, avgBuyPrice: 225.0, buyCurrency: 'USD' },
    ],
  },
  {
    id: 'balanced_indo_us',
    name: 'Global & Bluechip RI Balanced',
    badge: 'All-Weather Seimbang',
    description: 'Kombinasi bank pilar Indonesia (BBCA, BBRI), indeks S&P 500 (VOO), dan emas (GLD) untuk kestabilan jangka panjang.',
    recommendedRiskProfile: 'moderat',
    holdings: [
      { ticker: 'BBCA', shares: 4500, avgBuyPrice: 5250, buyCurrency: 'IDR' },
      { ticker: 'BBRI', shares: 6000, avgBuyPrice: 2950, buyCurrency: 'IDR' },
      { ticker: 'VOO', shares: 6, avgBuyPrice: 625.0, buyCurrency: 'USD' },
      { ticker: 'TLKM', shares: 5000, avgBuyPrice: 2050, buyCurrency: 'IDR' },
      { ticker: 'GLD', shares: 8, avgBuyPrice: 320.0, buyCurrency: 'USD' },
    ],
  },
  {
    id: 'dividend_cashflow',
    name: 'Dividen Cashflow Mantap',
    badge: 'Penghasilan Pasif',
    description: 'Fokus dividen yield tinggi dan stabil melalui ETF SCHD, saham bluechip perbankan dan konglomerasi otomotif.',
    recommendedRiskProfile: 'konservatif',
    holdings: [
      { ticker: 'SCHD', shares: 30, avgBuyPrice: 33.5, buyCurrency: 'USD' },
      { ticker: 'VIG', shares: 15, avgBuyPrice: 225.0, buyCurrency: 'USD' },
      { ticker: 'BBCA', shares: 3000, avgBuyPrice: 5250, buyCurrency: 'IDR' },
      { ticker: 'ASII', shares: 4000, avgBuyPrice: 5300, buyCurrency: 'IDR' },
      { ticker: 'JNJ', shares: 10, avgBuyPrice: 255.0, buyCurrency: 'USD' },
      { ticker: 'VOO', shares: 3, avgBuyPrice: 625.0, buyCurrency: 'USD' },
    ],
  },
  {
    id: 'aggressive_ai_momentum',
    name: 'Disrupsi AI & High Beta',
    badge: 'Volatilitas Tinggi',
    description: 'Portofolio berisiko tinggi dengan fokus semikonduktor, Tesla, dan inovasi eksponensial.',
    recommendedRiskProfile: 'sangat_agresif',
    holdings: [
      { ticker: 'NVDA', shares: 30, avgBuyPrice: 138.0, buyCurrency: 'USD' },
      { ticker: 'TSLA', shares: 14, avgBuyPrice: 340.0, buyCurrency: 'USD' },
      { ticker: 'SMH', shares: 12, avgBuyPrice: 410.0, buyCurrency: 'USD' },
      { ticker: 'ARKK', shares: 40, avgBuyPrice: 64.0, buyCurrency: 'USD' },
      { ticker: 'GOTO', shares: 50000, avgBuyPrice: 24, buyCurrency: 'IDR' },
    ],
  },
];

export function getLocalizedPresets(lang: AppLanguage = 'id'): PresetPortfolio[] {
  if (lang !== 'en') return PRESET_PORTFOLIOS;
  const enOverrides: Record<string, { name: string; badge: string; description: string }> = {
    tech_us_growth: {
      name: 'Wall Street Mega-Cap Tech',
      badge: 'High Growth',
      description:
        'Leading US tech equities (Nvidia, Microsoft, Apple, Amazon) paired with QQQ ETF to capture global AI growth.',
    },
    balanced_indo_us: {
      name: 'Global & IDX Bluechip Balanced',
      badge: 'Balanced All-Weather',
      description:
        'A blend of Indonesian blue-chip banks (BBCA, BBRI), S&P 500 ETF (VOO), and gold (GLD) for long-term stability.',
    },
    dividend_cashflow: {
      name: 'Steady Dividend Cashflow',
      badge: 'Passive Income',
      description:
        'Focused on resilient dividend yield via SCHD/VIG ETFs alongside Indonesian blue-chip banks and consumer stalwarts.',
    },
    aggressive_ai_momentum: {
      name: 'AI Disruption & High Beta',
      badge: 'High Volatility',
      description:
        'High-risk portfolio concentrated in semiconductors, EV leaders, and exponential innovation themes.',
    },
  };
  return PRESET_PORTFOLIOS.map((p) => ({
    ...p,
    ...(enOverrides[p.id] || {}),
  }));
}

const CUSTOM_ASSETS_STORAGE_KEY = 'portolens_custom_assets_v1';

const BASE_ASSET_MAP: Map<string, Asset> = new Map(
  AVAILABLE_ASSETS.map((asset) => [asset.ticker.toUpperCase(), asset])
);

let cachedCustomAssets: Asset[] | null = null;
let cachedAllAssets: Asset[] | null = null;
let cachedCustomMap: Map<string, Asset> | null = null;

interface SearchIndexEntry {
  asset: Asset;
  tickerUpper: string;
  tickerLower: string;
  nameLower: string;
  sectorLower: string;
}

let cachedSearchIndexSource: Asset[] | null = null;
let cachedSearchIndex: SearchIndexEntry[] = [];
let cachedCategoryCountsSource: Asset[] | null = null;
let cachedCategoryCounts: { all: number; idx: number; us: number; etf: number } = {
  all: 0,
  idx: 0,
  us: 0,
  etf: 0,
};

function loadCustomAssets(): Asset[] {
  if (cachedCustomAssets !== null) return cachedCustomAssets;
  try {
    if (typeof window === 'undefined') {
      cachedCustomAssets = [];
      return cachedCustomAssets;
    }
    const raw = window.localStorage.getItem(CUSTOM_ASSETS_STORAGE_KEY);
    cachedCustomAssets = raw ? JSON.parse(raw) : [];
    return cachedCustomAssets!;
  } catch {
    cachedCustomAssets = [];
    return cachedCustomAssets;
  }
}

function rebuildAssetCaches() {
  const customAssets = loadCustomAssets();
  const uniqueCustom = customAssets.filter((a) => !BASE_ASSET_MAP.has(a.ticker.toUpperCase()));
  cachedCustomMap = new Map(uniqueCustom.map((a) => [a.ticker.toUpperCase(), a]));
  cachedAllAssets = uniqueCustom.length > 0 ? [...uniqueCustom, ...AVAILABLE_ASSETS] : AVAILABLE_ASSETS;
}

function getSearchIndex(): SearchIndexEntry[] {
  const assets = getAllAssets();
  if (cachedSearchIndexSource !== assets) {
    cachedSearchIndex = assets.map((asset) => ({
      asset,
      tickerUpper: asset.ticker.toUpperCase(),
      tickerLower: asset.ticker.toLowerCase(),
      nameLower: asset.name.toLowerCase(),
      sectorLower: asset.sector.toLowerCase(),
    }));
    cachedSearchIndexSource = assets;
  }
  return cachedSearchIndex;
}

export function getCatalogCategoryCounts(): { all: number; idx: number; us: number; etf: number } {
  const assets = getAllAssets();
  if (cachedCategoryCountsSource !== assets) {
    let idx = 0;
    let us = 0;
    let etf = 0;
    for (let i = 0; i < assets.length; i++) {
      const t = assets[i].type;
      if (t === 'IDX_STOCK') idx++;
      else if (t === 'US_STOCK') us++;
      else etf++;
    }
    cachedCategoryCounts = { all: assets.length, idx, us, etf };
    cachedCategoryCountsSource = assets;
  }
  return cachedCategoryCounts;
}

export function searchCatalogAssets(
  query: string,
  typeFilter: 'ALL' | 'IDX_STOCK' | 'US_STOCK' | 'ETF' = 'ALL',
  options?: {
    prioritizeTickerMatch?: boolean;
    excludeTickers?: Set<string>;
    limit?: number;
  }
): Asset[] {
  const index = getSearchIndex();
  const q = query.toLowerCase().trim();
  const exclude = options?.excludeTickers;
  const limit = options?.limit;

  if (!q) {
    const out: Asset[] = [];
    for (let i = 0; i < index.length; i++) {
      const entry = index[i];
      if (typeFilter !== 'ALL' && entry.asset.type !== typeFilter) continue;
      if (exclude && exclude.has(entry.tickerUpper)) continue;
      out.push(entry.asset);
      if (limit && out.length >= limit) break;
    }
    return out;
  }

  if (options?.prioritizeTickerMatch) {
    const cleanLowerQ = q.replace(/\.jk$/i, '');
    const exactBucket: Asset[] = [];
    const tickerPrefixBucket: Asset[] = [];
    const namePrefixBucket: Asset[] = [];
    const otherBucket: Asset[] = [];

    for (let i = 0; i < index.length; i++) {
      const entry = index[i];
      if (typeFilter !== 'ALL' && entry.asset.type !== typeFilter) continue;
      if (exclude && exclude.has(entry.tickerUpper)) continue;

      if (
        !entry.tickerLower.includes(q) &&
        !entry.nameLower.includes(q) &&
        !entry.sectorLower.includes(q)
      ) {
        continue;
      }

      if (entry.tickerLower === cleanLowerQ) {
        exactBucket.push(entry.asset);
      } else if (entry.tickerLower.startsWith(cleanLowerQ)) {
        tickerPrefixBucket.push(entry.asset);
      } else if (entry.nameLower.startsWith(q)) {
        namePrefixBucket.push(entry.asset);
      } else {
        otherBucket.push(entry.asset);
      }
    }

    const combined = exactBucket.concat(tickerPrefixBucket, namePrefixBucket, otherBucket);
    return limit && combined.length > limit ? combined.slice(0, limit) : combined;
  }

  const matches: Asset[] = [];
  for (let i = 0; i < index.length; i++) {
    const entry = index[i];
    if (typeFilter !== 'ALL' && entry.asset.type !== typeFilter) continue;
    if (exclude && exclude.has(entry.tickerUpper)) continue;
    if (
      entry.tickerLower.includes(q) ||
      entry.nameLower.includes(q) ||
      entry.sectorLower.includes(q)
    ) {
      matches.push(entry.asset);
      if (limit && matches.length >= limit) break;
    }
  }
  return matches;
}

export function getAllAssets(): Asset[] {
  if (!cachedAllAssets) {
    rebuildAssetCaches();
  }
  return cachedAllAssets!;
}

export function isCustomAsset(ticker: string): boolean {
  const upper = ticker.toUpperCase();
  if (BASE_ASSET_MAP.has(upper)) return false;
  if (!cachedCustomMap) rebuildAssetCaches();
  return cachedCustomMap!.has(upper);
}

export function registerCustomAsset(asset: Asset): Asset[] {
  const upper = asset.ticker.toUpperCase();
  if (BASE_ASSET_MAP.has(upper)) return getAllAssets();

  const customAssets = loadCustomAssets();
  const existingIdx = customAssets.findIndex((a) => a.ticker.toUpperCase() === upper);
  const updated =
    existingIdx >= 0
      ? customAssets.map((a, idx) => (idx === existingIdx ? asset : a))
      : [asset, ...customAssets];

  cachedCustomAssets = updated;
  try {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(CUSTOM_ASSETS_STORAGE_KEY, JSON.stringify(updated));
    }
  } catch {
    // ignore storage errors
  }

  rebuildAssetCaches();
  return getAllAssets();
}

export function updateCustomAssetClassification(
  ticker: string,
  newType: 'IDX_STOCK' | 'US_STOCK' | 'ETF',
  updatedPrice?: number,
  updatedName?: string,
  updatedSector?: string,
  lang: AppLanguage = 'id'
): Asset[] {
  const upper = ticker.toUpperCase();
  const customAssets = loadCustomAssets();
  const existing = customAssets.find((a) => a.ticker.toUpperCase() === upper);
  if (!existing) return getAllAssets();

  const label =
    lang === 'en'
      ? newType === 'IDX_STOCK'
        ? 'IDX Stock (Indonesia)'
        : newType === 'US_STOCK'
        ? 'US Stock (Wall Street)'
        : 'Global ETF'
      : newType === 'IDX_STOCK'
      ? 'Saham IHSG (IDX)'
      : newType === 'US_STOCK'
      ? 'Saham AS (Wall Street)'
      : 'ETF Global';

  const defaultSector =
    newType === 'IDX_STOCK'
      ? lang === 'en'
        ? 'Indonesia Stock Exchange'
        : 'Bursa Efek Indonesia'
      : newType === 'US_STOCK'
      ? 'Wall Street Global'
      : lang === 'en'
      ? 'Index & Sector ETF'
      : 'ETF Indeks & Sektoral';

  const resolvedSector =
    updatedSector?.trim() ||
    ([
      'Bursa Efek Indonesia',
      'Indonesia Stock Exchange',
      'Wall Street Global',
      'ETF Indeks & Sektoral',
      'Index & Sector ETF',
    ].includes(existing.sector)
      ? defaultSector
      : existing.sector);

  const updatedAsset: Asset = {
    ...existing,
    type: newType,
    name: updatedName?.trim() || existing.name,
    currency: newType === 'IDX_STOCK' ? 'IDR' : 'USD',
    price: updatedPrice !== undefined && updatedPrice > 0 ? updatedPrice : existing.price,
    sector: resolvedSector,
    peRatio: newType !== 'ETF' ? existing.peRatio ?? 18.0 : undefined,
    expenseRatio: newType === 'ETF' ? existing.expenseRatio ?? 0.15 : undefined,
    marketCap:
      newType === 'IDX_STOCK'
        ? lang === 'en'
          ? 'IDX Issuer'
          : 'Emiten IDX'
        : newType === 'ETF'
        ? lang === 'en'
          ? 'Global ETF'
          : 'ETF Global'
        : lang === 'en'
        ? 'US Issuer'
        : 'Emiten AS',
    description:
      lang === 'en'
        ? `${label} instrument registered by you in the PortoLens AI catalog.`
        : `Instrumen ${label} yang didaftarkan oleh Anda ke katalog PortoLens AI.`,
  };

  return registerCustomAsset(updatedAsset);
}

// Helper to find asset (searches catalog + user's custom tickers in O(1))
export function getAssetByTicker(ticker: string): Asset | undefined {
  const upper = ticker.toUpperCase();
  const baseHit = BASE_ASSET_MAP.get(upper);
  if (baseHit) return baseHit;
  if (!cachedCustomMap) rebuildAssetCaches();
  return cachedCustomMap!.get(upper);
}

// Convert price to unified currency with optional live exchange rate
export function convertToCurrency(
  amount: number,
  from: 'USD' | 'IDR',
  to: 'USD' | 'IDR',
  exchangeRate: number = USD_TO_IDR_RATE
): number {
  if (from === to) return amount;
  const safeRate =
    typeof exchangeRate === 'number' && Number.isFinite(exchangeRate) && exchangeRate > 0
      ? exchangeRate
      : USD_TO_IDR_RATE;
  if (from === 'USD' && to === 'IDR') return amount * safeRate;
  return amount / safeRate;
}

// Parse user numeric input supporting both Indonesian comma decimals (e.g. "3,8955")
// and standard dot decimals (e.g. "3.8955"), as well as multi-separator thousands (e.g. "1.000.000" or "1.500,25").
// When thousandsDotForIntegerLocale is true (e.g. IDR prices or IDX shares), a single pattern like "9.500" or "10.000"
// is treated as Indonesian thousands separator (9500 / 10000).
export function parseDecimalInput(
  raw: string | number,
  options?: { thousandsDotForIntegerLocale?: boolean }
): number {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : NaN;
  const cleaned = raw.trim().replace(/\s+/g, '');
  if (!cleaned) return NaN;

  const hasDot = cleaned.includes('.');
  const hasComma = cleaned.includes(',');

  let normalized = cleaned;
  if (hasDot && hasComma) {
    if (cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')) {
      normalized = cleaned.replace(/\./g, '').replace(',', '.');
    } else {
      normalized = cleaned.replace(/,/g, '');
    }
  } else if (hasComma) {
    const parts = cleaned.split(',');
    if (parts.length > 2) {
      normalized = cleaned.replace(/,/g, '');
    } else if (options?.thousandsDotForIntegerLocale && /^[1-9]\d{0,2}(,\d{3})+$/.test(cleaned)) {
      normalized = cleaned.replace(/,/g, '');
    } else {
      normalized = cleaned.replace(',', '.');
    }
  } else if (hasDot) {
    const parts = cleaned.split('.');
    if (parts.length > 2) {
      normalized = cleaned.replace(/\./g, '');
    } else if (options?.thousandsDotForIntegerLocale && /^[1-9]\d{0,2}(\.\d{3})+$/.test(cleaned)) {
      normalized = cleaned.replace(/\./g, '');
    } else {
      normalized = cleaned;
    }
  }

  const num = Number(normalized);
  return Number.isFinite(num) ? num : NaN;
}

// Format share quantities without truncating fractional US/ETF decimals (up to 6 decimal places)
export function formatShareQuantity(shares: number, lang: AppLanguage = 'id'): string {
  return shares.toLocaleString(lang === 'en' ? 'en-US' : 'id-ID', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 6,
  });
}

// Analyze entire portfolio quantitatively with live market quotes support
export function calculatePortfolioMetrics(
  holdings: PortfolioHolding[],
  riskProfileId: string = 'moderat',
  viewCurrency: 'IDR' | 'USD' = 'IDR',
  liveQuotes?: Record<string, { price: number; change?: number; changePercent?: number; isLiveFound?: boolean }>,
  liveExchangeRate?: number,
  lang: AppLanguage = 'id'
) {
  const profile = getLocalizedRiskProfile(riskProfileId, lang);
  const currentFxRate = liveExchangeRate || USD_TO_IDR_RATE;

  let totalValueCurrent = 0;
  let totalCostBasis = 0;

  const enrichedHoldings = holdings
    .map((item) => {
      if (!Number.isFinite(item.shares) || item.shares <= 0) return null;
      const baseAsset = getAssetByTicker(item.ticker);
      if (!baseAsset) return null;

      const upperTicker = baseAsset.ticker.toUpperCase();
      const live =
        liveQuotes?.[item.ticker] ||
        liveQuotes?.[upperTicker] ||
        (baseAsset.type === 'IDX_STOCK' ? liveQuotes?.[`${upperTicker}.JK`] : undefined);
      const hasValidLive =
        typeof live?.price === 'number' &&
        Number.isFinite(live.price) &&
        live.price > 0 &&
        live.isLiveFound !== false;
      const effectivePrice = hasValidLive ? live.price : baseAsset.price;
      const effectiveChange1D =
        hasValidLive && typeof live.changePercent === 'number' && Number.isFinite(live.changePercent)
          ? live.changePercent
          : baseAsset.change1D;
      const nativeCurrency: 'IDR' | 'USD' = baseAsset.type === 'IDX_STOCK' ? 'IDR' : 'USD';

      const asset: Asset = {
        ...baseAsset,
        currency: nativeCurrency,
        price: effectivePrice,
        change1D: effectiveChange1D,
      };

      const safeAvgBuyPrice =
        Number.isFinite(item.avgBuyPrice) && item.avgBuyPrice > 0 ? item.avgBuyPrice : effectivePrice;
      const currentValNative = item.shares * effectivePrice;
      const currentValInView = convertToCurrency(currentValNative, nativeCurrency, viewCurrency, currentFxRate);

      const costBasisNative = item.shares * safeAvgBuyPrice;
      const costBasisInView = convertToCurrency(costBasisNative, item.buyCurrency, viewCurrency, currentFxRate);

      const gainLossVal = currentValInView - costBasisInView;
      const gainLossPct = costBasisInView > 0 ? (gainLossVal / costBasisInView) * 100 : 0;

      totalValueCurrent += currentValInView;
      totalCostBasis += costBasisInView;

      return {
        ...item,
        asset,
        currentValInView,
        costBasisInView,
        gainLossVal,
        gainLossPct,
      };
    })
    .filter(Boolean) as Array<any>;

  if (enrichedHoldings.length === 0 || totalValueCurrent === 0) {
    return {
      totalValue: 0,
      totalCost: 0,
      totalGainLoss: 0,
      totalGainLossPct: 0,
      weightedBeta: 0,
      portfolio1YReturn: 0,
      portfolioDividendYield: 0,
      diversificationScore: 0,
      riskManagementScore: 0,
      healthScore: 0,
      healthGrade: 'N/A',
      sectorBreakdown: [] as any[],
      typeBreakdown: [] as any[],
      currencyBreakdown: [] as any[],
      holdings: [],
      issuesDetected: [],
      optimizationSuggestions: [],
      historySeries: [] as Array<{ month: string; portfolio: number; benchmark: number }>,
    };
  }

  // Calculate weights & weighted metrics
  let weightedBeta = 0;
  let weighted1YReturn = 0;
  let weightedDivYield = 0;

  const sectorMap: Record<string, number> = {};
  const typeMap: Record<string, number> = {};
  const currencyMap: Record<string, number> = {};

  const finalizedHoldings = enrichedHoldings.map((h) => {
    const weight = (h.currentValInView / totalValueCurrent) * 100;
    weightedBeta += (weight / 100) * h.asset.beta;
    weighted1YReturn += (weight / 100) * h.asset.return1Y;
    weightedDivYield += (weight / 100) * h.asset.dividendYield;

    sectorMap[h.asset.sector] = (sectorMap[h.asset.sector] || 0) + weight;
    typeMap[h.asset.type] = (typeMap[h.asset.type] || 0) + weight;
    currencyMap[h.asset.currency] = (currencyMap[h.asset.currency] || 0) + weight;

    return {
      ...h,
      weight,
    };
  });

  // Calculate Diversification Score using Herfindahl-Hirschman Index (HHI)
  // HHI = sum of squared weights. Lower is better. If 1 stock is 100%, HHI = 10000.
  // If 5 equal stocks, HHI = 5 * 400 = 2000.
  const hhi = finalizedHoldings.reduce((sum, h) => sum + Math.pow(h.weight, 2), 0);
  // Transform HHI to a 0-100 score: HHI 1500 or less is ideal (100 pts), HHI 5000 is 30 pts.
  let diversificationScore = Math.round(Math.max(10, Math.min(100, 100 - (hhi - 1200) / 45)));

  // Sector concentration penalty:
  const maxSectorWeight = Math.max(...Object.values(sectorMap));
  if (maxSectorWeight > profile.maxSingleSectorAllocation) {
    diversificationScore = Math.max(20, diversificationScore - Math.round((maxSectorWeight - profile.maxSingleSectorAllocation) * 1.2));
  }

  // Risk Management Score (alignment with risk profile)
  let riskManagementScore = 85;
  const betaDeviation = Math.abs(weightedBeta - (profile.minTargetBeta + profile.maxTargetBeta) / 2);
  if (weightedBeta > profile.maxTargetBeta) {
    riskManagementScore -= Math.round((weightedBeta - profile.maxTargetBeta) * 50);
  } else if (weightedBeta < profile.minTargetBeta) {
    riskManagementScore -= Math.round((profile.minTargetBeta - weightedBeta) * 30);
  }

  // Single asset concentration check
  const maxAssetWeight = Math.max(...finalizedHoldings.map((h) => h.weight));
  if (maxAssetWeight > profile.maxSingleAssetAllocation) {
    riskManagementScore -= Math.round((maxAssetWeight - profile.maxSingleAssetAllocation) * 1.5);
  }

  riskManagementScore = Math.max(15, Math.min(100, riskManagementScore));

  // Overall Health Score: Weighted combination (smooth dividend component, strictly 0..100)
  const divComponent = Math.min(20, Math.max(0, (weightedDivYield / 1.5) * 20));
  const healthScore = Math.min(
    100,
    Math.max(0, Math.round(diversificationScore * 0.35 + riskManagementScore * 0.45 + divComponent))
  );

  let healthGrade = 'C';
  if (healthScore >= 90) healthGrade = 'A+';
  else if (healthScore >= 80) healthGrade = 'A';
  else if (healthScore >= 70) healthGrade = 'B+';
  else if (healthScore >= 60) healthGrade = 'B';
  else if (healthScore >= 50) healthGrade = 'C+';
  else healthGrade = 'D';

  const isEn = lang === 'en';

  // Rule-based issue detector
  const issuesDetected: Array<{ title: string; severity: 'high' | 'medium' | 'info'; desc: string }> = [];

  if (maxAssetWeight > profile.maxSingleAssetAllocation) {
    const topAsset = finalizedHoldings.find((h) => h.weight === maxAssetWeight);
    issuesDetected.push({
      title: isEn
        ? `Excessive Single-Asset Concentration (${topAsset?.ticker})`
        : `Konsentrasi Single-Asset Berlebih (${topAsset?.ticker})`,
      severity: maxAssetWeight > 35 ? 'high' : 'medium',
      desc: isEn
        ? `${topAsset?.ticker} accounts for ${maxAssetWeight.toFixed(1)}% of your portfolio, exceeding the ${profile.name} limit (max ${profile.maxSingleAssetAllocation}%). A sharp drop in this holding would heavily impact your portfolio.`
        : `Porsi ${topAsset?.ticker} mencapai ${maxAssetWeight.toFixed(1)}%, melebihi rekomendasi ${profile.name} (maks ${profile.maxSingleAssetAllocation}%). Kejatuhan pada emiten ini akan berdampak fatal pada portofolio Anda.`,
    });
  }

  if (weightedBeta > profile.maxTargetBeta) {
    issuesDetected.push({
      title: isEn
        ? `Portfolio Beta (${weightedBeta.toFixed(2)}) Exceeds Risk Limit`
        : `Beta Portofolio (${weightedBeta.toFixed(2)}) Melampaui Batas Toleransi`,
      severity: 'high',
      desc: isEn
        ? `Your ${profile.name} profile targets beta ${profile.targetBetaRange}. Current exposure is overly sensitive to broad market drawdowns.`
        : `Profil ${profile.name} memiliki toleransi beta ${profile.targetBetaRange}. Portofolio Anda saat ini terlalu sensitif terhadap penurunan pasar (bear market).`,
    });
  }

  if (maxSectorWeight > profile.maxSingleSectorAllocation) {
    const topSector = Object.entries(sectorMap).find(([_, w]) => w === maxSectorWeight)?.[0];
    issuesDetected.push({
      title: isEn
        ? `High Sector Concentration in ${topSector}`
        : `Risiko Sektoral Tinggi di ${topSector}`,
      severity: 'medium',
      desc: isEn
        ? `This sector dominates ${maxSectorWeight.toFixed(1)}% of your portfolio. Sector-wide headwinds or regulatory shifts could hurt overall returns.`
        : `Sektor ini mendominasi ${maxSectorWeight.toFixed(1)}% aset Anda. Bila ada regulasi negatif atau siklus pelemahan sektor, seluruh portofolio rentan tertekan.`,
    });
  }

  const etfWeight = typeMap['ETF'] || 0;
  if (etfWeight < profile.suggestedEtfWeight * 0.5) {
    issuesDetected.push({
      title: isEn ? 'Suboptimal Stabilizing ETF Allocation' : 'Porsi ETF Penstabil Kurang Optimal',
      severity: 'info',
      desc: isEn
        ? `Current ETF allocation is ${etfWeight.toFixed(1)}% (recommended at least ${profile.suggestedEtfWeight}% for ${profile.name} profile). Broad ETFs improve diversification effortlessly.`
        : `Portofolio baru memiliki ${etfWeight.toFixed(1)}% ETF (disarankan minimal ${profile.suggestedEtfWeight}% untuk profil ${profile.name}). ETF indeks membantu diversifikasi tanpa perlu memantau ratusan saham harian.`,
    });
  }

  // Actionable Rebalancing Suggestions
  const optimizationSuggestions: Array<{
    action: 'PANGKAS' | 'TAMBAH' | 'DIVERSIFIKASI';
    ticker: string;
    name: string;
    targetChange: string;
    rationale: string;
  }> = [];

  finalizedHoldings.forEach((h) => {
    if (h.weight > profile.maxSingleAssetAllocation) {
      const trimAmount = (h.weight - profile.maxSingleAssetAllocation).toFixed(1);
      optimizationSuggestions.push({
        action: 'PANGKAS',
        ticker: h.ticker,
        name: h.asset.name,
        targetChange: isEn
          ? `Trim -${trimAmount}% (to ${profile.maxSingleAssetAllocation}%)`
          : `Pangkas -${trimAmount}% (ke ${profile.maxSingleAssetAllocation}%)`,
        rationale: isEn
          ? `Lock in gains and redistribute risk so your portfolio isn't reliant on a single ticker.`
          : `Mengamankan laba dan mendistribusikan risiko agar tidak bergantung pada 1 saham saja.`,
      });
    }
  });

  if (weightedBeta > profile.maxTargetBeta) {
    optimizationSuggestions.push({
      action: 'TAMBAH',
      ticker: 'VOO',
      name: 'Vanguard S&P 500 ETF',
      targetChange: isEn ? 'Allocate 10% - 15%' : 'Alokasikan 10% - 15%',
      rationale: isEn
        ? 'Lowers portfolio beta predictably while giving broad exposure to 500 top US corporations.'
        : 'Menurunkan beta portofolio secara terukur dan memberikan eksposur langsung ke 500 perusahaan raksasa dunia.',
    });
    optimizationSuggestions.push({
      action: 'TAMBAH',
      ticker: 'SCHD / GLD',
      name: isEn ? 'Defensive Dividend & Gold' : 'Dividen Defensif & Emas',
      targetChange: isEn ? 'Allocate 5% - 10%' : 'Alokasikan 5% - 10%',
      rationale: isEn
        ? 'Provides downside cushioning during market volatility plus reliable dividend cashflow.'
        : 'Memberikan bantalan proteksi saat Wall Street bergejolak serta arus kas dividen teratur.',
    });
  }

  const monthsArr = isEn
    ? ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    : ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

  // 12-Month Historical Portfolio Backtest Curve
  const historySeries = Array.from({ length: 12 }).map((_, idx) => {
    const monthPortfolio = finalizedHoldings.reduce((acc, h) => {
      const val = h.asset.history12M[idx] || 100;
      return acc + (h.weight / 100) * val;
    }, 0);
    // Baseline SPY benchmark
    const monthBenchmark = 84 + idx * 2.8;
    return {
      month: monthsArr[idx],
      portfolio: Math.round(monthPortfolio * 10) / 10,
      benchmark: Math.round(monthBenchmark * 10) / 10,
    };
  });

  const totalGainLoss = totalValueCurrent - totalCostBasis;
  const totalGainLossPct = totalCostBasis > 0 ? (totalGainLoss / totalCostBasis) * 100 : 0;

  return {
    totalValue: totalValueCurrent,
    totalCost: totalCostBasis,
    totalGainLoss,
    totalGainLossPct,
    weightedBeta: Math.round(weightedBeta * 100) / 100,
    portfolio1YReturn: Math.round(weighted1YReturn * 10) / 10,
    portfolioDividendYield: Math.round(weightedDivYield * 100) / 100,
    diversificationScore,
    riskManagementScore,
    healthScore,
    healthGrade,
    sectorBreakdown: Object.entries(sectorMap)
      .map(([name, weight]) => ({ name, weight: Math.round(weight * 10) / 10 }))
      .sort((a, b) => b.weight - a.weight),
    typeBreakdown: Object.entries(typeMap).map(([type, weight]) => ({
      type,
      label: isEn
        ? type === 'US_STOCK'
          ? 'US Stocks'
          : type === 'IDX_STOCK'
          ? 'IDX Stocks'
          : 'Global ETFs'
        : type === 'US_STOCK'
        ? 'Saham AS'
        : type === 'IDX_STOCK'
        ? 'Saham IDX (RI)'
        : 'ETF Global',
      weight: Math.round(weight * 10) / 10,
    })),
    currencyBreakdown: Object.entries(currencyMap).map(([curr, weight]) => ({
      curr,
      weight: Math.round(weight * 10) / 10,
    })),
    holdings: finalizedHoldings,
    issuesDetected,
    optimizationSuggestions,
    historySeries,
  };
}

export type BenchmarkRangeKey = '1M' | '3M' | '6M' | '1Y' | '5Y' | '10Y';

export interface BenchmarkHistoryPoint {
  date: string;
  timestamp: number;
  label: string;
  sp500Pct: number;
  ihsgPct: number;
  nasdaqPct: number;
}

export interface ComparisonSeriesPoint extends BenchmarkHistoryPoint {
  portfolioPct: number | null;
}

export function buildFallbackBenchmarkHistory(
  range: BenchmarkRangeKey,
  lang: AppLanguage = 'id'
): BenchmarkHistoryPoint[] {
  const countMap: Record<BenchmarkRangeKey, number> = {
    '1M': 22,
    '3M': 36,
    '6M': 26,
    '1Y': 52,
    '5Y': 60,
    '10Y': 60,
  };
  const stepDaysMap: Record<BenchmarkRangeKey, number> = {
    '1M': 1,
    '3M': 2,
    '6M': 7,
    '1Y': 7,
    '5Y': 30,
    '10Y': 61,
  };
  const count = countMap[range];
  const stepDays = stepDaysMap[range];
  const now = Date.now();
  const points: BenchmarkHistoryPoint[] = [];
  const showYear = range === '1Y' || range === '5Y' || range === '10Y';
  const dateLocale = lang === 'en' ? 'en-US' : 'id-ID';

  const spTotalMap: Record<BenchmarkRangeKey, number> = {
    '1M': 2.4,
    '3M': 6.8,
    '6M': 11.5,
    '1Y': 21.4,
    '5Y': 58.6,
    '10Y': 237.7,
  };
  const ihsgTotalMap: Record<BenchmarkRangeKey, number> = {
    '1M': 1.1,
    '3M': 3.2,
    '6M': 5.4,
    '1Y': 9.8,
    '5Y': 18.4,
    '10Y': 42.5,
  };
  const ndxTotalMap: Record<BenchmarkRangeKey, number> = {
    '1M': 3.3,
    '3M': 9.2,
    '6M': 15.8,
    '1Y': 28.6,
    '5Y': 95.4,
    '10Y': 365.0,
  };

  for (let i = 0; i < count; i++) {
    const progress = count > 1 ? i / (count - 1) : 1;
    const ts = now - (count - 1 - i) * stepDays * 86400000;
    const d = new Date(ts);
    const waveScale = range === '10Y' ? 4.5 : range === '5Y' ? 2.5 : 1;
    const spWave = (Math.sin(i * 0.65) * 1.1 + Math.cos(i * 0.25) * 0.7) * waveScale;
    const ihsgWave = (Math.cos(i * 0.55) * 1.2 + Math.sin(i * 0.3) * 0.8) * waveScale;
    const ndxWave = (Math.sin(i * 0.7) * 1.6 + Math.cos(i * 0.28) * 1.0) * waveScale;

    points.push({
      date: d.toISOString().slice(0, 10),
      timestamp: ts,
      label: showYear
        ? d.toLocaleDateString(dateLocale, { month: 'short', year: '2-digit', timeZone: 'UTC' })
        : d.toLocaleDateString(dateLocale, { day: 'numeric', month: 'short', timeZone: 'UTC' }),
      sp500Pct: i === 0 ? 0 : Number((progress * spTotalMap[range] + spWave * (1 - progress * 0.3)).toFixed(2)),
      ihsgPct: i === 0 ? 0 : Number((progress * ihsgTotalMap[range] + ihsgWave * (1 - progress * 0.3)).toFixed(2)),
      nasdaqPct: i === 0 ? 0 : Number((progress * ndxTotalMap[range] + ndxWave * (1 - progress * 0.3)).toFixed(2)),
    });
  }
  return points;
}

export function computePortfolioComparisonSeries(
  holdings: Array<{ weight: number; asset: Asset }>,
  benchmarkPoints: BenchmarkHistoryPoint[],
  range: BenchmarkRangeKey
): ComparisonSeriesPoint[] {
  if (!benchmarkPoints || benchmarkPoints.length === 0) return [];
  if (!holdings || holdings.length === 0) {
    return benchmarkPoints.map((pt) => ({ ...pt, portfolioPct: null }));
  }

  const n = benchmarkPoints.length;

  // Multi-year mode (5Y & 10Y): blend real historical market cycles (S&P 500 / IHSG) with beta sensitivity and mean-reverting annualized alpha
  if (range === '5Y' || range === '10Y') {
    const years = range === '10Y' ? 10 : 5;
    const rawSeries: number[] = [];

    for (let i = 0; i < n; i++) {
      const progress = n > 1 ? i / (n - 1) : 1;
      const pt = benchmarkPoints[i];
      let weightedVal = 0;
      let totalW = 0;

      for (const h of holdings) {
        const w = h.weight / 100;
        if (!(w > 0)) continue;
        totalW += w;

        const isIdx = h.asset.type === 'IDX_STOCK';
        const benchPct = isIdx ? pt.ihsgPct : pt.sp500Pct;
        const beta = Math.max(0.4, Math.min(1.8, h.asset.beta || 1));

        const r3Y = Math.max(-0.65, (h.asset.return3Y ?? 25) / 100);
        const cagr3Y = Math.pow(1 + r3Y, 1 / 3) - 1;
        const r1Y = Math.max(-0.5, (h.asset.return1Y ?? 10) / 100);
        const baseMarketCagr = isIdx ? 0.05 : 0.1;
        const blendedCagr = cagr3Y * 0.65 + r1Y * 0.2 + baseMarketCagr * 0.15;
        const rawAlpha = blendedCagr - baseMarketCagr;
        const maxAlpha = range === '10Y' ? 0.08 : 0.11;
        const dampedAlpha = Math.max(
          -0.08,
          Math.min(maxAlpha, rawAlpha * (range === '10Y' ? 0.45 : 0.6))
        );

        const marketFactor = Math.max(0.25, 1 + (benchPct / 100) * (0.7 + 0.3 * beta));
        const alphaFactor = Math.pow(1 + dampedAlpha, years * progress);
        weightedVal += w * 100 * marketFactor * alphaFactor;
      }

      rawSeries.push(totalW > 0 ? weightedVal / totalW : 100);
    }

    const baseVal = rawSeries[0] || 100;
    return benchmarkPoints.map((pt, i) => ({
      ...pt,
      portfolioPct:
        i === 0 ? 0 : Number((((rawSeries[i] - baseVal) / baseVal) * 100).toFixed(2)),
    }));
  }

  const startMonthMap: Record<'1M' | '3M' | '6M' | '1Y', number> = {
    '1M': 10,
    '3M': 8,
    '6M': 5,
    '1Y': 0,
  };
  const startMonth = startMonthMap[range];

  const interpolate12M = (hist: number[], monthPos: number) => {
    const safeHist = hist && hist.length >= 2 ? hist : [100, 102, 104, 106, 108, 110, 111, 112, 113, 114, 115, 116];
    const clamped = Math.max(0, Math.min(safeHist.length - 1, monthPos));
    const lo = Math.floor(clamped);
    const hi = Math.min(safeHist.length - 1, lo + 1);
    const frac = clamped - lo;
    return safeHist[lo] * (1 - frac) + safeHist[hi] * frac;
  };

  // Compute raw portfolio index value per timestamp combining asset 12M trend + market-beta volatility
  const rawSeries: number[] = [];
  for (let i = 0; i < n; i++) {
    const progress = n > 1 ? i / (n - 1) : 1;
    const monthPos = startMonth + progress * (11 - startMonth);
    const pt = benchmarkPoints[i];

    // Market swing relative to linear trend (preserves real index dips & rallies)
    const spLinear = benchmarkPoints[n - 1].sp500Pct * progress;
    const spDetrended = pt.sp500Pct - spLinear;
    const ihsgLinear = benchmarkPoints[n - 1].ihsgPct * progress;
    const ihsgDetrended = pt.ihsgPct - ihsgLinear;

    let weightedVal = 0;
    let totalW = 0;
    for (const h of holdings) {
      const w = h.weight / 100;
      totalW += w;
      const baseTrend = interpolate12M(h.asset.history12M, monthPos);
      const marketWave = h.asset.type === 'IDX_STOCK' ? ihsgDetrended : spDetrended;
      const betaScaledWave = marketWave * (h.asset.beta || 1) * 0.45;
      weightedVal += w * baseTrend * (1 + betaScaledWave / 100);
    }
    rawSeries.push(totalW > 0 ? weightedVal / totalW : 100);
  }

  const baseVal = rawSeries[0] || 100;
  return benchmarkPoints.map((pt, i) => ({
    ...pt,
    portfolioPct:
      i === 0 ? 0 : Number((((rawSeries[i] - baseVal) / baseVal) * 100).toFixed(2)),
  }));
}

export type RebalanceMode = 'SELL_AND_BUY' | 'BUY_ONLY';

export interface AutoRebalanceItem {
  ticker: string;
  name: string;
  assetType: 'US_STOCK' | 'IDX_STOCK' | 'ETF';
  nativeCurrency: 'IDR' | 'USD';
  priceNative: number;
  priceInView: number;
  beta: number;
  isNewAsset: boolean;
  currentShares: number;
  targetShares: number;
  deltaShares: number;
  action: 'SELL' | 'BUY' | 'HOLD';
  currentWeight: number;
  idealTargetWeight: number;
  projectedWeight: number;
  weightDeltaPct: number;
  tradeValueInView: number;
  tradeValueNative: number;
  reason: string;
}

export interface AutoRebalancePlan {
  mode: RebalanceMode;
  profileId: string;
  profileName: string;
  viewCurrency: 'IDR' | 'USD';
  items: AutoRebalanceItem[];
  totalPortfolioBeforeInView: number;
  totalPortfolioAfterInView: number;
  totalSellValueInView: number;
  totalBuyValueInView: number;
  netCashRequiredInView: number;
  sellCount: number;
  buyCount: number;
  holdCount: number;
  beforeScore: number;
  afterScore: number;
  beforeBeta: number;
  afterBeta: number;
  beforeDiversification: number;
  afterDiversification: number;
  needsRebalance: boolean;
  changes: string[];
  updatedHoldings: PortfolioHolding[];
}

export interface OptimizationApplyResult {
  mode?: RebalanceMode;
  updatedHoldings: PortfolioHolding[];
  applied: boolean;
  changes: string[];
  beforeScore: number;
  afterScore: number;
  beforeBeta: number;
  afterBeta: number;
}

function waterFillCap(
  scores: Record<string, number>,
  totalBudgetPct: number,
  maxPerKey: Record<string, number>
): Record<string, number> {
  const keys = Object.keys(scores);
  const result: Record<string, number> = {};
  if (keys.length === 0 || totalBudgetPct <= 0) return result;

  let remainingBudget = totalBudgetPct;
  let unlocked = new Set(keys);

  for (let iter = 0; iter < keys.length + 2; iter++) {
    if (unlocked.size === 0 || remainingBudget <= 0.0001) break;
    let sumScores = 0;
    for (const k of unlocked) {
      sumScores += Math.max(0.0001, scores[k] || 0);
    }

    let cappedAny = false;
    for (const k of Array.from(unlocked)) {
      const raw = (Math.max(0.0001, scores[k] || 0) / sumScores) * remainingBudget;
      const cap = maxPerKey[k] ?? 100;
      if (raw > cap + 0.0001) {
        result[k] = cap;
        remainingBudget -= cap;
        unlocked.delete(k);
        cappedAny = true;
      }
    }

    if (!cappedAny) {
      for (const k of unlocked) {
        result[k] = (Math.max(0.0001, scores[k] || 0) / sumScores) * remainingBudget;
      }
      remainingBudget = 0;
      break;
    }
  }

  return result;
}

export function calculateAutoRebalancePlan(
  holdings: PortfolioHolding[],
  riskProfile: RiskProfile,
  viewCurrency: 'IDR' | 'USD' = 'IDR',
  liveQuotes?: Record<string, { price: number; changePercent?: number; isLiveFound?: boolean }>,
  exchangeRate: number = USD_TO_IDR_RATE,
  mode: RebalanceMode = 'SELL_AND_BUY',
  lang: AppLanguage = 'id'
): AutoRebalancePlan | null {
  if (!holdings || holdings.length === 0) return null;

  const localizedProfile = getLocalizedRiskProfile(riskProfile.id, lang);
  const beforeMetrics = calculatePortfolioMetrics(
    holdings,
    localizedProfile.id,
    viewCurrency,
    liveQuotes,
    exchangeRate,
    lang
  );
  if (!beforeMetrics || beforeMetrics.totalValue <= 0) return null;

  const resolveEffectiveAsset = (ticker: string): Asset | null => {
    const base = getAssetByTicker(ticker);
    if (!base) return null;
    const upper = base.ticker.toUpperCase();
    const live =
      liveQuotes?.[ticker] ||
      liveQuotes?.[upper] ||
      (base.type === 'IDX_STOCK' ? liveQuotes?.[`${upper}.JK`] : undefined);
    const hasValidLive =
      typeof live?.price === 'number' &&
      Number.isFinite(live.price) &&
      live.price > 0 &&
      live.isLiveFound !== false;
    return {
      ...base,
      currency: base.type === 'IDX_STOCK' ? 'IDR' : 'USD',
      price: hasValidLive ? live.price : base.price,
    };
  };

  interface PoolCandidate {
    ticker: string;
    asset: Asset;
    holding: PortfolioHolding | null;
    currentWeight: number;
    currentShares: number;
    currentValInView: number;
    priceNative: number;
    priceInView: number;
    isNewAsset: boolean;
  }

  const candidateMap = new Map<string, PoolCandidate>();

  for (const mh of beforeMetrics.holdings) {
    const holding = holdings.find((h) => h.ticker.toUpperCase() === mh.ticker.toUpperCase()) || null;
    const priceNative = mh.asset.price;
    const nativeCurrency: 'IDR' | 'USD' = mh.asset.type === 'IDX_STOCK' ? 'IDR' : 'USD';
    const priceInView = convertToCurrency(priceNative, nativeCurrency, viewCurrency, exchangeRate);
    if (!Number.isFinite(priceInView) || priceInView <= 0) continue;

    candidateMap.set(mh.ticker.toUpperCase(), {
      ticker: mh.ticker,
      asset: mh.asset,
      holding,
      currentWeight: mh.weight,
      currentShares: holding?.shares || 0,
      currentValInView: mh.currentValInView,
      priceNative,
      priceInView,
      isNewAsset: false,
    });
  }

  if (candidateMap.size === 0) return null;

  const capPerAsset = riskProfile.maxSingleAssetAllocation;
  const ensureAnchorCandidate = (ticker: string) => {
    const upper = ticker.toUpperCase();
    if (candidateMap.has(upper)) return;
    const asset = resolveEffectiveAsset(upper);
    if (!asset || asset.price <= 0) return;
    const nativeCurrency: 'IDR' | 'USD' = asset.type === 'IDX_STOCK' ? 'IDR' : 'USD';
    const priceInView = convertToCurrency(asset.price, nativeCurrency, viewCurrency, exchangeRate);
    if (!Number.isFinite(priceInView) || priceInView <= 0) return;
    candidateMap.set(upper, {
      ticker: asset.ticker,
      asset,
      holding: null,
      currentWeight: 0,
      currentShares: 0,
      currentValInView: 0,
      priceNative: asset.price,
      priceInView,
      isNewAsset: true,
    });
  };

  const existingEtfs = Array.from(candidateMap.values()).filter((c) => c.asset.type === 'ETF');
  const existingNonEtfs = Array.from(candidateMap.values()).filter((c) => c.asset.type !== 'ETF');
  const currentEtfWeight = existingEtfs.reduce((s, c) => s + c.currentWeight, 0);

  // Target ETF sleeve follows profile suggestion while ensuring enough ETFs to avoid single-asset cap breach
  let desiredEtfPct =
    existingNonEtfs.length === 0
      ? 100
      : Math.max(currentEtfWeight, riskProfile.suggestedEtfWeight);
  if (existingNonEtfs.length > 0 && beforeMetrics.weightedBeta > riskProfile.maxTargetBeta) {
    desiredEtfPct = Math.max(desiredEtfPct, riskProfile.suggestedEtfWeight + 5);
  }
  desiredEtfPct = Math.min(desiredEtfPct, existingNonEtfs.length === 0 ? 100 : 85);

  const anchorEtfOrder = ['VOO', 'SCHD', 'BND', 'VIG', 'GLD', 'VXUS', 'JEPI'];
  for (const anchor of anchorEtfOrder) {
    const etfCandidatesCount = Array.from(candidateMap.values()).filter(
      (c) => c.asset.type === 'ETF'
    ).length;
    const needsMoreEtfsForWeight = etfCandidatesCount * capPerAsset < desiredEtfPct - 0.1;
    const needsTotalCapacity = candidateMap.size * capPerAsset < 99.5;
    const needsDefensiveLowBeta =
      beforeMetrics.weightedBeta > riskProfile.maxTargetBeta && etfCandidatesCount < 2;
    if (
      etfCandidatesCount === 0 ||
      needsMoreEtfsForWeight ||
      needsTotalCapacity ||
      needsDefensiveLowBeta
    ) {
      ensureAnchorCandidate(anchor);
    } else {
      break;
    }
  }

  // If total non-ETF capacity cannot absorb remaining equity sleeve, shift overflow cleanly to ETF sleeve
  const allCandidates = Array.from(candidateMap.values());
  const etfPool = allCandidates.filter((c) => c.asset.type === 'ETF');
  const eqPool = allCandidates.filter((c) => c.asset.type !== 'ETF');

  const maxEqCapacity = eqPool.length * capPerAsset;
  const maxEtfCapacity = etfPool.length * capPerAsset;
  let targetEtfPct = desiredEtfPct;
  let targetEqPct = 100 - targetEtfPct;

  if (targetEqPct > maxEqCapacity) {
    targetEqPct = maxEqCapacity;
    targetEtfPct = 100 - targetEqPct;
  }
  if (targetEtfPct > maxEtfCapacity) {
    targetEtfPct = maxEtfCapacity;
    targetEqPct = 100 - targetEtfPct;
  }

  const eqScores: Record<string, number> = {};
  const eqCaps: Record<string, number> = {};
  const fairEq = eqPool.length > 0 ? targetEqPct / eqPool.length : 0;

  for (const c of eqPool) {
    let score = Math.max(fairEq * 0.45, Math.min(c.currentWeight, capPerAsset));
    if (c.asset.beta > riskProfile.maxTargetBeta) {
      const excessBeta = c.asset.beta - riskProfile.maxTargetBeta;
      score *= Math.max(0.35, 1 - excessBeta * 0.45);
    } else if (
      (riskProfile.id === 'agresif' || riskProfile.id === 'sangat_agresif') &&
      c.asset.beta >= riskProfile.minTargetBeta
    ) {
      score *= 1.15;
    }
    if (riskProfile.id === 'konservatif' && c.asset.dividendYield > 2.5) {
      score *= 1 + Math.min(0.25, c.asset.dividendYield / 18);
    }
    eqScores[c.ticker.toUpperCase()] = Math.max(1, score);
    eqCaps[c.ticker.toUpperCase()] = capPerAsset;
  }

  const etfScores: Record<string, number> = {};
  const etfCaps: Record<string, number> = {};
  const fairEtf = etfPool.length > 0 ? targetEtfPct / etfPool.length : 0;

  for (const c of etfPool) {
    let score = c.isNewAsset
      ? Math.max(6, fairEtf)
      : Math.max(fairEtf * 0.65, Math.min(c.currentWeight, capPerAsset));
    if (beforeMetrics.weightedBeta > riskProfile.maxTargetBeta && c.asset.beta < 0.85) {
      score *= 1.2;
    }
    etfScores[c.ticker.toUpperCase()] = Math.max(1, score);
    etfCaps[c.ticker.toUpperCase()] = capPerAsset;
  }

  const targetWeights: Record<string, number> = {
    ...waterFillCap(eqScores, targetEqPct, eqCaps),
    ...waterFillCap(etfScores, targetEtfPct, etfCaps),
  };

  // Iterative beta alignment: trim highest-beta assets toward lowest-beta ETFs if weightedBeta > maxTargetBeta
  const calcPortfolioBeta = (weights: Record<string, number>) => {
    let sum = 0;
    for (const c of allCandidates) {
      sum += ((weights[c.ticker.toUpperCase()] || 0) / 100) * (c.asset.beta || 1);
    }
    return sum;
  };

  for (let step = 0; step < 25; step++) {
    const b = calcPortfolioBeta(targetWeights);
    if (b <= riskProfile.maxTargetBeta) break;

    const donors = allCandidates
      .filter((c) => (targetWeights[c.ticker.toUpperCase()] || 0) > 2.5)
      .sort((a, z) => z.asset.beta - a.asset.beta);
    const receivers = allCandidates
      .filter((c) => (targetWeights[c.ticker.toUpperCase()] || 0) < capPerAsset - 0.5)
      .sort((a, z) => a.asset.beta - z.asset.beta);

    if (donors.length === 0 || receivers.length === 0) break;
    const donor = donors[0];
    const receiver = receivers[0];
    if (donor.ticker === receiver.ticker || donor.asset.beta <= receiver.asset.beta + 0.05) {
      break;
    }

    const dKey = donor.ticker.toUpperCase();
    const rKey = receiver.ticker.toUpperCase();
    const shift = Math.min(
      2.0,
      targetWeights[dKey] - 2.0,
      capPerAsset - targetWeights[rKey]
    );
    if (shift <= 0.1) break;
    targetWeights[dKey] -= shift;
    targetWeights[rKey] += shift;
  }

  // Round ideal target weights cleanly to 1 decimal while preserving exact 100.0% sum & capPerAsset
  const roundedTargets: Record<string, number> = {};
  let roundedSumTenths = 0;
  for (const c of allCandidates) {
    const k = c.ticker.toUpperCase();
    const w = Math.min(capPerAsset, Math.max(0, Math.round((targetWeights[k] || 0) * 10) / 10));
    roundedTargets[k] = w;
    roundedSumTenths += Math.round(w * 10);
  }
  let diffTenths = 1000 - roundedSumTenths;
  if (diffTenths !== 0 && allCandidates.length > 0) {
    const stepDir = diffTenths > 0 ? 0.1 : -0.1;
    let remainingSteps = Math.abs(diffTenths);
    const orderedKeys = allCandidates
      .slice()
      .sort((a, b) =>
        diffTenths > 0
          ? (roundedTargets[a.ticker.toUpperCase()] ?? 0) - (roundedTargets[b.ticker.toUpperCase()] ?? 0)
          : (roundedTargets[b.ticker.toUpperCase()] ?? 0) - (roundedTargets[a.ticker.toUpperCase()] ?? 0)
      )
      .map((c) => c.ticker.toUpperCase());

    let guard = 0;
    while (remainingSteps > 0 && guard < remainingSteps + orderedKeys.length * 2) {
      let progressed = false;
      for (const ak of orderedKeys) {
        if (remainingSteps <= 0) break;
        const curr = roundedTargets[ak] || 0;
        const next = Number((curr + stepDir).toFixed(1));
        if (next >= 0 && next <= capPerAsset) {
          roundedTargets[ak] = next;
          remainingSteps--;
          progressed = true;
        }
      }
      if (!progressed) break;
      guard++;
    }
  }

  const totalBeforeInView = beforeMetrics.totalValue;

  // In BUY_ONLY mode, compute minimum expanded portfolio value so no asset needs to be sold
  let targetPortfolioScaleInView = totalBeforeInView;
  if (mode === 'BUY_ONLY') {
    for (const c of allCandidates) {
      const tw = roundedTargets[c.ticker.toUpperCase()] || 0;
      if (tw > 0.5 && c.currentValInView > 0) {
        const impliedTotal = c.currentValInView / (tw / 100);
        if (impliedTotal > targetPortfolioScaleInView) {
          targetPortfolioScaleInView = impliedTotal;
        }
      }
    }
  }

  const roundDeltaShares = (
    rawDelta: number,
    c: PoolCandidate
  ): number => {
    if (c.asset.type === 'IDX_STOCK') {
      const useLot = c.currentShares === 0 || Math.abs(rawDelta) >= 100;
      const rounded = useLot
        ? Math.round(rawDelta / 100) * 100
        : Math.round(rawDelta);
      if (c.currentShares + rounded < 0) return -c.currentShares;
      return rounded;
    }
    const decimals = Math.abs(rawDelta) < 0.1 || c.priceNative < 5 ? 4 : 2;
    const rounded = Number(rawDelta.toFixed(decimals));
    if (c.currentShares + rounded < 0) return -c.currentShares;
    return rounded;
  };

  const draftItems = allCandidates
    .map((c) => {
      const key = c.ticker.toUpperCase();
      const idealW = roundedTargets[key] || 0;
      const targetValInView = (idealW / 100) * targetPortfolioScaleInView;
      const rawDeltaInView = targetValInView - c.currentValInView;
      let rawDeltaShares = rawDeltaInView / c.priceInView;

      if (mode === 'BUY_ONLY' && rawDeltaShares < 0) {
        rawDeltaShares = 0;
      }

      let deltaShares = roundDeltaShares(rawDeltaShares, c);
      const minMeaningfulStep = c.asset.type === 'IDX_STOCK' ? (c.currentShares >= 100 ? 100 : 1) : 0.01;
      const weightDiff = idealW - c.currentWeight;
      const estTradeInView = Math.abs(deltaShares) * c.priceInView;

      // Ignore negligible drift (< 0.8% weight & < 0.5% portfolio value) unless it's a new anchor asset
      if (
        !c.isNewAsset &&
        (Math.abs(deltaShares) < minMeaningfulStep ||
          (Math.abs(weightDiff) < 0.8 && estTradeInView < totalBeforeInView * 0.006))
      ) {
        deltaShares = 0;
      }

      // Never sell 100% of an active holding automatically unless target weight is literally 0
      if (deltaShares < 0 && c.currentShares + deltaShares <= 0 && idealW > 0) {
        const minKeep = c.asset.type === 'IDX_STOCK' ? Math.min(100, c.currentShares) : Math.min(0.01, c.currentShares);
        deltaShares = -(c.currentShares - minKeep);
        deltaShares = roundDeltaShares(deltaShares, c);
      }

      const targetShares = Number(
        Math.max(0, c.currentShares + deltaShares).toFixed(c.asset.type === 'IDX_STOCK' ? 0 : 4)
      );
      const action: 'SELL' | 'BUY' | 'HOLD' =
        deltaShares < 0 ? 'SELL' : deltaShares > 0 ? 'BUY' : 'HOLD';

      // If new anchor rounded to 0 shares, skip adding noise row
      if (c.isNewAsset && action === 'HOLD') {
        return null;
      }

      const tradeValueInView = deltaShares * c.priceInView;
      const tradeValueNative = deltaShares * c.priceNative;

      const isEn = lang === 'en';
      let reason = isEn
        ? 'Weight is already aligned with your risk profile target'
        : 'Proporsi sudah selaras dengan target profil risiko';
      if (action === 'SELL') {
        if (c.currentWeight > capPerAsset && c.asset.beta > localizedProfile.maxTargetBeta) {
          reason = isEn
            ? `Weight ${c.currentWeight.toFixed(1)}% exceeds ${capPerAsset}% cap & high beta (${c.asset.beta})`
            : `Bobot ${c.currentWeight.toFixed(1)}% melampaui batas ${capPerAsset}% & beta tinggi (${c.asset.beta})`;
        } else if (c.currentWeight > capPerAsset) {
          reason = isEn
            ? `Concentration ${c.currentWeight.toFixed(1)}% exceeds ${capPerAsset}% single-asset cap`
            : `Konsentrasi ${c.currentWeight.toFixed(1)}% melampaui batas maksimal ${capPerAsset}%`;
        } else if (c.asset.beta > localizedProfile.maxTargetBeta) {
          reason = isEn
            ? `Reduce beta exposure (${c.asset.beta}) below ${localizedProfile.maxTargetBeta} limit`
            : `Turunkan eksposur beta (${c.asset.beta}) agar sesuai batas ${localizedProfile.maxTargetBeta}`;
        } else {
          reason = isEn
            ? `Reallocate partial gains to target-balancing assets`
            : `Realokasi sebagian laba ke aset penyeimbang target`;
        }
      } else if (action === 'BUY') {
        if (c.isNewAsset) {
          reason = isEn
            ? `Add ${c.asset.type === 'ETF' ? 'defensive ETF' : 'asset'} anchor to reach ${localizedProfile.suggestedEtfWeight}% ETF target & lower beta`
            : `Tambah jangkar ${c.asset.type === 'ETF' ? 'ETF defensif' : 'aset'} untuk penuhi target ETF ${localizedProfile.suggestedEtfWeight}% & tekan beta`;
        } else if (mode === 'BUY_ONLY') {
          reason = isEn
            ? `Top-up without selling to dilute overweight positions toward ${idealW.toFixed(1)}%`
            : `Top-up tanpa jual untuk mendilusi aset overweight menuju target ${idealW.toFixed(1)}%`;
        } else if (c.asset.type === 'ETF') {
          reason = isEn
            ? `Strengthen ETF sleeve toward ${localizedProfile.suggestedEtfWeight}% ideal weight`
            : `Perkuat porsi ETF menuju alokasi ideal ${localizedProfile.suggestedEtfWeight}%`;
        } else {
          reason = isEn
            ? `Add underweight shares to align with ${idealW.toFixed(1)}% target weight`
            : `Tambah porsi underweight agar selaras bobot target ${idealW.toFixed(1)}%`;
        }
      }

      return {
        candidate: c,
        ticker: c.ticker,
        name: c.asset.name,
        assetType: c.asset.type,
        nativeCurrency: (c.asset.type === 'IDX_STOCK' ? 'IDR' : 'USD') as 'IDR' | 'USD',
        priceNative: c.priceNative,
        priceInView: c.priceInView,
        beta: c.asset.beta,
        isNewAsset: c.isNewAsset,
        currentShares: c.currentShares,
        targetShares,
        deltaShares,
        action,
        currentWeight: c.currentWeight,
        idealTargetWeight: idealW,
        weightDeltaPct: Number((idealW - c.currentWeight).toFixed(1)),
        tradeValueInView,
        tradeValueNative,
        reason,
      };
    })
    .filter(Boolean) as Array<Omit<AutoRebalanceItem, 'projectedWeight'> & { candidate: PoolCandidate }>;

  // Build exact updatedHoldings resulting from applying these deltaShares
  const updatedHoldings: PortfolioHolding[] = [];
  draftItems.forEach((item, idx) => {
    if (item.targetShares <= 0) return;
    const prev = item.candidate.holding;
    if (prev) {
      let nextAvgBuy = prev.avgBuyPrice;
      if (item.deltaShares > 0 && item.targetShares > 0) {
        const oldCostInNative = convertToCurrency(
          prev.shares * prev.avgBuyPrice,
          prev.buyCurrency,
          item.nativeCurrency,
          exchangeRate
        );
        const addedCostInNative = item.deltaShares * item.priceNative;
        const blendedInBuyCurr = convertToCurrency(
          oldCostInNative + addedCostInNative,
          item.nativeCurrency,
          prev.buyCurrency,
          exchangeRate
        );
        if (Number.isFinite(blendedInBuyCurr) && blendedInBuyCurr > 0) {
          nextAvgBuy = Number(
            (blendedInBuyCurr / item.targetShares).toFixed(
              prev.buyCurrency === 'USD' ? (item.priceNative < 1 ? 4 : 2) : 0
            )
          );
        }
      }
      updatedHoldings.push({
        ...prev,
        shares: item.targetShares,
        avgBuyPrice: nextAvgBuy,
      });
    } else {
      updatedHoldings.push({
        id: `h-reb-${item.ticker.toLowerCase()}-${idx}-${Date.now()}`,
        ticker: item.ticker,
        shares: item.targetShares,
        avgBuyPrice: Number(
          item.priceNative.toFixed(item.nativeCurrency === 'USD' ? (item.priceNative < 1 ? 4 : 2) : 0)
        ),
        buyCurrency: item.nativeCurrency,
      });
    }
  });

  const afterMetrics = calculatePortfolioMetrics(
    updatedHoldings,
    localizedProfile.id,
    viewCurrency,
    liveQuotes,
    exchangeRate,
    lang
  );

  const items: AutoRebalanceItem[] = draftItems
    .map(({ candidate: _c, ...rest }) => {
      const afterH = afterMetrics.holdings.find(
        (h: any) => h.ticker.toUpperCase() === rest.ticker.toUpperCase()
      );
      return {
        ...rest,
        projectedWeight: afterH ? Number(afterH.weight.toFixed(1)) : rest.currentWeight,
      };
    })
    .sort((a, b) => {
      const order = { SELL: 0, BUY: 1, HOLD: 2 };
      if (order[a.action] !== order[b.action]) return order[a.action] - order[b.action];
      return Math.abs(b.tradeValueInView) - Math.abs(a.tradeValueInView);
    });

  let totalSellValueInView = 0;
  let totalBuyValueInView = 0;
  let sellCount = 0;
  let buyCount = 0;
  let holdCount = 0;
  const changes: string[] = [];
  const isEn = lang === 'en';
  const unit = isEn ? 'sh' : 'lbr';

  for (const item of items) {
    if (item.action === 'SELL') {
      totalSellValueInView += Math.abs(item.tradeValueInView);
      sellCount++;
      changes.push(
        isEn
          ? `Sell ${item.ticker} ${formatShareQuantity(Math.abs(item.deltaShares), lang)} ${unit} (${formatShareQuantity(item.currentShares, lang)} → ${formatShareQuantity(item.targetShares, lang)} ${unit} · ${item.reason})`
          : `Jual ${item.ticker} ${formatShareQuantity(Math.abs(item.deltaShares), lang)} ${unit} (${formatShareQuantity(item.currentShares, lang)} → ${formatShareQuantity(item.targetShares, lang)} ${unit} · ${item.reason})`
      );
    } else if (item.action === 'BUY') {
      totalBuyValueInView += item.tradeValueInView;
      buyCount++;
      changes.push(
        isEn
          ? `${item.isNewAsset ? 'Buy new asset' : 'Buy'} ${item.ticker} +${formatShareQuantity(item.deltaShares, lang)} ${unit} (${formatShareQuantity(item.currentShares, lang)} → ${formatShareQuantity(item.targetShares, lang)} ${unit} · ${item.reason})`
          : `${item.isNewAsset ? 'Beli aset baru' : 'Beli'} ${item.ticker} +${formatShareQuantity(item.deltaShares, lang)} ${unit} (${formatShareQuantity(item.currentShares, lang)} → ${formatShareQuantity(item.targetShares, lang)} ${unit} · ${item.reason})`
      );
    } else {
      holdCount++;
    }
  }

  const needsRebalance = sellCount > 0 || buyCount > 0;
  if (!needsRebalance) {
    changes.push(
      isEn
        ? `Your portfolio composition is already well-aligned with the ${localizedProfile.name} target weights.`
        : `Komposisi portofolio Anda sudah selaras dan optimal dengan target bobot profil ${localizedProfile.name}.`
    );
  }

  return {
    mode,
    profileId: localizedProfile.id,
    profileName: localizedProfile.name,
    viewCurrency,
    items,
    totalPortfolioBeforeInView: beforeMetrics.totalValue,
    totalPortfolioAfterInView: afterMetrics.totalValue,
    totalSellValueInView,
    totalBuyValueInView,
    netCashRequiredInView: totalBuyValueInView - totalSellValueInView,
    sellCount,
    buyCount,
    holdCount,
    beforeScore: beforeMetrics.healthScore,
    afterScore: afterMetrics.healthScore,
    beforeBeta: beforeMetrics.weightedBeta,
    afterBeta: afterMetrics.weightedBeta,
    beforeDiversification: beforeMetrics.diversificationScore,
    afterDiversification: afterMetrics.diversificationScore,
    needsRebalance,
    changes,
    updatedHoldings,
  };
}

export function applyPortfolioOptimization(
  holdings: PortfolioHolding[],
  riskProfile: RiskProfile,
  liveQuotes?: Record<string, { price: number; changePercent?: number; isLiveFound?: boolean }>,
  exchangeRate: number = USD_TO_IDR_RATE,
  mode: RebalanceMode = 'SELL_AND_BUY',
  viewCurrency: 'IDR' | 'USD' = 'IDR',
  lang: AppLanguage = 'id'
): OptimizationApplyResult | null {
  const plan = calculateAutoRebalancePlan(
    holdings,
    riskProfile,
    viewCurrency,
    liveQuotes,
    exchangeRate,
    mode,
    lang
  );
  if (!plan) return null;

  return {
    mode: plan.mode,
    updatedHoldings: plan.updatedHoldings,
    applied: plan.needsRebalance,
    changes: plan.changes,
    beforeScore: plan.beforeScore,
    afterScore: plan.afterScore,
    beforeBeta: plan.beforeBeta,
    afterBeta: plan.afterBeta,
  };
}





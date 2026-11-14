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

export const USD_TO_IDR_RATE = 15840;

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
      { ticker: 'NVDA', shares: 25, avgBuyPrice: 120.0, buyCurrency: 'USD' },
      { ticker: 'MSFT', shares: 8, avgBuyPrice: 400.0, buyCurrency: 'USD' },
      { ticker: 'AAPL', shares: 12, avgBuyPrice: 215.0, buyCurrency: 'USD' },
      { ticker: 'QQQ', shares: 10, avgBuyPrice: 480.0, buyCurrency: 'USD' },
      { ticker: 'AMZN', shares: 15, avgBuyPrice: 185.0, buyCurrency: 'USD' },
    ],
  },
  {
    id: 'balanced_indo_us',
    name: 'Global & Bluechip RI Balanced',
    badge: 'All-Weather Seimbang',
    description: 'Kombinasi bank pilar Indonesia (BBCA, BBRI), indeks S&P 500 (VOO), dan emas (GLD) untuk kestabilan jangka panjang.',
    recommendedRiskProfile: 'moderat',
    holdings: [
      { ticker: 'BBCA', shares: 4500, avgBuyPrice: 9500, buyCurrency: 'IDR' },
      { ticker: 'BBRI', shares: 6000, avgBuyPrice: 4800, buyCurrency: 'IDR' },
      { ticker: 'VOO', shares: 6, avgBuyPrice: 510.0, buyCurrency: 'USD' },
      { ticker: 'TLKM', shares: 5000, avgBuyPrice: 3100, buyCurrency: 'IDR' },
      { ticker: 'GLD', shares: 8, avgBuyPrice: 220.0, buyCurrency: 'USD' },
    ],
  },
  {
    id: 'dividend_cashflow',
    name: 'Dividen Cashflow Mantap',
    badge: 'Penghasilan Pasif',
    description: 'Fokus dividen yield tinggi dan stabil melalui ETF SCHD, saham bluechip perbankan dan konglomerasi otomotif.',
    recommendedRiskProfile: 'konservatif',
    holdings: [
      { ticker: 'SCHD', shares: 30, avgBuyPrice: 80.0, buyCurrency: 'USD' },
      { ticker: 'VIG', shares: 15, avgBuyPrice: 198.0, buyCurrency: 'USD' },
      { ticker: 'BBCA', shares: 3000, avgBuyPrice: 9800, buyCurrency: 'IDR' },
      { ticker: 'ASII', shares: 4000, avgBuyPrice: 5200, buyCurrency: 'IDR' },
      { ticker: 'JNJ', shares: 10, avgBuyPrice: 150.0, buyCurrency: 'USD' },
      { ticker: 'VOO', shares: 3, avgBuyPrice: 525.0, buyCurrency: 'USD' },
    ],
  },
  {
    id: 'aggressive_ai_momentum',
    name: 'Disrupsi AI & High Beta',
    badge: 'Volatilitas Tinggi',
    description: 'Portofolio berisiko tinggi dengan fokus semikonduktor, Tesla, dan inovasi eksponensial.',
    recommendedRiskProfile: 'sangat_agresif',
    holdings: [
      { ticker: 'NVDA', shares: 30, avgBuyPrice: 110.0, buyCurrency: 'USD' },
      { ticker: 'TSLA', shares: 14, avgBuyPrice: 260.0, buyCurrency: 'USD' },
      { ticker: 'SMH', shares: 12, avgBuyPrice: 235.0, buyCurrency: 'USD' },
      { ticker: 'ARKK', shares: 40, avgBuyPrice: 48.0, buyCurrency: 'USD' },
      { ticker: 'GOTO', shares: 50000, avgBuyPrice: 80, buyCurrency: 'IDR' },
    ],
  },
];

const CUSTOM_ASSETS_STORAGE_KEY = 'portolens_custom_assets_v1';

const BASE_ASSET_MAP: Map<string, Asset> = new Map(
  AVAILABLE_ASSETS.map((asset) => [asset.ticker.toUpperCase(), asset])
);

let cachedCustomAssets: Asset[] | null = null;
let cachedAllAssets: Asset[] | null = null;
let cachedCustomMap: Map<string, Asset> | null = null;

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
  updatedSector?: string
): Asset[] {
  const upper = ticker.toUpperCase();
  const customAssets = loadCustomAssets();
  const existing = customAssets.find((a) => a.ticker.toUpperCase() === upper);
  if (!existing) return getAllAssets();

  const label =
    newType === 'IDX_STOCK'
      ? 'Saham IHSG (IDX)'
      : newType === 'US_STOCK'
      ? 'Saham AS (Wall Street)'
      : 'ETF Global';

  const defaultSector =
    newType === 'IDX_STOCK'
      ? 'Bursa Efek Indonesia'
      : newType === 'US_STOCK'
      ? 'Wall Street Global'
      : 'ETF Indeks & Sektoral';

  const resolvedSector =
    updatedSector?.trim() ||
    (['Bursa Efek Indonesia', 'Wall Street Global', 'ETF Indeks & Sektoral'].includes(existing.sector)
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
    marketCap: newType === 'IDX_STOCK' ? 'Emiten IDX' : newType === 'ETF' ? 'ETF Global' : 'Emiten AS',
    description: `Instrumen ${label} yang didaftarkan oleh Anda ke katalog PortoLens AI.`,
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
    normalized = parts.length > 2 ? cleaned.replace(/,/g, '') : cleaned.replace(',', '.');
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
export function formatShareQuantity(shares: number): string {
  return shares.toLocaleString('id-ID', {
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
  liveExchangeRate?: number
) {
  const profile = RISK_PROFILES[riskProfileId] || RISK_PROFILES.moderat;
  const currentFxRate = liveExchangeRate || USD_TO_IDR_RATE;

  let totalValueCurrent = 0;
  let totalCostBasis = 0;

  const enrichedHoldings = holdings
    .map((item) => {
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

      const currentValNative = item.shares * effectivePrice;
      const currentValInView = convertToCurrency(currentValNative, nativeCurrency, viewCurrency, currentFxRate);

      const costBasisNative = item.shares * item.avgBuyPrice;
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

  // Overall Health Score: Weighted combination
  const healthScore = Math.round(
    diversificationScore * 0.35 +
    riskManagementScore * 0.45 +
    (weightedDivYield > 1.5 ? 20 : weightedDivYield * 10)
  );

  let healthGrade = 'C';
  if (healthScore >= 90) healthGrade = 'A+';
  else if (healthScore >= 80) healthGrade = 'A';
  else if (healthScore >= 70) healthGrade = 'B+';
  else if (healthScore >= 60) healthGrade = 'B';
  else if (healthScore >= 50) healthGrade = 'C+';
  else healthGrade = 'D';

  // Rule-based issue detector
  const issuesDetected: Array<{ title: string; severity: 'high' | 'medium' | 'info'; desc: string }> = [];

  if (maxAssetWeight > profile.maxSingleAssetAllocation) {
    const topAsset = finalizedHoldings.find((h) => h.weight === maxAssetWeight);
    issuesDetected.push({
      title: `Konsentrasi Single-Asset Berlebih (${topAsset?.ticker})`,
      severity: maxAssetWeight > 35 ? 'high' : 'medium',
      desc: `Porsi ${topAsset?.ticker} mencapai ${maxAssetWeight.toFixed(1)}%, melebihi rekomendasi ${profile.name} (maks ${profile.maxSingleAssetAllocation}%). Kejatuhan pada emiten ini akan berdampak fatal pada portofolio Anda.`,
    });
  }

  if (weightedBeta > profile.maxTargetBeta) {
    issuesDetected.push({
      title: `Beta Portofolio (${weightedBeta.toFixed(2)}) Melampaui Batas Toleransi`,
      severity: 'high',
      desc: `Profil ${profile.name} memiliki toleransi beta ${profile.targetBetaRange}. Portofolio Anda saat ini terlalu sensitif terhadap penurunan pasar (bear market).`,
    });
  }

  if (maxSectorWeight > profile.maxSingleSectorAllocation) {
    const topSector = Object.entries(sectorMap).find(([_, w]) => w === maxSectorWeight)?.[0];
    issuesDetected.push({
      title: `Risiko Sektoral Tinggi di ${topSector}`,
      severity: 'medium',
      desc: `Sektor ini mendominasi ${maxSectorWeight.toFixed(1)}% aset Anda. Bila ada regulasi negatif atau siklus pelemahan sektor, seluruh portofolio rentan tertekan.`,
    });
  }

  const etfWeight = typeMap['ETF'] || 0;
  if (etfWeight < profile.suggestedEtfWeight * 0.5) {
    issuesDetected.push({
      title: 'Porsi ETF Penstabil Kurang Optimal',
      severity: 'info',
      desc: `Portofolio baru memiliki ${etfWeight.toFixed(1)}% ETF (disarankan minimal ${profile.suggestedEtfWeight}% untuk profil ${profile.name}). ETF indeks membantu diversifikasi tanpa perlu memantau ratusan saham harian.`,
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
        targetChange: `Pangkas -${trimAmount}% (ke ${profile.maxSingleAssetAllocation}%)`,
        rationale: `Mengamankan laba dan mendistribusikan risiko agar tidak bergantung pada 1 saham saja.`,
      });
    }
  });

  if (weightedBeta > profile.maxTargetBeta) {
    optimizationSuggestions.push({
      action: 'TAMBAH',
      ticker: 'VOO',
      name: 'Vanguard S&P 500 ETF',
      targetChange: 'Alokasikan 10% - 15%',
      rationale: 'Menurunkan beta portofolio secara terukur dan memberikan eksposur langsung ke 500 perusahaan raksasa dunia.',
    });
    optimizationSuggestions.push({
      action: 'TAMBAH',
      ticker: 'SCHD / GLD',
      name: 'Dividen Defensif & Emas',
      targetChange: 'Alokasikan 5% - 10%',
      rationale: 'Memberikan bantalan proteksi saat Wall Street bergejolak serta arus kas dividen teratur.',
    });
  }

  // 12-Month Historical Portfolio Backtest Curve
  const historySeries = Array.from({ length: 12 }).map((_, idx) => {
    const monthPortfolio = finalizedHoldings.reduce((acc, h) => {
      const val = h.asset.history12M[idx] || 100;
      return acc + (h.weight / 100) * val;
    }, 0);
    // Baseline SPY benchmark
    const monthBenchmark = 84 + idx * 2.8;
    return {
      month: ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'][idx],
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
      label: type === 'US_STOCK' ? 'Saham AS' : type === 'IDX_STOCK' ? 'Saham IDX (RI)' : 'ETF Global',
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

export function buildFallbackBenchmarkHistory(range: BenchmarkRangeKey): BenchmarkHistoryPoint[] {
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
        ? d.toLocaleDateString('id-ID', { month: 'short', year: '2-digit' })
        : d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }),
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


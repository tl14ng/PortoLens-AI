import React, { useState, useMemo, useEffect, useRef, useCallback, Suspense } from 'react';
import {
  PortfolioHolding,
  PRESET_PORTFOLIOS,
  PresetPortfolio,
  calculatePortfolioMetrics,
  getAssetByTicker,
  getLocalizedRiskProfile,
  convertToCurrency,
  Asset,
  PriceAlert,
  USD_TO_IDR_RATE,
  applyPortfolioOptimization,
  OptimizationApplyResult,
  RebalanceMode,
} from './data/marketData';
import { useLanguage } from './i18n/LanguageContext';
import { AndroidHeader } from './components/AndroidHeader';
import { LiveMarketBar } from './components/LiveMarketBar';
import { BottomTabBar, TabKey } from './components/BottomTabBar';
import { PortfolioTab } from './components/PortfolioTab';
import { AndroidNotificationBanner } from './components/AndroidNotificationBanner';
import { playNotificationChime } from './utils/audio';
import { fetchAppApi } from './services/apkClientBridge';

const SearchTickerTab = React.lazy(() =>
  import('./components/SearchTickerTab').then((m) => ({ default: m.SearchTickerTab }))
);
const ScoreTab = React.lazy(() =>
  import('./components/ScoreTab').then((m) => ({ default: m.ScoreTab }))
);
const OptimizationTab = React.lazy(() =>
  import('./components/OptimizationTab').then((m) => ({ default: m.OptimizationTab }))
);
const MarketTrendsTab = React.lazy(() =>
  import('./components/MarketTrendsTab').then((m) => ({ default: m.MarketTrendsTab }))
);
const DividendCalendarTab = React.lazy(() =>
  import('./components/DividendCalendarTab').then((m) => ({ default: m.DividendCalendarTab }))
);
const AddAssetModal = React.lazy(() =>
  import('./components/AddAssetModal').then((m) => ({ default: m.AddAssetModal }))
);
const RiskProfileModal = React.lazy(() =>
  import('./components/RiskProfileModal').then((m) => ({ default: m.RiskProfileModal }))
);
const AssetDetailModal = React.lazy(() =>
  import('./components/AssetDetailModal').then((m) => ({ default: m.AssetDetailModal }))
);
const PriceAlertModal = React.lazy(() =>
  import('./components/PriceAlertModal').then((m) => ({ default: m.PriceAlertModal }))
);
const PriceAlertDrawer = React.lazy(() =>
  import('./components/PriceAlertDrawer').then((m) => ({ default: m.PriceAlertDrawer }))
);
const OnboardingTutorialModal = React.lazy(() =>
  import('./components/OnboardingTutorialModal').then((m) => ({ default: m.OnboardingTutorialModal }))
);

type LiveQuoteEntry = {
  price: number;
  change?: number;
  changePercent?: number;
  currency: string;
  isLiveFound?: boolean;
};

function areQuotesEqual(
  prev: Record<string, LiveQuoteEntry>,
  incoming: Record<string, LiveQuoteEntry>
): boolean {
  const keys = Object.keys(incoming);
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    const p = prev[k];
    const n = incoming[k];
    if (!p || !n) return false;
    if (
      p.price !== n.price ||
      p.change !== n.change ||
      p.changePercent !== n.changePercent ||
      p.currency !== n.currency ||
      p.isLiveFound !== n.isLiveFound
    ) {
      return false;
    }
  }
  return true;
}

const TabLoadingFallback: React.FC = () => (
  <div className="pb-24 pt-6 px-4 max-w-lg mx-auto space-y-3 animate-pulse">
    <div className="h-28 rounded-3xl bg-slate-900 border border-slate-800" />
    <div className="h-44 rounded-2xl bg-slate-900 border border-slate-800" />
    <div className="h-24 rounded-2xl bg-slate-900 border border-slate-800" />
  </div>
);

export default function App() {
  const { language, locale, t } = useLanguage();

  // Active Tab state
  const [activeTab, setActiveTab] = useState<TabKey | 'dividends'>('portfolio');

  // Currency view state (IDR or USD)
  const [currency, setCurrency] = useState<'IDR' | 'USD'>(() => {
    try {
      const saved = window.localStorage.getItem('portolens_currency_v1');
      return saved === 'USD' ? 'USD' : 'IDR';
    } catch {
      return 'IDR';
    }
  });

  // Selected Risk Profile
  const [riskProfileId, setRiskProfileId] = useState<string>(() => {
    try {
      return window.localStorage.getItem('portolens_profile_v1') || 'moderat';
    } catch {
      return 'moderat';
    }
  });

  // Device Frame simulation (Mobile phone frame on desktop)
  const [isDeviceFramed, setIsDeviceFramed] = useState<boolean>(true);

  // Current active preset tracking ('custom' when user builds/edits their own portfolio)
  const [currentPresetId, setCurrentPresetId] = useState<string>(() => {
    try {
      const savedPreset = window.localStorage.getItem('portolens_preset_id_v1');
      if (savedPreset) return savedPreset;
      const savedHoldings = window.localStorage.getItem('portolens_holdings_v1');
      return savedHoldings ? 'custom' : PRESET_PORTFOLIOS[1].id;
    } catch {
      return PRESET_PORTFOLIOS[1].id;
    }
  });

  // Real-time market quotes dictionary (ticker -> { price, change, changePercent, currency, isLiveFound })
  const [liveQuotes, setLiveQuotes] = useState<
    Record<string, { price: number; change?: number; changePercent?: number; currency: string; isLiveFound?: boolean }>
  >({});
  const [usdIdrRate, setUsdIdrRate] = useState<number>(() => {
    try {
      const saved = Number(window.localStorage.getItem('portolens_usd_idr_v1'));
      if (Number.isFinite(saved) && saved > 1000) return saved;
    } catch {
      // ignore storage errors
    }
    return USD_TO_IDR_RATE;
  });
  const [usdIdrChange, setUsdIdrChange] = useState<number>(0);
  const [usdIdrSource, setUsdIdrSource] = useState<string>('Live FX');
  const [lastUpdatedTime, setLastUpdatedTime] = useState<string>('');
  const [isFetchingLive, setIsFetchingLive] = useState<boolean>(false);

  // Simulated live market prices overrides (ticker -> price) for user testing
  const [simulatedPrices, setSimulatedPrices] = useState<Record<string, number>>({});

  // Price Alerts State (Persisted to localStorage with 2 initial target alerts)
  const [alerts, setAlerts] = useState<PriceAlert[]>(() => {
    const isEnInit =
      typeof window !== 'undefined' &&
      window.localStorage.getItem('portolens_lang_v1') === 'en';
    const defaultAlerts: PriceAlert[] = [
      {
        id: 'alert-1',
        ticker: 'NVDA',
        assetName: 'NVIDIA Corporation',
        type: 'EXIT',
        condition: 'ABOVE_OR_EQUAL',
        targetPrice: 175.0,
        currentPriceAtCreation: 156.14,
        currency: 'USD',
        note: isEnInit
          ? 'Gradual take-profit target on new AI rally'
          : 'Target Take Profit bertahap saat rally AI baru',
        status: 'ACTIVE',
        createdAt: isEnInit ? 'Today' : 'Hari ini',
      },
      {
        id: 'alert-2',
        ticker: 'BBCA',
        assetName: 'Bank Central Asia Tbk',
        type: 'ENTRY',
        condition: 'BELOW_OR_EQUAL',
        targetPrice: 5300,
        currentPriceAtCreation: 5600,
        currency: 'IDR',
        note: isEnInit
          ? 'Buy on dip / accumulate on pullback'
          : 'Buy on Dip / Tambah muatan saat harga diskon',
        status: 'ACTIVE',
        createdAt: isEnInit ? 'Today' : 'Hari ini',
      },
    ];
    try {
      const saved = window.localStorage.getItem('portolens_alerts_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.filter(
            (a: any) =>
              a &&
              typeof a.id === 'string' &&
              typeof a.ticker === 'string' &&
              Number.isFinite(Number(a.targetPrice)) &&
              Number(a.targetPrice) > 0
          );
        }
      }
    } catch {
      // ignore storage errors
    }
    return defaultAlerts;
  });

  // Active triggered alert for Heads-Up notification banner
  const [activeBannerAlert, setActiveBannerAlert] = useState<PriceAlert | null>(null);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [preselectedAddAsset, setPreselectedAddAsset] = useState<Asset | null>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isAlertModalOpen, setIsAlertModalOpen] = useState(false);
  const [isAlertDrawerOpen, setIsAlertDrawerOpen] = useState(false);
  const [alertTargetTicker, setAlertTargetTicker] = useState<string>('NVDA');

  const [isOnboardingOpen, setIsOnboardingOpen] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem('portolens_onboarding_seen_v1') !== 'true';
    } catch {
      return false;
    }
  });

  const handleCloseOnboarding = useCallback(() => {
    setIsOnboardingOpen(false);
    try {
      window.localStorage.setItem('portolens_onboarding_seen_v1', 'true');
    } catch {
      // ignore storage errors
    }
  }, []);

  const [selectedAssetForDetail, setSelectedAssetForDetail] = useState<{
    asset: Asset;
    holding: PortfolioHolding | null;
  } | null>(null);

  const [preOptimizationSnapshot, setPreOptimizationSnapshot] = useState<{
    holdings: PortfolioHolding[];
    presetId: string;
    profileId: string;
    result: OptimizationApplyResult;
  } | null>(null);

  // Initial Holdings: Restore saved personal portfolio from localStorage, or seed initial holdings
  const [holdings, setHoldings] = useState<PortfolioHolding[]>(() => {
    try {
      const saved = window.localStorage.getItem('portolens_holdings_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed
            .filter(
              (h: any) =>
                h &&
                typeof h.ticker === 'string' &&
                h.ticker.trim().length > 0 &&
                Number.isFinite(Number(h.shares)) &&
                Number(h.shares) > 0 &&
                Number.isFinite(Number(h.avgBuyPrice)) &&
                Number(h.avgBuyPrice) > 0
            )
            .map((h: any, i: number) => ({
              id: typeof h.id === 'string' && h.id ? h.id : `h-restored-${i}`,
              ticker: h.ticker.trim().toUpperCase(),
              shares: Number(h.shares),
              avgBuyPrice: Number(h.avgBuyPrice),
              buyCurrency: h.buyCurrency === 'USD' || h.buyCurrency === 'IDR'
                ? h.buyCurrency
                : getAssetByTicker(h.ticker)?.currency || 'USD',
            }));
        }
      }
    } catch {
      // ignore storage errors
    }
    const defaultPreset = PRESET_PORTFOLIOS[1]; // Balanced Indo-US initial starter
    return defaultPreset.holdings.map((h, i) => ({
      id: `h-${i}`,
      ticker: h.ticker,
      shares: h.shares,
      avgBuyPrice: h.avgBuyPrice,
      buyCurrency: h.buyCurrency,
    }));
  });

  // Persist user's personal portfolio & settings to localStorage
  useEffect(() => {
    try {
      window.localStorage.setItem('portolens_holdings_v1', JSON.stringify(holdings));
    } catch {
      // ignore storage errors
    }
  }, [holdings]);

  useEffect(() => {
    try {
      window.localStorage.setItem('portolens_profile_v1', riskProfileId);
    } catch {
      // ignore storage errors
    }
  }, [riskProfileId]);

  useEffect(() => {
    try {
      window.localStorage.setItem('portolens_currency_v1', currency);
    } catch {
      // ignore storage errors
    }
  }, [currency]);

  useEffect(() => {
    try {
      window.localStorage.setItem('portolens_preset_id_v1', currentPresetId);
    } catch {
      // ignore storage errors
    }
  }, [currentPresetId]);

  useEffect(() => {
    try {
      window.localStorage.setItem('portolens_alerts_v1', JSON.stringify(alerts));
    } catch {
      // ignore storage errors
    }
  }, [alerts]);

  // Track currently inspected asset ticker so polling keeps detail modal live
  const selectedDetailAssetRef = useRef<Asset | null>(null);
  useEffect(() => {
    selectedDetailAssetRef.current = selectedAssetForDetail?.asset || null;
  }, [selectedAssetForDetail]);

  // Effective real-time quotes combining live stream and any simulation overrides
  const effectiveQuotes = useMemo(() => {
    const merged = { ...liveQuotes };
    Object.entries(simulatedPrices).forEach(([ticker, price]) => {
      const assetCurrency = getAssetByTicker(ticker)?.currency;
      merged[ticker] = {
        price,
        change: 0,
        changePercent: 0,
        currency:
          merged[ticker]?.currency ||
          assetCurrency ||
          (ticker.endsWith('.JK') ? 'IDR' : 'USD'),
        isLiveFound: true,
      };
    });
    return merged;
  }, [liveQuotes, simulatedPrices]);

  // Slice effectiveQuotes strictly to held assets so unrelated market bar ticks never trigger portfolio recalculation
  const prevHeldQuotesRef = useRef<Record<string, LiveQuoteEntry>>({});
  const holdingsRelevantQuotes = useMemo(() => {
    const subset: Record<string, LiveQuoteEntry> = {};
    for (const h of holdings) {
      const ticker = h.ticker;
      const upper = ticker.toUpperCase();
      const base = getAssetByTicker(upper);
      const keysToCheck = [ticker, upper];
      if (!base || base.type === 'IDX_STOCK') {
        keysToCheck.push(`${upper}.JK`);
      }
      for (const k of keysToCheck) {
        if (effectiveQuotes[k]) {
          subset[k] = effectiveQuotes[k];
        }
      }
    }
    const prev = prevHeldQuotesRef.current;
    const nextKeys = Object.keys(subset);
    const prevKeys = Object.keys(prev);
    if (nextKeys.length === prevKeys.length && areQuotesEqual(prev, subset)) {
      return prev;
    }
    prevHeldQuotesRef.current = subset;
    return subset;
  }, [holdings, effectiveQuotes]);

  // Quantitative Metrics Calculation (using only held live quotes, live FX rate & active language)
  const metrics = useMemo(() => {
    return calculatePortfolioMetrics(
      holdings,
      riskProfileId,
      currency,
      holdingsRelevantQuotes,
      usdIdrRate,
      language
    );
  }, [holdings, riskProfileId, currency, holdingsRelevantQuotes, usdIdrRate, language]);

  const currentProfile = useMemo(
    () => getLocalizedRiskProfile(riskProfileId, language),
    [riskProfileId, language]
  );

  // Keep refs to latest alerts, simulatedPrices, liveQuotes, effectiveQuotes, holdings, currency & profile so polling & memoized callbacks avoid stale closures
  const alertsRef = useRef(alerts);
  alertsRef.current = alerts;
  const simulatedPricesRef = useRef(simulatedPrices);
  simulatedPricesRef.current = simulatedPrices;
  const liveQuotesRef = useRef(liveQuotes);
  liveQuotesRef.current = liveQuotes;
  const effectiveQuotesRef = useRef(effectiveQuotes);
  effectiveQuotesRef.current = effectiveQuotes;
  const holdingsRef = useRef(holdings);
  holdingsRef.current = holdings;
  const usdIdrRateRef = useRef(usdIdrRate);
  usdIdrRateRef.current = usdIdrRate;
  const currentProfileRef = useRef(currentProfile);
  currentProfileRef.current = currentProfile;
  const currencyRef = useRef(currency);
  currencyRef.current = currency;
  const languageRef = useRef(language);
  languageRef.current = language;
  const liveFetchIdRef = useRef(0);
  const lastPollAtRef = useRef<number>(0);
  const polledSymbolsRef = useRef<Set<string>>(new Set());

  const holdingTickers = useMemo(() => holdings.map((h) => h.ticker), [holdings]);

  // Real-time market fetch function (covers featured market bar + user holdings + active alerts + inspected detail asset)
  const fetchLiveQuotes = async (showSpinner: boolean = false) => {
    const fetchId = ++liveFetchIdRef.current;
    lastPollAtRef.current = Date.now();
    const shouldShowSpinner = showSpinner || Object.keys(liveQuotesRef.current).length === 0;
    try {
      if (shouldShowSpinner) {
        setIsFetchingLive(true);
      }
      const featuredMarketSymbols = [
        'NVDA', 'BBCA.JK', 'VOO', 'PLTR', 'BBNI.JK', 'AAPL', 'BBRI.JK',
        'SCHD', 'ANTM.JK', 'SPY', 'TSLA', 'QQQ', 'ASII.JK', 'AMMN.JK',
        'MSFT', 'AMZN', 'GOOGL', 'META', 'BMRI.JK', 'TLKM.JK', 'GLD', 'SMH', 'VIG', 'JNJ', 'ARKK', 'GOTO.JK',
      ];
      const toYahooSym = (ticker: string) => {
        const asset = getAssetByTicker(ticker);
        if (!asset) return ticker;
        return asset.type === 'IDX_STOCK' ? `${asset.ticker}.JK` : asset.ticker;
      };
      const holdingSymbols = holdingsRef.current.map((h) => toYahooSym(h.ticker));
      const alertSymbols = alertsRef.current.map((a) => toYahooSym(a.ticker));
      const detailAsset = selectedDetailAssetRef.current;
      const detailSymbols = detailAsset
        ? [detailAsset.type === 'IDX_STOCK' ? `${detailAsset.ticker}.JK` : detailAsset.ticker]
        : [];
      const allSymbols = Array.from(
        new Set([...featuredMarketSymbols, ...holdingSymbols, ...alertSymbols, ...detailSymbols])
      );
      allSymbols.forEach((s) => polledSymbolsRef.current.add(s.toUpperCase()));
      const query = `?symbols=${encodeURIComponent(allSymbols.join(','))}`;
      const result = await fetchAppApi<any>(`/api/live-quotes${query}`);
      if (fetchId !== liveFetchIdRef.current) return;
      if (result.ok && result.data) {
        const data = result.data;
        const incomingRate = Number(data.exchangeRateUSDIDR);
        const isLiveRate = data.exchangeRateIsLive !== false;
        const canApplyRate =
          Number.isFinite(incomingRate) &&
          incomingRate > 1000 &&
          (isLiveRate || !(usdIdrRateRef.current > 1000));
        const nextRate = canApplyRate ? incomingRate : usdIdrRateRef.current;
        const incomingQuotes = data.quotes as Record<string, LiveQuoteEntry> | undefined;
        let activeQuotes = liveQuotesRef.current;
        if (incomingQuotes && !areQuotesEqual(liveQuotesRef.current, incomingQuotes)) {
          const mergedQuotes = { ...liveQuotesRef.current, ...incomingQuotes };
          liveQuotesRef.current = mergedQuotes;
          activeQuotes = mergedQuotes;
          setLiveQuotes(mergedQuotes);
        }
        if (canApplyRate && incomingRate !== usdIdrRateRef.current) {
          usdIdrRateRef.current = incomingRate;
          setUsdIdrRate(incomingRate);
          if (isLiveRate) {
            try {
              window.localStorage.setItem('portolens_usd_idr_v1', String(incomingRate));
            } catch {
              // ignore storage errors
            }
          }
        }
        if (isLiveRate && typeof data.exchangeRateChange === 'number' && Number.isFinite(data.exchangeRateChange)) {
          setUsdIdrChange(data.exchangeRateChange);
        }
        if (isLiveRate && typeof data.exchangeRateSource === 'string' && data.exchangeRateSource) {
          setUsdIdrSource(data.exchangeRateSource);
        }
        if (data.lastUpdated) {
          setLastUpdatedTime(data.lastUpdated);
        }
        // Immediately check and trigger price alerts with latest quotes!
        evaluateAlerts(alertsRef.current, simulatedPricesRef.current, activeQuotes, nextRate);
      }
    } catch {
      // Transient quote fetch issue; fallback catalog/cached quotes stay active until next poll tick
    } finally {
      if (shouldShowSpinner && fetchId === liveFetchIdRef.current) {
        setIsFetchingLive(false);
      }
    }
  };

  const fetchLiveQuotesRef = useRef(fetchLiveQuotes);
  fetchLiveQuotesRef.current = fetchLiveQuotes;
  const stableRefreshLiveQuotes = useCallback(() => {
    fetchLiveQuotesRef.current(true);
  }, []);

  const holdingsKey = holdings.map((h) => h.ticker).join(',');
  const activeAlertSymbolsKey = alerts
    .filter((a) => a.status === 'ACTIVE')
    .map((a) => a.ticker)
    .sort()
    .join(',');

  // Real-time market polling loop (visibility-aware, skips duplicate burst on alert-status change)
  useEffect(() => {
    const toYahooSym = (ticker: string) => {
      const asset = getAssetByTicker(ticker);
      if (!asset) return ticker.toUpperCase();
      return (asset.type === 'IDX_STOCK' ? `${asset.ticker}.JK` : asset.ticker).toUpperCase();
    };
    const trackedSymbols = [
      ...holdingsRef.current.map((h) => toYahooSym(h.ticker)),
      ...alertsRef.current.filter((a) => a.status === 'ACTIVE').map((a) => toYahooSym(a.ticker)),
    ];
    const hasUnpolledSymbol = trackedSymbols.some((s) => !polledSymbolsRef.current.has(s));
    const msSinceLastPoll = Date.now() - lastPollAtRef.current;

    if (lastPollAtRef.current === 0 || hasUnpolledSymbol || msSinceLastPoll >= 1500) {
      fetchLiveQuotesRef.current();
    }

    const interval = window.setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      fetchLiveQuotesRef.current();
    }, 4500);

    const handleVisibilityChange = () => {
      if (typeof document !== 'undefined' && !document.hidden) {
        if (Date.now() - lastPollAtRef.current > 2000) {
          fetchLiveQuotesRef.current();
        }
      }
    };
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }

    return () => {
      window.clearInterval(interval);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
    };
  }, [holdingsKey, activeAlertSymbolsKey]);

  const localeRef = useRef(locale);
  localeRef.current = locale;

  // PRICE ALERT MONITORING & TRIGGER ENGINE
  const evaluateAlerts = (
    currentAlerts: PriceAlert[],
    currentSimPrices: Record<string, number>,
    currentLiveQuotes: Record<string, { price: number; currency?: string; isLiveFound?: boolean }> = liveQuotes,
    currentRate: number = usdIdrRateRef.current
  ) => {
    let triggeredAny = false;
    const nowTime = new Date().toLocaleTimeString(localeRef.current, {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    const updatedAlerts = currentAlerts.map((alert) => {
      if (alert.status !== 'ACTIVE') return alert;

      const normalizedTicker = alert.ticker.toUpperCase();
      const baseAsset = getAssetByTicker(normalizedTicker);
      const liveEntry =
        currentLiveQuotes[alert.ticker] ||
        currentLiveQuotes[normalizedTicker] ||
        (baseAsset?.type === 'IDX_STOCK' ? currentLiveQuotes[`${normalizedTicker}.JK`] : undefined);
      const hasValidLive =
        typeof liveEntry?.price === 'number' &&
        Number.isFinite(liveEntry.price) &&
        liveEntry.price > 0 &&
        liveEntry.isLiveFound !== false;
      const simPrice =
        currentSimPrices[alert.ticker] !== undefined
          ? currentSimPrices[alert.ticker]
          : currentSimPrices[normalizedTicker];

      const nativeCurrency: 'IDR' | 'USD' =
        baseAsset?.type === 'IDX_STOCK'
          ? 'IDR'
          : liveEntry?.currency === 'IDR' || baseAsset?.currency === 'IDR'
          ? 'IDR'
          : 'USD';

      // Priority: Simulator price -> Real-time live quote -> Base catalog price (normalized to alert.currency)
      let currentPrice = alert.currentPriceAtCreation;
      if (simPrice !== undefined) {
        currentPrice = convertToCurrency(simPrice, nativeCurrency, alert.currency, currentRate);
      } else {
        const rawMarketPrice = hasValidLive
          ? liveEntry.price
          : baseAsset?.price || alert.currentPriceAtCreation;
        currentPrice = convertToCurrency(rawMarketPrice, nativeCurrency, alert.currency, currentRate);
      }

      let isTriggered = false;
      if (alert.condition === 'ABOVE_OR_EQUAL' && currentPrice >= alert.targetPrice) {
        isTriggered = true;
      } else if (alert.condition === 'BELOW_OR_EQUAL' && currentPrice <= alert.targetPrice) {
        isTriggered = true;
      }

      if (isTriggered) {
        triggeredAny = true;
        const triggeredAlert: PriceAlert = {
          ...alert,
          status: 'TRIGGERED',
          triggeredAt: nowTime,
          isRead: false,
        };
        setActiveBannerAlert(triggeredAlert);
        playNotificationChime();
        return triggeredAlert;
      }

      return alert;
    });

    if (triggeredAny) {
      setAlerts(updatedAlerts);
    }
  };

  // Handlers for Price Alerts
  const handleSaveAlert = useCallback((newAlertData: Omit<PriceAlert, 'id' | 'createdAt' | 'status'>) => {
    const newAlert: PriceAlert = {
      ...newAlertData,
      id: `alert-${Date.now()}`,
      status: 'ACTIVE',
      createdAt: languageRef.current === 'en' ? 'Just now' : 'Baru saja',
    };

    const nextAlerts = [newAlert, ...alertsRef.current];
    alertsRef.current = nextAlerts;
    setAlerts(nextAlerts);
    window.setTimeout(() => {
      evaluateAlerts(alertsRef.current, simulatedPricesRef.current, liveQuotesRef.current);
    }, 100);
  }, []);

  const handleRemoveAlert = useCallback((alertId: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== alertId));
    setActiveBannerAlert((prev) => (prev?.id === alertId ? null : prev));
  }, []);

  const handleSimulatePriceChange = useCallback((ticker: string, newPrice: number) => {
    const nextPrices = { ...simulatedPricesRef.current, [ticker]: newPrice };
    simulatedPricesRef.current = nextPrices;
    setSimulatedPrices(nextPrices);
    evaluateAlerts(alertsRef.current, nextPrices, liveQuotesRef.current, usdIdrRateRef.current);
  }, []);

  const handleResetSimulatedPrices = useCallback(() => {
    simulatedPricesRef.current = {};
    setSimulatedPrices({});
  }, []);

  const handleOpenPriceAlertModal = useCallback((ticker?: string) => {
    if (ticker) setAlertTargetTicker(ticker);
    setIsAlertModalOpen(true);
  }, []);

  const handleQuickSetAlert = useCallback((ticker: string, targetPrice: number, type: 'ENTRY' | 'EXIT', note: string) => {
    const asset = getAssetByTicker(ticker);
    const upper = ticker.toUpperCase();
    const quotesMap = effectiveQuotesRef.current;
    const live =
      quotesMap[ticker] ||
      quotesMap[upper] ||
      (asset?.type === 'IDX_STOCK' ? quotesMap[`${upper}.JK`] : undefined);
    const hasValidLive =
      typeof live?.price === 'number' &&
      Number.isFinite(live.price) &&
      live.price > 0 &&
      live.isLiveFound !== false;
    const currentPrice = hasValidLive ? live.price : asset ? asset.price : targetPrice;
    // Entry targets trigger when price dips below or equal to target, Exit targets trigger when price rises above or equal
    const condition = type === 'ENTRY' ? 'BELOW_OR_EQUAL' : 'ABOVE_OR_EQUAL';

    handleSaveAlert({
      ticker,
      assetName: asset?.name || ticker,
      type,
      targetPrice,
      condition,
      currentPriceAtCreation: currentPrice,
      currency: asset?.currency || 'USD',
      note,
    });
  }, [handleSaveAlert]);

  // Handlers for Currency, Device Frame & Portfolio Presets
  const handleToggleCurrency = useCallback(() => {
    setCurrency((prev) => (prev === 'IDR' ? 'USD' : 'IDR'));
  }, []);

  const handleToggleDeviceFrame = useCallback(() => {
    setIsDeviceFramed((prev) => !prev);
  }, []);

  const handleOpenProfileModal = useCallback(() => setIsProfileModalOpen(true), []);
  const handleCloseProfileModal = useCallback(() => setIsProfileModalOpen(false), []);
  const handleOpenAlertDrawer = useCallback(() => setIsAlertDrawerOpen(true), []);
  const handleCloseAlertDrawer = useCallback(() => setIsAlertDrawerOpen(false), []);
  const handleCloseAlertModal = useCallback(() => setIsAlertModalOpen(false), []);
  const handleOpenCreateAlertFromDrawer = useCallback(() => {
    setIsAlertDrawerOpen(false);
    setIsAlertModalOpen(true);
  }, []);
  const handleOpenTutorial = useCallback(() => setIsOnboardingOpen(true), []);
  const handleOpenDividendCalendar = useCallback(() => setActiveTab('dividends'), []);
  const handleNavigateToEvaluation = useCallback(() => setActiveTab('evaluation'), []);
  const handleNavigateToOptimizer = useCallback(() => setActiveTab('optimizer'), []);
  const handleNavigateToPortfolio = useCallback(() => setActiveTab('portfolio'), []);
  const handleOpenAddModal = useCallback(() => {
    setPreselectedAddAsset(null);
    setIsAddModalOpen(true);
  }, []);
  const handleCloseAddModal = useCallback(() => {
    setIsAddModalOpen(false);
    setPreselectedAddAsset(null);
  }, []);
  const handleCloseDetailModal = useCallback(() => setSelectedAssetForDetail(null), []);
  const handleRequestAddToPortfolio = useCallback((asset: Asset) => {
    setPreselectedAddAsset(asset);
    setIsAddModalOpen(true);
  }, []);
  const handleDismissBanner = useCallback((id: string) => {
    setActiveBannerAlert((prev) => (prev?.id === id ? null : prev));
  }, []);
  const handleViewBannerAsset = useCallback((ticker: string) => {
    setActiveTab('portfolio');
    handleOpenAssetDetailRef.current(ticker);
  }, []);

  const handleApplyPreset = useCallback((preset: PresetPortfolio) => {
    setPreOptimizationSnapshot(null);
    setCurrentPresetId(preset.id);
    setRiskProfileId(preset.recommendedRiskProfile);
    setHoldings(
      preset.holdings.map((h, i) => ({
        id: `h-preset-${i}-${Date.now()}`,
        ticker: h.ticker,
        shares: h.shares,
        avgBuyPrice: h.avgBuyPrice,
        buyCurrency: h.buyCurrency,
      }))
    );
  }, []);

  const handleClearPortfolio = useCallback(() => {
    setPreOptimizationSnapshot(null);
    setCurrentPresetId('custom');
    setHoldings([]);
  }, []);

  const handleAddHolding = useCallback((newHolding: {
    ticker: string;
    shares: number;
    avgBuyPrice: number;
    buyCurrency: 'USD' | 'IDR';
  }) => {
    setPreOptimizationSnapshot(null);
    setCurrentPresetId('custom');
    setHoldings((prev) => {
      const existingIdx = prev.findIndex(
        (h) => h.ticker.toUpperCase() === newHolding.ticker.toUpperCase()
      );
      if (existingIdx >= 0) {
        const updated = [...prev];
        const existing = updated[existingIdx];
        const totalShares = existing.shares + newHolding.shares;
        const normalizedNewPrice = convertToCurrency(
          newHolding.avgBuyPrice,
          newHolding.buyCurrency,
          existing.buyCurrency,
          usdIdrRateRef.current
        );
        const totalCost =
          existing.shares * existing.avgBuyPrice + newHolding.shares * normalizedNewPrice;
        updated[existingIdx] = {
          ...existing,
          shares: totalShares,
          avgBuyPrice: totalShares > 0 ? totalCost / totalShares : existing.avgBuyPrice,
        };
        return updated;
      } else {
        return [
          ...prev,
          {
            id: `h-${Date.now()}`,
            ticker: newHolding.ticker,
            shares: newHolding.shares,
            avgBuyPrice: newHolding.avgBuyPrice,
            buyCurrency: newHolding.buyCurrency,
          },
        ];
      }
    });
  }, []);

  const handleUpdateShares = useCallback((
    ticker: string,
    newShares: number,
    newAvgBuyPrice?: number,
    newBuyCurrency?: 'USD' | 'IDR'
  ) => {
    setPreOptimizationSnapshot(null);
    setCurrentPresetId('custom');
    setHoldings((prev) =>
      prev.map((h) => {
        if (h.ticker.toUpperCase() === ticker.toUpperCase()) {
          return {
            ...h,
            shares: newShares,
            avgBuyPrice: newAvgBuyPrice !== undefined ? newAvgBuyPrice : h.avgBuyPrice,
            buyCurrency: newBuyCurrency !== undefined ? newBuyCurrency : h.buyCurrency,
          };
        }
        return h;
      })
    );
    setSelectedAssetForDetail((prev) => {
      if (!prev) return null;
      if (prev.asset.ticker.toUpperCase() !== ticker.toUpperCase()) return prev;
      return {
        ...prev,
        holding: prev.holding
          ? {
              ...prev.holding,
              shares: newShares,
              avgBuyPrice: newAvgBuyPrice !== undefined ? newAvgBuyPrice : prev.holding.avgBuyPrice,
              buyCurrency: newBuyCurrency !== undefined ? newBuyCurrency : prev.holding.buyCurrency,
            }
          : null,
      };
    });
  }, []);

  const handleRemoveHolding = useCallback((ticker: string) => {
    setPreOptimizationSnapshot(null);
    setCurrentPresetId('custom');
    setHoldings((prev) => prev.filter((h) => h.ticker.toUpperCase() !== ticker.toUpperCase()));
    setSelectedAssetForDetail(null);
  }, []);

  const refreshSingleQuoteOnDemand = async (asset: Asset) => {
    try {
      const sym = asset.type === 'IDX_STOCK' ? `${asset.ticker}.JK` : asset.ticker;
      const result = await fetchAppApi<any>(`/api/live-quotes?symbols=${encodeURIComponent(sym)}`);
      if (result.ok && result.data) {
        const data = result.data;
        const incomingQuotes = data?.quotes as Record<string, LiveQuoteEntry> | undefined;
        if (incomingQuotes && !areQuotesEqual(liveQuotesRef.current, incomingQuotes)) {
          setLiveQuotes((prev) => {
            const merged = { ...prev, ...incomingQuotes };
            liveQuotesRef.current = merged;
            return merged;
          });
        }
        const incomingRate = Number(data?.exchangeRateUSDIDR);
        const isLiveRate = data?.exchangeRateIsLive !== false;
        if (
          Number.isFinite(incomingRate) &&
          incomingRate > 1000 &&
          (isLiveRate || !(usdIdrRateRef.current > 1000)) &&
          incomingRate !== usdIdrRateRef.current
        ) {
          usdIdrRateRef.current = incomingRate;
          setUsdIdrRate(incomingRate);
          if (isLiveRate) {
            try {
              window.localStorage.setItem('portolens_usd_idr_v1', String(incomingRate));
            } catch {
              // ignore storage errors
            }
          }
        }
      }
    } catch {
      // ignore on-demand fetch errors
    }
  };

  const handleOpenAssetDetail = (ticker: string) => {
    const normalized = ticker.toUpperCase().replace(/\.JK$/i, '');
    const baseAsset = getAssetByTicker(ticker) || getAssetByTicker(normalized);
    if (!baseAsset) return;
    const upper = baseAsset.ticker.toUpperCase();
    const live =
      effectiveQuotes[baseAsset.ticker] ||
      effectiveQuotes[upper] ||
      effectiveQuotes[ticker] ||
      (baseAsset.type === 'IDX_STOCK' ? effectiveQuotes[`${upper}.JK`] : undefined);
    const hasValidLive =
      typeof live?.price === 'number' &&
      Number.isFinite(live.price) &&
      live.price > 0 &&
      live.isLiveFound !== false;
    const asset: Asset = {
      ...baseAsset,
      price: hasValidLive ? live.price : baseAsset.price,
      change1D:
        hasValidLive && typeof live.changePercent === 'number' && Number.isFinite(live.changePercent)
          ? live.changePercent
          : baseAsset.change1D,
    };
    const holding = holdings.find((h) => h.ticker.toUpperCase() === upper) || null;
    setSelectedAssetForDetail({ asset, holding });
    if (!hasValidLive) {
      refreshSingleQuoteOnDemand(baseAsset);
    }
  };

  const handleOpenAssetDetailRef = useRef(handleOpenAssetDetail);
  handleOpenAssetDetailRef.current = handleOpenAssetDetail;
  const stableOpenAssetDetail = useCallback((ticker: string) => {
    handleOpenAssetDetailRef.current(ticker);
  }, []);

  const handleSelectAssetToView = useCallback((assetInput: Asset) => {
    const upper = assetInput.ticker.toUpperCase();
    const quotesMap = effectiveQuotesRef.current;
    const live =
      quotesMap[assetInput.ticker] ||
      quotesMap[upper] ||
      (assetInput.type === 'IDX_STOCK' ? quotesMap[`${upper}.JK`] : undefined);
    const hasValidLive =
      typeof live?.price === 'number' &&
      Number.isFinite(live.price) &&
      live.price > 0 &&
      live.isLiveFound !== false;
    const asset: Asset = {
      ...assetInput,
      price: hasValidLive ? live.price : assetInput.price,
      change1D:
        hasValidLive && typeof live.changePercent === 'number' && Number.isFinite(live.changePercent)
          ? live.changePercent
          : assetInput.change1D,
    };
    const holding = holdingsRef.current.find((h) => h.ticker.toUpperCase() === upper) || null;
    setSelectedAssetForDetail({ asset, holding });
    if (!hasValidLive) {
      refreshSingleQuoteOnDemand(assetInput);
    }
  }, []);

  // 1-Click Auto-Rebalance & Optimization
  const handleApplyOptimization = useCallback((mode: RebalanceMode = 'SELL_AND_BUY'): OptimizationApplyResult | null => {
    const currentHoldings = holdingsRef.current;
    if (currentHoldings.length === 0) return null;
    const activeProfile = currentProfileRef.current;
    const result = applyPortfolioOptimization(
      currentHoldings,
      activeProfile,
      effectiveQuotesRef.current,
      usdIdrRateRef.current,
      mode,
      currencyRef.current,
      languageRef.current
    );
    if (!result) return null;

    if (result.applied) {
      setPreOptimizationSnapshot((prev) => ({
        holdings: prev ? prev.holdings : currentHoldings.map((h) => ({ ...h })),
        presetId: prev ? prev.presetId : currentPresetId,
        profileId: activeProfile.id,
        result,
      }));
      setCurrentPresetId('custom');
      setHoldings(result.updatedHoldings);
    }
    return result;
  }, [currentPresetId]);

  const handleRevertOptimization = useCallback(() => {
    setHoldings((_curr) => {
      if (!preOptimizationSnapshot) return _curr;
      return preOptimizationSnapshot.holdings.map((h) => ({ ...h }));
    });
    if (preOptimizationSnapshot) {
      setCurrentPresetId(preOptimizationSnapshot.presetId);
      setPreOptimizationSnapshot(null);
    }
  }, [preOptimizationSnapshot]);

  const triggeredCount = useMemo(
    () => alerts.filter((a) => a.status === 'TRIGGERED').length,
    [alerts]
  );

  const detailModalAsset = useMemo(() => {
    if (!selectedAssetForDetail) return null;
    const fresh = getAssetByTicker(selectedAssetForDetail.asset.ticker) || selectedAssetForDetail.asset;
    const upper = fresh.ticker.toUpperCase();
    const live =
      effectiveQuotes[fresh.ticker] ||
      effectiveQuotes[upper] ||
      (fresh.type === 'IDX_STOCK' ? effectiveQuotes[`${upper}.JK`] : undefined);
    const hasValidLive =
      typeof live?.price === 'number' &&
      Number.isFinite(live.price) &&
      live.price > 0 &&
      live.isLiveFound !== false;
    return {
      ...fresh,
      currency: fresh.type === 'IDX_STOCK' ? ('IDR' as const) : ('USD' as const),
      price: hasValidLive ? live.price : fresh.price,
      change1D:
        hasValidLive && typeof live.changePercent === 'number' && Number.isFinite(live.changePercent)
          ? live.changePercent
          : fresh.change1D,
    };
  }, [selectedAssetForDetail, effectiveQuotes]);

  const detailModalHolding = useMemo(() => {
    if (!selectedAssetForDetail) return null;
    const upper = selectedAssetForDetail.asset.ticker.toUpperCase();
    return holdings.find((h) => h.ticker.toUpperCase() === upper) || null;
  }, [selectedAssetForDetail, holdings]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-start sm:p-4 md:p-6 font-sans antialiased">
      {/* Device Wrapper */}
      <div
        className={`w-full transition-all duration-300 relative ${
          isDeviceFramed
            ? 'max-w-[430px] min-h-[100dvh] sm:min-h-[640px] sm:h-[min(880px,calc(100dvh-2rem))] sm:max-h-[920px] sm:rounded-[44px] sm:border-[8px] sm:border-slate-800 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9)] bg-slate-950 overflow-hidden flex flex-col'
            : 'max-w-3xl min-h-[100dvh] bg-slate-950 flex flex-col'
        }`}
      >
        {/* Android Heads-Up Notification Banner (Triggers on target threshold hit) */}
        <AndroidNotificationBanner
          alert={activeBannerAlert}
          onDismiss={handleDismissBanner}
          onViewAsset={handleViewBannerAsset}
        />

        {/* Top App Header with Android Status Bar */}
        <AndroidHeader
          currentProfile={currentProfile}
          onOpenProfileModal={handleOpenProfileModal}
          currency={currency}
          onToggleCurrency={handleToggleCurrency}
          isDeviceFramed={isDeviceFramed}
          onToggleDeviceFrame={handleToggleDeviceFrame}
          notificationCount={triggeredCount}
          onOpenAlertDrawer={handleOpenAlertDrawer}
          onOpenTutorial={handleOpenTutorial}
          onOpenDividendCalendar={handleOpenDividendCalendar}
        />

        {/* Real-Time Live Market Ticker Bar */}
        <LiveMarketBar
          lastUpdated={lastUpdatedTime}
          isFetching={isFetchingLive}
          onRefresh={stableRefreshLiveQuotes}
          liveQuotes={effectiveQuotes}
          usdIdrRate={usdIdrRate}
          usdIdrChange={usdIdrChange}
          usdIdrSource={usdIdrSource}
          onSelectTicker={stableOpenAssetDetail}
        />

        {/* Scrollable Viewport Content */}
        <div className="flex-1 overflow-y-auto no-scrollbar">
          {activeTab === 'portfolio' && (
            <PortfolioTab
              metrics={metrics}
              currency={currency}
              usdIdrRate={usdIdrRate}
              onOpenAddModal={handleOpenAddModal}
              onSelectHolding={stableOpenAssetDetail}
              onApplyPreset={handleApplyPreset}
              onClearPortfolio={handleClearPortfolio}
              onNavigateToEvaluation={handleNavigateToEvaluation}
              onOpenDividendCalendar={handleOpenDividendCalendar}
              currentPresetId={currentPresetId}
              canRevertOptimization={!!preOptimizationSnapshot}
              onRevertOptimization={handleRevertOptimization}
            />
          )}

          {activeTab !== 'portfolio' && (
            <Suspense fallback={<TabLoadingFallback />}>
              {activeTab === 'dividends' && (
                <DividendCalendarTab
                  metrics={metrics}
                  currency={currency}
                  usdIdrRate={usdIdrRate}
                  onBack={handleNavigateToPortfolio}
                  onSelectAsset={stableOpenAssetDetail}
                  onOpenAddModal={handleOpenAddModal}
                />
              )}

              {activeTab === 'search' && (
                <SearchTickerTab
                  existingTickers={holdingTickers}
                  liveQuotes={effectiveQuotes}
                  onSelectAssetToView={handleSelectAssetToView}
                />
              )}

              {activeTab === 'evaluation' && (
                <ScoreTab
                  metrics={metrics}
                  currentProfile={currentProfile}
                  currency={currency}
                  usdIdrRate={usdIdrRate}
                  onNavigateToOptimizer={handleNavigateToOptimizer}
                />
              )}

              {activeTab === 'optimizer' && (
                <OptimizationTab
                  metrics={metrics}
                  holdings={holdings}
                  currentProfile={currentProfile}
                  currency={currency}
                  usdIdrRate={usdIdrRate}
                  liveQuotes={holdingsRelevantQuotes}
                  onApplyOptimization={handleApplyOptimization}
                  onNavigateToPortfolio={handleNavigateToPortfolio}
                  canRevertOptimization={!!preOptimizationSnapshot}
                  lastAppliedResult={preOptimizationSnapshot?.result || null}
                  lastAppliedResultProfileId={preOptimizationSnapshot?.profileId || null}
                  onRevertOptimization={handleRevertOptimization}
                />
              )}

              {activeTab === 'trends' && (
                <MarketTrendsTab
                  metrics={metrics}
                  currency={currency}
                  liveQuotes={effectiveQuotes}
                  usdIdrRate={usdIdrRate}
                  usdIdrChange={usdIdrChange}
                  onSelectAssetToView={handleSelectAssetToView}
                />
              )}
            </Suspense>
          )}
        </div>

        {/* Bottom Navigation Tab Bar */}
        <BottomTabBar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          optimizationCount={metrics.issuesDetected.length}
        />
      </div>

      {/* Lazy Modals & Drawers */}
      <Suspense fallback={null}>
        {isProfileModalOpen && (
          <RiskProfileModal
            isOpen={isProfileModalOpen}
            onClose={handleCloseProfileModal}
            selectedProfileId={riskProfileId}
            onSelectProfile={setRiskProfileId}
          />
        )}

        {detailModalAsset && (
          <AssetDetailModal
            isOpen={!!detailModalAsset}
            onClose={handleCloseDetailModal}
            asset={detailModalAsset}
            holding={detailModalHolding}
            onUpdateShares={handleUpdateShares}
            onRemoveHolding={handleRemoveHolding}
            viewCurrency={currency}
            usdIdrRate={usdIdrRate}
            onOpenPriceAlertModal={handleOpenPriceAlertModal}
            currentProfile={currentProfile}
            onQuickSetAlert={handleQuickSetAlert}
            onRequestAddToPortfolio={handleRequestAddToPortfolio}
          />
        )}

        {isAlertDrawerOpen && (
          <PriceAlertDrawer
            isOpen={isAlertDrawerOpen}
            onClose={handleCloseAlertDrawer}
            alerts={alerts}
            onOpenCreateModal={handleOpenCreateAlertFromDrawer}
            onRemoveAlert={handleRemoveAlert}
            onSimulatePriceChange={handleSimulatePriceChange}
            onResetSimulatedPrices={handleResetSimulatedPrices}
            simulatedPrices={simulatedPrices}
            liveQuotes={effectiveQuotes}
            usdIdrRate={usdIdrRate}
          />
        )}

        {isAddModalOpen && (
          <AddAssetModal
            isOpen={isAddModalOpen}
            onClose={handleCloseAddModal}
            onAddHolding={handleAddHolding}
            existingTickers={holdingTickers}
            viewCurrency={currency}
            usdIdrRate={usdIdrRate}
            liveQuotes={effectiveQuotes}
            initialAsset={preselectedAddAsset}
          />
        )}

        {isAlertModalOpen && (
          <PriceAlertModal
            isOpen={isAlertModalOpen}
            onClose={handleCloseAlertModal}
            initialTicker={alertTargetTicker}
            onSaveAlert={handleSaveAlert}
            availableHoldingsTickers={holdingTickers}
            liveQuotes={effectiveQuotes}
          />
        )}

        {isOnboardingOpen && (
          <OnboardingTutorialModal
            isOpen={isOnboardingOpen}
            onClose={handleCloseOnboarding}
            onNavigateTab={setActiveTab}
          />
        )}
      </Suspense>
    </div>
  );
}

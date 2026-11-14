import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  PortfolioHolding,
  RISK_PROFILES,
  PRESET_PORTFOLIOS,
  PresetPortfolio,
  calculatePortfolioMetrics,
  getAssetByTicker,
  convertToCurrency,
  Asset,
  PriceAlert,
  USD_TO_IDR_RATE,
} from './data/marketData';
import { AndroidHeader } from './components/AndroidHeader';
import { LiveMarketBar } from './components/LiveMarketBar';
import { BottomTabBar, TabKey } from './components/BottomTabBar';
import { PortfolioTab } from './components/PortfolioTab';
import { SearchTickerTab } from './components/SearchTickerTab';
import { ScoreTab } from './components/ScoreTab';
import { OptimizationTab } from './components/OptimizationTab';
import { MarketTrendsTab } from './components/MarketTrendsTab';
import { AddAssetModal } from './components/AddAssetModal';
import { RiskProfileModal } from './components/RiskProfileModal';
import { AssetDetailModal } from './components/AssetDetailModal';
import { PriceAlertModal } from './components/PriceAlertModal';
import { PriceAlertDrawer } from './components/PriceAlertDrawer';
import { AndroidNotificationBanner } from './components/AndroidNotificationBanner';
import { OnboardingTutorialModal } from './components/OnboardingTutorialModal';
import { DividendCalendarTab } from './components/DividendCalendarTab';
import { playNotificationChime } from './utils/audio';

export default function App() {
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
      return window.localStorage.getItem('portolens_preset_id_v1') || 'custom';
    } catch {
      return 'custom';
    }
  });

  // Real-time market quotes dictionary (ticker -> { price, change, changePercent, currency, isLiveFound })
  const [liveQuotes, setLiveQuotes] = useState<
    Record<string, { price: number; change?: number; changePercent?: number; currency: string; isLiveFound?: boolean }>
  >({});
  const [usdIdrRate, setUsdIdrRate] = useState<number>(USD_TO_IDR_RATE);
  const [lastUpdatedTime, setLastUpdatedTime] = useState<string>('');
  const [isFetchingLive, setIsFetchingLive] = useState<boolean>(false);

  // Simulated live market prices overrides (ticker -> price) for user testing
  const [simulatedPrices, setSimulatedPrices] = useState<Record<string, number>>({});

  // Price Alerts State (Pre-populated with 2 initial target alerts)
  const [alerts, setAlerts] = useState<PriceAlert[]>([
    {
      id: 'alert-1',
      ticker: 'NVDA',
      assetName: 'NVIDIA Corporation',
      type: 'EXIT',
      condition: 'ABOVE_OR_EQUAL',
      targetPrice: 175.0,
      currentPriceAtCreation: 170.0,
      currency: 'USD',
      note: 'Target Take Profit bertahap saat rally AI baru',
      status: 'ACTIVE',
      createdAt: 'Hari ini',
    },
    {
      id: 'alert-2',
      ticker: 'BBCA',
      assetName: 'Bank Central Asia Tbk',
      type: 'ENTRY',
      condition: 'BELOW_OR_EQUAL',
      targetPrice: 5300,
      currentPriceAtCreation: 5350,
      currency: 'IDR',
      note: 'Buy on Dip / Tambah muatan saat harga diskon',
      status: 'ACTIVE',
      createdAt: 'Hari ini',
    },
  ]);

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

  const handleCloseOnboarding = () => {
    setIsOnboardingOpen(false);
    try {
      window.localStorage.setItem('portolens_onboarding_seen_v1', 'true');
    } catch {
      // ignore storage errors
    }
  };

  const [selectedAssetForDetail, setSelectedAssetForDetail] = useState<{
    asset: Asset;
    holding: PortfolioHolding | null;
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

  // Quantitative Metrics Calculation (using live market quotes & live exchange rate)
  const metrics = useMemo(() => {
    return calculatePortfolioMetrics(holdings, riskProfileId, currency, effectiveQuotes, usdIdrRate);
  }, [holdings, riskProfileId, currency, effectiveQuotes, usdIdrRate]);

  const currentProfile = RISK_PROFILES[riskProfileId] || RISK_PROFILES.moderat;

  // Keep refs to latest alerts, simulatedPrices, liveQuotes, and holdings so polling loop avoids redundant refetches
  const alertsRef = useRef(alerts);
  alertsRef.current = alerts;
  const simulatedPricesRef = useRef(simulatedPrices);
  simulatedPricesRef.current = simulatedPrices;
  const liveQuotesRef = useRef(liveQuotes);
  liveQuotesRef.current = liveQuotes;
  const holdingsRef = useRef(holdings);
  holdingsRef.current = holdings;

  // Real-time market fetch function (covers featured market bar + user holdings + active alerts + inspected detail asset)
  const fetchLiveQuotes = async () => {
    try {
      setIsFetchingLive(true);
      const featuredMarketSymbols = [
        'NVDA', 'BBCA.JK', 'VOO', 'PLTR', 'BBNI.JK', 'AAPL', 'BBRI.JK',
        'SCHD', 'ANTM.JK', 'SPY', 'TSLA', 'QQQ', 'ASII.JK', 'AMMN.JK',
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
      const query = `?symbols=${encodeURIComponent(allSymbols.join(','))}`;
      const res = await fetch(`/api/live-quotes${query}`);
      if (res.ok) {
        const data = await res.json();
        const mergedQuotes = { ...liveQuotesRef.current, ...(data.quotes || {}) };
        if (data.quotes) {
          setLiveQuotes((prev) => ({ ...prev, ...data.quotes }));
        }
        if (data.exchangeRateUSDIDR) {
          setUsdIdrRate(data.exchangeRateUSDIDR);
        }
        if (data.lastUpdated) {
          setLastUpdatedTime(data.lastUpdated);
        }
        // Immediately check and trigger price alerts with new live quotes!
        evaluateAlerts(alertsRef.current, simulatedPricesRef.current, mergedQuotes);
      }
    } catch (err) {
      console.error('Error fetching live quotes:', err);
    } finally {
      setIsFetchingLive(false);
    }
  };

  const holdingsKey = holdings.map((h) => h.ticker).join(',');
  const activeAlertSymbolsKey = alerts
    .filter((a) => a.status === 'ACTIVE')
    .map((a) => a.ticker)
    .sort()
    .join(',');

  // Real-time market polling loop (every 4.5 seconds)
  useEffect(() => {
    fetchLiveQuotes();
    const interval = setInterval(fetchLiveQuotes, 4500);
    return () => clearInterval(interval);
  }, [holdingsKey, activeAlertSymbolsKey]);

  // PRICE ALERT MONITORING & TRIGGER ENGINE
  const evaluateAlerts = (
    currentAlerts: PriceAlert[],
    currentSimPrices: Record<string, number>,
    currentLiveQuotes: Record<string, { price: number; isLiveFound?: boolean }> = liveQuotes
  ) => {
    let triggeredAny = false;
    const nowTime = new Date().toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    const updatedAlerts = currentAlerts.map((alert) => {
      if (alert.status !== 'ACTIVE') return alert;

      const normalizedTicker = alert.ticker.toUpperCase();
      const baseAsset = getAssetByTicker(normalizedTicker);
      const liveEntry = currentLiveQuotes[alert.ticker] || currentLiveQuotes[normalizedTicker];
      const hasValidLive = liveEntry?.price !== undefined && liveEntry.isLiveFound !== false;
      const simPrice =
        currentSimPrices[alert.ticker] !== undefined
          ? currentSimPrices[alert.ticker]
          : currentSimPrices[normalizedTicker];

      // Priority: Simulator price -> Real-time live quote -> Base catalog price
      const currentPrice =
        simPrice !== undefined
          ? simPrice
          : hasValidLive
          ? liveEntry.price
          : baseAsset?.price || alert.currentPriceAtCreation;

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
  const handleSaveAlert = (newAlertData: Omit<PriceAlert, 'id' | 'createdAt' | 'status'>) => {
    const newAlert: PriceAlert = {
      ...newAlertData,
      id: `alert-${Date.now()}`,
      status: 'ACTIVE',
      createdAt: 'Baru saja',
    };

    setAlerts((prev) => {
      const nextAlerts = [newAlert, ...prev];
      setTimeout(() => evaluateAlerts(nextAlerts, simulatedPrices, liveQuotes), 100);
      return nextAlerts;
    });
  };

  const handleRemoveAlert = (alertId: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== alertId));
    if (activeBannerAlert?.id === alertId) {
      setActiveBannerAlert(null);
    }
  };

  const handleSimulatePriceChange = (ticker: string, newPrice: number) => {
    const nextPrices = { ...simulatedPrices, [ticker]: newPrice };
    setSimulatedPrices(nextPrices);
    evaluateAlerts(alerts, nextPrices, liveQuotes);
  };

  const handleResetSimulatedPrices = () => {
    setSimulatedPrices({});
  };

  const handleOpenPriceAlertModal = (ticker?: string) => {
    if (ticker) setAlertTargetTicker(ticker);
    setIsAlertModalOpen(true);
  };

  const handleQuickSetAlert = (ticker: string, targetPrice: number, type: 'ENTRY' | 'EXIT', note: string) => {
    const asset = getAssetByTicker(ticker);
    const live = effectiveQuotes[ticker] || effectiveQuotes[ticker.toUpperCase()];
    const hasValidLive = live?.price !== undefined && live.isLiveFound !== false;
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
  };

  // Handlers for Currency & Device Frame
  const handleToggleCurrency = () => {
    setCurrency((prev) => (prev === 'IDR' ? 'USD' : 'IDR'));
  };

  const handleToggleDeviceFrame = () => {
    setIsDeviceFramed((prev) => !prev);
  };

  const handleApplyPreset = (preset: PresetPortfolio) => {
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
  };

  const handleClearPortfolio = () => {
    setCurrentPresetId('custom');
    setHoldings([]);
  };

  const handleAddHolding = (newHolding: {
    ticker: string;
    shares: number;
    avgBuyPrice: number;
    buyCurrency: 'USD' | 'IDR';
  }) => {
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
          usdIdrRate
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
  };

  const handleUpdateShares = (
    ticker: string,
    newShares: number,
    newAvgBuyPrice?: number,
    newBuyCurrency?: 'USD' | 'IDR'
  ) => {
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
  };

  const handleRemoveHolding = (ticker: string) => {
    setCurrentPresetId('custom');
    setHoldings((prev) => prev.filter((h) => h.ticker.toUpperCase() !== ticker.toUpperCase()));
    setSelectedAssetForDetail(null);
  };

  const refreshSingleQuoteOnDemand = async (asset: Asset) => {
    try {
      const sym = asset.type === 'IDX_STOCK' ? `${asset.ticker}.JK` : asset.ticker;
      const res = await fetch(`/api/live-quotes?symbols=${encodeURIComponent(sym)}`);
      if (res.ok) {
        const data = await res.json();
        if (data?.quotes) {
          setLiveQuotes((prev) => ({ ...prev, ...data.quotes }));
        }
        if (data?.exchangeRateUSDIDR) {
          setUsdIdrRate(data.exchangeRateUSDIDR);
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
    const live = effectiveQuotes[baseAsset.ticker] || effectiveQuotes[ticker];
    const hasValidLive = live?.price !== undefined && live.isLiveFound !== false;
    const asset: Asset = {
      ...baseAsset,
      price: hasValidLive ? live.price : baseAsset.price,
      change1D: hasValidLive && live.changePercent !== undefined ? live.changePercent : baseAsset.change1D,
    };
    const holding = holdings.find((h) => h.ticker.toUpperCase() === baseAsset.ticker.toUpperCase()) || null;
    setSelectedAssetForDetail({ asset, holding });
    if (!hasValidLive) {
      refreshSingleQuoteOnDemand(baseAsset);
    }
  };

  const handleSelectAssetToView = (assetInput: Asset) => {
    const live = effectiveQuotes[assetInput.ticker];
    const hasValidLive = live?.price !== undefined && live.isLiveFound !== false;
    const asset: Asset = {
      ...assetInput,
      price: hasValidLive ? live.price : assetInput.price,
      change1D: hasValidLive && live.changePercent !== undefined ? live.changePercent : assetInput.change1D,
    };
    const holding = holdings.find((h) => h.ticker.toUpperCase() === asset.ticker.toUpperCase()) || null;
    setSelectedAssetForDetail({ asset, holding });
    if (!hasValidLive) {
      refreshSingleQuoteOnDemand(assetInput);
    }
  };

  // 1-Click Optimization Rebalancing
  const handleApplyOptimization = () => {
    if (holdings.length === 0) return;
    setCurrentPresetId('custom');
    const getEffectivePrice = (ticker: string, fallback: number) => {
      const live = effectiveQuotes[ticker];
      if (live?.price !== undefined && live.isLiveFound !== false) return live.price;
      return getAssetByTicker(ticker)?.price || fallback;
    };

    setHoldings((prev) => {
      if (prev.length === 0) return prev;
      const updated = prev.map((h) => {
        const asset = getAssetByTicker(h.ticker);
        if (!asset) return h;
        if (asset.beta > currentProfile.maxTargetBeta) {
          const scaledShares =
            asset.type === 'IDX_STOCK'
              ? Math.max(1, Math.round(h.shares * 0.75))
              : Number(Math.max(0.0001, h.shares * 0.75).toFixed(4));
          return { ...h, shares: scaledShares };
        }
        return h;
      });

      const hasVoo = updated.some((h) => h.ticker.toUpperCase() === 'VOO');
      if (!hasVoo) {
        updated.push({
          id: `h-opt-voo-${Date.now()}`,
          ticker: 'VOO',
          shares: 5,
          avgBuyPrice: getEffectivePrice('VOO', 540.0),
          buyCurrency: 'USD',
        });
      }

      if (['konservatif', 'moderat'].includes(riskProfileId)) {
        const hasSchd = updated.some((h) => h.ticker.toUpperCase() === 'SCHD');
        if (!hasSchd) {
          updated.push({
            id: `h-opt-schd-${Date.now()}`,
            ticker: 'SCHD',
            shares: 20,
            avgBuyPrice: getEffectivePrice('SCHD', 84.0),
            buyCurrency: 'USD',
          });
        }
      }

      return updated;
    });
  };

  const triggeredCount = alerts.filter((a) => a.status === 'TRIGGERED').length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-start sm:p-4 md:p-6 font-sans antialiased">
      {/* Device Wrapper */}
      <div
        className={`w-full transition-all duration-300 relative ${
          isDeviceFramed
            ? 'max-w-[430px] min-h-[100dvh] sm:min-h-[880px] sm:max-h-[920px] sm:rounded-[44px] sm:border-[8px] sm:border-slate-800 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9)] bg-slate-950 overflow-hidden flex flex-col'
            : 'max-w-2xl min-h-[100dvh] bg-slate-950 flex flex-col'
        }`}
      >
        {/* Android Heads-Up Notification Banner (Triggers on target threshold hit) */}
        <AndroidNotificationBanner
          alert={activeBannerAlert}
          onDismiss={() => setActiveBannerAlert(null)}
          onViewAsset={(ticker) => {
            setActiveTab('portfolio');
            handleOpenAssetDetail(ticker);
          }}
        />

        {/* Top App Header with Android Status Bar */}
        <AndroidHeader
          currentProfile={currentProfile}
          onOpenProfileModal={() => setIsProfileModalOpen(true)}
          currency={currency}
          onToggleCurrency={handleToggleCurrency}
          isDeviceFramed={isDeviceFramed}
          onToggleDeviceFrame={handleToggleDeviceFrame}
          notificationCount={triggeredCount}
          onOpenAlertDrawer={() => setIsAlertDrawerOpen(true)}
          onOpenTutorial={() => setIsOnboardingOpen(true)}
          onOpenDividendCalendar={() => setActiveTab('dividends')}
        />

        {/* Real-Time Live Market Ticker Bar */}
        <LiveMarketBar
          lastUpdated={lastUpdatedTime}
          isFetching={isFetchingLive}
          onRefresh={fetchLiveQuotes}
          liveQuotes={effectiveQuotes}
          usdIdrRate={usdIdrRate}
          onSelectTicker={handleOpenAssetDetail}
        />

        {/* Scrollable Viewport Content */}
        <div className="flex-1 overflow-y-auto no-scrollbar">
          {activeTab === 'portfolio' && (
            <PortfolioTab
              metrics={metrics}
              currency={currency}
              usdIdrRate={usdIdrRate}
              onOpenAddModal={() => {
                setPreselectedAddAsset(null);
                setIsAddModalOpen(true);
              }}
              onSelectHolding={handleOpenAssetDetail}
              onApplyPreset={handleApplyPreset}
              onClearPortfolio={handleClearPortfolio}
              onNavigateToEvaluation={() => setActiveTab('evaluation')}
              onOpenDividendCalendar={() => setActiveTab('dividends')}
              currentPresetId={currentPresetId}
            />
          )}

          {activeTab === 'dividends' && (
            <DividendCalendarTab
              metrics={metrics}
              currency={currency}
              usdIdrRate={usdIdrRate}
              onBack={() => setActiveTab('portfolio')}
              onSelectAsset={handleOpenAssetDetail}
              onOpenAddModal={() => {
                setPreselectedAddAsset(null);
                setIsAddModalOpen(true);
              }}
            />
          )}

          {activeTab === 'search' && (
            <SearchTickerTab
              existingTickers={holdings.map((h) => h.ticker)}
              liveQuotes={effectiveQuotes}
              onSelectAssetToView={handleSelectAssetToView}
            />
          )}

          {activeTab === 'evaluation' && (
            <ScoreTab
              metrics={metrics}
              currentProfile={currentProfile}
              currency={currency}
              onNavigateToOptimizer={() => setActiveTab('optimizer')}
            />
          )}

          {activeTab === 'optimizer' && (
            <OptimizationTab
              metrics={metrics}
              currentProfile={currentProfile}
              currency={currency}
              onApplyOptimization={handleApplyOptimization}
            />
          )}

          {activeTab === 'trends' && (
            <MarketTrendsTab
              metrics={metrics}
              currency={currency}
              liveQuotes={effectiveQuotes}
              usdIdrRate={usdIdrRate}
              onSelectAssetToView={handleSelectAssetToView}
            />
          )}
        </div>

        {/* Bottom Navigation Tab Bar */}
        <BottomTabBar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          optimizationCount={metrics.issuesDetected.length}
        />
      </div>

      {/* Modals & Drawers */}
      <AddAssetModal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setPreselectedAddAsset(null);
        }}
        onAddHolding={handleAddHolding}
        existingTickers={holdings.map((h) => h.ticker)}
        viewCurrency={currency}
        usdIdrRate={usdIdrRate}
        liveQuotes={effectiveQuotes}
        initialAsset={preselectedAddAsset}
      />

      <RiskProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        selectedProfileId={riskProfileId}
        onSelectProfile={setRiskProfileId}
      />

      <AssetDetailModal
        isOpen={!!selectedAssetForDetail}
        onClose={() => setSelectedAssetForDetail(null)}
        asset={
          selectedAssetForDetail
            ? (() => {
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
                  currency: fresh.type === 'IDX_STOCK' ? 'IDR' : 'USD',
                  price: hasValidLive ? live.price : fresh.price,
                  change1D:
                    hasValidLive && typeof live.changePercent === 'number' && Number.isFinite(live.changePercent)
                      ? live.changePercent
                      : fresh.change1D,
                };
              })()
            : null
        }
        holding={
          selectedAssetForDetail
            ? holdings.find(
                (h) => h.ticker.toUpperCase() === selectedAssetForDetail.asset.ticker.toUpperCase()
              ) || null
            : null
        }
        onUpdateShares={handleUpdateShares}
        onRemoveHolding={handleRemoveHolding}
        viewCurrency={currency}
        usdIdrRate={usdIdrRate}
        onOpenPriceAlertModal={handleOpenPriceAlertModal}
        currentProfile={currentProfile}
        onQuickSetAlert={handleQuickSetAlert}
        onRequestAddToPortfolio={(asset) => {
          setPreselectedAddAsset(asset);
          setIsAddModalOpen(true);
        }}
      />

      <PriceAlertModal
        isOpen={isAlertModalOpen}
        onClose={() => setIsAlertModalOpen(false)}
        initialTicker={alertTargetTicker}
        onSaveAlert={handleSaveAlert}
        availableHoldingsTickers={holdings.map((h) => h.ticker)}
        liveQuotes={effectiveQuotes}
      />

      <PriceAlertDrawer
        isOpen={isAlertDrawerOpen}
        onClose={() => setIsAlertDrawerOpen(false)}
        alerts={alerts}
        onOpenCreateModal={() => {
          setIsAlertDrawerOpen(false);
          setIsAlertModalOpen(true);
        }}
        onRemoveAlert={handleRemoveAlert}
        onSimulatePriceChange={handleSimulatePriceChange}
        onResetSimulatedPrices={handleResetSimulatedPrices}
        simulatedPrices={simulatedPrices}
        liveQuotes={effectiveQuotes}
      />

      <OnboardingTutorialModal
        isOpen={isOnboardingOpen}
        onClose={handleCloseOnboarding}
        onNavigateTab={(tab) => setActiveTab(tab)}
      />
    </div>
  );
}

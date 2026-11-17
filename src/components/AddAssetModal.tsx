import React, { useState, useMemo, useEffect, useRef, useDeferredValue } from 'react';
import {
  X,
  Search,
  PlusCircle,
  Sparkles,
  CheckCircle2,
  Building2,
  Globe,
  Layers,
  Loader2,
  ArrowLeft,
  AlertCircle,
  Edit3,
} from 'lucide-react';
import { fetchAppApi } from '../services/apkClientBridge';
import {
  getAllAssets,
  getAssetByTicker,
  getCatalogCategoryCounts,
  searchCatalogAssets,
  Asset,
  convertToCurrency,
  registerCustomAsset,
  isCustomAsset,
  updateCustomAssetClassification,
  parseDecimalInput,
  formatShareQuantity,
} from '../data/marketData';
import { useLanguage } from '../i18n/LanguageContext';

interface AddAssetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddHolding: (holding: {
    ticker: string;
    shares: number;
    avgBuyPrice: number;
    buyCurrency: 'USD' | 'IDR';
  }) => void;
  existingTickers: string[];
  viewCurrency: 'IDR' | 'USD';
  usdIdrRate?: number;
  liveQuotes?: Record<string, { price: number; changePercent?: number; isLiveFound?: boolean }>;
  initialAsset?: Asset | null;
}

type AssetClassification = 'IDX_STOCK' | 'US_STOCK' | 'ETF';

export const AddAssetModal: React.FC<AddAssetModalProps> = ({
  isOpen,
  onClose,
  onAddHolding,
  existingTickers,
  viewCurrency,
  usdIdrRate,
  liveQuotes,
  initialAsset,
}) => {
  const { language, locale, t } = useLanguage();
  const [catalogVersion, setCatalogVersion] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [filterType, setFilterType] = useState<'ALL' | 'US_STOCK' | 'IDX_STOCK' | 'ETF'>('ALL');
  const [displayLimit, setDisplayLimit] = useState(60);

  // Step state: 'CATALOG' | 'REGISTER' | 'ADD_HOLDING'
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [registeringTicker, setRegisteringTicker] = useState<string | null>(null);
  const [justRegisteredBanner, setJustRegisteredBanner] = useState<{
    ticker: string;
    label: string;
  } | null>(null);

  // Registration / Edit custom classification state
  const [regType, setRegType] = useState<AssetClassification | null>(null);
  const [regName, setRegName] = useState('');
  const [regSector, setRegSector] = useState('');
  const [regPrice, setRegPrice] = useState('');
  const [isLookingUpQuote, setIsLookingUpQuote] = useState(false);
  const [lookupStatus, setLookupStatus] = useState<'idle' | 'found' | 'not_found'>('idle');
  const [editingCustomTicker, setEditingCustomTicker] = useState<string | null>(null);
  const [detectedMarketHint, setDetectedMarketHint] = useState<{
    suggestedType: AssetClassification | null;
    shortName?: string;
    price?: number;
    currency?: string;
    foundIdx: boolean;
    foundGlobal: boolean;
  } | null>(null);

  // Explicit search & auto-detect state for unlisted tickers
  const [isSearchingTicker, setIsSearchingTicker] = useState(false);
  const searchReqIdRef = useRef(0);
  const [searchDetection, setSearchDetection] = useState<{
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

  // Add to portfolio form fields
  const [sharesInput, setSharesInput] = useState<string>('10');
  const [buyPriceInput, setBuyPriceInput] = useState<string>('');
  const lookupReqIdRef = useRef(0);

  // Sync catalog whenever modal opens
  useEffect(() => {
    if (isOpen) {
      lookupReqIdRef.current++;
      setIsLookingUpQuote(false);
      setCatalogVersion((v) => v + 1);
      setSearchQuery('');
      setFilterType('ALL');
      setRegisteringTicker(null);
      setEditingCustomTicker(null);
      setDetectedMarketHint(null);
      setJustRegisteredBanner(null);
      setSearchDetection(null);
      setSelectedCandidateIdx(0);
      setDisplayLimit(60);
      if (initialAsset) {
        setSelectedAsset(initialAsset);
        setBuyPriceInput(initialAsset.price.toString());
        if (initialAsset.type === 'IDX_STOCK') {
          setSharesInput('1000');
        } else if (initialAsset.price > 300) {
          setSharesInput('5');
        } else {
          setSharesInput('15');
        }
      } else {
        setSelectedAsset(null);
      }
    }
  }, [isOpen, initialAsset]);

  useEffect(() => {
    setDisplayLimit(60);
  }, [deferredSearchQuery, filterType]);

  // Normalized clean ticker from search bar (e.g., "bren.jk" -> "BREN")
  const normalizedSearchTicker = useMemo(() => {
    return searchQuery
      .toUpperCase()
      .trim()
      .replace(/\.JK$/i, '')
      .replace(/[^A-Z0-9.-]/g, '');
  }, [searchQuery]);

  const catalogAssets = getAllAssets();

  const existingTickersSet = useMemo(
    () => new Set(existingTickers.map((t) => t.toUpperCase())),
    [existingTickers]
  );

  // Check if exact ticker already exists in catalog
  const isExactTickerInCatalog = useMemo(() => {
    if (!normalizedSearchTicker) return false;
    return Boolean(getAssetByTicker(normalizedSearchTicker));
  }, [catalogAssets, normalizedSearchTicker, catalogVersion]);

  const categoryCounts = useMemo(
    () => getCatalogCategoryCounts(),
    [catalogAssets, catalogVersion]
  );

  // Filtered catalog assets using pre-lowercased index
  const filteredAssets = useMemo(() => {
    return searchCatalogAssets(deferredSearchQuery, filterType, { prioritizeTickerMatch: true });
  }, [catalogAssets, deferredSearchQuery, filterType, catalogVersion]);

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

  // Explicit Search Button handler: checks local catalog first; if not found, auto-detects exchange/category
  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!normalizedSearchTicker) return;
    setJustRegisteredBanner(null);

    if (isExactTickerInCatalog) {
      setSearchDetection(null);
      setFilterType('ALL');
      return;
    }

    const reqId = ++searchReqIdRef.current;
    setIsSearchingTicker(true);
    setSearchDetection(null);
    setSelectedCandidateIdx(0);
    try {
      const result = await fetchAppApi<any>(
        `/api/detect-ticker?ticker=${encodeURIComponent(searchQuery.trim() || normalizedSearchTicker)}&lang=${language}`
      );
      if (reqId !== searchReqIdRef.current) return;
      if (result.ok && result.data) {
        setSearchDetection(result.data);
      } else {
        setSearchDetection({
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
      if (reqId !== searchReqIdRef.current) return;
      setSearchDetection({
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
      if (reqId === searchReqIdRef.current) {
        setIsSearchingTicker(false);
      }
    }
  };

  // Add auto-detected ticker directly to catalog
  const handleQuickAddDetectedToCatalog = () => {
    if (!searchDetection || !searchDetection.found) return;
    const candidate =
      searchDetection.candidates[selectedCandidateIdx] ||
      (searchDetection.detectedType
        ? {
            type: searchDetection.detectedType,
            label: searchDetection.classificationLabel || t('ETF Global', 'Global ETF'),
            name: searchDetection.name || searchDetection.ticker,
            price: searchDetection.price || 100,
            changePercent: searchDetection.changePercent || 0,
            currency: searchDetection.currency || 'USD',
            exchangeName: searchDetection.exchangeName || '',
          }
        : null);

    if (!candidate) return;

    const regTypeVal = candidate.type;
    const defaultSector =
      regTypeVal === 'IDX_STOCK'
        ? t('Bursa Efek Indonesia', 'Indonesia Stock Exchange')
        : regTypeVal === 'US_STOCK'
        ? t('Wall Street Global', 'US Wall Street')
        : t('ETF Indeks & Sektoral', 'Index & Sector ETFs');

    const newAsset: Asset = {
      ticker: searchDetection.ticker,
      name: candidate.name,
      type: regTypeVal,
      sector: defaultSector,
      currency: candidate.currency,
      price: candidate.price,
      change1D: candidate.changePercent || 0,
      return1Y: 10.0,
      return3Y: 12.0,
      beta: regTypeVal === 'ETF' ? 0.95 : 1.1,
      dividendYield: regTypeVal === 'ETF' ? 2.0 : 1.0,
      peRatio: regTypeVal !== 'ETF' ? 18.0 : undefined,
      expenseRatio: regTypeVal === 'ETF' ? 0.15 : undefined,
      marketCap:
        regTypeVal === 'IDX_STOCK'
          ? t('Emiten IDX', 'IDX Listed')
          : regTypeVal === 'ETF'
          ? t('ETF Global', 'Global ETF')
          : t('Emiten AS', 'US Listed'),
      riskRating: 'Moderat',
      history12M: [90, 92, 94, 95, 97, 99, 98, 100, 101, 102, 103, 105],
      description: t(
        `Instrumen ${candidate.label} (${candidate.exchangeName || 'Global'}) yang didaftarkan otomatis ke katalog PortoLens AI.`,
        `${candidate.label} (${candidate.exchangeName || 'Global'}) instrument auto-registered to the PortoLens AI catalog.`
      ),
    };

    registerCustomAsset(newAsset);
    setCatalogVersion((v) => v + 1);
    setSearchDetection(null);
    setSearchQuery(newAsset.ticker);
    setFilterType('ALL');
    setJustRegisteredBanner({
      ticker: newAsset.ticker,
      label: candidate.label,
    });
  };

  // Probe both Global/US and IDX (.JK) to give accurate market detection hint
  const probeTickerMarkets = async (ticker: string) => {
    const reqId = ++lookupReqIdRef.current;
    setIsLookingUpQuote(true);
    try {
      const idxSym = `${ticker}.JK`;
      const result = await fetchAppApi<any>(
        `/api/live-quotes?symbols=${encodeURIComponent(`${ticker},${idxSym}`)}`
      );
      if (reqId !== lookupReqIdRef.current) return;
      if (result.ok && result.data) {
        const data = result.data;
        const globalQ = data?.quotes?.[ticker];
        const idxQ = data?.quotes?.[idxSym];

        const foundIdx = !!(idxQ && idxQ.isLiveFound);
        const foundGlobal = !!(globalQ && globalQ.isLiveFound && globalQ.currency !== 'IDR');

        let suggestedType: AssetClassification | null = null;
        let hintName: string | undefined;
        let hintPrice: number | undefined;
        let hintCurrency: string | undefined;

        if (foundGlobal && !foundIdx) {
          hintName = globalQ.shortName;
          hintPrice = globalQ.price;
          hintCurrency = globalQ.currency || 'USD';
          const instType = (globalQ.instrumentType || '').toUpperCase();
          const upperName = (hintName || '').toUpperCase();
          suggestedType =
            instType === 'ETF' ||
            instType === 'MUTUALFUND' ||
            upperName.includes('ETF') ||
            upperName.includes('FUND') ||
            upperName.includes('TRUST') ||
            upperName.includes('INDEX') ||
            upperName.includes('INCOME')
              ? 'ETF'
              : 'US_STOCK';
        } else if (foundIdx && !foundGlobal) {
          hintName = idxQ.shortName;
          hintPrice = idxQ.price;
          hintCurrency = 'IDR';
          suggestedType = 'IDX_STOCK';
        }

        setDetectedMarketHint({
          suggestedType,
          shortName: hintName,
          price: hintPrice,
          currency: hintCurrency,
          foundIdx,
          foundGlobal,
        });

        if (suggestedType && !editingCustomTicker) {
          setRegType(suggestedType);
          if (hintPrice) setRegPrice(hintPrice.toString());
          if (hintName) setRegName(hintName);
          setLookupStatus('found');
        }
      }
    } catch {
      // ignore probe errors
    } finally {
      if (reqId === lookupReqIdRef.current) {
        setIsLookingUpQuote(false);
      }
    }
  };

  // Open registration form for an unlisted ticker
  const handleStartRegistration = (ticker: string) => {
    setEditingCustomTicker(null);
    setRegisteringTicker(ticker);
    setRegType(null);
    setRegName('');
    setRegSector('');
    setRegPrice('');
    setLookupStatus('idle');
    setDetectedMarketHint(null);
    setJustRegisteredBanner(null);
    probeTickerMarkets(ticker);
  };

  // Open classification editor for an existing custom ticker
  const handleStartEditCustomAsset = (asset: Asset, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingCustomTicker(asset.ticker);
    setRegisteringTicker(asset.ticker);
    setRegType(asset.type);
    setRegName(asset.name);
    setRegSector(asset.sector);
    setRegPrice(asset.price.toString());
    setLookupStatus('idle');
    setDetectedMarketHint(null);
    setJustRegisteredBanner(null);
    probeTickerMarkets(asset.ticker);
  };

  // When classification is selected during registration, try fetching live quote metadata for that market
  const handleSelectClassification = async (classification: AssetClassification) => {
    setRegType(classification);
    if (!registeringTicker) return;

    const querySymbol =
      classification === 'IDX_STOCK'
        ? `${registeringTicker}.JK`
        : registeringTicker;

    const reqId = ++lookupReqIdRef.current;
    setIsLookingUpQuote(true);
    setLookupStatus('idle');
    try {
      const result = await fetchAppApi<any>(
        `/api/live-quotes?symbols=${encodeURIComponent(querySymbol)}`
      );
      if (reqId !== lookupReqIdRef.current) return;
      if (result.ok && result.data) {
        const data = result.data;
        const quote = data?.quotes?.[querySymbol];
        if (quote && quote.isLiveFound && typeof quote.price === 'number') {
          setRegPrice(quote.price.toString());
          if (quote.shortName) {
            setRegName(quote.shortName);
          }
          setLookupStatus('found');
        } else {
          setLookupStatus('not_found');
          if (!regPrice.trim() && !editingCustomTicker) {
            setRegPrice(classification === 'IDX_STOCK' ? '1000' : '100');
          }
        }
      } else {
        setLookupStatus('not_found');
        if (!regPrice.trim() && !editingCustomTicker) {
          setRegPrice(classification === 'IDX_STOCK' ? '1000' : '100');
        }
      }
    } catch {
      if (reqId !== lookupReqIdRef.current) return;
      setLookupStatus('not_found');
      if (!regPrice.trim() && !editingCustomTicker) {
        setRegPrice(classification === 'IDX_STOCK' ? '1000' : '100');
      }
    } finally {
      if (reqId === lookupReqIdRef.current) {
        setIsLookingUpQuote(false);
      }
    }
  };

  // Complete Stage 1: Register new ticker into catalog (NOT into portfolio yet)
  const handleConfirmRegisterToCatalog = (e: React.FormEvent) => {
    e.preventDefault();
    if (!registeringTicker || !regType) return;

    const cleanPrice = parseDecimalInput(regPrice, {
      thousandsDotForIntegerLocale: regType === 'IDX_STOCK',
    });
    const validPrice =
      !isNaN(cleanPrice) && cleanPrice > 0
        ? cleanPrice
        : regType === 'IDX_STOCK'
        ? 1000
        : 100;

    const classificationLabel =
      regType === 'IDX_STOCK'
        ? t('Saham IHSG (IDX)', 'IDX Stock (Indonesia)')
        : regType === 'US_STOCK'
        ? t('Saham AS (Wall Street)', 'US Stock (Wall Street)')
        : t('ETF Global', 'Global ETF');

    const defaultSector =
      regType === 'IDX_STOCK'
        ? t('Bursa Efek Indonesia', 'Indonesia Stock Exchange')
        : regType === 'US_STOCK'
        ? t('Wall Street Global', 'US Wall Street')
        : t('ETF Indeks & Sektoral', 'Index & Sector ETFs');

    const defaultName =
      regName.trim() ||
      (regType === 'IDX_STOCK'
        ? `${registeringTicker} Tbk`
        : regType === 'ETF'
        ? `${registeringTicker} ETF`
        : `${registeringTicker} Inc.`);

    const newAsset: Asset = {
      ticker: registeringTicker,
      name: defaultName,
      type: regType,
      sector: regSector.trim() || defaultSector,
      currency: regType === 'IDX_STOCK' ? 'IDR' : 'USD',
      price: validPrice,
      change1D: 0,
      return1Y: 10.0,
      return3Y: 12.0,
      beta: regType === 'ETF' ? 0.95 : 1.1,
      dividendYield: regType === 'ETF' ? 1.5 : 1.0,
      peRatio: regType !== 'ETF' ? 18.0 : undefined,
      expenseRatio: regType === 'ETF' ? 0.15 : undefined,
      marketCap:
        regType === 'IDX_STOCK'
          ? t('Emiten IDX', 'IDX Listed')
          : regType === 'ETF'
          ? t('ETF Global', 'Global ETF')
          : t('Emiten AS', 'US Listed'),
      riskRating: 'Moderat',
      history12M: [90, 92, 94, 95, 97, 99, 98, 100, 101, 102, 103, 105],
      description: t(
        `Instrumen ${classificationLabel} yang didaftarkan oleh Anda ke katalog PortoLens AI.`,
        `${classificationLabel} instrument manually registered to your PortoLens AI catalog.`
      ),
    };

    if (editingCustomTicker) {
      updateCustomAssetClassification(
        registeringTicker,
        regType,
        validPrice,
        defaultName,
        regSector.trim() || undefined,
        language
      );
    } else {
      registerCustomAsset(newAsset);
    }
    setCatalogVersion((v) => v + 1);

    // Return to Catalog list so user now sees the registered ticker and can select it to add to portfolio
    setRegisteringTicker(null);
    setEditingCustomTicker(null);
    setDetectedMarketHint(null);
    setSearchQuery(newAsset.ticker);
    setFilterType('ALL');
    setJustRegisteredBanner({
      ticker: newAsset.ticker,
      label: classificationLabel,
    });
  };

  // Stage 2: Select an already-registered catalog asset to add into portfolio
  const handleSelectAsset = (asset: Asset) => {
    setSelectedAsset(asset);
    setBuyPriceInput(asset.price.toString());
    if (asset.type === 'IDX_STOCK') {
      setSharesInput('1000'); // 10 lot
    } else if (asset.price > 300) {
      setSharesInput('5');
    } else {
      setSharesInput('15');
    }
  };

  const handleSaveToPortfolio = () => {
    if (!selectedAsset) return;
    const shares = parseDecimalInput(sharesInput, {
      thousandsDotForIntegerLocale: selectedAsset.type === 'IDX_STOCK',
    });
    const avgBuyPrice = parseDecimalInput(buyPriceInput, {
      thousandsDotForIntegerLocale: selectedAsset.currency === 'IDR',
    });

    if (isNaN(shares) || shares <= 0) return;
    if (isNaN(avgBuyPrice) || avgBuyPrice <= 0) return;

    onAddHolding({
      ticker: selectedAsset.ticker,
      shares,
      avgBuyPrice,
      buyCurrency: selectedAsset.currency,
    });

    setSelectedAsset(null);
    setSearchQuery('');
    setJustRegisteredBanner(null);
    onClose();
  };

  if (!isOpen) return null;

  const parsedShares = parseDecimalInput(sharesInput, {
    thousandsDotForIntegerLocale: selectedAsset?.type === 'IDX_STOCK',
  });
  const parsedBuyPrice = parseDecimalInput(buyPriceInput, {
    thousandsDotForIntegerLocale: selectedAsset?.currency === 'IDR',
  });
  const sharesNum = !isNaN(parsedShares) && parsedShares > 0 ? parsedShares : 0;
  const buyPriceNum = !isNaN(parsedBuyPrice) && parsedBuyPrice > 0 ? parsedBuyPrice : 0;
  const totalNative = sharesNum * buyPriceNum;
  const totalInView = selectedAsset
    ? convertToCurrency(totalNative, selectedAsset.currency, viewCurrency, usdIdrRate)
    : 0;

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-t-3xl sm:rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-5 pt-4 pb-3 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-white">
              {registeringTicker
                ? editingCustomTicker
                  ? t(`Ubah Kategori ${registeringTicker}`, `Edit Category: ${registeringTicker}`)
                  : t(`Daftarkan Ticker ${registeringTicker}`, `Register Ticker ${registeringTicker}`)
                : selectedAsset
                ? t(`Masukkan ${selectedAsset.ticker} ke Portofolio`, `Add ${selectedAsset.ticker} to Portfolio`)
                : t('Katalog Saham & ETF Lengkap', 'Full Stock & ETF Catalog')}
            </h2>
            <p className="text-xs text-slate-400">
              {registeringTicker
                ? t('Langkah 1: Pilih klasifikasi agar terdaftar di katalog', 'Step 1: Choose classification to register in catalog')
                : selectedAsset
                ? t('Langkah 2: Tentukan jumlah lembar & harga beli rata-rata', 'Step 2: Enter share quantity & average buy price')
                : t('Saham IHSG (RI), Saham Wall Street (AS) & ETF Global', 'IDX Stocks (ID), Wall Street (US) & Global ETFs')}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label={t('Tutup', 'Close')}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto space-y-3.5">
          {/* VIEW 2: REGISTER NEW TICKER FORM */}
          {registeringTicker ? (
            <form onSubmit={handleConfirmRegisterToCatalog} className="space-y-4">
              {detectedMarketHint?.suggestedType ? (
                <div className="p-3 rounded-xl bg-cyan-950/30 border border-cyan-800/60 flex items-start gap-2.5 text-xs text-cyan-200">
                  <Sparkles className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block">
                      {t('Terdeteksi Otomatis:', 'Auto-Detected:')}{' '}
                      {detectedMarketHint.suggestedType === 'ETF'
                        ? t('ETF Global (USD)', 'Global ETF (USD)')
                        : detectedMarketHint.suggestedType === 'US_STOCK'
                        ? t('Saham Wall Street AS (USD)', 'US Wall Street Stock (USD)')
                        : t('Saham IHSG (IDR)', 'IDX Stock (IDR)')}
                    </span>
                    <span className="text-[11px] text-cyan-200/80">
                      {detectedMarketHint.shortName
                        ? `${detectedMarketHint.shortName} · `
                        : ''}
                      {t(
                        'Anda tetap dapat memilih atau mengubah klasifikasi di bawah sebelum menyimpan.',
                        'You can still select or change the classification below before saving.'
                      )}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-800/50 flex items-start gap-2.5 text-xs text-amber-200">
                  <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block">
                      {editingCustomTicker
                        ? t(`Ubah Klasifikasi "${registeringTicker}"`, `Change Classification for "${registeringTicker}"`)
                        : t(`Ticker "${registeringTicker}" Belum Terdaftar`, `Ticker "${registeringTicker}" Not Listed Yet`)}
                    </span>
                    <span className="text-[11px] text-amber-200/80">
                      {t(
                        'Pilih klasifikasi di bawah (Saham IHSG, Saham Wall Street AS, atau ETF Global) sebelum dimasukkan ke portofolio.',
                        'Choose a classification below (IDX Stock, US Wall Street Stock, or Global ETF) before adding to your portfolio.'
                      )}
                    </span>
                  </div>
                </div>
              )}

              {/* Mandatory Classification Picker */}
              <div>
                <label className="block text-xs font-bold text-slate-200 mb-2">
                  {t('Klasifikasi Instrumen', 'Asset Classification')}{' '}
                  <span className="text-rose-400">{t('*Wajib pilih salah satu', '*Required')}</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => handleSelectClassification('IDX_STOCK')}
                    className={`p-3 rounded-xl border text-left transition-all flex sm:flex-col items-center sm:items-start gap-3 sm:gap-1.5 ${
                      regType === 'IDX_STOCK'
                        ? 'bg-emerald-500/15 border-emerald-500 text-white shadow-sm'
                        : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <Building2
                      className={`w-5 h-5 shrink-0 ${
                        regType === 'IDX_STOCK' ? 'text-emerald-400' : 'text-slate-400'
                      }`}
                    />
                    <div>
                      <span className="text-xs font-bold block">{t('Saham IHSG', 'IDX Stock')}</span>
                      <span className="text-[10px] text-slate-400 block">IDX · Rupiah (IDR)</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSelectClassification('US_STOCK')}
                    className={`p-3 rounded-xl border text-left transition-all flex sm:flex-col items-center sm:items-start gap-3 sm:gap-1.5 ${
                      regType === 'US_STOCK'
                        ? 'bg-cyan-500/15 border-cyan-500 text-white shadow-sm'
                        : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <Globe
                      className={`w-5 h-5 shrink-0 ${
                        regType === 'US_STOCK' ? 'text-cyan-400' : 'text-slate-400'
                      }`}
                    />
                    <div>
                      <span className="text-xs font-bold block">{t('Saham AS', 'US Stock')}</span>
                      <span className="text-[10px] text-slate-400 block">Wall Street · USD</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSelectClassification('ETF')}
                    className={`p-3 rounded-xl border text-left transition-all flex sm:flex-col items-center sm:items-start gap-3 sm:gap-1.5 ${
                      regType === 'ETF'
                        ? 'bg-amber-500/15 border-amber-500 text-white shadow-sm'
                        : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <Layers
                      className={`w-5 h-5 shrink-0 ${
                        regType === 'ETF' ? 'text-amber-400' : 'text-slate-400'
                      }`}
                    />
                    <div>
                      <span className="text-xs font-bold block">{t('ETF Global', 'Global ETF')}</span>
                      <span className="text-[10px] text-slate-400 block">NYSE / Nasdaq · USD</span>
                    </div>
                  </button>
                </div>
              </div>

              {/* Additional Details once Classification is Selected */}
              {regType && (
                <div className="space-y-3 pt-1 animate-in fade-in duration-200">
                  {isLookingUpQuote && (
                    <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 flex items-center gap-2">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                      <span>{t(`Mencari data harga terkini ${registeringTicker}...`, `Fetching live quote for ${registeringTicker}...`)}</span>
                    </div>
                  )}

                  {!isLookingUpQuote && lookupStatus === 'found' && (
                    <div className="p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-800/60 text-[11px] text-emerald-300 flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>{t('Data harga pasar real-time berhasil ditemukan otomatis!', 'Real-time market quote found automatically!')}</span>
                    </div>
                  )}

                  {!isLookingUpQuote &&
                    regType === 'IDX_STOCK' &&
                    detectedMarketHint?.foundGlobal &&
                    !detectedMarketHint?.foundIdx && (
                      <div className="p-2.5 rounded-xl bg-amber-950/50 border border-amber-700/70 text-[11px] text-amber-200 flex items-start gap-2">
                        <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                        <span>
                          {language === 'en' ? (
                            <>
                              Warning: <b>{registeringTicker}</b> was not found on the Indonesia Stock Exchange (.JK), but was detected on a global exchange ({detectedMarketHint.currency}). Consider selecting <b>Global ETF</b> or <b>US Stock</b>.
                            </>
                          ) : (
                            <>
                              Peringatan: <b>{registeringTicker}</b> tidak ditemukan di Bursa Efek Indonesia (.JK), tetapi terdeteksi sebagai instrumen bursa global ({detectedMarketHint.currency}). Pertimbangkan memilih <b>ETF Global</b> atau <b>Saham AS</b>.
                            </>
                          )}
                        </span>
                      </div>
                    )}

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      {t('Nama Emiten / ETF', 'Company / ETF Name')}
                    </label>
                    <input
                      type="text"
                      value={regName}
                      onChange={(e) => setRegName(e.target.value)}
                      placeholder={
                        regType === 'IDX_STOCK'
                          ? t(`Contoh: ${registeringTicker} Tbk`, `e.g. ${registeringTicker} Tbk`)
                          : regType === 'ETF'
                          ? t(`Contoh: ${registeringTicker} Index ETF`, `e.g. ${registeringTicker} Index ETF`)
                          : t(`Contoh: ${registeringTicker} Corp.`, `e.g. ${registeringTicker} Corp.`)
                      }
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        {t(`Harga Pasar (${regType === 'IDX_STOCK' ? 'IDR' : 'USD'})`, `Market Price (${regType === 'IDX_STOCK' ? 'IDR' : 'USD'})`)}
                      </label>
                      <input
                        type="text"
                        inputMode="decimal"
                        required
                        value={regPrice}
                        onChange={(e) => setRegPrice(e.target.value)}
                        placeholder={regType === 'IDX_STOCK' ? '1000' : '100'}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white font-mono focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        {t('Sektor (Opsional)', 'Sector (Optional)')}
                      </label>
                      <input
                        type="text"
                        value={regSector}
                        onChange={(e) => setRegSector(e.target.value)}
                        placeholder={
                          regType === 'IDX_STOCK'
                            ? t('Energi / Bank / Tech', 'Energy / Banking / Tech')
                            : regType === 'ETF'
                            ? t('Indeks / Dividen', 'Index / Dividend')
                            : t('Teknologi / Finansial', 'Technology / Financials')
                        }
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setRegisteringTicker(null)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 flex items-center justify-center gap-1.5 transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>{t('Kembali', 'Back')}</span>
                </button>
                <button
                  type="submit"
                  disabled={
                    !regType ||
                    (() => {
                      const p = parseDecimalInput(regPrice, {
                        thousandsDotForIntegerLocale: regType === 'IDX_STOCK',
                      });
                      return isNaN(p) || p <= 0;
                    })()
                  }
                  className={`flex-1 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all ${
                    regType &&
                    (() => {
                      const p = parseDecimalInput(regPrice, {
                        thousandsDotForIntegerLocale: regType === 'IDX_STOCK',
                      });
                      return !isNaN(p) && p > 0;
                    })()
                      ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-500/20'
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{t('Daftarkan ke Katalog', 'Register to Catalog')}</span>
                </button>
              </div>
            </form>
          ) : !selectedAsset ? (
            /* VIEW 1: CATALOG BROWSER */
            <>
              {/* Confirmation banner after registering a new ticker */}
              {justRegisteredBanner && (
                <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-700/80 text-xs text-emerald-200 flex items-start gap-2 animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-emerald-300 block">
                      {t(
                        `Ticker ${justRegisteredBanner.ticker} berhasil didaftarkan (${justRegisteredBanner.label})!`,
                        `Ticker ${justRegisteredBanner.ticker} registered (${justRegisteredBanner.label})!`
                      )}
                    </span>
                    <span className="text-[11px] text-emerald-200/80">
                      {t(
                        'Sekarang ketuk aset di bawah untuk memasukkannya ke portofolio Anda.',
                        'Tap the asset below to add it to your portfolio.'
                      )}
                    </span>
                  </div>
                </div>
              )}

              {/* Search Bar + Explicit Search Button */}
              <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder={t('Ketik ticker (contoh: BREN, CRWD, SCHG)...', 'Type ticker (e.g. BREN, CRWD, SCHG)...')}
                    value={searchQuery}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSearchQuery(val);
                      if (justRegisteredBanner) setJustRegisteredBanner(null);
                      const nextNorm = val
                        .toUpperCase()
                        .trim()
                        .replace(/\.JK$/i, '')
                        .replace(/[^A-Z0-9.-]/g, '');
                      if (searchDetection && nextNorm !== searchDetection.ticker) {
                        setSearchDetection(null);
                      }
                    }}
                    className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <button
                  type="submit"
                  disabled={!normalizedSearchTicker || isSearchingTicker}
                  className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 shrink-0 transition-all ${
                    normalizedSearchTicker && !isSearchingTicker
                      ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-md shadow-emerald-500/20 active:scale-[0.98]'
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  {isSearchingTicker ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Search className="w-4 h-4" />
                  )}
                  <span>{t('Cari', 'Search')}</span>
                </button>
              </form>

              {/* Loading Auto-Detection Card */}
              {isSearchingTicker && (
                <div className="p-3.5 rounded-xl bg-slate-950 border border-indigo-700/50 text-xs text-slate-200 flex items-center gap-2.5 animate-in fade-in">
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-400 shrink-0" />
                  <div>
                    <span className="font-bold block">
                      {t(`Mendeteksi Ticker "${normalizedSearchTicker}"...`, `Detecting Ticker "${normalizedSearchTicker}"...`)}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {t(
                        'Memeriksa kategori otomatis: Saham IHSG, Saham Wall Street AS, atau ETF Global.',
                        'Checking category automatically: IDX Stock, US Wall Street Stock, or Global ETF.'
                      )}
                    </span>
                  </div>
                </div>
              )}

              {/* Unlisted Ticker Search Prompt & Auto-Detected Result Card */}
              {!isSearchingTicker && normalizedSearchTicker.length >= 1 && !isExactTickerInCatalog && (
                <>
                  {searchDetection && searchDetection.ticker === normalizedSearchTicker ? (
                    searchDetection.found ? (
                      (() => {
                        const activeCandidate =
                          searchDetection.candidates[selectedCandidateIdx] || {
                            type: searchDetection.detectedType!,
                            label: searchDetection.classificationLabel || t('ETF Global', 'Global ETF'),
                            name: searchDetection.name || searchDetection.ticker,
                            price: searchDetection.price || 100,
                            changePercent: searchDetection.changePercent || 0,
                            currency: searchDetection.currency || 'USD',
                            exchangeName: searchDetection.exchangeName || 'Global',
                          };

                        return (
                          <div className="p-3.5 rounded-xl bg-indigo-950/40 border border-indigo-600/60 space-y-2.5 animate-in fade-in">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-xs font-bold text-white">
                                    {searchDetection.ticker}
                                  </span>
                                  <span
                                    className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                                      activeCandidate.type === 'IDX_STOCK'
                                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                        : activeCandidate.type === 'US_STOCK'
                                        ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                                        : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                                    }`}
                                  >
                                    {t('Terdeteksi:', 'Detected:')} {activeCandidate.label}
                                  </span>
                                </div>
                                <p className="text-xs text-slate-200 font-medium mt-1">
                                  {activeCandidate.name}
                                </p>
                                <p className="text-[10px] text-slate-400">
                                  {t('Bursa:', 'Exchange:')} {activeCandidate.exchangeName} · {t('Belum ada di katalog', 'Not yet in catalog')}
                                </p>
                              </div>
                              <div className="text-right shrink-0">
                                <span className="text-xs font-bold text-white font-mono">
                                  {activeCandidate.currency === 'USD' ? '$' : 'Rp '}
                                  {activeCandidate.price.toLocaleString(locale, {
                                    maximumFractionDigits:
                                      activeCandidate.currency === 'USD'
                                        ? activeCandidate.price < 1
                                          ? 4
                                          : 2
                                        : 0,
                                  })}
                                </span>
                                <span
                                  className={`block text-[10px] font-mono ${
                                    activeCandidate.changePercent >= 0
                                      ? 'text-emerald-400'
                                      : 'text-rose-400'
                                  }`}
                                >
                                  {activeCandidate.changePercent >= 0 ? '+' : ''}
                                  {activeCandidate.changePercent}%
                                </span>
                              </div>
                            </div>

                            {searchDetection.candidates.length > 1 && (
                              <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                                <span className="text-[10px] text-slate-400">{t('Pilih bursa cocok:', 'Select matching exchange:')}</span>
                                {searchDetection.candidates.map((cand, idx) => (
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

                            <div className="flex items-center gap-2 pt-0.5">
                              <button
                                type="button"
                                onClick={handleQuickAddDetectedToCatalog}
                                className="flex-1 py-2 px-3 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-md shadow-emerald-500/20"
                              >
                                <PlusCircle className="w-3.5 h-3.5" />
                                <span>{t(`Tambahkan ${searchDetection.ticker} ke Katalog`, `Add ${searchDetection.ticker} to Catalog`)}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleStartRegistration(normalizedSearchTicker)}
                                className="py-2 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-semibold border border-slate-700 transition-colors"
                              >
                                {t('Edit Manual', 'Edit Manually')}
                              </button>
                            </div>
                          </div>
                        );
                      })()
                    ) : (
                      <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-700/60 space-y-2 animate-in fade-in">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                          <span>{t(`Ticker "${normalizedSearchTicker}" tidak ditemukan otomatis`, `Ticker "${normalizedSearchTicker}" was not found automatically`)}</span>
                        </div>
                        <p className="text-[11px] text-slate-300 leading-relaxed">
                          {language === 'en' ? (
                            <>You can still add it manually by choosing <b>IDX Stock</b>, <b>US Wall Street Stock</b>, or <b>Global ETF</b>.</>
                          ) : (
                            <>Anda tetap dapat menambahkannya ke katalog secara manual dengan memilih kategori <b>Saham IHSG</b>, <b>Saham Wall Street AS</b>, atau <b>ETF Global</b>.</>
                          )}
                        </p>
                        <button
                          type="button"
                          onClick={() => handleStartRegistration(normalizedSearchTicker)}
                          className="w-full py-2 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-md"
                        >
                          <PlusCircle className="w-3.5 h-3.5" />
                          <span>{t(`Tambahkan "${normalizedSearchTicker}" ke Katalog (Manual)`, `Add "${normalizedSearchTicker}" to Catalog (Manual)`)}</span>
                        </button>
                      </div>
                    )
                  ) : (
                    <div className="p-3 rounded-xl bg-indigo-950/35 border border-indigo-700/50 flex items-center justify-between gap-2 animate-in fade-in">
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-indigo-300">
                          {t(`Ticker "${normalizedSearchTicker}" belum ada di katalog`, `Ticker "${normalizedSearchTicker}" is not in the catalog yet`)}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          {language === 'en' ? (
                            <>Click <b>Search</b> to auto-detect category & live market price.</>
                          ) : (
                            <>Klik tombol <b>Cari</b> untuk deteksi otomatis kategori & harga terkini.</>
                          )}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleSearchSubmit({ preventDefault: () => {} } as React.FormEvent)}
                        className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shrink-0 flex items-center gap-1 transition-colors"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>{t('Deteksi & Tambah', 'Detect & Add')}</span>
                      </button>
                    </div>
                  )}
                </>
              )}

              {/* Category Filter Tabs */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between px-0.5">
                  <span className="text-[11px] font-semibold text-slate-400">
                    {t('Kategori Instrumen:', 'Asset Category:')}
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">
                    {filteredAssets.length.toLocaleString(locale)} {t('aset terdaftar', 'listed assets')}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 p-1 bg-slate-950/60 rounded-xl border border-slate-800/80 overflow-x-auto no-scrollbar">
                <button
                  onClick={() => setFilterType('ALL')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-colors ${
                    filterType === 'ALL'
                      ? 'bg-slate-800 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {t('Semua', 'All')} ({categoryCounts.all.toLocaleString(locale)})
                </button>
                <button
                  onClick={() => setFilterType('IDX_STOCK')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-colors ${
                    filterType === 'IDX_STOCK'
                      ? 'bg-slate-800 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {t('Saham IHSG', 'IDX Stocks')} ({categoryCounts.idx.toLocaleString(locale)})
                </button>
                <button
                  onClick={() => setFilterType('US_STOCK')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-colors ${
                    filterType === 'US_STOCK'
                      ? 'bg-slate-800 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {t('Saham AS', 'US Stocks')} ({categoryCounts.us.toLocaleString(locale)})
                </button>
                <button
                  onClick={() => setFilterType('ETF')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-colors ${
                    filterType === 'ETF'
                      ? 'bg-slate-800 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {t('ETF Global', 'Global ETFs')} ({categoryCounts.etf.toLocaleString(locale)})
                </button>
                </div>
              </div>

              {/* Asset List */}
              <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
                {visibleAssets.map((asset) => {
                  const isAlreadyInPortfolio = existingTickersSet.has(asset.ticker.toUpperCase());
                  const isNewlyRegistered = justRegisteredBanner?.ticker === asset.ticker;
                  const isUserCustom = isCustomAsset(asset.ticker);

                  return (
                    <div
                      key={asset.ticker}
                      onClick={() => handleSelectAsset(asset)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleSelectAsset(asset);
                        }
                      }}
                      className={`w-full p-3 rounded-xl border flex items-center justify-between text-left transition-colors cursor-pointer ${
                        isNewlyRegistered
                          ? 'bg-emerald-950/30 border-emerald-500/70 hover:bg-emerald-950/50'
                          : 'bg-slate-950/40 border-slate-800/90 hover:border-slate-700 hover:bg-slate-800/50'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-slate-800 flex flex-col items-center justify-center font-bold text-white text-xs border border-slate-700/60 shrink-0">
                          <span>{asset.ticker}</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-semibold text-sm text-slate-100 truncate">
                              {asset.name}
                            </span>
                            {isAlreadyInPortfolio && (
                              <span className="text-[10px] text-emerald-400 bg-emerald-950/60 px-1.5 py-0.2 rounded border border-emerald-800/50 font-medium">
                                {t('Ada', 'Held')}
                              </span>
                            )}
                            {isNewlyRegistered && (
                              <span className="text-[10px] text-cyan-300 bg-cyan-950/70 px-1.5 py-0.2 rounded border border-cyan-700/60 font-semibold">
                                {t('Terdaftar', 'Registered')}
                              </span>
                            )}
                            {isUserCustom && (
                              <button
                                type="button"
                                onClick={(e) => handleStartEditCustomAsset(asset, e)}
                                className="inline-flex items-center gap-0.5 text-[10px] text-amber-300 bg-amber-950/50 hover:bg-amber-900/60 px-1.5 py-0.5 rounded border border-amber-800/60 font-medium"
                                title={t('Ubah klasifikasi ticker ini', 'Edit asset classification')}
                              >
                                <Edit3 className="w-2.5 h-2.5" />
                                <span>{t('Ubah Kategori', 'Edit Category')}</span>
                              </button>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <span className="text-[11px] text-slate-400 truncate">
                              {asset.type === 'IDX_STOCK'
                                ? t('Saham IHSG', 'IDX Stock')
                                : asset.type === 'US_STOCK'
                                ? t('Saham Wall Street AS', 'US Wall Street Stock')
                                : t('ETF Global', 'Global ETF')}{' '}
                              · {asset.sector}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0 pl-2">
                        <p className="text-xs font-semibold text-slate-200 tabular-nums font-mono">
                          {asset.currency === 'USD' ? '$' : 'Rp '}
                          {asset.price.toLocaleString(locale, {
                            maximumFractionDigits:
                              asset.currency === 'USD' ? (asset.price < 1 ? 4 : 2) : 0,
                          })}
                        </p>
                        {(() => {
                          const chg = typeof asset.change1D === 'number' && Number.isFinite(asset.change1D) ? asset.change1D : 0;
                          return (
                            <p
                              className={`text-[11px] tabular-nums font-medium ${
                                chg >= 0 ? 'text-emerald-400' : 'text-rose-400'
                              }`}
                            >
                              {chg >= 0 ? '+' : ''}
                              {chg.toFixed(2)}%
                            </p>
                          );
                        })()}
                      </div>
                    </div>
                  );
                })}

                {visibleAssets.length < filteredAssets.length && (
                  <button
                    type="button"
                    onClick={() => setDisplayLimit((prev) => prev + 60)}
                    className="w-full py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/70 text-xs font-semibold text-slate-200 transition-colors"
                  >
                    {t(
                      `Muat Lebih Banyak (${visibleAssets.length.toLocaleString(locale)} dari ${filteredAssets.length.toLocaleString(locale)})`,
                      `Load More (${visibleAssets.length.toLocaleString(locale)} of ${filteredAssets.length.toLocaleString(locale)})`
                    )}
                  </button>
                )}

                {filteredAssets.length === 0 && !normalizedSearchTicker && (
                  <div className="text-center py-6 text-slate-400 text-xs">
                    {t('Tidak ada aset pada filter yang dipilih.', 'No assets match the selected filter.')}
                  </div>
                )}
              </div>
            </>
          ) : (
            /* VIEW 3: SELECTED REGISTERED ASSET -> ADD TO PORTFOLIO FORM */
            <div className="space-y-4">
              {/* Asset Header Card */}
              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold text-xs">
                    {selectedAsset.ticker}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">{selectedAsset.name}</h3>
                    <p className="text-xs text-slate-400">
                      {selectedAsset.type === 'IDX_STOCK'
                        ? t('Saham IHSG', 'IDX Stock')
                        : selectedAsset.type === 'US_STOCK'
                        ? t('Saham AS', 'US Stock')
                        : t('ETF Global', 'Global ETF')}{' '}
                      · {t('Harga Pasar:', 'Market Price:')} {selectedAsset.currency === 'USD' ? '$' : 'Rp '}
                      {selectedAsset.price.toLocaleString(locale, {
                        maximumFractionDigits:
                          selectedAsset.currency === 'USD'
                            ? selectedAsset.price < 1
                              ? 4
                              : 2
                            : 0,
                      })}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedAsset(null)}
                  className="text-xs text-slate-400 hover:text-slate-200 underline"
                >
                  {t('Ganti', 'Change')}
                </button>
              </div>

              {/* Shares Input */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  {t('Jumlah Lembar (Shares)', 'Share Quantity')}
                  {selectedAsset.type === 'IDX_STOCK' && (
                    <span className="text-slate-500 ml-1.5">{t('(1 Lot = 100 Lembar)', '(1 Lot = 100 Shares)')}</span>
                  )}
                </label>
                <div className="relative">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={sharesInput}
                    onChange={(e) => setSharesInput(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono focus:outline-none focus:border-emerald-500"
                    placeholder={
                      selectedAsset.type === 'IDX_STOCK'
                        ? t('Contoh: 1000', 'e.g. 1000')
                        : t('Contoh: 3,8955 atau 10', 'e.g. 3.8955 or 10')
                    }
                  />
                  {selectedAsset.type === 'IDX_STOCK' && sharesNum > 0 && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-mono">
                      = {(sharesNum / 100).toLocaleString(locale, { maximumFractionDigits: 2 })} {t('Lot', 'Lots')}
                    </span>
                  )}
                </div>
                {sharesNum > 0 && (
                  <p className="text-[10px] text-slate-400 mt-1 font-mono">
                    {t('Terbaca:', 'Parsed:')}{' '}
                    <span className="text-emerald-400 font-semibold">
                      {formatShareQuantity(sharesNum, language)}
                    </span>{' '}
                    {t('lembar', 'shares')}
                  </p>
                )}
              </div>

              {/* Average Buy Price Input */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  {t(`Harga Beli Rata-Rata (${selectedAsset.currency})`, `Average Buy Price (${selectedAsset.currency})`)}
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={buyPriceInput}
                  onChange={(e) => setBuyPriceInput(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono focus:outline-none focus:border-emerald-500"
                  placeholder={t(`Harga beli dalam ${selectedAsset.currency}`, `Buy price in ${selectedAsset.currency}`)}
                />
              </div>

              {/* Total Calculation Preview */}
              <div className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-900/40 text-xs space-y-1.5">
                <div className="flex justify-between text-slate-300">
                  <span>{t('Total Nilai Investasi:', 'Total Investment Value:')}</span>
                  <span className="font-semibold text-emerald-400 font-mono">
                    {selectedAsset.currency === 'USD' ? '$' : 'Rp '}
                    {totalNative.toLocaleString(locale, { maximumFractionDigits: 2 })}
                  </span>
                </div>
                {viewCurrency !== selectedAsset.currency && (
                  <div className="flex justify-between text-slate-400 text-[11px]">
                    <span>{t(`Konversi (${viewCurrency}):`, `Converted (${viewCurrency}):`)}</span>
                    <span className="font-mono">
                      {viewCurrency === 'IDR' ? 'Rp ' : '$'}
                      {totalInView.toLocaleString(locale, {
                        maximumFractionDigits: viewCurrency === 'USD' ? 2 : 0,
                      })}
                    </span>
                  </div>
                )}
              </div>

              {(sharesNum <= 0 || buyPriceNum <= 0) && (
                <p className="text-[11px] text-rose-400 font-medium">
                  {sharesNum <= 0
                    ? t('Masukkan jumlah lembar saham lebih dari 0.', 'Enter share quantity greater than 0.')
                    : t('Masukkan harga beli rata-rata lebih dari 0.', 'Enter average buy price greater than 0.')}
                </p>
              )}

              {/* Action Buttons */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedAsset(null)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 transition-colors"
                >
                  {t('Kembali', 'Back')}
                </button>
                <button
                  type="button"
                  onClick={handleSaveToPortfolio}
                  disabled={sharesNum <= 0 || buyPriceNum <= 0}
                  className={`flex-1 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-colors ${
                    sharesNum > 0 && buyPriceNum > 0
                      ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-500/20'
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>{t('Simpan ke Portofolio', 'Save to Portfolio')}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

import React, { useState, useMemo, useEffect } from 'react';
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
import {
  getAllAssets,
  Asset,
  convertToCurrency,
  registerCustomAsset,
  isCustomAsset,
  updateCustomAssetClassification,
  parseDecimalInput,
  formatShareQuantity,
} from '../data/marketData';

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
  const [catalogAssets, setCatalogAssets] = useState<Asset[]>(() => getAllAssets());
  const [searchQuery, setSearchQuery] = useState('');
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

  // Sync catalog whenever modal opens
  useEffect(() => {
    if (isOpen) {
      setCatalogAssets(getAllAssets());
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
  }, [searchQuery, filterType]);

  // Normalized clean ticker from search bar (e.g., "bren.jk" -> "BREN")
  const normalizedSearchTicker = useMemo(() => {
    return searchQuery
      .toUpperCase()
      .trim()
      .replace(/\.JK$/i, '')
      .replace(/[^A-Z0-9.-]/g, '');
  }, [searchQuery]);

  // Check if exact ticker already exists in catalog
  const isExactTickerInCatalog = useMemo(() => {
    if (!normalizedSearchTicker) return false;
    return catalogAssets.some(
      (a) => a.ticker.toUpperCase() === normalizedSearchTicker
    );
  }, [catalogAssets, normalizedSearchTicker]);

  const categoryCounts = useMemo(() => {
    let idx = 0;
    let us = 0;
    let etf = 0;
    for (const a of catalogAssets) {
      if (a.type === 'IDX_STOCK') idx++;
      else if (a.type === 'US_STOCK') us++;
      else etf++;
    }
    return { all: catalogAssets.length, idx, us, etf };
  }, [catalogAssets]);

  // Filtered catalog assets (enriched with live market quotes only for matching slice)
  const filteredAssets = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return catalogAssets.filter((asset) => {
      const matchesType = filterType === 'ALL' || asset.type === filterType;
      if (!matchesType) return false;
      if (!q) return true;
      return (
        asset.ticker.toLowerCase().includes(q) ||
        asset.name.toLowerCase().includes(q) ||
        asset.sector.toLowerCase().includes(q)
      );
    });
  }, [catalogAssets, searchQuery, filterType]);

  const visibleAssets = useMemo(() => {
    return filteredAssets.slice(0, displayLimit).map((asset) => {
      const live = liveQuotes?.[asset.ticker];
      const hasValidLive = live?.price !== undefined && live.isLiveFound !== false;
      return hasValidLive
        ? {
            ...asset,
            price: live.price,
            change1D: live.changePercent !== undefined ? live.changePercent : asset.change1D,
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

    setIsSearchingTicker(true);
    setSearchDetection(null);
    setSelectedCandidateIdx(0);
    try {
      const res = await fetch(
        `/api/detect-ticker?ticker=${encodeURIComponent(searchQuery.trim() || normalizedSearchTicker)}`
      );
      if (res.ok) {
        const data = await res.json();
        setSearchDetection(data);
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
      setIsSearchingTicker(false);
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
            label: searchDetection.classificationLabel || 'ETF Global',
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
        ? 'Bursa Efek Indonesia'
        : regTypeVal === 'US_STOCK'
        ? 'Wall Street Global'
        : 'ETF Indeks & Sektoral';

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
          ? 'Emiten IDX'
          : regTypeVal === 'ETF'
          ? 'ETF Global'
          : 'Emiten AS',
      riskRating: 'Moderat',
      history12M: [90, 92, 94, 95, 97, 99, 98, 100, 101, 102, 103, 105],
      description: `Instrumen ${candidate.label} (${candidate.exchangeName || 'Global'}) yang didaftarkan otomatis ke katalog PortoLens AI.`,
    };

    const updatedCatalog = registerCustomAsset(newAsset);
    setCatalogAssets(updatedCatalog);
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
    setIsLookingUpQuote(true);
    try {
      const idxSym = `${ticker}.JK`;
      const res = await fetch(
        `/api/live-quotes?symbols=${encodeURIComponent(`${ticker},${idxSym}`)}`
      );
      if (res.ok) {
        const data = await res.json();
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
      setIsLookingUpQuote(false);
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

    setIsLookingUpQuote(true);
    setLookupStatus('idle');
    try {
      const res = await fetch(
        `/api/live-quotes?symbols=${encodeURIComponent(querySymbol)}`
      );
      if (res.ok) {
        const data = await res.json();
        const quote = data?.quotes?.[querySymbol];
        if (quote && quote.isLiveFound && typeof quote.price === 'number') {
          setRegPrice(quote.price.toString());
          if (quote.shortName) {
            setRegName(quote.shortName);
          }
          setLookupStatus('found');
        } else {
          setLookupStatus('not_found');
          setRegPrice(classification === 'IDX_STOCK' ? '1000' : '100');
        }
      } else {
        setLookupStatus('not_found');
        setRegPrice(classification === 'IDX_STOCK' ? '1000' : '100');
      }
    } catch {
      setLookupStatus('not_found');
      setRegPrice(classification === 'IDX_STOCK' ? '1000' : '100');
    } finally {
      setIsLookingUpQuote(false);
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
        ? 'Saham IHSG (IDX)'
        : regType === 'US_STOCK'
        ? 'Saham AS (Wall Street)'
        : 'ETF Global';

    const defaultSector =
      regType === 'IDX_STOCK'
        ? 'Bursa Efek Indonesia'
        : regType === 'US_STOCK'
        ? 'Wall Street Global'
        : 'ETF Indeks & Sektoral';

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
      marketCap: regType === 'IDX_STOCK' ? 'Emiten IDX' : regType === 'ETF' ? 'ETF Global' : 'Emiten AS',
      riskRating: 'Moderat',
      history12M: [90, 92, 94, 95, 97, 99, 98, 100, 101, 102, 103, 105],
      description: `Instrumen ${classificationLabel} yang didaftarkan oleh Anda ke katalog PortoLens AI.`,
    };

    const updatedCatalog = editingCustomTicker
      ? updateCustomAssetClassification(
          registeringTicker,
          regType,
          validPrice,
          defaultName,
          regSector.trim() || undefined
        )
      : registerCustomAsset(newAsset);
    setCatalogAssets(updatedCatalog);

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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-t-3xl sm:rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-5 pt-4 pb-3 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-white">
              {registeringTicker
                ? editingCustomTicker
                  ? `Ubah Kategori ${registeringTicker}`
                  : `Daftarkan Ticker ${registeringTicker}`
                : selectedAsset
                ? `Masukkan ${selectedAsset.ticker} ke Portofolio`
                : 'Katalog Saham & ETF Lengkap'}
            </h2>
            <p className="text-xs text-slate-400">
              {registeringTicker
                ? 'Langkah 1: Pilih klasifikasi agar terdaftar di katalog'
                : selectedAsset
                ? 'Langkah 2: Tentukan jumlah lembar & harga beli rata-rata'
                : 'Saham IHSG (RI), Saham Wall Street (AS) & ETF Global'}
            </p>
          </div>
          <button
            onClick={onClose}
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
                      Terdeteksi Otomatis:{' '}
                      {detectedMarketHint.suggestedType === 'ETF'
                        ? 'ETF Global (USD)'
                        : detectedMarketHint.suggestedType === 'US_STOCK'
                        ? 'Saham Wall Street AS (USD)'
                        : 'Saham IHSG (IDR)'}
                    </span>
                    <span className="text-[11px] text-cyan-200/80">
                      {detectedMarketHint.shortName
                        ? `${detectedMarketHint.shortName} · `
                        : ''}
                      Anda tetap dapat memilih atau mengubah klasifikasi di bawah sebelum menyimpan.
                    </span>
                  </div>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-800/50 flex items-start gap-2.5 text-xs text-amber-200">
                  <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block">
                      {editingCustomTicker
                        ? `Ubah Klasifikasi "${registeringTicker}"`
                        : `Ticker "${registeringTicker}" Belum Terdaftar`}
                    </span>
                    <span className="text-[11px] text-amber-200/80">
                      Pilih klasifikasi di bawah (Saham IHSG, Saham Wall Street AS, atau ETF Global) sebelum dimasukkan ke portofolio.
                    </span>
                  </div>
                </div>
              )}

              {/* Mandatory Classification Picker */}
              <div>
                <label className="block text-xs font-bold text-slate-200 mb-2">
                  Klasifikasi Instrumen <span className="text-rose-400">*Wajib pilih salah satu</span>
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
                      <span className="text-xs font-bold block">Saham IHSG</span>
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
                      <span className="text-xs font-bold block">Saham AS</span>
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
                      <span className="text-xs font-bold block">ETF Global</span>
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
                      <span>Mencari data harga terkini {registeringTicker}...</span>
                    </div>
                  )}

                  {!isLookingUpQuote && lookupStatus === 'found' && (
                    <div className="p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-800/60 text-[11px] text-emerald-300 flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>Data harga pasar real-time berhasil ditemukan otomatis!</span>
                    </div>
                  )}

                  {!isLookingUpQuote &&
                    regType === 'IDX_STOCK' &&
                    detectedMarketHint?.foundGlobal &&
                    !detectedMarketHint?.foundIdx && (
                      <div className="p-2.5 rounded-xl bg-amber-950/50 border border-amber-700/70 text-[11px] text-amber-200 flex items-start gap-2">
                        <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                        <span>
                          Peringatan: <b>{registeringTicker}</b> tidak ditemukan di Bursa Efek Indonesia (.JK), tetapi terdeteksi sebagai instrumen bursa global ({detectedMarketHint.currency}). Pertimbangkan memilih <b>ETF Global</b> atau <b>Saham AS</b>.
                        </span>
                      </div>
                    )}

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Nama Emiten / ETF
                    </label>
                    <input
                      type="text"
                      value={regName}
                      onChange={(e) => setRegName(e.target.value)}
                      placeholder={
                        regType === 'IDX_STOCK'
                          ? `Contoh: ${registeringTicker} Tbk`
                          : regType === 'ETF'
                          ? `Contoh: ${registeringTicker} Index ETF`
                          : `Contoh: ${registeringTicker} Corp.`
                      }
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        Harga Pasar ({regType === 'IDX_STOCK' ? 'IDR' : 'USD'})
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
                        Sektor (Opsional)
                      </label>
                      <input
                        type="text"
                        value={regSector}
                        onChange={(e) => setRegSector(e.target.value)}
                        placeholder={
                          regType === 'IDX_STOCK'
                            ? 'Energi / Bank / Tech'
                            : regType === 'ETF'
                            ? 'Indeks / Dividen'
                            : 'Teknologi / Finansial'
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
                  <span>Kembali</span>
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
                  <span>Daftarkan ke Katalog</span>
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
                      Ticker {justRegisteredBanner.ticker} berhasil didaftarkan ({justRegisteredBanner.label})!
                    </span>
                    <span className="text-[11px] text-emerald-200/80">
                      Sekarang ketuk aset di bawah untuk memasukkannya ke portofolio Anda.
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
                    placeholder="Ketik ticker (contoh: BREN, CRWD, SCHG)..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      if (justRegisteredBanner) setJustRegisteredBanner(null);
                      if (searchDetection && e.target.value.toUpperCase().trim().replace(/\.JK$/i, '') !== searchDetection.ticker) {
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
                  <span>Cari</span>
                </button>
              </form>

              {/* Loading Auto-Detection Card */}
              {isSearchingTicker && (
                <div className="p-3.5 rounded-xl bg-slate-950 border border-indigo-700/50 text-xs text-slate-200 flex items-center gap-2.5 animate-in fade-in">
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-400 shrink-0" />
                  <div>
                    <span className="font-bold block">Mendeteksi Ticker "{normalizedSearchTicker}"...</span>
                    <span className="text-[11px] text-slate-400">
                      Memeriksa kategori otomatis: Saham IHSG, Saham Wall Street AS, atau ETF Global.
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
                            label: searchDetection.classificationLabel || 'ETF Global',
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
                                    Terdeteksi: {activeCandidate.label}
                                  </span>
                                </div>
                                <p className="text-xs text-slate-200 font-medium mt-1">
                                  {activeCandidate.name}
                                </p>
                                <p className="text-[10px] text-slate-400">
                                  Bursa: {activeCandidate.exchangeName} · Belum ada di katalog
                                </p>
                              </div>
                              <div className="text-right shrink-0">
                                <span className="text-xs font-bold text-white font-mono">
                                  {activeCandidate.currency === 'USD' ? '$' : 'Rp '}
                                  {activeCandidate.price.toLocaleString('id-ID', {
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
                                <span className="text-[10px] text-slate-400">Pilih bursa cocok:</span>
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
                                <span>Tambahkan {searchDetection.ticker} ke Katalog</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleStartRegistration(normalizedSearchTicker)}
                                className="py-2 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-semibold border border-slate-700 transition-colors"
                              >
                                Edit Manual
                              </button>
                            </div>
                          </div>
                        );
                      })()
                    ) : (
                      <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-700/60 space-y-2 animate-in fade-in">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                          <span>Ticker "{normalizedSearchTicker}" tidak ditemukan otomatis</span>
                        </div>
                        <p className="text-[11px] text-slate-300 leading-relaxed">
                          Anda tetap dapat menambahkannya ke katalog secara manual dengan memilih kategori <b>Saham IHSG</b>, <b>Saham Wall Street AS</b>, atau <b>ETF Global</b>.
                        </p>
                        <button
                          type="button"
                          onClick={() => handleStartRegistration(normalizedSearchTicker)}
                          className="w-full py-2 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-md"
                        >
                          <PlusCircle className="w-3.5 h-3.5" />
                          <span>Tambahkan "{normalizedSearchTicker}" ke Katalog (Manual)</span>
                        </button>
                      </div>
                    )
                  ) : (
                    <div className="p-3 rounded-xl bg-indigo-950/35 border border-indigo-700/50 flex items-center justify-between gap-2 animate-in fade-in">
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-indigo-300">
                          Ticker "{normalizedSearchTicker}" belum ada di katalog
                        </p>
                        <p className="text-[11px] text-slate-400">
                          Klik tombol <b>Cari</b> untuk deteksi otomatis kategori & harga terkini.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleSearchSubmit({ preventDefault: () => {} } as React.FormEvent)}
                        className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shrink-0 flex items-center gap-1 transition-colors"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Deteksi & Tambah</span>
                      </button>
                    </div>
                  )}
                </>
              )}

              {/* Category Filter Tabs */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between px-0.5">
                  <span className="text-[11px] font-semibold text-slate-400">
                    Kategori Instrumen:
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">
                    {filteredAssets.length.toLocaleString('id-ID')} aset terdaftar
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
                  Semua ({categoryCounts.all.toLocaleString('id-ID')})
                </button>
                <button
                  onClick={() => setFilterType('IDX_STOCK')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-colors ${
                    filterType === 'IDX_STOCK'
                      ? 'bg-slate-800 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Saham IHSG ({categoryCounts.idx.toLocaleString('id-ID')})
                </button>
                <button
                  onClick={() => setFilterType('US_STOCK')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-colors ${
                    filterType === 'US_STOCK'
                      ? 'bg-slate-800 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Saham AS ({categoryCounts.us.toLocaleString('id-ID')})
                </button>
                <button
                  onClick={() => setFilterType('ETF')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-colors ${
                    filterType === 'ETF'
                      ? 'bg-slate-800 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  ETF Global ({categoryCounts.etf.toLocaleString('id-ID')})
                </button>
                </div>
              </div>

              {/* Asset List */}
              <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
                {visibleAssets.map((asset) => {
                  const isAlreadyInPortfolio = existingTickers.includes(asset.ticker);
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
                                Ada
                              </span>
                            )}
                            {isNewlyRegistered && (
                              <span className="text-[10px] text-cyan-300 bg-cyan-950/70 px-1.5 py-0.2 rounded border border-cyan-700/60 font-semibold">
                                Terdaftar
                              </span>
                            )}
                            {isUserCustom && (
                              <button
                                type="button"
                                onClick={(e) => handleStartEditCustomAsset(asset, e)}
                                className="inline-flex items-center gap-0.5 text-[10px] text-amber-300 bg-amber-950/50 hover:bg-amber-900/60 px-1.5 py-0.5 rounded border border-amber-800/60 font-medium"
                                title="Ubah klasifikasi ticker ini"
                              >
                                <Edit3 className="w-2.5 h-2.5" />
                                <span>Ubah Kategori</span>
                              </button>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <span className="text-[11px] text-slate-400 truncate">
                              {asset.type === 'IDX_STOCK'
                                ? 'Saham IHSG'
                                : asset.type === 'US_STOCK'
                                ? 'Saham Wall Street AS'
                                : 'ETF Global'}{' '}
                              · {asset.sector}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0 pl-2">
                        <p className="text-xs font-semibold text-slate-200 tabular-nums font-mono">
                          {asset.currency === 'USD' ? '$' : 'Rp '}
                          {asset.price.toLocaleString('id-ID', {
                            maximumFractionDigits:
                              asset.currency === 'USD' ? (asset.price < 1 ? 4 : 2) : 0,
                          })}
                        </p>
                        <p
                          className={`text-[11px] tabular-nums font-medium ${
                            asset.change1D >= 0 ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {asset.change1D >= 0 ? '+' : ''}
                          {asset.change1D}%
                        </p>
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
                    Muat Lebih Banyak ({visibleAssets.length.toLocaleString('id-ID')} dari{' '}
                    {filteredAssets.length.toLocaleString('id-ID')})
                  </button>
                )}

                {filteredAssets.length === 0 && !normalizedSearchTicker && (
                  <div className="text-center py-6 text-slate-400 text-xs">
                    Tidak ada aset pada filter yang dipilih.
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
                        ? 'Saham IHSG'
                        : selectedAsset.type === 'US_STOCK'
                        ? 'Saham AS'
                        : 'ETF Global'}{' '}
                      · Harga Pasar: {selectedAsset.currency === 'USD' ? '$' : 'Rp '}
                      {selectedAsset.price.toLocaleString('id-ID', {
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
                  Ganti
                </button>
              </div>

              {/* Shares Input */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Jumlah Lembar (Shares)
                  {selectedAsset.type === 'IDX_STOCK' && (
                    <span className="text-slate-500 ml-1.5">(1 Lot = 100 Lembar)</span>
                  )}
                </label>
                <div className="relative">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={sharesInput}
                    onChange={(e) => setSharesInput(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono focus:outline-none focus:border-emerald-500"
                    placeholder={selectedAsset.type === 'IDX_STOCK' ? 'Contoh: 1000' : 'Contoh: 3,8955 atau 10'}
                  />
                  {selectedAsset.type === 'IDX_STOCK' && sharesNum > 0 && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-mono">
                      = {(sharesNum / 100).toLocaleString('id-ID', { maximumFractionDigits: 2 })} Lot
                    </span>
                  )}
                </div>
                {sharesNum > 0 && (
                  <p className="text-[10px] text-slate-400 mt-1 font-mono">
                    Terbaca: <span className="text-emerald-400 font-semibold">{formatShareQuantity(sharesNum)}</span> lembar
                  </p>
                )}
              </div>

              {/* Average Buy Price Input */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Harga Beli Rata-Rata ({selectedAsset.currency})
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={buyPriceInput}
                  onChange={(e) => setBuyPriceInput(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono focus:outline-none focus:border-emerald-500"
                  placeholder={`Harga beli dalam ${selectedAsset.currency}`}
                />
              </div>

              {/* Total Calculation Preview */}
              <div className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-900/40 text-xs space-y-1.5">
                <div className="flex justify-between text-slate-300">
                  <span>Total Nilai Investasi:</span>
                  <span className="font-semibold text-emerald-400 font-mono">
                    {selectedAsset.currency === 'USD' ? '$' : 'Rp '}
                    {totalNative.toLocaleString('id-ID', { maximumFractionDigits: 2 })}
                  </span>
                </div>
                {viewCurrency !== selectedAsset.currency && (
                  <div className="flex justify-between text-slate-400 text-[11px]">
                    <span>Konversi ({viewCurrency}):</span>
                    <span className="font-mono">
                      {viewCurrency === 'IDR' ? 'Rp ' : '$'}
                      {totalInView.toLocaleString('id-ID', {
                        maximumFractionDigits: viewCurrency === 'USD' ? 2 : 0,
                      })}
                    </span>
                  </div>
                )}
              </div>

              {(sharesNum <= 0 || buyPriceNum <= 0) && (
                <p className="text-[11px] text-rose-400 font-medium">
                  {sharesNum <= 0
                    ? 'Masukkan jumlah lembar saham lebih dari 0.'
                    : 'Masukkan harga beli rata-rata lebih dari 0.'}
                </p>
              )}

              {/* Action Buttons */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedAsset(null)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 transition-colors"
                >
                  Kembali
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
                  <span>Simpan ke Portofolio</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

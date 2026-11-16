import React, { useState, useEffect } from 'react';
import {
  X,
  Trash2,
  Edit3,
  Check,
  TrendingUp,
  ShieldAlert,
  DollarSign,
  Bell,
  CheckCircle2,
  Sparkles,
  Bot,
  Loader2,
  ArrowRight,
  Target,
  AlertTriangle,
  Lightbulb,
  PlusCircle,
} from 'lucide-react';
import { fetchJsonSafe } from '../utils/safeFetch';
import {
  Asset,
  PortfolioHolding,
  convertToCurrency,
  RiskProfile,
  parseDecimalInput,
  formatShareQuantity,
} from '../data/marketData';

export interface AssetAiAnalysisResult {
  source: 'gemini' | 'algorithm';
  rekomendasi: string;
  sentimen: string;
  ringkasanEksekutif: string;
  estimasiHargaWajar: {
    rentangNilai: string;
    statusValuasi: string;
  };
  katalisPositif: string[];
  risikoDanTantangan: string[];
  kesesuaianProfil: string;
  saranStrategi: string;
  targetEntryPrice?: number;
  targetExitPrice?: number;
}

interface AssetDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  asset: Asset | null;
  holding: PortfolioHolding | null;
  onUpdateShares: (ticker: string, newShares: number, newAvgBuyPrice?: number, newBuyCurrency?: 'USD' | 'IDR') => void;
  onRemoveHolding: (ticker: string) => void;
  viewCurrency: 'IDR' | 'USD';
  usdIdrRate?: number;
  onOpenPriceAlertModal: (ticker: string, defaultTargetPrice?: number, defaultType?: 'ENTRY' | 'EXIT') => void;
  currentProfile?: RiskProfile;
  onQuickSetAlert?: (ticker: string, targetPrice: number, type: 'ENTRY' | 'EXIT', note: string) => void;
  onRequestAddToPortfolio?: (asset: Asset) => void;
}

const ASSET_AI_CACHE_MAX = 30;
const assetAiClientCache = new Map<string, AssetAiAnalysisResult>();

function setAssetAiCache(key: string, value: AssetAiAnalysisResult) {
  if (assetAiClientCache.has(key)) assetAiClientCache.delete(key);
  assetAiClientCache.set(key, value);
  if (assetAiClientCache.size > ASSET_AI_CACHE_MAX) {
    const oldest = assetAiClientCache.keys().next().value;
    if (oldest !== undefined) assetAiClientCache.delete(oldest);
  }
}

export const AssetDetailModal: React.FC<AssetDetailModalProps> = ({
  isOpen,
  onClose,
  asset,
  holding,
  onUpdateShares,
  onRemoveHolding,
  viewCurrency,
  usdIdrRate,
  onOpenPriceAlertModal,
  currentProfile,
  onQuickSetAlert,
  onRequestAddToPortfolio,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editShares, setEditShares] = useState('');
  const [editAvgPrice, setEditAvgPrice] = useState('');
  const [editBuyCurrency, setEditBuyCurrency] = useState<'USD' | 'IDR'>('USD');
  const [saveSuccessMsg, setSaveSuccessMsg] = useState(false);

  const aiCacheKey = asset
    ? `${asset.ticker}|${currentProfile?.id || ''}|${viewCurrency}|${holding?.shares || 0}|${holding?.avgBuyPrice || 0}|${holding?.buyCurrency || ''}`
    : '';

  // AI Analysis state
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<AssetAiAnalysisResult | null>(() =>
    aiCacheKey ? assetAiClientCache.get(aiCacheKey) || null : null
  );
  const [aiError, setAiError] = useState<string | null>(null);
  const [alertAddedSuccess, setAlertAddedSuccess] = useState<string | null>(null);

  const aiRequestIdRef = React.useRef(0);
  const saveTimerRef = React.useRef<number | null>(null);
  const alertTimerRef = React.useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
      if (alertTimerRef.current) window.clearTimeout(alertTimerRef.current);
    };
  }, []);

  // Sync edit fields only when modal opens or selected asset ticker changes
  useEffect(() => {
    if (holding) {
      setEditShares(holding.shares.toString());
      setEditAvgPrice(holding.avgBuyPrice.toString());
      setEditBuyCurrency(holding.buyCurrency);
    }
    setIsEditing(false);
    setSaveSuccessMsg(false);
  }, [holding?.ticker, isOpen]);

  // Restore cached AI analysis (if any) when viewing different asset/position
  useEffect(() => {
    aiRequestIdRef.current += 1;
    setIsAiLoading(false);
    setAiAnalysis(aiCacheKey ? assetAiClientCache.get(aiCacheKey) || null : null);
    setAiError(null);
    setAlertAddedSuccess(null);
  }, [aiCacheKey, isOpen]);

  const handleRunAiAnalysis = async () => {
    if (!asset) return;
    const reqId = ++aiRequestIdRef.current;
    const reqCacheKey = aiCacheKey;
    setIsAiLoading(true);
    setAiError(null);
    try {
      const result = await fetchJsonSafe<AssetAiAnalysisResult>('/api/analyze-asset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asset,
          holding,
          riskProfile: currentProfile,
          currency: viewCurrency,
        }),
      });

      if (!result.ok || !result.data) {
        throw new Error(result.errorMessage || `Server status ${result.status}`);
      }

      const data = result.data;
      if (reqCacheKey) setAssetAiCache(reqCacheKey, data);
      if (aiRequestIdRef.current !== reqId) return;
      setAiAnalysis(data);
    } catch (err: any) {
      if (aiRequestIdRef.current !== reqId) return;
      console.error('Error in handleRunAiAnalysis:', err);
      setAiError('Terjadi kendala saat menganalisis dengan AI. Silakan coba beberapa saat lagi.');
    } finally {
      if (aiRequestIdRef.current === reqId) {
        setIsAiLoading(false);
      }
    }
  };

  const formatAssetPrice = (val: number, curr: 'USD' | 'IDR', maxDecimalsOverride?: number) => {
    if (!Number.isFinite(val)) return '0';
    if (curr === 'IDR') {
      return val.toLocaleString('id-ID', { maximumFractionDigits: 0 });
    }
    return val.toLocaleString('id-ID', {
      minimumFractionDigits: 2,
      maximumFractionDigits: maxDecimalsOverride ?? (val < 1 ? 4 : 2),
    });
  };

  const handleApplyAiAlert = (targetPrice: number, type: 'ENTRY' | 'EXIT') => {
    if (!asset) return;
    const marketCurr: 'IDR' | 'USD' = asset.type === 'IDX_STOCK' ? 'IDR' : 'USD';
    const formattedPrice = `${marketCurr === 'USD' ? '$' : 'Rp '}${formatAssetPrice(targetPrice, marketCurr)}`;
    const note = type === 'ENTRY'
      ? `Target Beli Akumulasi AI (${aiAnalysis?.rekomendasi || 'AI'})`
      : `Target Take Profit AI (${aiAnalysis?.rekomendasi || 'AI'})`;

    if (onQuickSetAlert) {
      onQuickSetAlert(asset.ticker, targetPrice, type, note);
      setAlertAddedSuccess(`Alert ${type === 'ENTRY' ? 'Beli (Entry)' : 'Ambil Profit (Exit)'} pada target ${formattedPrice} aktif!`);
      if (alertTimerRef.current) window.clearTimeout(alertTimerRef.current);
      alertTimerRef.current = window.setTimeout(() => setAlertAddedSuccess(null), 4000);
    } else {
      onOpenPriceAlertModal(asset.ticker, targetPrice, type);
    }
  };

  if (!isOpen || !asset) return null;

  const nativeCurrency: 'IDR' | 'USD' = asset.type === 'IDX_STOCK' ? 'IDR' : 'USD';
  const safeChange1D =
    typeof asset.change1D === 'number' && Number.isFinite(asset.change1D) ? asset.change1D : 0;

  const currentShares = holding?.shares || 0;
  const currentAvgPrice = holding?.avgBuyPrice || asset.price;
  const avgBuyPriceInNative = holding
    ? holding.buyCurrency === nativeCurrency
      ? holding.avgBuyPrice
      : convertToCurrency(holding.avgBuyPrice, holding.buyCurrency, nativeCurrency, usdIdrRate)
    : asset.price;

  const currentValNative = currentShares * asset.price;
  const currentValInView = convertToCurrency(currentValNative, nativeCurrency, viewCurrency, usdIdrRate);

  const costBasisNative = currentShares * currentAvgPrice;
  const costBasisInView = holding
    ? convertToCurrency(costBasisNative, holding.buyCurrency, viewCurrency, usdIdrRate)
    : 0;

  const gainLossVal = currentValInView - costBasisInView;
  const gainLossPct = costBasisInView > 0 ? (gainLossVal / costBasisInView) * 100 : 0;

  const handleStartEdit = () => {
    if (holding) {
      setEditShares(holding.shares.toString());
      setEditAvgPrice(holding.avgBuyPrice.toString());
      setEditBuyCurrency(holding.buyCurrency);
    }
    setIsEditing(true);
    setSaveSuccessMsg(false);
  };

  const parsedEditShares = parseDecimalInput(editShares, {
    thousandsDotForIntegerLocale: asset.type === 'IDX_STOCK',
  });
  const editSharesNum = !isNaN(parsedEditShares) && parsedEditShares > 0 ? parsedEditShares : 0;

  const parsedEditAvg = parseDecimalInput(editAvgPrice, {
    thousandsDotForIntegerLocale: editBuyCurrency === 'IDR',
  });
  const editAvgPriceNum = !isNaN(parsedEditAvg) && parsedEditAvg > 0 ? parsedEditAvg : 0;
  const isEditValid = editSharesNum > 0 && editAvgPriceNum > 0;
  const editCostInView = convertToCurrency(
    editSharesNum * editAvgPriceNum,
    editBuyCurrency,
    viewCurrency,
    usdIdrRate
  );

  const handleSaveEdit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!isEditValid || !holding) return;

    onUpdateShares(holding.ticker, editSharesNum, editAvgPriceNum, editBuyCurrency);
    setIsEditing(false);
    setSaveSuccessMsg(true);
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => setSaveSuccessMsg(false), 3000);
  };

  const handleConfirmDelete = () => {
    if (holding) {
      onRemoveHolding(holding.ticker);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-t-3xl sm:rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-5 pt-4 pb-3 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold text-sm">
              {asset.ticker}
            </div>
            <div>
              <h2 className="text-sm font-bold text-white leading-tight">{asset.name}</h2>
              <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                <span className="text-xs text-slate-400">
                  {asset.sector} · {asset.type === 'US_STOCK' ? 'Saham Wall Street AS' : asset.type === 'IDX_STOCK' ? 'Saham IHSG (RI)' : 'ETF Global'}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-4 overflow-y-auto space-y-4">
          {/* Success Flash Badge */}
          {saveSuccessMsg && (
            <div className="p-3 rounded-xl bg-emerald-950/50 border border-emerald-800 text-xs text-emerald-300 flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="font-semibold">Jumlah lembar saham berhasil disimpan dan diperbarui!</span>
            </div>
          )}

          {/* Current Price & 1D Change */}
          <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
            <div>
              <span className="text-[11px] text-slate-400 font-medium">Harga Saat Ini</span>
              <p className="text-xl font-bold text-white tabular-nums mt-0.5 font-mono">
                {nativeCurrency === 'USD' ? '$' : 'Rp '}
                {formatAssetPrice(asset.price, nativeCurrency)}
              </p>
            </div>
            <div className="text-right">
              <span className="text-[11px] text-slate-400 font-medium">Perubahan 1 Hari</span>
              <p
                className={`text-sm font-bold tabular-nums mt-0.5 flex items-center justify-end gap-1 font-mono ${
                  safeChange1D >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                <TrendingUp className="w-3.5 h-3.5" />
                {safeChange1D >= 0 ? '+' : ''}
                {safeChange1D.toFixed(2)}%
              </p>
            </div>
          </div>

          {/* User's Holding Overview */}
          {holding && (
            <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                <span className="text-xs font-bold text-slate-300">Posisi Kepemilikan Anda</span>
                {!isEditing && (
                  <button
                    onClick={handleStartEdit}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-[11px] text-emerald-400 border border-emerald-500/30 font-semibold transition-colors"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Ubah Jumlah Lembar</span>
                  </button>
                )}
              </div>

              {isEditing ? (
                /* FORM EDIT JUMLAH LEMBAR */
                <form onSubmit={handleSaveEdit} noValidate className="space-y-3 pt-1">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Jumlah Lembar (Shares) Baru:
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={editShares}
                        onChange={(e) => setEditShares(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-emerald-500 text-white font-mono text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        placeholder={asset.type === 'IDX_STOCK' ? 'Contoh: 1000' : 'Contoh: 3,8955 atau 10'}
                        autoFocus
                      />
                      {asset.type === 'IDX_STOCK' && editSharesNum > 0 && (
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-mono">
                          = {(editSharesNum / 100).toLocaleString('id-ID', { maximumFractionDigits: 2 })} Lot
                        </span>
                      )}
                    </div>
                    {editSharesNum > 0 && (
                      <p className="text-[10px] text-slate-400 mt-1 font-mono">
                        Terbaca: <span className="text-emerald-400 font-semibold">{formatShareQuantity(editSharesNum)}</span> lembar
                      </p>
                    )}

                    {/* Quick Preset Buttons for Easy Input */}
                    <div className="flex items-center gap-1.5 mt-2 overflow-x-auto pb-0.5">
                      <span className="text-[10px] text-slate-500 shrink-0">Preset cepat:</span>
                      {asset.type === 'IDX_STOCK' ? (
                        <>
                          <button
                            type="button"
                            onClick={() => setEditShares('500')}
                            className="px-2 py-0.5 text-[10px] font-mono rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
                          >
                            500
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditShares('1000')}
                            className="px-2 py-0.5 text-[10px] font-mono rounded bg-slate-800 hover:bg-slate-700 text-emerald-400 font-bold"
                          >
                            1.000 (10 lot)
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditShares('5000')}
                            className="px-2 py-0.5 text-[10px] font-mono rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
                          >
                            5.000
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditShares('10000')}
                            className="px-2 py-0.5 text-[10px] font-mono rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
                          >
                            10.000
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => setEditShares('10')}
                            className="px-2 py-0.5 text-[10px] font-mono rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
                          >
                            10
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditShares('50')}
                            className="px-2 py-0.5 text-[10px] font-mono rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
                          >
                            50
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditShares('100')}
                            className="px-2 py-0.5 text-[10px] font-mono rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
                          >
                            100
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditShares('1000')}
                            className="px-2 py-0.5 text-[10px] font-mono rounded bg-slate-800 hover:bg-slate-700 text-emerald-400 font-bold"
                          >
                            1.000
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-semibold text-slate-300">
                        Harga Beli Rata-Rata ({editBuyCurrency}):
                      </label>
                      <div className="flex items-center gap-1 bg-slate-900 border border-slate-700 rounded-lg p-0.5">
                        <button
                          type="button"
                          onClick={() => setEditBuyCurrency('USD')}
                          className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors ${
                            editBuyCurrency === 'USD'
                              ? 'bg-emerald-500 text-slate-950'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          USD
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditBuyCurrency('IDR')}
                          className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors ${
                            editBuyCurrency === 'IDR'
                              ? 'bg-emerald-500 text-slate-950'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          IDR
                        </button>
                      </div>
                    </div>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={editAvgPrice}
                      onChange={(e) => setEditAvgPrice(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono text-sm focus:outline-none focus:border-emerald-500"
                      placeholder="Harga beli rata-rata..."
                    />
                    {/* Live Edit Cost Preview */}
                    {editSharesNum > 0 && editAvgPriceNum > 0 && (
                      <div className="mt-2 p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 text-[11px] flex items-center justify-between">
                        <span className="text-slate-400">Estimasi Modal ({viewCurrency}):</span>
                        <span className="font-mono font-bold text-emerald-400">
                          {viewCurrency === 'IDR' ? 'Rp ' : '$'}
                          {editCostInView.toLocaleString('id-ID', { maximumFractionDigits: viewCurrency === 'USD' ? 2 : 0 })}
                        </span>
                      </div>
                    )}
                    {editBuyCurrency !== nativeCurrency && (
                      <div className="mt-2 p-2 rounded-lg bg-amber-950/40 border border-amber-800/60 text-[10px] text-amber-300 flex items-center justify-between gap-2">
                        <span>
                          Mata uang beli ({editBuyCurrency}) berbeda dari mata uang bursa aset ({nativeCurrency}).
                        </span>
                        <button
                          type="button"
                          onClick={() => setEditBuyCurrency(nativeCurrency)}
                          className="px-2 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 font-bold shrink-0"
                        >
                          Ubah ke {nativeCurrency}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Validation error feedback */}
                  {!isEditValid && (
                    <p className="text-[11px] text-rose-400 font-medium">
                      {editSharesNum <= 0
                        ? 'Jumlah lembar saham harus lebih dari 0.'
                        : 'Harga beli rata-rata harus lebih dari 0.'}
                    </p>
                  )}

                  {/* Action buttons inside form */}
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setIsEditing(false)}
                      className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      disabled={!isEditValid}
                      className={`flex-1 py-2 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all ${
                        isEditValid
                          ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-md shadow-emerald-500/20 active:scale-[0.98]'
                          : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                      }`}
                    >
                      <Check className="w-4 h-4 stroke-[3]" />
                      <span>Simpan Perubahan</span>
                    </button>
                  </div>
                </form>
              ) : (
                /* READ-ONLY STATS */
                <div className="space-y-2.5">
                  {holding.buyCurrency !== nativeCurrency && (
                    <div className="p-2.5 rounded-xl bg-amber-950/40 border border-amber-700/60 text-[11px] text-amber-200 flex items-center justify-between gap-2">
                      <span>
                        Harga beli tercatat dalam <b>{holding.buyCurrency}</b> sedangkan harga pasar dalam <b>{nativeCurrency}</b>.
                      </span>
                      <button
                        type="button"
                        onClick={handleStartEdit}
                        className="px-2 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-bold text-[10px] shrink-0"
                      >
                        Sesuaikan
                      </button>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="col-span-2">
                      <span className="text-slate-400">Total Lembar:</span>
                      <p className="font-bold text-white font-mono mt-0.5 text-sm">
                        {formatShareQuantity(holding.shares)}{' '}
                        {asset.type === 'IDX_STOCK' && (
                          <span className="text-xs text-slate-400 font-normal">
                            ({(holding.shares / 100).toLocaleString('id-ID', { maximumFractionDigits: 2 })} lot)
                          </span>
                        )}
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-400">Avg Harga Beli:</span>
                      <p className="font-semibold text-white font-mono mt-0.5">
                        {nativeCurrency === 'USD' ? '$' : 'Rp '}
                        {formatAssetPrice(avgBuyPriceInNative, nativeCurrency, nativeCurrency === 'USD' ? 4 : 0)}
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-400">Harga Saat Ini:</span>
                      <p className="font-semibold text-emerald-300 font-mono mt-0.5">
                        {nativeCurrency === 'USD' ? '$' : 'Rp '}
                        {formatAssetPrice(asset.price, nativeCurrency)}
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-400">Nilai Sekarang ({viewCurrency}):</span>
                      <p className="font-bold text-slate-100 font-mono mt-0.5">
                        {viewCurrency === 'IDR' ? 'Rp ' : '$'}
                        {currentValInView.toLocaleString('id-ID', { maximumFractionDigits: viewCurrency === 'USD' ? 2 : 0 })}
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-400">Modal ({viewCurrency}):</span>
                      <p className="font-semibold text-slate-200 font-mono mt-0.5">
                        {viewCurrency === 'IDR' ? 'Rp ' : '$'}
                        {costBasisInView.toLocaleString('id-ID', { maximumFractionDigits: viewCurrency === 'USD' ? 2 : 0 })}
                      </p>
                    </div>
                    <div className="col-span-2 pt-1 border-t border-slate-800/70 flex items-center justify-between">
                      <span className="text-slate-400">Laba / Rugi (P&L):</span>
                      <p
                        className={`font-bold font-mono ${
                          gainLossVal >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {gainLossVal >= 0 ? '+' : '-'}
                        {viewCurrency === 'IDR' ? 'Rp ' : '$'}
                        {Math.abs(gainLossVal).toLocaleString('id-ID', { maximumFractionDigits: viewCurrency === 'USD' ? 2 : 0 })} (
                        {gainLossPct >= 0 ? '+' : ''}
                        {gainLossPct.toFixed(1)}%)
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Alert Success Banner */}
          {alertAddedSuccess && (
            <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-700/80 text-xs text-emerald-300 flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="font-semibold">{alertAddedSuccess}</span>
            </div>
          )}

          {/* AI REAL-TIME DEEP ANALYSIS CARD */}
          <div className="rounded-2xl border border-indigo-500/30 bg-gradient-to-b from-indigo-950/40 via-slate-900 to-slate-950 p-4 space-y-3 relative overflow-hidden shadow-lg shadow-indigo-950/30">
            {/* Header / Trigger */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/40 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 animate-pulse" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-white tracking-wide">Analisis AI Real-time</span>
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                      {aiAnalysis?.source === 'algorithm' ? 'QUANT ENGINE' : 'AI ANALYST'}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400">
                    Riset fundamental, valuasi harga wajar & manajemen risiko
                  </p>
                </div>
              </div>

              {aiAnalysis && !isAiLoading && (
                <button
                  onClick={handleRunAiAnalysis}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[10px] text-slate-300 border border-slate-700 font-medium transition-colors"
                >
                  Analisis Ulang
                </button>
              )}
            </div>

            {/* Error Message if any */}
            {aiError && (
              <div className="p-2.5 rounded-xl bg-rose-950/50 border border-rose-800 text-[11px] text-rose-300 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{aiError}</span>
              </div>
            )}

            {/* Initial State: Button to start analysis */}
            {!aiAnalysis && !isAiLoading && (
              <div className="pt-1">
                <p className="text-xs text-slate-300 leading-relaxed mb-3">
                  Dapatkan bedah emiten/ETF secara mendalam dengan AI: estimasi rentang harga wajar, rekomendasi aksi untuk profil{' '}
                  <span className="font-semibold text-emerald-400">{currentProfile?.name || 'investor'}</span>, 3 katalis utama, serta titik target harga masuk/keluar yang presisi.
                </p>
                <button
                  type="button"
                  onClick={handleRunAiAnalysis}
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 via-indigo-600 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-md shadow-indigo-600/30 transition-all active:scale-[0.98]"
                >
                  <Sparkles className="w-4 h-4 fill-indigo-200" />
                  <span>Analisis Mendalam {asset.ticker} dengan AI</span>
                </button>
              </div>
            )}

            {/* Loading State */}
            {isAiLoading && (
              <div className="py-6 px-3 text-center space-y-3">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 animate-spin">
                  <Loader2 className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white">Sedang Membedah {asset.ticker}...</h4>
                  <p className="text-[11px] text-slate-400 mt-1 max-w-xs mx-auto">
                    Menghitung rasio keuangan, volatilitas beta ({asset.beta}), valuasi harga wajar, serta kecocokan dengan profil {currentProfile?.name || 'investor'}.
                  </p>
                </div>
              </div>
            )}

            {/* Results Display */}
            {aiAnalysis && !isAiLoading && (
              <div className="space-y-3 pt-1 animate-in fade-in duration-300">
                {/* Recommendation & Sentiment Badges */}
                <div className="flex flex-wrap items-center gap-2">
                  {(() => {
                    const recUpper = (aiAnalysis.rekomendasi || 'TAHAN (HOLD)').toUpperCase();
                    return (
                      <div
                        className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 border shadow-sm ${
                          recUpper.includes('BELI')
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                            : recUpper.includes('TAHAN')
                            ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                            : recUpper.includes('PANGKAS')
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                            : 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                        }`}
                      >
                        <Target className="w-3.5 h-3.5" />
                        <span>{aiAnalysis.rekomendasi || 'TAHAN (HOLD)'}</span>
                      </div>
                    );
                  })()}

                  <div className="px-2.5 py-1 rounded-xl bg-slate-800/80 border border-slate-700 text-[11px] text-slate-300 font-medium">
                    Sentimen: <span className="font-semibold text-white">{aiAnalysis.sentimen}</span>
                  </div>

                  <div className="px-2.5 py-1 rounded-xl bg-slate-800/80 border border-slate-700 text-[11px] text-slate-300 font-medium">
                    Status: <span className="font-semibold text-amber-300">{aiAnalysis.estimasiHargaWajar?.statusValuasi || 'Wajar'}</span>
                  </div>
                </div>

                {/* Fair Value Estimate Box */}
                <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-slate-400 font-medium block">Rentang Estimasi Harga Wajar (Fair Value)</span>
                    <p className="text-sm font-bold text-emerald-400 font-mono mt-0.5">
                      {aiAnalysis.estimasiHargaWajar?.rentangNilai || '-'}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 font-medium block">Harga Pasar Saat Ini</span>
                    <p className="text-sm font-bold text-white font-mono mt-0.5">
                      {nativeCurrency === 'USD' ? '$' : 'Rp '}
                      {formatAssetPrice(asset.price, nativeCurrency)}
                    </p>
                  </div>
                </div>

                {/* Executive Summary */}
                <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 text-xs text-slate-200 leading-relaxed">
                  <div className="flex items-center gap-1.5 font-bold text-indigo-300 mb-1">
                    <Lightbulb className="w-3.5 h-3.5" />
                    <span>Ringkasan Fundamental AI</span>
                  </div>
                  <p>{aiAnalysis.ringkasanEksekutif}</p>
                </div>

                {/* Two Column: Positive Catalysts vs Risks */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {/* Catalysts */}
                  <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-900/50 space-y-1.5">
                    <div className="flex items-center gap-1.5 font-bold text-emerald-400 text-[11px]">
                      <TrendingUp className="w-3.5 h-3.5" />
                      <span>3 Katalis Pertumbuhan</span>
                    </div>
                    <ul className="space-y-1 text-[11px] text-slate-300">
                      {aiAnalysis.katalisPositif?.map((kat, idx) => (
                        <li key={idx} className="flex items-start gap-1.5">
                          <Check className="w-3 h-3 text-emerald-400 shrink-0 mt-0.5" />
                          <span>{kat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Risks */}
                  <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-900/50 space-y-1.5">
                    <div className="flex items-center gap-1.5 font-bold text-amber-400 text-[11px]">
                      <ShieldAlert className="w-3.5 h-3.5" />
                      <span>Risiko & Tantangan</span>
                    </div>
                    <ul className="space-y-1 text-[11px] text-slate-300">
                      {aiAnalysis.risikoDanTantangan?.map((risk, idx) => (
                        <li key={idx} className="flex items-start gap-1.5">
                          <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0 mt-0.5" />
                          <span>{risk}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Kesesuaian Profil */}
                <div className="p-2.5 rounded-xl bg-slate-900/50 border border-slate-800 text-[11px] text-slate-300">
                  <span className="font-semibold text-white">Kesesuaian Profil ({currentProfile?.name || 'Investor'}): </span>
                  {aiAnalysis.kesesuaianProfil}
                </div>

                {/* Saran Strategi & Quick Target Action */}
                <div className="p-3 rounded-xl bg-indigo-950/40 border border-indigo-800/60 space-y-2.5">
                  <div>
                    <span className="text-[11px] font-bold text-indigo-300 block mb-0.5">Saran Strategi AI:</span>
                    <p className="text-xs text-slate-200 leading-relaxed">{aiAnalysis.saranStrategi}</p>
                  </div>

                  {/* Quick Target Entry & Exit Buttons */}
                  {(aiAnalysis.targetEntryPrice || aiAnalysis.targetExitPrice) && (
                    <div className="pt-1 border-t border-indigo-900/50">
                      <span className="text-[10px] text-slate-400 font-medium block mb-1.5">
                        Pasang Target Notifikasi Cepat dari Rekomendasi AI:
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {aiAnalysis.targetEntryPrice && (
                          <button
                            type="button"
                            onClick={() => handleApplyAiAlert(aiAnalysis.targetEntryPrice!, 'ENTRY')}
                            className="w-full py-2 px-3 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-300 text-xs font-semibold flex items-center justify-between transition-colors"
                          >
                            <span className="flex items-center gap-1.5">
                              <Bell className="w-3.5 h-3.5" />
                              <span>Target Beli (Entry)</span>
                            </span>
                            <span className="font-mono font-bold">
                              {nativeCurrency === 'USD' ? '$' : 'Rp '}
                              {formatAssetPrice(aiAnalysis.targetEntryPrice, nativeCurrency)}
                            </span>
                          </button>
                        )}

                        {aiAnalysis.targetExitPrice && (
                          <button
                            type="button"
                            onClick={() => handleApplyAiAlert(aiAnalysis.targetExitPrice!, 'EXIT')}
                            className="w-full py-2 px-3 rounded-lg bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/40 text-indigo-300 text-xs font-semibold flex items-center justify-between transition-colors"
                          >
                            <span className="flex items-center gap-1.5">
                              <Target className="w-3.5 h-3.5" />
                              <span>Target Jual (Exit)</span>
                            </span>
                            <span className="font-mono font-bold">
                              {nativeCurrency === 'USD' ? '$' : 'Rp '}
                              {formatAssetPrice(aiAnalysis.targetExitPrice, nativeCurrency)}
                            </span>
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Key Fundamentals & Risk Metrics Grid */}
          <div>
            <h3 className="text-xs font-bold text-slate-300 mb-2">Metrik Risiko & Fundamental</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                <span className="text-slate-400 text-[11px]">Beta (Volatilitas)</span>
                <p className="font-bold text-white text-sm font-mono mt-0.5">{asset.beta}</p>
                <span className="text-[10px] text-slate-500">
                  {asset.beta > 1.2 ? 'Lebih fluktuatif dr pasar' : asset.beta < 0.8 ? 'Defensif & stabil' : 'Setara pasar'}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                <span className="text-slate-400 text-[11px]">Return 1 Tahun</span>
                <p
                  className={`font-bold text-sm font-mono mt-0.5 ${
                    asset.return1Y >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {asset.return1Y >= 0 ? '+' : ''}
                  {asset.return1Y}%
                </p>
                <span className="text-[10px] text-slate-500">Kinerja 12 bln terakhir</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                <span className="text-slate-400 text-[11px]">Dividend Yield</span>
                <p className="font-bold text-white text-sm font-mono mt-0.5">{asset.dividendYield}%</p>
                <span className="text-[10px] text-slate-500">Estimasi dividen tahunan</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                <span className="text-slate-400 text-[11px]">
                  {asset.peRatio !== undefined ? 'P/E Ratio (Valuasi)' : 'Expense Ratio'}
                </span>
                <p className="font-bold text-white text-sm font-mono mt-0.5">
                  {asset.peRatio !== undefined ? `${asset.peRatio}x` : `${asset.expenseRatio}%`}
                </p>
                <span className="text-[10px] text-slate-500">
                  {asset.peRatio !== undefined ? 'Kelipatan laba' : 'Biaya kelola ETF'}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                <span className="text-slate-400 text-[11px]">Market Cap / AUM</span>
                <p className="font-bold text-white text-sm font-mono mt-0.5">{asset.marketCap}</p>
                <span className="text-[10px] text-slate-500">Ukuran kapitalisasi</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                <span className="text-slate-400 text-[11px]">Tingkat Risiko</span>
                <p className="font-bold text-amber-400 text-sm mt-0.5">{asset.riskRating}</p>
                <span className="text-[10px] text-slate-500">Kategori profil</span>
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="p-3 rounded-xl bg-slate-950/40 border border-slate-800/80 text-xs text-slate-300 leading-relaxed">
            <span className="font-semibold text-white block mb-1">Tentang Emiten / ETF:</span>
            {asset.description}
          </div>

          {/* Price Alert, Add & Delete Actions */}
          <div className="pt-2 space-y-2">
            {!holding && onRequestAddToPortfolio && (
              <button
                onClick={() => {
                  onClose();
                  onRequestAddToPortfolio(asset);
                }}
                className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-md shadow-emerald-500/20"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Masukkan {asset.ticker} ke Portofolio</span>
              </button>
            )}

            <button
              onClick={() => {
                onOpenPriceAlertModal(asset.ticker);
                onClose();
              }}
              className="w-full py-2.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
            >
              <Bell className="w-3.5 h-3.5" />
              <span>Pasang Target Entry / Exit ({asset.ticker})</span>
            </button>

            {holding && (
              <button
                onClick={handleConfirmDelete}
                className="w-full py-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Hapus {asset.ticker} dari Portofolio</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

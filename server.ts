import express, { Request, Response, NextFunction } from 'express';
import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { CATALOG_ASSETS } from './src/data/assetsCatalog';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json());

// Initialize GoogleGenAI with fast timeout to prevent proxy hangs
const ai = process.env.GEMINI_API_KEY
  ? new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        timeout: 12000,
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    })
  : null;

function parseGeminiJson(rawText: string | undefined): any {
  if (!rawText) throw new Error('Empty Gemini response text');
  const cleaned = rawText
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/, '')
    .trim();
  return JSON.parse(cleaned);
}

// Endpoint: Analyze Portfolio using Gemini AI
app.post('/api/analyze-portfolio', async (req: Request, res: Response) => {
  const lang: 'id' | 'en' = req.body?.lang === 'en' ? 'en' : 'id';
  const isEn = lang === 'en';
  try {
    const { portfolio: rawPortfolio, metrics, riskProfile: rawRiskProfile, currency = 'IDR', totalValue = 0 } = req.body;
    const portfolio = Array.isArray(rawPortfolio)
      ? rawPortfolio
      : Array.isArray(metrics?.holdings)
      ? metrics.holdings
      : [];

    if (portfolio.length === 0) {
      return res.status(400).json({
        error: isEn ? 'Portfolio cannot be empty.' : 'Portofolio tidak boleh kosong.',
      });
    }

    const riskProfile = {
      name: rawRiskProfile?.name || (isEn ? 'Moderate' : 'Moderat'),
      description:
        rawRiskProfile?.description ||
        (isEn ? 'Balanced growth and risk management' : 'Keseimbangan pertumbuhan dan manajemen risiko'),
      volatilityTolerance:
        rawRiskProfile?.volatilityTolerance || (isEn ? 'Medium (10% - 15%)' : 'Menengah (10% - 15%)'),
      targetBetaRange: rawRiskProfile?.targetBetaRange || '0.85 - 1.10',
    };

    const numLocale = isEn ? 'en-US' : 'id-ID';
    const portfolioSummary = portfolio
      .map((item: any) => {
        const ticker = item.ticker || item.asset?.ticker || 'ASSET';
        const name = item.name || item.asset?.name || ticker;
        const allocation = item.allocation ?? item.weight ?? 0;
        const type = item.type || item.asset?.type || 'EQUITY';
        const sector = item.sector || item.asset?.sector || (isEn ? 'General' : 'Umum');
        const val = item.totalValue ?? item.valueInViewCurrency ?? 0;
        const ret1Y = item.return1Y ?? item.asset?.return1Y ?? 0;
        const beta = item.beta ?? item.asset?.beta ?? 1;
        return isEn
          ? `- ${ticker} (${name}): ${allocation}% allocation, Type: ${type}, Sector: ${sector}, Value: ${currency} ${Number(val).toLocaleString(numLocale)}, 1Y Return: ${ret1Y}%, Beta: ${beta}`
          : `- ${ticker} (${name}): ${allocation}% alokasi, Tipe: ${type}, Sektor: ${sector}, Nilai: ${currency} ${Number(val).toLocaleString(numLocale)}, 1Y Return: ${ret1Y}%, Beta: ${beta}`;
      })
      .join('\n');

    const liveFx = await fetchLiveUsdIdrRate();
    const clientRate = Number(req.body?.usdIdrRate);
    const activeUsdIdr = liveFx.isLive
      ? liveFx.price
      : Number.isFinite(clientRate) && clientRate > 1000
      ? clientRate
      : liveFx.price;
    const todayIso = new Date().toISOString().slice(0, 10);

    const prompt = isEn
      ? `You are a CFA-grade Senior Portfolio Manager and Quantitative Risk Analyst.
Perform a thorough evaluation, risk management assessment, and optimization recommendation for the following investment portfolio:

REFERENCE DATE: ${todayIso}
LIVE MARKET FX RATE: 1 USD = Rp ${Math.round(activeUsdIdr).toLocaleString('en-US')}
INVESTOR RISK PROFILE: ${riskProfile.name} (${riskProfile.description})
VOLATILITY TOLERANCE: ${riskProfile.volatilityTolerance}
TARGET BETA RANGE: ${riskProfile.targetBetaRange}
TOTAL PORTFOLIO VALUE: ${currency} ${Number(totalValue || 0).toLocaleString('en-US')}

HOLDINGS LIST:
${portfolioSummary}

CURRENT MACRO & MARKET CONTEXT (${todayIso}):
- US Federal Reserve target rate: 3.75% - 4.00%; Bank Indonesia BI-Rate: 5.75%.
- Live USD/IDR exchange rate around Rp ${Math.round(activeUsdIdr).toLocaleString('en-US')}.
- S&P 500 forward 12M P/E ~18.3x (below 10-yr average 19.1x) alongside strong AI/tech earnings.
- Sector rotation and liquidity across Indonesian blue-chip banking & commodities (IDX/IHSG).
- Capital flows into broad-market ETFs (VOO, SPY, QQQ) vs defensive/dividend instruments.

Provide detailed evaluation output strictly in JSON with these fields (ALL text values MUST be written in natural, professional English and MUST stay factually consistent with the reference date, live USD/IDR rate, and portfolio numbers above):
1. skorKesehatan (0-100) and predikat (A+, A, B+, B, C, D)
2. ringkasanEksekutif (concise, sharp, objective executive summary in English)
3. analisisKesesuaianProfil (whether this portfolio is too aggressive, well-aligned, or too conservative for the investor's risk profile)
4. kekuatanPortofolio (array of 3-4 key portfolio strengths backed by metrics)
5. kelemahanDanRisiko (array of 3-4 critical risk factors such as sector concentration, single-stock hazard, high beta, lack of defensive hedge)
6. saranOptimasiKonkret (array of specific actions: tindakan [TRIM/ADD/REBALANCE], ticker or asset type, allocation percentage delta in persentase, and fundamental/macro alasan)
7. proyeksiHasilOptimasi (estimated betaSebelum, betaSesudah, penurunanRisikoDrawdown, skorDiversifikasiNaik in English)
8. pandanganTrenPasarTerkait (how current US/Indonesia macro & market trends affect this portfolio)`
      : `Anda adalah seorang Senior Portfolio Manager dan Quantitative Risk Analyst profesional berstandar CFA dan OJK.
Lakukan evaluasi mendalam, penilaian risiko (risk management), dan rekomendasi optimasi portofolio investasi berikut:

TANGGAL REFERENSI: ${todayIso}
KURS USD/IDR TERKINI: 1 USD = Rp ${Math.round(activeUsdIdr).toLocaleString('id-ID')}
PROFIL RISIKO INVESTOR: ${riskProfile.name} (${riskProfile.description})
TOLERANSI VOLATILITAS: ${riskProfile.volatilityTolerance}
TARGET BETA: ${riskProfile.targetBetaRange}
TOTAL NILAI PORTOFOLIO: ${currency} ${Number(totalValue || 0).toLocaleString('id-ID')}

DAFTAR KEPEMILIKAN ASET:
${portfolioSummary}

KONTEKS MAKRO & TREN PASAR TERKINI (${todayIso}):
- Suku bunga acuan The Fed: 3.75% - 4.00%; BI-Rate Bank Indonesia: 5.75%.
- Kurs USD/IDR aktual berada di kisaran Rp ${Math.round(activeUsdIdr).toLocaleString('id-ID')}.
- Valuasi S&P 500 forward 12M P/E ~18.3x (di bawah rata-rata 10 tahun 19.1x) didukung pertumbuhan laba AI & teknologi.
- Rotasi sektor dan likuiditas pada saham perbankan & komoditas Indonesia (IHSG).
- Aliran dana ETF broad-market (VOO, SPY, QQQ) vs instrumen defensif/dividen.

Berikan output evaluasi terperinci dalam format JSON dengan struktur yang ditentukan (SELURUH teks WAJIB dalam Bahasa Indonesia serta konsisten secara faktual dengan tanggal referensi, kurs USD/IDR terkini, dan angka portofolio di atas):
1. skorKesehatan (0-100) dan predikat (A+, A, B+, B, C, D)
2. ringkasanEksekutif (penjelasan ringkas, tajam, objektif dalam Bahasa Indonesia)
3. analisisKesesuaianProfil (apakah portofolio ini terlalu berisiko, pas, atau terlalu konservatif bagi profil risiko investor)
4. kekuatanPortofolio (array 3-4 poin kekuatan beserta argumen data)
5. kelemahanDanRisiko (array 3-4 poin risiko kritis, misal konsentrasi sektor, single-stock hazard, beta tinggi, ketiadaan hedge)
6. saranOptimasiKonkret (array rekomendasi spesifik: tindakan [PANGKAS/TAMBAH/REBALANCE], ticker atau jenis aset, persentase perubahan alokasi, dan alasan fundamental/tren pasar)
7. proyeksiHasilOptimasi (estimasi penurunan risiko beta, peningkatan estimasi Sharpe Ratio, estimasi diversifikasi)
8. pandanganTrenPasarTerkait (analisis bagaimana tren makro & pasar AS/Indonesia mempengaruhi portofolio ini saat ini)`;

    const computedBeta = portfolio.reduce((sum: number, item: any) => {
      const alloc = Number(item.allocation ?? item.weight ?? 0);
      const itemBeta = Number(item.beta ?? item.asset?.beta ?? 1);
      return sum + (alloc / 100) * itemBeta;
    }, 0);
    const actualBeta = Number((computedBeta > 0 ? computedBeta : 1.0).toFixed(2));
    const projectedTargetBeta = actualBeta > 1.05
      ? Math.max(0.85, Number((actualBeta * 0.82).toFixed(2)))
      : actualBeta;
    const hasHighBetaAsset = portfolio.some((p: any) => (p.beta ?? p.asset?.beta ?? 1) > 1.3);

    if (!ai) {
      // Fallback high-fidelity algorithmic response if API key is not yet set
      return res.json(
        isEn
          ? {
              source: 'algorithm',
              skorKesehatan: 82,
              predikat: 'B+',
              ringkasanEksekutif: `Your portfolio rests on high-quality market leaders with strong global growth and tech exposure. However, elevated beta concentration should be aligned more closely with your ${riskProfile.name} risk management target.`,
              analisisKesesuaianProfil: `For a ${riskProfile.name} profile, your current volatility (beta ${actualBeta}) appears ${hasHighBetaAsset ? 'slightly more aggressive than the ideal band' : 'relatively well-balanced'}. Rebalancing a modest portion into dividend equities or broad-market ETFs can tighten downside protection.`,
              kekuatanPortofolio: [
                'Holds dominant market-leading companies with resilient operating margins and solid balance sheets.',
                'Dual-currency exposure (USD/IDR) provides a natural macroeconomic currency hedge.',
                'High institutional market liquidity enables flexible rebalancing at low execution slippage.',
              ],
              kelemahanDanRisiko: [
                'Elevated sensitivity to growth/tech sentiment and US Federal Reserve rate expectations.',
                'High cross-asset correlation among growth holdings during sudden equity drawdowns.',
                'Allocation to defensive income assets (high-dividend stocks or broad ETFs) remains below optimal weight.',
              ],
              saranOptimasiKonkret: [
                {
                  tindakan: 'TRIM',
                  ticker: portfolio[0]?.ticker || 'Top Asset',
                  persentase: 'Trim 5-10%',
                  alasan: 'Reduce single-asset concentration hazard and lock in partial gains amid elevated multiples.',
                },
                {
                  tindakan: 'ADD',
                  ticker: 'VOO / SCHD',
                  persentase: 'Add 10-15%',
                  alasan: 'Broaden diversification across 500 US blue-chips or quality dividends to anchor portfolio beta.',
                },
                {
                  tindakan: 'REBALANCE',
                  ticker: 'IDX Bluechips (BBCA/BBRI)',
                  persentase: 'Maintain 15-20%',
                  alasan: 'Provides steady dividend cash flow and domestic banking resilience against global volatility.',
                },
              ],
              proyeksiHasilOptimasi: {
                betaSebelum: actualBeta,
                betaSesudah: projectedTargetBeta,
                penurunanRisikoDrawdown: '22% more resilient during market pullbacks',
                skorDiversifikasiNaik: '+18 pts',
              },
              pandanganTrenPasarTerkait:
                'Global markets remain in a selective monetary easing transition. AI-driven technology leaders still deliver robust earnings growth but remain valuation-sensitive. Balancing growth exposure with quality dividend banks and broad ETFs offers the strongest risk-adjusted posture today.',
            }
          : {
              source: 'algorithm',
              skorKesehatan: 82,
              predikat: 'B+',
              ringkasanEksekutif:
                'Portofolio Anda memiliki fondasi aset berkualitas tinggi dengan eksposur ke sektor teknologi dan pertumbuhan global. Namun, terdapat konsentrasi risiko pada aset dengan beta tinggi yang perlu diselaraskan dengan manajemen risiko profil ' +
                riskProfile.name +
                '.',
              analisisKesesuaianProfil: `Untuk profil ${riskProfile.name}, tingkat volatilitas saat ini (beta ${actualBeta}) cenderung ${hasHighBetaAsset ? 'sedikit lebih agresif dari ambang ideal' : 'relatif seimbang'}. Diperlukan sedikit penyeimbangan ke instrumen berdividen atau ETF broad-market.`,
              kekuatanPortofolio: [
                'Memiliki saham pemimpin pasar (market leaders) dengan margin laba yang kuat dan fundamental solid.',
                'Eksposur terhadap mata uang global (USD) yang memberikan lindung nilai (currency hedge) alami.',
                'Likuiditas aset sangat tinggi memudahkan fleksibilitas rebalancing kapan saja.',
              ],
              kelemahanDanRisiko: [
                'Ketergantungan berlebih pada sentimen saham teknologi dan suku bunga acuan The Fed.',
                'Korelasi antar aset pertumbuhan cukup tinggi saat terjadi koreksi pasar mendadak.',
                'Porsi instrumen defensif (dividen tinggi atau obligasi/emas) masih di bawah standar alokasi optimal.',
              ],
              saranOptimasiKonkret: [
                {
                  tindakan: 'PANGKAS',
                  ticker: portfolio[0]?.ticker || 'Top Asset',
                  persentase: 'Kurangi 5-10%',
                  alasan:
                    'Mengurangi risiko konsentrasi tunggal dan mengamankan keuntungan sebagian (profit taking) di tengah valuasi yang tinggi.',
                },
                {
                  tindakan: 'TAMBAH',
                  ticker: 'VOO / SCHD',
                  persentase: 'Tambah 10-15%',
                  alasan:
                    'Meningkatkan diversifikasi ke 500 saham AS atau dividen defensif untuk menurunkan beta portofolio di bawah target risiko.',
                },
                {
                  tindakan: 'REBALANCE',
                  ticker: 'IDX Bluechips (BBCA/BBRI)',
                  persentase: 'Pertahankan 15-20%',
                  alasan:
                    'Memberikan imbal hasil dividen stabil dan pertumbuhan ekonomi domestik yang resilient terhadap volatilitas global.',
                },
              ],
              proyeksiHasilOptimasi: {
                betaSebelum: actualBeta,
                betaSesudah: projectedTargetBeta,
                penurunanRisikoDrawdown: '22% lebih stabil saat koreksi pasar',
                skorDiversifikasiNaik: '+18 poin',
              },
              pandanganTrenPasarTerkait:
                'Pasar global saat ini berada dalam fase transisi pelonggaran kebijakan moneter. Saham berbasis kecerdasan buatan (AI) masih menunjukkan pertumbuhan pendapatan kuat namun sensitif terhadap valuasi. Menjaga diversifikasi ke sektor kebutuhan pokok atau perbankan berdividen tinggi adalah strategi manajemen risiko terbaik saat ini.',
            }
      );
    }

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: prompt,
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        systemInstruction: isEn
          ? 'You are a professional quantitative portfolio analysis and risk management assistant for the PortoLens AI app. Always respond with valid JSON matching the schema, grounded in numbers, and written entirely in clear, professional English.'
          : 'Anda adalah asisten analisis portofolio keuangan dan manajemen risiko profesional untuk aplikasi Android PortoLens AI. Selalu berikan respon valid dalam format JSON sesuai schema, mendalam, berbasis data numerik, dan dalam Bahasa Indonesia yang profesional dan mudah dipahami.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            skorKesehatan: { type: Type.INTEGER },
            predikat: { type: Type.STRING },
            ringkasanEksekutif: { type: Type.STRING },
            analisisKesesuaianProfil: { type: Type.STRING },
            kekuatanPortofolio: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            kelemahanDanRisiko: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            saranOptimasiKonkret: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  tindakan: { type: Type.STRING },
                  ticker: { type: Type.STRING },
                  persentase: { type: Type.STRING },
                  alasan: { type: Type.STRING },
                },
                required: ['tindakan', 'ticker', 'persentase', 'alasan'],
              },
            },
            proyeksiHasilOptimasi: {
              type: Type.OBJECT,
              properties: {
                betaSebelum: { type: Type.NUMBER },
                betaSesudah: { type: Type.NUMBER },
                penurunanRisikoDrawdown: { type: Type.STRING },
                skorDiversifikasiNaik: { type: Type.STRING },
              },
              required: ['betaSebelum', 'betaSesudah', 'penurunanRisikoDrawdown', 'skorDiversifikasiNaik'],
            },
            pandanganTrenPasarTerkait: { type: Type.STRING },
          },
          required: [
            'skorKesehatan',
            'predikat',
            'ringkasanEksekutif',
            'analisisKesesuaianProfil',
            'kekuatanPortofolio',
            'kelemahanDanRisiko',
            'saranOptimasiKonkret',
            'proyeksiHasilOptimasi',
            'pandanganTrenPasarTerkait',
          ],
        },
      },
    });

    const parsed = parseGeminiJson(response.text);
    return res.json({
      source: 'gemini',
      ...parsed,
    });
  } catch (error: any) {
    console.error('Error analyzing portfolio with Gemini:', error);
    // Graceful fallback so user always gets actionable insight
    // Compute actual portfolio beta for catch fallback too
    const rawPort = Array.isArray(req.body?.portfolio)
      ? req.body.portfolio
      : Array.isArray(req.body?.metrics?.holdings)
      ? req.body.metrics.holdings
      : [];
    const fallbackBetaRaw = rawPort.reduce((sum: number, item: any) => {
      const alloc = Number(item.allocation ?? item.weight ?? 0);
      const itemBeta = Number(item.beta ?? item.asset?.beta ?? 1);
      return sum + (alloc / 100) * itemBeta;
    }, 0);
    const fbBetaBefore = Number((fallbackBetaRaw > 0 ? fallbackBetaRaw : 1.0).toFixed(2));
    const fbBetaAfter = fbBetaBefore > 1.05
      ? Math.max(0.85, Number((fbBetaBefore * 0.84).toFixed(2)))
      : fbBetaBefore;

    return res.status(200).json(
      isEn
        ? {
            source: 'fallback',
            skorKesehatan: 78,
            predikat: 'B',
            ringkasanEksekutif:
              'Your portfolio shows reasonable diversification across core equities, though weight adjustments are recommended to keep downside volatility within your risk tolerance.',
            analisisKesesuaianProfil:
              'Current allocation carries moderate-to-high market exposure. Balancing growth leaders with dividend-paying equities or broad ETFs is advised.',
            kekuatanPortofolio: [
              'Concentrated in large-capitalization companies with strong balance sheets and cash generation.',
              'Dual-currency allocation across USD and IDR helps cushion exchange rate swings.',
            ],
            kelemahanDanRisiko: [
              'Top 1–2 holdings exceed 25% of portfolio weight, creating single-name concentration risk.',
              'Annualized volatility may expand sharply during broad Wall Street selloffs.',
            ],
            saranOptimasiKonkret: [
              {
                tindakan: 'REBALANCE',
                ticker: 'Broad-Market ETF (VOO/SPY)',
                persentase: 'Allocate 15%',
                alasan: 'Dampen volatility and spread risk across broad economic sectors.',
              },
              {
                tindakan: 'TRIM',
                ticker: 'Highest-weight single stock',
                persentase: 'Trim 5-8%',
                alasan: 'Prevent sharp portfolio drawdown if a single top holding experiences a correction.',
              },
            ],
            proyeksiHasilOptimasi: {
              betaSebelum: fbBetaBefore,
              betaSesudah: fbBetaAfter,
              penurunanRisikoDrawdown: '18% lower drawdown sensitivity',
              skorDiversifikasiNaik: '+15 pts',
            },
            pandanganTrenPasarTerkait:
              'Fed rate expectations and global AI capital expenditure continue to drive periodic sector rotation. Holding broad index or dividend ETFs remains an effective shock absorber.',
          }
        : {
            source: 'fallback',
            skorKesehatan: 78,
            predikat: 'B',
            ringkasanEksekutif:
              'Portofolio Anda memiliki diversifikasi yang cukup baik pada saham-saham utama, namun membutuhkan penyesuaian porsi alokasi agar risiko penurunan (downside risk) terkendali sesuai profil Anda.',
            analisisKesesuaianProfil:
              'Alokasi saat ini memiliki eksposur moderat-tinggi. Disarankan menyeimbangkan antara aset pertumbuhan dan aset pendapatan dividen.',
            kekuatanPortofolio: [
              'Aset didominasi oleh perusahaan berkapitalisasi pasar besar dengan neraca keuangan yang sehat.',
              'Diversifikasi mata uang antara US Dollar dan Rupiah membantu mengimbangi fluktuasi nilai tukar.',
            ],
            kelemahanDanRisiko: [
              'Risiko konsentrasi pada 1-2 aset teratas masih di atas 25% dari total portofolio.',
              'Volatilitas tahunan dapat meningkat signifikan bila terjadi aksi jual di bursa Wall Street.',
            ],
            saranOptimasiKonkret: [
              {
                tindakan: 'REBALANCE',
                ticker: 'ETF Broad-Market (VOO/SPY)',
                persentase: 'Alokasikan 15%',
                alasan: 'Meredam volatilitas dan menyebarkan risiko ke seluruh sektor ekonomi.',
              },
              {
                tindakan: 'PANGKAS',
                ticker: 'Saham dengan alokasi tertinggi',
                persentase: 'Pangkas 5-8%',
                alasan: 'Mencegah risiko kejatuhan portofolio bila terjadi koreksi pada satu emiten.',
              },
            ],
            proyeksiHasilOptimasi: {
              betaSebelum: fbBetaBefore,
              betaSesudah: fbBetaAfter,
              penurunanRisikoDrawdown: '18% lebih aman dari gejolak pasar',
              skorDiversifikasiNaik: '+15 poin',
            },
            pandanganTrenPasarTerkait:
              'Sentimen suku bunga The Fed dan tren adopsi AI global memicu rotasi modal secara berkala. Memiliki cadangan kas atau ETF dividen terbukti menjadi bantalan terbaik saat volatilitas meningkat.',
          }
    );
  }
});

// Helper function for deep algorithmic financial analysis
function generateAssetFallbackAnalysis(
  asset: any,
  _holding: any,
  riskProfile: any,
  lang: 'id' | 'en' = 'id'
) {
  const isEn = lang === 'en';
  const numLocale = isEn ? 'en-US' : 'id-ID';
  const safeBeta = typeof asset.beta === 'number' ? asset.beta : 1.0;
  const safeReturn1Y = typeof asset.return1Y === 'number' ? asset.return1Y : 10.0;
  const safeDividend = typeof asset.dividendYield === 'number' ? asset.dividendYield : 0;
  const safeSector = asset.sector || (isEn ? 'Global Capital Markets' : 'Pasar Modal Global');
  const safePrice = typeof asset.price === 'number' && asset.price > 0 ? asset.price : 100;
  const safeName = asset.name || asset.ticker;
  const isHighBeta = safeBeta > 1.3;
  const isDividend = safeDividend > 2.0;

  const defaultEntry = asset.currency === 'USD'
    ? Number((safePrice * 0.93).toFixed(2))
    : Math.round(safePrice * 0.93);
  const defaultExit = asset.currency === 'USD'
    ? Number((safePrice * 1.15).toFixed(2))
    : Math.round(safePrice * 1.15);

  const fairLow = asset.currency === 'USD'
    ? `$${(safePrice * 0.95).toFixed(1)}`
    : `Rp ${Math.round(safePrice * 0.95).toLocaleString(numLocale)}`;
  const fairHigh = asset.currency === 'USD'
    ? `$${(safePrice * 1.12).toFixed(1)}`
    : `Rp ${Math.round(safePrice * 1.12).toLocaleString(numLocale)}`;

  if (isEn) {
    return {
      source: 'algorithm',
      rekomendasi: isHighBeta ? 'HOLD' : isDividend ? 'BUY / ACCUMULATE' : 'GRADUAL BUY',
      sentimen: isHighBeta ? 'Cautious / Long-Term Bullish' : 'Bullish',
      ringkasanEksekutif: `${safeName} (${asset.ticker}) holds a strong competitive moat in ${safeSector}. With a beta of ${safeBeta} and a 1-year return of ${safeReturn1Y}%, it offers an attractive risk-reward balance supported by solid market liquidity.`,
      estimasiHargaWajar: {
        rentangNilai: `${fairLow} - ${fairHigh}`,
        statusValuasi: isHighBeta ? 'Elevated Valuation (Premium Multiples)' : 'Fair Value',
      },
      katalisPositif: [
        `Structural secular tailwinds across ${safeSector} with steady institutional adoption.`,
        safeDividend > 0
          ? `A ${safeDividend}% dividend yield provides recurring cash-flow cushion for shareholders.`
          : 'Disciplined capital reinvestment expanding its long-term economic moat.',
        'Deep market liquidity enables flexible portfolio sizing and low transaction slippage.',
      ],
      risikoDanTantangan: [
        'Sensitivity to global interest-rate expectations and currency fluctuations.',
        isHighBeta
          ? 'Wider daily price swings during US equity factor and sector rotations.'
          : 'More moderate earnings growth rate given its large capitalization base.',
        'Regulatory shifts and global competitive dynamics within the sector.',
      ],
      kesesuaianProfil: `For a ${riskProfile?.name || 'Moderate'} profile, sizing ${asset.ticker} at 5% - 15% of total portfolio maintains healthy diversification while limiting single-asset concentration risk.`,
      saranStrategi: `Accumulate gradually (Dollar-Cost Averaging) on technical pullbacks toward the ${asset.currency === 'USD' ? '$' : 'Rp '}${defaultEntry.toLocaleString(numLocale)} support zone, and trim partial profits near ${asset.currency === 'USD' ? '$' : 'Rp '}${defaultExit.toLocaleString(numLocale)}.`,
      targetEntryPrice: defaultEntry,
      targetExitPrice: defaultExit,
    };
  }

  return {
    source: 'algorithm',
    rekomendasi: isHighBeta ? 'TAHAN (HOLD)' : isDividend ? 'BELI / AKUMULASI' : 'BELI BERTAHAP',
    sentimen: isHighBeta ? 'Hati-hati / Bullish Jangka Panjang' : 'Bullish',
    ringkasanEksekutif: `${safeName} (${asset.ticker}) memiliki posisi kompetitif yang kuat di sektor ${safeSector}. Dengan beta ${safeBeta} dan imbal hasil historis 1 tahun ${safeReturn1Y}%, instrumen ini menawarkan profil risk-reward yang menarik, didukung oleh kekuatan neraca keuangan dan likuiditas pasar yang prima.`,
    estimasiHargaWajar: {
      rentangNilai: `${fairLow} - ${fairHigh}`,
      statusValuasi: isHighBeta ? 'Valuasi Cukup Tinggi (Premium Multiples)' : 'Valuasi Wajar (Fair Value)',
    },
    katalisPositif: [
      `Pertumbuhan struktural jangka panjang di sektor ${safeSector} dengan adopsi pasar yang solid.`,
      safeDividend > 0
        ? `Imbal hasil dividen ${safeDividend}% memberikan proteksi arus kas reguler bagi pemegang saham.`
        : 'Reinvestasi laba bersih yang agresif untuk memperluas parit ekonomi (economic moat).',
      'Likuiditas transaksi institusional yang tinggi memudahkan fleksibilitas eksekusi portofolio.',
    ],
    risikoDanTantangan: [
      'Sensitivitas terhadap arah kebijakan suku bunga global dan fluktuasi valuta asing.',
      isHighBeta
        ? 'Volatilitas harga harian cukup lebar saat sentimen pasar Wall Street mengalami rotasi sektoral.'
        : 'Pertumbuhan laba yang moderat seiring besarnya skala kapitalisasi pasar saat ini.',
      'Risiko regulasi industri dan dinamika persaingan kompetitor global.',
    ],
    kesesuaianProfil: `Untuk profil ${riskProfile?.name || 'Moderat'}, alokasi pada ${asset.ticker} disarankan berada pada kisaran 5% - 15% dari total portofolio guna menjaga diversifikasi dan mencegah risiko konsentrasi tunggal.`,
    saranStrategi: `Lakukan akumulasi bertahap (Dollar-Cost Averaging) saat terjadi koreksi teknikal ke area support ${asset.currency === 'USD' ? '$' : 'Rp '}${defaultEntry.toLocaleString(numLocale)}, dan pasang target take profit bertahap di area ${asset.currency === 'USD' ? '$' : 'Rp '}${defaultExit.toLocaleString(numLocale)}.`,
    targetEntryPrice: defaultEntry,
    targetExitPrice: defaultExit,
  };
}

// Endpoint: Deep Real-time AI Analysis for an Individual Stock or ETF
app.post('/api/analyze-asset', async (req: Request, res: Response) => {
  const lang: 'id' | 'en' = req.body?.lang === 'en' ? 'en' : 'id';
  const isEn = lang === 'en';
  const { asset, holding, riskProfile } = req.body;
  if (!asset || !asset.ticker) {
    return res.status(400).json({ error: isEn ? 'Invalid asset payload.' : 'Data aset tidak valid.' });
  }

  let effectiveAsset = asset;
  try {
    const numLocale = isEn ? 'en-US' : 'id-ID';
    const [liveFx, verifiedQuote] = await Promise.all([
      fetchLiveUsdIdrRate(),
      fetchLiveQuote(
        asset.type === 'IDX_STOCK' && !String(asset.ticker).toUpperCase().endsWith('.JK')
          ? `${String(asset.ticker).toUpperCase()}.JK`
          : String(asset.ticker).toUpperCase()
      ),
    ]);
    effectiveAsset = {
      ...asset,
      price:
        verifiedQuote?.isLiveFound && Number.isFinite(verifiedQuote.price) && verifiedQuote.price > 0
          ? verifiedQuote.price
          : asset.price,
      change1D:
        verifiedQuote?.isLiveFound && Number.isFinite(verifiedQuote.changePercent)
          ? verifiedQuote.changePercent
          : asset.change1D,
    };
    const todayIso = new Date().toISOString().slice(0, 10);
    const clientRate = Number(req.body?.usdIdrRate);
    const activeUsdIdr = liveFx.isLive
      ? liveFx.price
      : Number.isFinite(clientRate) && clientRate > 1000
      ? clientRate
      : liveFx.price;

    const prompt = isEn
      ? `You are a CFA-certified Senior Equity Research & Portfolio Strategist.
Perform an in-depth, real-time analysis for the following investment instrument:

REFERENCE DATE: ${todayIso}
LIVE USD/IDR RATE: Rp ${Math.round(activeUsdIdr).toLocaleString('en-US')} (Fed Rate: 3.75%-4.00%, BI-Rate: 5.75%)
TICKER / ETF: ${effectiveAsset.ticker} - ${effectiveAsset.name || effectiveAsset.ticker}
CATEGORY: ${effectiveAsset.type === 'US_STOCK' ? 'US Stock (Wall Street)' : effectiveAsset.type === 'IDX_STOCK' ? 'Indonesian Stock (IDX)' : 'Global ETF'}
SECTOR: ${effectiveAsset.sector || 'Global Capital Markets'}
CURRENT LIVE PRICE: ${effectiveAsset.currency === 'USD' ? '$' : 'Rp '}${(effectiveAsset.price ?? 0).toLocaleString(numLocale)}
1D CHANGE: ${effectiveAsset.change1D ?? 0}%
1Y RETURN: ${effectiveAsset.return1Y ?? 10}%
BETA (VOLATILITY): ${effectiveAsset.beta ?? 1.0}
DIVIDEND YIELD: ${effectiveAsset.dividendYield ?? 0}%
VALUATION: ${effectiveAsset.peRatio !== undefined ? `P/E Ratio: ${effectiveAsset.peRatio}x` : `ETF Expense Ratio: ${effectiveAsset.expenseRatio ?? 0.15}%`}
MARKET CAP / AUM: ${effectiveAsset.marketCap || 'N/A'}
DESCRIPTION: ${effectiveAsset.description || 'Capital market investment instrument.'}

INVESTOR RISK PROFILE: ${riskProfile?.name || 'Moderate'} (${riskProfile?.description || 'Balanced growth and risk'})
HOLDING STATUS: ${
          holding
            ? `Investor holds ${holding.shares} shares at average cost ${holding.buyCurrency} ${holding.avgBuyPrice}`
            : 'Investor does not currently hold this asset.'
        }

Respond strictly in JSON matching the schema, with ALL text written in concise, professional English and anchored to the CURRENT LIVE PRICE (${effectiveAsset.price}) and live USD/IDR rate above:
1. rekomendasi (One of: "BUY / ACCUMULATE", "HOLD", "TRIM / TAKE PROFIT", "WAIT FOR DIP")
2. sentimen ("Very Bullish", "Bullish", "Neutral", "Cautious / Defensive")
3. ringkasanEksekutif (Concise, data-driven fundamental thesis in English)
4. estimasiHargaWajar (Object with rentangNilai and statusValuasi in English)
5. katalisPositif (Array of 3 growth, macro, product, or dividend catalysts)
6. risikoDanTantangan (Array of 3 downside or competitive/cyclical risks)
7. kesesuaianProfil (How well this asset fits the investor's risk profile)
8. saranStrategi (Actionable strategy: entry target, profit-taking zone, or DCA plan)
9. targetEntryPrice (Numeric suggested buy target price in asset currency, relative to ${effectiveAsset.price})
10. targetExitPrice (Numeric suggested take-profit target price in asset currency, relative to ${effectiveAsset.price})`
      : `Anda adalah Senior Equity Research & Portfolio Strategist berstandar CFA.
Lakukan analisis mendalam secara real-time untuk instrumen investasi berikut:

TANGGAL REFERENSI: ${todayIso}
KURS USD/IDR TERKINI: Rp ${Math.round(activeUsdIdr).toLocaleString('id-ID')} (Fed Rate: 3.75%-4.00%, BI-Rate: 5.75%)
EMITEN / ETF: ${effectiveAsset.ticker} - ${effectiveAsset.name || effectiveAsset.ticker}
KATEGORI: ${effectiveAsset.type === 'US_STOCK' ? 'Saham Wall Street' : effectiveAsset.type === 'IDX_STOCK' ? 'Saham Bursa Efek Indonesia (IDX)' : 'ETF Global'}
SEKTOR: ${effectiveAsset.sector || 'Pasar Modal Global'}
HARGA PASAR TERKINI: ${effectiveAsset.currency === 'USD' ? '$' : 'Rp '} ${(effectiveAsset.price ?? 0).toLocaleString(numLocale)}
PERUBAHAN HARI INI: ${effectiveAsset.change1D ?? 0}%
RETURN 1 TAHUN TERAKHIR: ${effectiveAsset.return1Y ?? 10}%
BETA (VOLATILITAS): ${effectiveAsset.beta ?? 1.0}
DIVIDEND YIELD: ${effectiveAsset.dividendYield ?? 0}%
VALUASI: ${effectiveAsset.peRatio !== undefined ? `P/E Ratio: ${effectiveAsset.peRatio}x` : `Expense Ratio ETF: ${effectiveAsset.expenseRatio ?? 0.15}%`}
MARKET CAP / AUM: ${effectiveAsset.marketCap || 'N/A'}
DESKRIPSI: ${effectiveAsset.description || 'Instrumen investasi pasar modal.'}

PROFIL RISIKO INVESTOR: ${riskProfile?.name || 'Moderat'} (${riskProfile?.description || 'Keseimbangan pertumbuhan dan risiko'})
STATUS KEPEMILIKAN INVESTOR: ${
          holding
            ? `Investor memiliki ${holding.shares} lembar dengan harga beli rata-rata ${holding.buyCurrency} ${holding.avgBuyPrice}`
            : 'Investor belum memiliki aset ini di portofolio.'
        }

Berikan output evaluasi terperinci dalam format JSON dengan struktur yang ditentukan (SELURUH teks dalam Bahasa Indonesia dan WAJIB mengacu pada HARGA PASAR TERKINI ${effectiveAsset.price} serta kurs USD/IDR di atas):
1. rekomendasi (Salah satu: "BELI / AKUMULASI", "TAHAN (HOLD)", "PANGKAS / AMANKAN PROFIT", "TUNGGU KOREKSI")
2. sentimen ("Sangat Bullish", "Bullish", "Netral", "Hati-hati / Defensif")
3. ringkasanEksekutif (Analisis fundamental mendalam dan ringkas dalam Bahasa Indonesia yang tajam dan profesional)
4. estimasiHargaWajar (Objek berisi rentangNilai dan statusValuasi)
5. katalisPositif (Array 3 poin katalis pertumbuhan, produk, makro, dividen)
6. risikoDanTantangan (Array 3 poin risiko penurunan atau ancaman persaingan/siklus)
7. kesesuaianProfil (Penjelasan kesesuaian aset ini untuk profil risiko investor)
8. saranStrategi (Langkah konkret: target entry price, target exit/take profit, atau dollar-cost averaging)
9. targetEntryPrice (Nominal angka rekomendasi beli terbaik relatif terhadap harga ${effectiveAsset.price})
10. targetExitPrice (Nominal angka rekomendasi jual / take profit relatif terhadap harga ${effectiveAsset.price})`;

    if (!ai) {
      return res.json(generateAssetFallbackAnalysis(effectiveAsset, holding, riskProfile, lang));
    }

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: prompt,
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        systemInstruction: isEn
          ? 'You are a professional equity research analyst and quantitative portfolio advisor for PortoLens AI. Deliver sharp, data-backed stock/ETF research strictly in valid JSON in English.'
          : 'Anda adalah asisten riset pasar saham dan penasihat portofolio kuantitatif profesional untuk PortoLens AI. Berikan analisis saham/ETF yang mendalam, tajam, berbasis data terkini, dan dalam format JSON terstruktur.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            rekomendasi: { type: Type.STRING },
            sentimen: { type: Type.STRING },
            ringkasanEksekutif: { type: Type.STRING },
            estimasiHargaWajar: {
              type: Type.OBJECT,
              properties: {
                rentangNilai: { type: Type.STRING },
                statusValuasi: { type: Type.STRING },
              },
              required: ['rentangNilai', 'statusValuasi'],
            },
            katalisPositif: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            risikoDanTantangan: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            kesesuaianProfil: { type: Type.STRING },
            saranStrategi: { type: Type.STRING },
            targetEntryPrice: { type: Type.NUMBER },
            targetExitPrice: { type: Type.NUMBER },
          },
          required: [
            'rekomendasi',
            'sentimen',
            'ringkasanEksekutif',
            'estimasiHargaWajar',
            'katalisPositif',
            'risikoDanTantangan',
            'kesesuaianProfil',
            'saranStrategi',
            'targetEntryPrice',
            'targetExitPrice',
          ],
        },
      },
    });

    const parsed = parseGeminiJson(response.text);
    return res.json({
      source: 'gemini',
      ...parsed,
    });
  } catch (error: any) {
    console.error('Error analyzing asset with Gemini, falling back to algorithmic analysis:', error);
    return res.status(200).json(generateAssetFallbackAnalysis(effectiveAsset, holding, riskProfile, lang));
  }
});

// Endpoint: Market Trends and Macro Insights (synchronized with live USD/IDR rate & Nov 2026 macro baseline)
app.get('/api/market-trends', async (req: Request, res: Response) => {
  const isEn = req.query.lang === 'en';
  const fx = await fetchLiveUsdIdrRate();
  const formattedUsdIdr = isEn
    ? `Rp ${Math.round(fx.price).toLocaleString('en-US')}`
    : `Rp ${Math.round(fx.price).toLocaleString('id-ID')}`;

  res.setHeader('Cache-Control', 'no-store');
  res.json({
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
            impact: `Live ${fx.source} spot rate; USD assets continue to provide strong Rupiah purchasing-power protection.`,
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
            impact: `Kurs spot terkini (${fx.source}); aset berdenominasi USD memberi lindung nilai daya beli terhadap pelemahan Rupiah.`,
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
  });
});

// Bounded cache helper to keep server memory strictly capped over long uptimes
function setBoundedCache<K, V>(map: Map<K, V>, key: K, value: V, maxSize: number) {
  if (map.has(key)) {
    map.delete(key);
  } else if (map.size >= maxSize) {
    const oldestKey = map.keys().next().value;
    if (oldestKey !== undefined) map.delete(oldestKey);
  }
  map.set(key, value);
}

// In-memory cache & in-flight deduplication for benchmark historical comparison curves
interface BenchmarkCacheEntry {
  fetchedAt: number;
  payload: any;
}
const benchmarkHistoryCache = new Map<string, BenchmarkCacheEntry>();
const inFlightHistoryRequests = new Map<string, Promise<Array<{ dateKey: string; timestamp: number; close: number }> | null>>();
const BENCHMARK_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

type BenchmarkRangeKey = '1M' | '3M' | '6M' | '1Y' | '5Y' | '10Y';

async function fetchYahooHistorySeries(
  symbol: string,
  yahooRange: string,
  yahooInterval: string
): Promise<Array<{ dateKey: string; timestamp: number; close: number }> | null> {
  const inflightKey = `${symbol}:${yahooRange}:${yahooInterval}`;
  const existing = inFlightHistoryRequests.get(inflightKey);
  if (existing) return existing;

  const task = (async () => {
    try {
      const hosts = ['query1.finance.yahoo.com', 'query2.finance.yahoo.com'];
      let response: globalThis.Response | null = null;
      for (const host of hosts) {
        try {
          const url = `https://${host}/v8/finance/chart/${encodeURIComponent(symbol)}?range=${yahooRange}&interval=${yahooInterval}`;
          const resAttempt = await fetch(url, {
            headers: {
              'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            },
            signal: AbortSignal.timeout(4500),
          });
          if (resAttempt.ok) {
            response = resAttempt;
            break;
          }
        } catch {
          // try backup Yahoo host
        }
      }
      if (!response || !response.ok) return null;
      const json: any = await response.json();
      const result = json?.chart?.result?.[0];
      const timestamps: number[] = result?.timestamp || [];
      const closes: Array<number | null> = result?.indicators?.quote?.[0]?.close || [];
      if (!timestamps.length || !closes.length) return null;

      const points: Array<{ dateKey: string; timestamp: number; close: number }> = [];
      for (let i = 0; i < timestamps.length; i++) {
        const c = closes[i];
        if (typeof c === 'number' && Number.isFinite(c) && c > 0) {
          const d = new Date(timestamps[i] * 1000);
          const dateKey = d.toISOString().slice(0, 10);
          points.push({ dateKey, timestamp: timestamps[i] * 1000, close: c });
        }
      }
      return points.length >= 2 ? points : null;
    } catch {
      return null;
    } finally {
      inFlightHistoryRequests.delete(inflightKey);
    }
  })();

  inFlightHistoryRequests.set(inflightKey, task);
  return task;
}

function buildFallbackBenchmarkSeries(rangeKey: BenchmarkRangeKey) {
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
  const count = countMap[rangeKey];
  const stepDays = stepDaysMap[rangeKey];
  const now = Date.now();
  const points = [];
  const showYear = rangeKey === '1Y' || rangeKey === '5Y' || rangeKey === '10Y';

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
    const waveScale = rangeKey === '10Y' ? 4.5 : rangeKey === '5Y' ? 2.5 : 1;
    const spWave = (Math.sin(i * 0.65) * 1.1 + Math.cos(i * 0.25) * 0.7) * waveScale;
    const ihsgWave = (Math.cos(i * 0.55) * 1.2 + Math.sin(i * 0.3) * 0.8) * waveScale;
    const ndxWave = (Math.sin(i * 0.7) * 1.6 + Math.cos(i * 0.28) * 1.0) * waveScale;

    const sp500Pct = i === 0 ? 0 : Number((progress * spTotalMap[rangeKey] + spWave * (1 - progress * 0.3)).toFixed(2));
    const ihsgPct = i === 0 ? 0 : Number((progress * ihsgTotalMap[rangeKey] + ihsgWave * (1 - progress * 0.3)).toFixed(2));
    const nasdaqPct = i === 0 ? 0 : Number((progress * ndxTotalMap[rangeKey] + ndxWave * (1 - progress * 0.3)).toFixed(2));

    points.push({
      date: d.toISOString().slice(0, 10),
      timestamp: ts,
      label: showYear
        ? d.toLocaleDateString('id-ID', { month: 'short', year: '2-digit', timeZone: 'UTC' })
        : d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', timeZone: 'UTC' }),
      sp500Pct,
      ihsgPct,
      nasdaqPct,
    });
  }
  return {
    range: rangeKey,
    source: 'fallback',
    points,
  };
}

// Endpoint: Benchmark Historical Comparison (S&P 500, IHSG, Nasdaq)
app.get('/api/benchmark-history', async (req: Request, res: Response) => {
  const rawRange = String(req.query.range || '1Y').toUpperCase();
  const rangeKey: BenchmarkRangeKey =
    rawRange === '1M' ||
    rawRange === '3M' ||
    rawRange === '6M' ||
    rawRange === '1Y' ||
    rawRange === '5Y' ||
    rawRange === '10Y'
      ? rawRange
      : '1Y';

  const cached = benchmarkHistoryCache.get(rangeKey);
  if (cached && Date.now() - cached.fetchedAt < BENCHMARK_CACHE_TTL_MS) {
    res.setHeader('Cache-Control', 'private, max-age=60');
    return res.json(cached.payload);
  }

  const yahooConfig: Record<BenchmarkRangeKey, { yRange: string; yInterval: string }> = {
    '1M': { yRange: '1mo', yInterval: '1d' },
    '3M': { yRange: '3mo', yInterval: '1d' },
    '6M': { yRange: '6mo', yInterval: '1wk' },
    '1Y': { yRange: '1y', yInterval: '1wk' },
    '5Y': { yRange: '5y', yInterval: '1mo' },
    '10Y': { yRange: '10y', yInterval: '1mo' },
  };
  const cfg = yahooConfig[rangeKey];
  const showYearLabel = rangeKey === '1Y' || rangeKey === '5Y' || rangeKey === '10Y';

  try {
    const [spSeries, ihsgSeries, ndxSeries] = await Promise.all([
      fetchYahooHistorySeries('^GSPC', cfg.yRange, cfg.yInterval),
      fetchYahooHistorySeries('^JKSE', cfg.yRange, cfg.yInterval),
      fetchYahooHistorySeries('^IXIC', cfg.yRange, cfg.yInterval),
    ]);

    if (!spSeries && !ihsgSeries) {
      const fb = buildFallbackBenchmarkSeries(rangeKey);
      return res.json(fb);
    }

    const baseTimeline = spSeries || ihsgSeries!;
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

    const points = baseTimeline.map((pt, idx) => {
      const [y, m, day] = pt.dateKey.split('-').map(Number);
      const d =
        y && m && day ? new Date(Date.UTC(y, m - 1, day)) : new Date(pt.timestamp);
      const label = showYearLabel
        ? d.toLocaleDateString('id-ID', { month: 'short', year: '2-digit', timeZone: 'UTC' })
        : d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', timeZone: 'UTC' });

      const ihsgPct =
        idx === 0
          ? 0
          : ihsgSeries
          ? spSeries
            ? lookupNearestPct(ihsgSeries, pt.timestamp, 0)
            : Number((((pt.close - ihsgSeries[0].close) / ihsgSeries[0].close) * 100).toFixed(2))
          : 0;

      const ndxRaw =
        idx === 0 ? 0 : ndxSeries ? lookupNearestPct(ndxSeries, pt.timestamp, 0) : null;

      const sp500Pct =
        idx === 0
          ? 0
          : spSeries
          ? Number((((pt.close - spSeries[0].close) / spSeries[0].close) * 100).toFixed(2))
          : ndxRaw !== null
          ? Number((ndxRaw * 0.78).toFixed(2))
          : Number((ihsgPct * 1.15).toFixed(2));

      const finalIhsgPct =
        idx === 0 ? 0 : ihsgSeries ? ihsgPct : Number((sp500Pct * 0.55).toFixed(2));

      const nasdaqPct =
        idx === 0
          ? 0
          : ndxRaw !== null
          ? ndxRaw
          : Number((sp500Pct * 1.25).toFixed(2));

      return {
        date: pt.dateKey,
        timestamp: pt.timestamp,
        label,
        sp500Pct,
        ihsgPct: finalIhsgPct,
        nasdaqPct,
      };
    });

    const payload = {
      range: rangeKey,
      source: 'live',
      updatedAt: new Date().toISOString(),
      points,
    };

    setBoundedCache(benchmarkHistoryCache, rangeKey, { fetchedAt: Date.now(), payload }, 20);
    res.setHeader('Cache-Control', 'private, max-age=60');
    return res.json(payload);
  } catch (error) {
    console.error('Error fetching benchmark history:', error);
    return res.json(buildFallbackBenchmarkSeries(rangeKey));
  }
});

// In-memory cache for per-ticker dividend events
interface DividendEventRecord {
  date: string;
  timestamp: number;
  amount: number;
}
interface CachedDividendInfo {
  ticker: string;
  currency: 'IDR' | 'USD';
  cadence: 'MONTHLY' | 'QUARTERLY' | 'SEMI_ANNUAL' | 'ANNUAL' | 'NONE';
  events: DividendEventRecord[];
  annualDividendPerShare: number;
  lastExDate: string | null;
  lastAmount: number;
  source: 'live' | 'fallback';
  fetchedAt: number;
}
const dividendCache = new Map<string, CachedDividendInfo>();
const inFlightDividendRequests = new Map<string, Promise<CachedDividendInfo>>();
const DIVIDEND_CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

async function fetchYahooDividends(rawTicker: string): Promise<CachedDividendInfo> {
  const ticker = rawTicker.toUpperCase().trim();
  const cleanTicker = ticker.replace(/\.JK$/, '');
  const yahooSymbol =
    ticker.endsWith('.JK') || KNOWN_IDX_TICKERS.has(cleanTicker)
      ? `${cleanTicker}.JK`
      : cleanTicker.includes('.')
      ? cleanTicker.replace(/\./g, '-')
      : cleanTicker;

  const cached = dividendCache.get(yahooSymbol);
  if (cached && Date.now() - cached.fetchedAt < DIVIDEND_CACHE_TTL_MS) {
    return cached;
  }

  const inflight = inFlightDividendRequests.get(yahooSymbol);
  if (inflight) return inflight;

  const task = (async (): Promise<CachedDividendInfo> => {
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?range=2y&interval=1mo&events=div`;
      const response = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
        signal: AbortSignal.timeout(4500),
      });

      if (response.ok) {
        const json: any = await response.json();
        const result = json?.chart?.result?.[0];
        const meta = result?.meta;
        const rawDivs = result?.events?.dividends || {};
        const events: DividendEventRecord[] = Object.values(rawDivs)
          .map((ev: any) => ({
            date: new Date((ev.date || 0) * 1000).toISOString().slice(0, 10),
            timestamp: (ev.date || 0) * 1000,
            amount: Number(ev.amount || 0),
          }))
          .filter((ev) => ev.timestamp > 0 && ev.amount > 0)
          .sort((a, b) => a.timestamp - b.timestamp);

        const oneYearAgo = Date.now() - 364 * 86400000;
        const trailingEvents = events.filter((e) => e.timestamp >= oneYearAgo);
        const count1Y = trailingEvents.length;
        const annualDividendPerShare = Number(
          trailingEvents.reduce((s, e) => s + e.amount, 0).toFixed(4)
        );

        let cadence: CachedDividendInfo['cadence'] = 'NONE';
        if (count1Y >= 10) cadence = 'MONTHLY';
        else if (count1Y >= 3) cadence = 'QUARTERLY';
        else if (count1Y === 2) cadence = 'SEMI_ANNUAL';
        else if (count1Y === 1 || events.length > 0) cadence = 'ANNUAL';

        const lastEv = events[events.length - 1] || null;
        const info: CachedDividendInfo = {
          ticker: cleanTicker,
          currency:
            meta?.currency === 'IDR' || yahooSymbol.endsWith('.JK') ? 'IDR' : 'USD',
          cadence,
          events,
          annualDividendPerShare,
          lastExDate: lastEv ? lastEv.date : null,
          lastAmount: lastEv ? lastEv.amount : 0,
          source: 'live',
          fetchedAt: Date.now(),
        };
        setBoundedCache(dividendCache, yahooSymbol, info, 500);
        return info;
      }
    } catch {
      // fallback handled below
    } finally {
      inFlightDividendRequests.delete(yahooSymbol);
    }

    return {
      ticker: cleanTicker,
      currency: yahooSymbol.endsWith('.JK') ? 'IDR' : 'USD',
      cadence: 'NONE',
      events: [],
      annualDividendPerShare: 0,
      lastExDate: null,
      lastAmount: 0,
      source: 'fallback',
      fetchedAt: Date.now(),
    };
  })();

  inFlightDividendRequests.set(yahooSymbol, task);
  return task;
}

// Endpoint: Dividend Calendar (real Yahoo Finance ex-dividend history per holding)
app.get('/api/dividend-calendar', async (req: Request, res: Response) => {
  try {
    const symbolsParam = String(req.query.symbols || '').trim();
    if (!symbolsParam) {
      return res.json({ dividends: {}, updatedAt: new Date().toISOString() });
    }
    const requested = Array.from(
      new Set(
        symbolsParam
          .split(',')
          .map((s) => s.trim().toUpperCase())
          .filter(Boolean)
      )
    ).slice(0, 40);

    const results = await Promise.all(requested.map((sym) => fetchYahooDividends(sym)));
    const dividendsMap: Record<string, CachedDividendInfo> = {};
    results.forEach((info) => {
      dividendsMap[info.ticker] = info;
    });

    res.setHeader('Cache-Control', 'private, max-age=120');
    return res.json({
      dividends: dividendsMap,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching dividend calendar:', error);
    const isEn = req.query.lang === 'en';
    return res.status(500).json({
      error: isEn ? 'Failed to load dividend calendar.' : 'Gagal memuat jadwal dividen.',
    });
  }
});

// In-memory quote cache for high-frequency live real-time updates
interface CachedQuote {
  price: number;
  change: number;
  changePercent: number;
  currency: string;
  shortName?: string;
  instrumentType?: string;
  exchangeName?: string;
  isLiveFound?: boolean;
  regularMarketTime: number;
  fetchedAt: number;
}
const quoteCache = new Map<string, CachedQuote>();
const inFlightQuoteRequests = new Map<string, Promise<CachedQuote>>();
const CACHE_TTL_MS = 4000; // 4 seconds TTL with in-flight coalescing for fast live ticks
const NEGATIVE_CACHE_TTL_MS = 30_000; // Cache failed/unlisted quote lookups for 30s to avoid timeout storms

// Baseline fallback prices & IDX ticker registry auto-derived from the full 5,000-ticker catalog
const BASELINE_USD_IDR_RATE = 18220;
const BASELINE_PRICES: Record<string, { price: number; currency: string }> = {
  '^GSPC': { price: 7416.59, currency: 'USD' },
  '^IXIC': { price: 24509.76, currency: 'USD' },
  '^JKSE': { price: 5320.98, currency: 'IDR' },
  'USDIDR=X': { price: BASELINE_USD_IDR_RATE, currency: 'IDR' },
};

const KNOWN_IDX_TICKERS = new Set<string>();

for (const asset of CATALOG_ASSETS) {
  const upper = asset.ticker.toUpperCase();
  BASELINE_PRICES[upper] = { price: asset.price, currency: asset.currency };
  if (asset.type === 'IDX_STOCK') {
    KNOWN_IDX_TICKERS.add(upper);
  }
}

const DEFAULT_LIVE_QUOTES_SYMBOLS = [
  'NVDA', 'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'META', 'PLTR',
  'BBCA', 'BBRI', 'BMRI', 'BBNI', 'TLKM', 'BREN', 'ASII', 'ANTM', 'AMMN', 'GOTO',
  'VOO', 'QQQ', 'SCHD', 'GLD', 'SMH', 'VIG', 'SPY', 'JNJ', 'ARKK',
];

interface LiveUsdIdrResult {
  price: number;
  changePercent: number;
  isLive: boolean;
  source: string;
  updatedAt: string;
  fetchedAt: number;
}

let cachedUsdIdrFX: LiveUsdIdrResult | null = null;
let inFlightUsdIdrFX: Promise<LiveUsdIdrResult> | null = null;
const FX_CACHE_TTL_MS = 10_000;

async function fetchLiveUsdIdrRate(): Promise<LiveUsdIdrResult> {
  if (cachedUsdIdrFX && Date.now() - cachedUsdIdrFX.fetchedAt < FX_CACHE_TTL_MS) {
    return cachedUsdIdrFX;
  }
  if (inFlightUsdIdrFX) {
    return inFlightUsdIdrFX;
  }

  const task = (async (): Promise<LiveUsdIdrResult> => {
    const yahooHosts = ['query1.finance.yahoo.com', 'query2.finance.yahoo.com'];
    for (const host of yahooHosts) {
      try {
        const res = await fetch(
          `https://${host}/v8/finance/chart/USDIDR=X?interval=1m&range=1d`,
          {
            headers: {
              'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            },
            signal: AbortSignal.timeout(3500),
          }
        );
        if (res.ok) {
          const json: any = await res.json();
          const meta = json?.chart?.result?.[0]?.meta;
          const closes: Array<number | null> = json?.chart?.result?.[0]?.indicators?.quote?.[0]?.close || [];
          let latestCandlePrice: number | null = null;
          for (let i = closes.length - 1; i >= 0; i--) {
            const c = closes[i];
            if (typeof c === 'number' && Number.isFinite(c) && c > 1000) {
              latestCandlePrice = c;
              break;
            }
          }
          const rawPrice =
            typeof meta?.regularMarketPrice === 'number' &&
            Number.isFinite(meta.regularMarketPrice) &&
            meta.regularMarketPrice > 1000
              ? meta.regularMarketPrice
              : latestCandlePrice;
          if (rawPrice && rawPrice > 1000) {
            const prevClose = meta?.chartPreviousClose || meta?.previousClose || rawPrice;
            const changePct =
              typeof meta?.regularMarketChangePercent === 'number' &&
              Number.isFinite(meta.regularMarketChangePercent)
                ? meta.regularMarketChangePercent
                : prevClose > 0
                ? ((rawPrice - prevClose) / prevClose) * 100
                : 0;
            const fxResult: LiveUsdIdrResult = {
              price: Number(rawPrice.toFixed(2)),
              changePercent: Number(changePct.toFixed(2)),
              isLive: true,
              source: 'Yahoo Finance',
              updatedAt: meta?.regularMarketTime
                ? new Date(meta.regularMarketTime * 1000).toISOString()
                : new Date().toISOString(),
              fetchedAt: Date.now(),
            };
            cachedUsdIdrFX = fxResult;
            return fxResult;
          }
        }
      } catch {
        // try next host/provider
      }
    }

    // Secondary live FX fallback 1: open.er-api.com
    try {
      const erRes = await fetch('https://open.er-api.com/v6/latest/USD', {
        signal: AbortSignal.timeout(3500),
      });
      if (erRes.ok) {
        const erJson: any = await erRes.json();
        const rate = erJson?.rates?.IDR;
        if (typeof rate === 'number' && Number.isFinite(rate) && rate > 1000) {
          const fxResult: LiveUsdIdrResult = {
            price: Number(rate.toFixed(2)),
            changePercent: 0,
            isLive: true,
            source: 'ExchangeRate-API',
            updatedAt: erJson?.time_last_update_utc
              ? new Date(erJson.time_last_update_utc).toISOString()
              : new Date().toISOString(),
            fetchedAt: Date.now(),
          };
          cachedUsdIdrFX = fxResult;
          return fxResult;
        }
      }
    } catch {
      // try next provider
    }

    // Secondary live FX fallback 2: Frankfurter (ECB)
    try {
      const ffRes = await fetch('https://api.frankfurter.app/latest?from=USD&to=IDR', {
        signal: AbortSignal.timeout(3500),
      });
      if (ffRes.ok) {
        const ffJson: any = await ffRes.json();
        const rate = ffJson?.rates?.IDR;
        if (typeof rate === 'number' && Number.isFinite(rate) && rate > 1000) {
          const fxResult: LiveUsdIdrResult = {
            price: Number(rate.toFixed(2)),
            changePercent: 0,
            isLive: true,
            source: 'ECB Frankfurter',
            updatedAt: new Date().toISOString(),
            fetchedAt: Date.now(),
          };
          cachedUsdIdrFX = fxResult;
          return fxResult;
        }
      }
    } catch {
      // fallback below
    }

    if (cachedUsdIdrFX) {
      return cachedUsdIdrFX;
    }

    return {
      price: BASELINE_USD_IDR_RATE,
      changePercent: 0,
      isLive: false,
      source: 'baseline',
      updatedAt: new Date().toISOString(),
      fetchedAt: Date.now(),
    };
  })().finally(() => {
    inFlightUsdIdrFX = null;
  });

  inFlightUsdIdrFX = task;
  return task;
}

async function fetchLiveQuote(rawTicker: string, exactSymbol: boolean = false): Promise<CachedQuote> {
  const ticker = rawTicker.toUpperCase();
  const baseSymbol =
    exactSymbol || ticker.endsWith('.JK') || ticker.includes('=')
      ? ticker
      : KNOWN_IDX_TICKERS.has(ticker)
      ? `${ticker}.JK`
      : ticker;
  const yahooSymbol =
    !baseSymbol.endsWith('.JK') && !baseSymbol.includes('=') && baseSymbol.includes('.')
      ? baseSymbol.replace(/\./g, '-')
      : baseSymbol;

  const cached = quoteCache.get(yahooSymbol);
  const effectiveTtl = cached?.isLiveFound === false ? NEGATIVE_CACHE_TTL_MS : CACHE_TTL_MS;
  if (cached && Date.now() - cached.fetchedAt < effectiveTtl) {
    return cached;
  }

  const inflight = inFlightQuoteRequests.get(yahooSymbol);
  if (inflight) {
    return inflight;
  }

  const task = (async (): Promise<CachedQuote> => {
    try {
      const hosts = ['query1.finance.yahoo.com', 'query2.finance.yahoo.com'];
      let response: globalThis.Response | null = null;
      for (const host of hosts) {
        try {
          const url = `https://${host}/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?interval=1d&range=1d`;
          const attempt = await fetch(url, {
            headers: {
              'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            },
            signal: AbortSignal.timeout(3500),
          });
          if (attempt.ok) {
            response = attempt;
            break;
          }
        } catch {
          // try backup host
        }
      }

      if (response && response.ok) {
        const data: any = await response.json();
        const meta = data?.chart?.result?.[0]?.meta;
        if (
          meta &&
          typeof meta.regularMarketPrice === 'number' &&
          Number.isFinite(meta.regularMarketPrice) &&
          meta.regularMarketPrice > 0
        ) {
          const price = meta.regularMarketPrice;
          const prevClose = meta.chartPreviousClose || meta.previousClose || price;
          const change = price - prevClose;
          const changePercent = prevClose > 0 ? (change / prevClose) * 100 : 0;

          const rawName = meta.shortName || meta.longName || undefined;
          const decodedName =
            typeof rawName === 'string'
              ? rawName
                  .replace(/&amp;/g, '&')
                  .replace(/&#39;|&apos;/g, "'")
                  .replace(/&quot;/g, '"')
                  .replace(/&lt;/g, '<')
                  .replace(/&gt;/g, '>')
                  .trim()
              : undefined;

          const result: CachedQuote = {
            price: Number(price.toFixed(price > 100 ? 2 : 4)),
            change: Number(change.toFixed(2)),
            changePercent: Number(changePercent.toFixed(2)),
            currency: meta.currency || (yahooSymbol.endsWith('.JK') ? 'IDR' : 'USD'),
            shortName: decodedName || undefined,
            instrumentType: meta.instrumentType || undefined,
            exchangeName: meta.fullExchangeName || meta.exchangeName || undefined,
            isLiveFound: true,
            regularMarketTime: meta.regularMarketTime || Math.floor(Date.now() / 1000),
            fetchedAt: Date.now(),
          };

          setBoundedCache(quoteCache, yahooSymbol, result, 1500);
          return result;
        }
      }
    } catch {
      // Network or timeout
    } finally {
      inFlightQuoteRequests.delete(yahooSymbol);
    }

    // Graceful fallback if live API is temporarily unavailable
    const isIdxSuffix = yahooSymbol.endsWith('.JK');
    const cleanTicker = ticker.replace(/\.JK$/, '');
    const fallback = BASELINE_PRICES[cleanTicker] || {
      price: isIdxSuffix ? 1000 : 100,
      currency: isIdxSuffix ? 'IDR' : 'USD',
    };
    const fallbackResult: CachedQuote = cached
      ? { ...cached, fetchedAt: Date.now() }
      : {
          price: fallback.price,
          change: 0,
          changePercent: 0,
          currency: fallback.currency,
          isLiveFound: false,
          regularMarketTime: Math.floor(Date.now() / 1000),
          fetchedAt: Date.now(),
        };
    setBoundedCache(quoteCache, yahooSymbol, fallbackResult, 1500);
    return fallbackResult;
  })();

  inFlightQuoteRequests.set(yahooSymbol, task);
  return task;
}

// Endpoint: Real-time Live Quotes Feed
app.get('/api/live-quotes', async (req: Request, res: Response) => {
  try {
    const symbolsParam = req.query.symbols as string;
    const extraParam = req.query.extraSymbols as string;
    const baseSymbols = symbolsParam
      ? symbolsParam.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean)
      : DEFAULT_LIVE_QUOTES_SYMBOLS;
    const extraSymbols = extraParam
      ? extraParam.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean)
      : [];
    const requestedSymbols = Array.from(new Set([...baseSymbols, ...extraSymbols])).slice(0, 60);

    // Fetch quotes and resilient multi-source USD/IDR exchange rate in parallel
    const [usdIdrFx, ...quoteResults] = await Promise.all([
      fetchLiveUsdIdrRate(),
      ...requestedSymbols.map(async (sym) => {
        const q = await fetchLiveQuote(sym);
        return { ticker: sym, ...q };
      }),
    ]);

    const quotesMap: Record<string, any> = {};
    quoteResults.forEach((q) => {
      const payload = {
        price: q.price,
        change: q.change,
        changePercent: q.changePercent,
        currency: q.currency,
        shortName: q.shortName,
        instrumentType: q.instrumentType,
        exchangeName: q.exchangeName,
        isLiveFound: q.isLiveFound ?? false,
        regularMarketTime: q.regularMarketTime,
        isLive: q.isLiveFound ?? false,
      };
      quotesMap[q.ticker] = payload;
      if (q.ticker.endsWith('.JK')) {
        quotesMap[q.ticker.replace(/\.JK$/, '')] = payload;
      }
    });

    res.setHeader('Cache-Control', 'no-store');
    res.json({
      timestamp: Date.now(),
      lastUpdated: new Date().toISOString(),
      exchangeRateUSDIDR: usdIdrFx.price,
      exchangeRateChange: usdIdrFx.changePercent,
      exchangeRateIsLive: usdIdrFx.isLive,
      exchangeRateSource: usdIdrFx.source,
      exchangeRateUpdatedAt: usdIdrFx.updatedAt,
      quotes: quotesMap,
    });
  } catch (error: any) {
    console.error('Error fetching live quotes:', error);
    const isEn = req.query.lang === 'en';
    res.status(500).json({
      error: isEn ? 'Failed to fetch real-time quote data.' : 'Gagal mengambil data harga real-time.',
    });
  }
});

// Endpoint: Auto-detect Ticker Classification (IDX_STOCK vs US_STOCK vs ETF)
app.get('/api/detect-ticker', async (req: Request, res: Response) => {
  const isEn = req.query.lang === 'en';
  try {
    const rawInput = String(req.query.ticker || '').toUpperCase().trim();
    const hadJkSuffix = /\.JK$/i.test(rawInput);
    const cleanTicker = rawInput.replace(/\.JK$/i, '').replace(/[^A-Z0-9.-]/g, '');

    if (!cleanTicker) {
      return res.status(400).json({ error: isEn ? 'Invalid ticker symbol.' : 'Ticker tidak valid.' });
    }

    const [globalQ, idxQ] = await Promise.all([
      fetchLiveQuote(cleanTicker, true),
      fetchLiveQuote(`${cleanTicker}.JK`, true),
    ]);

    const classifyGlobalQuote = (q: CachedQuote): 'ETF' | 'US_STOCK' | 'IDX_STOCK' => {
      const inst = (q.instrumentType || '').toUpperCase();
      const name = (q.shortName || '').toUpperCase();
      const exch = (q.exchangeName || '').toUpperCase();

      if (q.currency === 'IDR' || exch.includes('JAKARTA') || exch === 'JKT') {
        return 'IDX_STOCK';
      }
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

    const candidates: Array<{
      type: 'IDX_STOCK' | 'US_STOCK' | 'ETF';
      label: string;
      name: string;
      price: number;
      changePercent: number;
      currency: 'IDR' | 'USD';
      exchangeName: string;
      instrumentType: string;
    }> = [];

    if (globalQ.isLiveFound) {
      const gType = classifyGlobalQuote(globalQ);
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

    // Choose primary candidate
    let primary = candidates[0] || null;
    if (candidates.length > 1) {
      if (hadJkSuffix) {
        primary = candidates.find((c) => c.type === 'IDX_STOCK') || candidates[0];
      } else {
        // Prefer ETF or Wall Street unless 4-letter ticker is explicitly in KNOWN_IDX_TICKERS
        primary = KNOWN_IDX_TICKERS.has(cleanTicker)
          ? candidates.find((c) => c.type === 'IDX_STOCK') || candidates[0]
          : candidates.find((c) => c.type !== 'IDX_STOCK') || candidates[0];
      }
    }

    return res.json({
      ticker: cleanTicker,
      found: candidates.length > 0,
      detectedType: primary ? primary.type : null,
      classificationLabel: primary ? primary.label : null,
      name: primary ? primary.name : null,
      price: primary ? primary.price : null,
      changePercent: primary ? primary.changePercent : 0,
      currency: primary ? primary.currency : null,
      exchangeName: primary ? primary.exchangeName : null,
      instrumentType: primary ? primary.instrumentType : null,
      candidates,
    });
  } catch (error: any) {
    console.error('Error detecting ticker:', error);
    return res.status(500).json({
      error: isEn ? 'Failed to detect ticker category.' : 'Gagal mendeteksi kategori ticker.',
    });
  }
});

// Guarantee all unmatched /api/* routes & API middleware errors return JSON rather than HTML SPA fallbacks
app.use('/api', (req: Request, res: Response) => {
  const isEn = req.query.lang === 'en' || req.body?.lang === 'en';
  res.status(404).json({
    error: isEn ? 'API endpoint not found.' : 'Endpoint API tidak ditemukan.',
  });
});

app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  if (req.path.startsWith('/api')) {
    const isEn = req.query.lang === 'en' || req.body?.lang === 'en';
    const status = typeof err?.status === 'number' && err.status >= 400 ? err.status : 500;
    return res.status(status).json({
      error: err?.message || (isEn ? 'Internal API server error.' : 'Terjadi kesalahan pada server API.'),
    });
  }
  return next(err);
});

// Setup Vite middleware in dev or static files in production
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`PortoLens AI server running at http://localhost:${PORT}`);
  });
}

startServer();

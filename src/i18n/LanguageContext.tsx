import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';

export type AppLanguage = 'id' | 'en';

const LANGUAGE_STORAGE_KEY = 'portolens_lang_v1';

interface LanguageContextValue {
  language: AppLanguage;
  locale: 'id-ID' | 'en-US';
  setLanguage: (lang: AppLanguage) => void;
  toggleLanguage: () => void;
  t: (idText: string, enText: string) => string;
  formatRiskRating: (rating: string) => string;
  formatMarketType: (type: 'US_STOCK' | 'IDX_STOCK' | 'ETF' | string) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

function getInitialLanguage(): AppLanguage {
  try {
    if (typeof window === 'undefined') return 'id';
    const saved = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (saved === 'en' || saved === 'id') return saved;
  } catch {
    // ignore storage errors
  }
  return 'id';
}

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<AppLanguage>(getInitialLanguage);

  const setLanguage = useCallback((lang: AppLanguage) => {
    setLanguageState(lang);
    try {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
    } catch {
      // ignore storage errors
    }
  }, []);

  const toggleLanguage = useCallback(() => {
    setLanguageState((prev) => {
      const next: AppLanguage = prev === 'id' ? 'en' : 'id';
      try {
        window.localStorage.setItem(LANGUAGE_STORAGE_KEY, next);
      } catch {
        // ignore storage errors
      }
      return next;
    });
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.lang = language;
    document.title =
      language === 'en'
        ? 'PortoLens AI - Stock & ETF Portfolio Analytics & Optimizer'
        : 'PortoLens AI - Analisis & Optimasi Portofolio Saham & ETF';
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
      metaDesc.setAttribute(
        'content',
        language === 'en'
          ? 'Smart portfolio scoring, risk management, and auto-rebalance optimizer for US stocks, Indonesian stocks (IDX), and global ETFs.'
          : 'Aplikasi penilaian cerdas dan optimasi portofolio saham AS, saham Indonesia, dan ETF sesuai profil risiko dan tren pasar terkini.'
      );
    }
  }, [language]);

  const locale: 'id-ID' | 'en-US' = language === 'en' ? 'en-US' : 'id-ID';

  const t = useCallback(
    (idText: string, enText: string) => (language === 'en' ? enText : idText),
    [language]
  );

  const formatRiskRating = useCallback(
    (rating: string) => {
      if (language !== 'en') return rating;
      const map: Record<string, string> = {
        Rendah: 'Low',
        Moderat: 'Moderate',
        Tinggi: 'High',
        'Sangat Tinggi': 'Very High',
      };
      return map[rating] || rating;
    },
    [language]
  );

  const formatMarketType = useCallback(
    (type: string) => {
      if (language === 'en') {
        if (type === 'IDX_STOCK') return 'IDX Stock';
        if (type === 'US_STOCK') return 'US Stock';
        if (type === 'ETF') return 'Global ETF';
        return type;
      }
      if (type === 'IDX_STOCK') return 'Saham IHSG';
      if (type === 'US_STOCK') return 'Saham AS';
      if (type === 'ETF') return 'ETF Global';
      return type;
    },
    [language]
  );

  const value = useMemo<LanguageContextValue>(
    () => ({
      language,
      locale,
      setLanguage,
      toggleLanguage,
      t,
      formatRiskRating,
      formatMarketType,
    }),
    [language, locale, setLanguage, toggleLanguage, t, formatRiskRating, formatMarketType]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    return {
      language: 'id',
      locale: 'id-ID',
      setLanguage: () => {},
      toggleLanguage: () => {},
      t: (idText) => idText,
      formatRiskRating: (r) => r,
      formatMarketType: (tp) =>
        tp === 'IDX_STOCK' ? 'Saham IHSG' : tp === 'US_STOCK' ? 'Saham AS' : 'ETF Global',
    };
  }
  return ctx;
}

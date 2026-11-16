import React, { useState, useEffect } from 'react';
import {
  Wifi,
  BatteryMedium,
  Smartphone,
  Monitor,
  Shield,
  DollarSign,
  Bell,
  HelpCircle,
  CalendarDays,
  Languages,
} from 'lucide-react';
import { RiskProfile } from '../data/marketData';
import { useLanguage } from '../i18n/LanguageContext';

interface AndroidHeaderProps {
  currentProfile: RiskProfile;
  onOpenProfileModal: () => void;
  currency: 'IDR' | 'USD';
  onToggleCurrency: () => void;
  isDeviceFramed: boolean;
  onToggleDeviceFrame: () => void;
  notificationCount: number;
  onOpenAlertDrawer: () => void;
  onOpenTutorial?: () => void;
  onOpenDividendCalendar?: () => void;
}

export const AndroidHeader: React.FC<AndroidHeaderProps> = React.memo(({
  currentProfile,
  onOpenProfileModal,
  currency,
  onToggleCurrency,
  isDeviceFramed,
  onToggleDeviceFrame,
  notificationCount,
  onOpenAlertDrawer,
  onOpenTutorial,
  onOpenDividendCalendar,
}) => {
  const { language, locale, toggleLanguage, t } = useLanguage();
  const [time, setTime] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(
        now.toLocaleTimeString(locale, {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 30000);
    return () => clearInterval(interval);
  }, [locale]);

  return (
    <div className="w-full bg-slate-950/95 backdrop-blur-md border-b border-slate-800/80 sticky top-0 z-30 select-none">
      {/* Android Top Status Bar (Clock, 5G, Battery) */}
      <div className="flex items-center justify-between px-4 sm:px-5 pt-2 pb-1 text-[11px] text-slate-400 font-mono">
        <span className="font-semibold text-slate-200">{time || '09:41'}</span>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-emerald-400">5G</span>
          <Wifi className="w-3.5 h-3.5 text-slate-300" />
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-slate-300">98%</span>
            <BatteryMedium className="w-4 h-4 text-emerald-400" />
          </div>
        </div>
      </div>

      {/* Main App Bar */}
      <div className="flex items-center justify-between gap-2 px-3 sm:px-4 py-2">
        <div className="flex items-center gap-2 min-w-0 shrink-0">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-emerald-500/20 shrink-0">
            <Shield className="w-4 h-4 text-slate-950 font-black" />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm font-bold tracking-tight text-white flex items-center gap-1 leading-none whitespace-nowrap">
              PortoLens <span className="text-emerald-400 font-medium text-xs">AI</span>
            </h1>
            <p className="text-[10px] text-slate-400 mt-0.5 hidden min-[375px]:block truncate">
              {t('Analisis Saham & ETF', 'Stock & ETF Analytics')}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1 sm:gap-1.5 min-w-0 shrink-0">
          {/* Tutorial / Guide Button */}
          {onOpenTutorial && (
            <button
              onClick={onOpenTutorial}
              className="flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-emerald-400 border border-slate-800 transition-colors shrink-0"
              title={t('Panduan Penggunaan Aplikasi', 'App Usage Guide')}
              aria-label={t('Panduan', 'Guide')}
            >
              <HelpCircle className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Dividend Calendar Shortcut */}
          {onOpenDividendCalendar && (
            <button
              onClick={onOpenDividendCalendar}
              className="flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-emerald-400 border border-slate-800 transition-colors shrink-0"
              title={t('Kalender Dividen & Passive Income', 'Dividend Calendar & Passive Income')}
              aria-label={t('Kalender Dividen', 'Dividend Calendar')}
            >
              <CalendarDays className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Price Notification Bell */}
          <button
            onClick={onOpenAlertDrawer}
            className="relative flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition-colors shrink-0"
            title={t('Pusat Notifikasi Target Harga', 'Price Alert Center')}
            aria-label={t('Notifikasi Harga', 'Price Alerts')}
          >
            <Bell className="w-3.5 h-3.5" />
            {notificationCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-emerald-500 px-1 text-[9px] font-bold text-slate-950 shadow-sm animate-pulse">
                {notificationCount}
              </span>
            )}
          </button>

          {/* Language Switcher (ID / EN) */}
          <button
            onClick={toggleLanguage}
            className="flex items-center gap-1 h-7 sm:h-8 px-1.5 sm:px-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-[11px] font-bold text-slate-200 border border-slate-800 hover:border-cyan-500/40 transition-colors whitespace-nowrap shrink-0"
            title={t('Ubah Bahasa (Indonesia / English)', 'Switch Language (Indonesian / English)')}
            aria-label={t('Pilih Bahasa', 'Select Language')}
          >
            <Languages className="w-3 h-3 text-cyan-400 hidden min-[400px]:inline" />
            <span className={language === 'id' ? 'text-emerald-400' : 'text-slate-500'}>ID</span>
            <span className="text-slate-600 text-[10px]">/</span>
            <span className={language === 'en' ? 'text-emerald-400' : 'text-slate-500'}>EN</span>
          </button>

          {/* Currency Switcher */}
          <button
            onClick={onToggleCurrency}
            className="flex items-center gap-0.5 h-7 sm:h-8 px-1.5 sm:px-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-[11px] font-semibold text-slate-200 border border-slate-800 transition-colors whitespace-nowrap shrink-0"
            title={t('Ganti Mata Uang Tampilan (IDR / USD)', 'Switch Display Currency (IDR / USD)')}
          >
            {currency === 'IDR' ? (
              <span className="text-[10px] font-extrabold text-emerald-400 font-mono leading-none">
                Rp
              </span>
            ) : (
              <DollarSign className="w-3 h-3 text-emerald-400" />
            )}
            <span>{currency}</span>
          </button>

          {/* Risk Profile Trigger */}
          <button
            onClick={onOpenProfileModal}
            className="flex items-center gap-1 h-7 sm:h-8 px-1.5 sm:px-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-[11px] font-medium border border-slate-800 transition-colors whitespace-nowrap shrink-0"
            title={t('Ubah Profil Manajemen Risiko', 'Change Risk Profile')}
          >
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: currentProfile.color }}
            />
            <span className="text-slate-200 truncate max-w-[54px] sm:max-w-[68px]">
              {currentProfile.name}
            </span>
          </button>

          {/* Device Frame Toggle (Mobile vs Full Screen) */}
          <button
            onClick={onToggleDeviceFrame}
            className="hidden sm:flex items-center justify-center w-8 h-8 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 transition-colors shrink-0"
            title={
              isDeviceFramed
                ? t('Beralih ke Tampilan Layar Penuh', 'Switch to Fullscreen View')
                : t('Beralih ke Tampilan Frame Android', 'Switch to Android Frame View')
            }
          >
            {isDeviceFramed ? (
              <Monitor className="w-3.5 h-3.5" />
            ) : (
              <Smartphone className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
});

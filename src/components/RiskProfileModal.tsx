import React from 'react';
import { X, ShieldAlert, Check } from 'lucide-react';
import { RISK_PROFILES, RiskProfile } from '../data/marketData';

interface RiskProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedProfileId: string;
  onSelectProfile: (profileId: string) => void;
}

export const RiskProfileModal: React.FC<RiskProfileModalProps> = ({
  isOpen,
  onClose,
  selectedProfileId,
  onSelectProfile,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-t-3xl sm:rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Handle / Header */}
        <div className="px-5 pt-4 pb-3 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-emerald-400" />
            <div>
              <h2 className="text-base font-bold text-white">Profil Manajemen Risiko</h2>
              <p className="text-xs text-slate-400">Pilih strategi risiko untuk evaluasi portofolio</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Profile List */}
        <div className="p-4 space-y-3 overflow-y-auto">
          {Object.values(RISK_PROFILES).map((prof: RiskProfile) => {
            const isSelected = selectedProfileId === prof.id;

            return (
              <button
                key={prof.id}
                onClick={() => {
                  onSelectProfile(prof.id);
                  onClose();
                }}
                className={`w-full text-left p-4 rounded-xl border transition-all duration-200 relative ${
                  isSelected
                    ? 'bg-slate-800/90 border-emerald-500 shadow-md shadow-emerald-500/10'
                    : 'bg-slate-950/50 border-slate-800 hover:border-slate-700 hover:bg-slate-800/40'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: prof.color }}
                    />
                    <span className="text-sm font-bold text-white">{prof.name}</span>
                    <span className="text-[11px] text-slate-400 font-normal">· {prof.subtitle}</span>
                  </div>
                  {isSelected && (
                    <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center text-slate-950">
                      <Check className="w-3 h-3 stroke-[3]" />
                    </div>
                  )}
                </div>

                <p className="text-xs text-slate-300 mt-2 leading-relaxed">{prof.description}</p>

                {/* Key Risk Parameters */}
                <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-slate-800/80 text-[11px]">
                  <div>
                    <span className="text-slate-400">Target Beta: </span>
                    <span className="text-slate-200 font-mono font-medium">{prof.targetBetaRange}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Maks 1 Saham: </span>
                    <span className="text-slate-200 font-mono font-medium">{prof.maxSingleAssetAllocation}%</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-400">Toleransi Fluktuasi: </span>
                    <span className="text-emerald-400 font-medium">{prof.volatilityTolerance}</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-950/60 border-t border-slate-800 text-[11px] text-slate-400">
          💡 Skor kesehatan dan rekomendasi rebalancing akan otomatis disesuaikan secara matematis dan AI berdasarkan profil yang Anda pilih.
        </div>
      </div>
    </div>
  );
};

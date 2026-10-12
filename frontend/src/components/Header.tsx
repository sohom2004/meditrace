import React from 'react';
import { Activity, ShieldCheck, Stethoscope, Users, Globe } from 'lucide-react';

interface HeaderProps {
  currentRole: 'patient' | 'doctor';
  setRole: (role: 'patient' | 'doctor') => void;
  careProfiles: any[];
  activeProfileId: string;
  setActiveProfileId: (id: string) => void;
  language: string;
  setLanguage: (lang: string) => void;
  onOpenVoice: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentRole,
  setRole,
  careProfiles,
  activeProfileId,
  setActiveProfileId,
  language,
  setLanguage,
  onOpenVoice,
}) => {
  const activeProfile = careProfiles.find(p => p.id === activeProfileId) || careProfiles[0];

  return (
    <header className="sticky top-0 z-40 glass-nav px-4 sm:px-8 py-3.5 flex flex-wrap items-center justify-between gap-4">
      {/* Brand */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-sky-500 to-teal-400 flex items-center justify-center shadow-lg shadow-sky-500/20 text-white">
          <Activity className="w-5 h-5" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
              MediTrace
            </span>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 border border-sky-200/60">
              2.1
            </span>
          </div>
          <p className="text-[11px] text-slate-500 font-medium">Longitudinal Medical Memory</p>
        </div>
      </div>

      {/* Middle: Care Profile Switcher (When in patient mode) */}
      {currentRole === 'patient' && careProfiles.length > 0 && (
        <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-slate-200/50 backdrop-blur-md border border-white/60">
          {careProfiles.map((p) => {
            const isSelected = p.id === activeProfileId;
            return (
              <button
                key={p.id}
                onClick={() => setActiveProfileId(p.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  isSelected
                    ? 'bg-white text-slate-900 shadow-sm border border-slate-200/80 scale-[1.02]'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/40'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${isSelected ? 'bg-sky-500' : 'bg-slate-300'}`} />
                <span>{p.full_name}</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-500 capitalize">
                  {p.relationship}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Controls & Mode Switcher */}
      <div className="flex items-center gap-2.5">
        {/* Language selector */}
        <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl glass-pill text-xs font-medium text-slate-700">
          <Globe className="w-3.5 h-3.5 text-slate-400" />
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="bg-transparent border-none text-xs focus:outline-none cursor-pointer font-medium"
          >
            <option value="en">English (EN)</option>
            <option value="hi">हिन्दी (Hindi)</option>
            <option value="bn">বাংলা (Bengali)</option>
            <option value="ta">தமிழ் (Tamil)</option>
          </select>
        </div>

        {/* Voice Agent Trigger */}
        <button
          onClick={onOpenVoice}
          className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-teal-500 to-sky-600 text-white text-xs font-semibold shadow-md shadow-sky-500/25 hover:opacity-95 transition-all cursor-pointer"
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
          </span>
          <span>Voice Agent</span>
        </button>

        {/* Portal Switcher (Patient vs Doctor) */}
        <div className="flex items-center p-1 rounded-xl bg-slate-200/60 border border-white/60">
          <button
            onClick={() => setRole('patient')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
              currentRole === 'patient'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Patient</span>
          </button>
          <button
            onClick={() => setRole('doctor')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
              currentRole === 'doctor'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Stethoscope className="w-3.5 h-3.5 text-emerald-600" />
            <span>Doctor</span>
          </button>
        </div>
      </div>
    </header>
  );
};

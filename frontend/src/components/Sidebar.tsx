import React from 'react';
import {
  LayoutDashboard,
  Mic,
  Stethoscope,
  FileText,
  Pill,
  Users,
  Activity,
  Globe,
  LogOut,
  ChevronRight,
  Shield,
  UserCheck,
} from 'lucide-react';

interface SidebarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  activeProfile: any;
  careProfilesCount: number;
  onOpenAccountsModal: () => void;
  currentRole: 'patient' | 'doctor';
  setRole: (role: 'patient' | 'doctor') => void;
  language: string;
  setLanguage: (lang: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  activeProfile,
  careProfilesCount,
  onOpenAccountsModal,
  currentRole,
  setRole,
  language,
  setLanguage,
}) => {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'chat', label: 'Voice & Chat', icon: Mic, badge: 'Natasha' },
    { id: 'doctors', label: 'Doctors', icon: Stethoscope },
    { id: 'reports', label: 'Reports & Records', icon: FileText },
    { id: 'pharmacy', label: 'Pharmacy', icon: Pill },
  ];

  return (
    <aside className="w-64 glass-sidebar h-screen sticky top-0 flex flex-col justify-between p-4 z-40 hidden md:flex border-r border-slate-800">
      {/* Top Brand & Nav */}
      <div className="space-y-6">
        {/* Brand */}
        <div className="flex items-center gap-3 px-2">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-sky-500 to-teal-400 flex items-center justify-center shadow-lg shadow-sky-500/20 text-white shrink-0">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-base tracking-tight text-white">MediTrace</span>
              <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded-md bg-sky-950 text-sky-400 border border-sky-800/40 font-mono">
                2.1
              </span>
            </div>
            <p className="text-[11px] text-slate-400">Clinical Memory Monolith</p>
          </div>
        </div>

        {/* Role Toggle */}
        <div className="flex p-1 rounded-xl bg-slate-900 border border-slate-800">
          <button
            onClick={() => setRole('patient')}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              currentRole === 'patient'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Patient Mode
          </button>
          <button
            onClick={() => setRole('doctor')}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              currentRole === 'doctor'
                ? 'bg-teal-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Doctor Portal
          </button>
        </div>

        {/* Navigation Links */}
        {currentRole === 'patient' ? (
          <nav className="space-y-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onSelectTab(item.id)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-gradient-to-r from-sky-600/30 to-sky-600/10 text-sky-300 border border-sky-500/40 shadow-sm'
                      : 'text-slate-400 hover:text-white hover:bg-slate-900/60'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-sky-400' : 'text-slate-400'}`} />
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-950 text-sky-400 border border-sky-800/40 font-mono">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        ) : (
          <div className="p-3 rounded-xl bg-teal-950/30 border border-teal-800/40 text-xs text-teal-300">
            Doctor Workspace Active. Authorized clinical rosters, council verification, and allergy-checked Rx.
          </div>
        )}
      </div>

      {/* Bottom: Language & Accounts Button */}
      <div className="space-y-3 pt-3 border-t border-slate-800">
        {/* Language selector */}
        <div className="flex items-center justify-between px-2 text-xs text-slate-400">
          <div className="flex items-center gap-1.5">
            <Globe className="w-3.5 h-3.5" />
            <span>Language</span>
          </div>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-[11px] text-white focus:outline-none"
          >
            <option value="en">English</option>
            <option value="hi">हिन्दी (Hindi)</option>
            <option value="bn">বাংলা (Bengali)</option>
            <option value="ta">தமிழ் (Tamil)</option>
          </select>
        </div>

        {/* ACCOUNTS BUTTON (Single account active at a time, Crunchyroll-style switcher) */}
        <button
          onClick={onOpenAccountsModal}
          className="w-full p-2.5 rounded-2xl bg-slate-900/80 hover:bg-slate-800/90 border border-slate-800 hover:border-sky-500/40 transition-all text-left group"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-sky-500 to-teal-400 text-white flex items-center justify-center font-bold text-xs shadow-md shadow-sky-500/20 shrink-0">
                {activeProfile?.full_name?.charAt(0) || 'U'}
              </div>
              <div className="truncate">
                <div className="text-xs font-bold text-white truncate group-hover:text-sky-300 transition-colors">
                  {activeProfile?.full_name || 'Select Account'}
                </div>
                <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                  <span className="capitalize">{activeProfile?.relationship || 'Active'}</span>
                  <span>•</span>
                  <span className="text-sky-400 font-semibold">{careProfilesCount}/3 Members</span>
                </div>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-white transition-colors shrink-0" />
          </div>
        </button>
      </div>
    </aside>
  );
};

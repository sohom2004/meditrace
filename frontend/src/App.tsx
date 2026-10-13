import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { PatientDashboard } from './components/PatientDashboard';
import { VoiceAssistantContinuous } from './components/VoiceAssistantContinuous';
import { PatientDoctorPortal } from './components/PatientDoctorPortal';
import { ReportsView } from './components/ReportsView';
import { PharmacyRestockCard } from './components/PharmacyRestockCard';
import { DoctorPortal } from './components/DoctorPortal';
import { TargetedReviewModal } from './components/TargetedReviewModal';
import { AccountsModal } from './components/AccountsModal';
import { AuthModal } from './components/AuthModal';
import {
  LayoutDashboard,
  Mic,
  Stethoscope,
  FileText,
  Pill,
  Users,
  Menu,
  X,
  Activity,
  Globe,
  LogOut,
  ChevronRight,
  ShieldCheck,
  User,
} from 'lucide-react';
import { api, setAuthToken } from './api';

export const App: React.FC = () => {
  const [role, setRole] = useState<'patient' | 'doctor'>('patient');
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [language, setLanguage] = useState<string>('en');

  // Auth & Profile state
  const [currentUser, setCurrentUser] = useState<any | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [careProfiles, setCareProfiles] = useState<any[]>([]);
  const [activeProfileId, setActiveProfileId] = useState<string>('');
  const [isAccountsModalOpen, setIsAccountsModalOpen] = useState(false);

  // Profile data
  const [snapshot, setSnapshot] = useState<any | null>(null);
  const [timelineEvents, setTimelineEvents] = useState<any[]>([]);
  const [reviews, setReviews] = useState<{ pending_observations: any[]; pending_medications: any[] }>({
    pending_observations: [],
    pending_medications: [],
  });
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Initialize Auth
  useEffect(() => {
    const initialize = async () => {
      try {
        const token = localStorage.getItem('meditrace_token');
        if (!token) {
          // Auto-authenticate default demo user if first time
          const authRes = await api.verifyOTP('+919876543210', '123456');
          setAuthToken(authRes.access_token);
          setCurrentUser(authRes.user);
        } else {
          try {
            const me = await api.getMe();
            setCurrentUser(me);
          } catch {
            const authRes = await api.verifyOTP('+919876543210', '123456');
            setAuthToken(authRes.access_token);
            setCurrentUser(authRes.user);
          }
        }

        const profiles = await api.listCareProfiles();
        setCareProfiles(profiles);

        // Restore previously selected profile from localStorage or default to self/first
        const savedProfileId = localStorage.getItem('meditrace_active_profile_id');
        if (savedProfileId && profiles.some((p: any) => p.id === savedProfileId)) {
          setActiveProfileId(savedProfileId);
        } else {
          const selfProfile = profiles.find((p: any) => p.relationship === 'self');
          const defaultId = selfProfile ? selfProfile.id : profiles[0]?.id || '';
          setActiveProfileId(defaultId);
          if (defaultId) {
            localStorage.setItem('meditrace_active_profile_id', defaultId);
          }
        }
      } catch (err) {
        console.error('Initialization error:', err);
        setIsAuthModalOpen(true);
      }
    };
    initialize();
  }, []);

  // Fetch care profiles helper
  const refreshProfiles = async () => {
    try {
      const profiles = await api.listCareProfiles();
      setCareProfiles(profiles);
      const savedProfileId = localStorage.getItem('meditrace_active_profile_id');
      if (savedProfileId && profiles.some((p: any) => p.id === savedProfileId)) {
        setActiveProfileId(savedProfileId);
      } else if (!profiles.some((p: any) => p.id === activeProfileId) && profiles.length > 0) {
        const nextId = profiles[0].id;
        setActiveProfileId(nextId);
        localStorage.setItem('meditrace_active_profile_id', nextId);
      }
    } catch (e) {
      console.error('Failed to refresh care profiles:', e);
    }
  };

  // Fetch data for active profile
  const refreshProfileData = async () => {
    if (!activeProfileId) return;
    try {
      const [snap, tl, rev] = await Promise.all([
        api.getSnapshot(activeProfileId),
        api.getTimeline(activeProfileId),
        api.getReviews(activeProfileId),
      ]);
      setSnapshot(snap);
      setTimelineEvents(tl);
      setReviews(rev);
    } catch (err) {
      console.error('Failed to load profile data:', err);
    }
  };

  useEffect(() => {
    refreshProfileData();
  }, [activeProfileId]);

  const activeProfile = careProfiles.find((p) => p.id === activeProfileId) || careProfiles[0];
  const reviewCount =
    (reviews.pending_observations?.length || 0) + (reviews.pending_medications?.length || 0);

  const handleLoginSuccess = async (user: any) => {
    setCurrentUser(user);
    setIsAuthModalOpen(false);
    if (user.role === 'practitioner') {
      setRole('doctor');
    } else {
      setRole('patient');
    }
    await refreshProfiles();
  };

  const handleSignOut = () => {
    setAuthToken(null);
    setCurrentUser(null);
    setCareProfiles([]);
    setActiveProfileId('');
    setIsAccountsModalOpen(false);
    setIsAuthModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-[#07090e] text-slate-100 flex flex-col md:flex-row">
      {/* Desktop Sidebar */}
      <Sidebar
        currentTab={activeTab}
        onSelectTab={setActiveTab}
        activeProfile={activeProfile}
        careProfilesCount={careProfiles.length}
        onOpenAccountsModal={() => setIsAccountsModalOpen(true)}
        currentRole={role}
        setRole={setRole}
        language={language}
        setLanguage={setLanguage}
      />

      {/* Mobile Header */}
      <div className="md:hidden glass-nav px-4 py-3 flex items-center justify-between sticky top-0 z-40 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-sky-500 to-teal-400 flex items-center justify-center text-white">
            <Activity className="w-4 h-4" />
          </div>
          <span className="font-bold text-sm tracking-tight text-white">MediTrace 2.1</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Mobile Accounts pill */}
          <button
            onClick={() => setIsAccountsModalOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-900 border border-slate-800 text-xs font-semibold"
          >
            <div className="w-4 h-4 rounded-full bg-sky-500 text-white flex items-center justify-center text-[9px] font-bold">
              {activeProfile?.full_name?.charAt(0) || 'U'}
            </div>
            <span className="truncate max-w-[80px] text-slate-300">{activeProfile?.full_name}</span>
          </button>

          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 top-14 z-30 bg-black/95 p-5 space-y-4">
          <div className="flex p-1 rounded-xl bg-slate-900 border border-slate-800 mb-4">
            <button
              onClick={() => { setRole('patient'); setMobileMenuOpen(false); }}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg ${role === 'patient' ? 'bg-sky-600 text-white' : 'text-slate-400'}`}
            >
              Patient Mode
            </button>
            <button
              onClick={() => { setRole('doctor'); setMobileMenuOpen(false); }}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg ${role === 'doctor' ? 'bg-teal-600 text-white' : 'text-slate-400'}`}
            >
              Doctor Portal
            </button>
          </div>

          <nav className="space-y-2">
            {[
              { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
              { id: 'chat', label: 'Voice & Chat (Natasha)', icon: Mic },
              { id: 'doctors', label: 'Connected Doctors', icon: Stethoscope },
              { id: 'reports', label: 'Reports & Records', icon: FileText },
              { id: 'pharmacy', label: 'Pharmacy Restock', icon: Pill },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold ${
                    activeTab === item.id ? 'bg-sky-600/30 text-sky-400 border border-sky-500/40' : 'text-slate-400'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="pt-4 border-t border-slate-800 space-y-2">
            <button
              onClick={() => {
                setIsAccountsModalOpen(true);
                setMobileMenuOpen(false);
              }}
              className="w-full py-2.5 px-4 rounded-xl bg-slate-900 border border-slate-800 text-xs font-bold text-white flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-sky-400" />
                <span>Switch Family Account ({careProfiles.length}/3)</span>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-500" />
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 min-w-0 h-screen overflow-y-auto p-4 sm:p-6 lg:p-8">
        <div className="max-w-6xl mx-auto space-y-6">
          {role === 'doctor' ? (
            /* Doctor Workspace */
            <DoctorPortal />
          ) : (
            /* Patient Longitudinal Workspace */
            <>
              {activeTab === 'dashboard' && (
                <PatientDashboard
                  snapshot={snapshot}
                  activeProfileId={activeProfileId}
                  onNavigateTab={(tab) => setActiveTab(tab)}
                  onOpenReviews={() => setIsReviewModalOpen(true)}
                  reviewCount={reviewCount}
                />
              )}

              {activeTab === 'chat' && (
                <VoiceAssistantContinuous
                  activeProfileId={activeProfileId}
                  activeProfileName={activeProfile?.full_name || 'Patient'}
                  language={language}
                  onPendingActionResolved={refreshProfileData}
                />
              )}

              {activeTab === 'doctors' && (
                <PatientDoctorPortal
                  activeProfileId={activeProfileId}
                  onAppointmentRequested={refreshProfileData}
                />
              )}

              {activeTab === 'reports' && (
                <ReportsView
                  activeProfileId={activeProfileId}
                  activeProfileName={activeProfile?.full_name || 'Patient'}
                  onOpenReviews={() => setIsReviewModalOpen(true)}
                  reviewCount={reviewCount}
                  timelineEvents={timelineEvents}
                  onRefreshTimeline={refreshProfileData}
                />
              )}

              {activeTab === 'pharmacy' && (
                <PharmacyRestockCard activeProfileId={activeProfileId} />
              )}
            </>
          )}
        </div>
      </main>

      {/* Accounts & Profile Switcher Modal (Crunchyroll style, max 3 members) */}
      <AccountsModal
        isOpen={isAccountsModalOpen}
        onClose={() => setIsAccountsModalOpen(false)}
        careProfiles={careProfiles}
        activeProfileId={activeProfileId}
        onSelectProfile={(id) => {
          setActiveProfileId(id);
          localStorage.setItem('meditrace_active_profile_id', id);
          setIsAccountsModalOpen(false);
        }}
        onRefreshProfiles={refreshProfiles}
        onSignOut={handleSignOut}
      />

      {/* Authentication & Account Creation Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={handleLoginSuccess}
      />

      {/* Targeted Review Modal */}
      <TargetedReviewModal
        isOpen={isReviewModalOpen}
        onClose={() => setIsReviewModalOpen(false)}
        reviews={reviews}
        onReviewResolved={() => {
          setIsReviewModalOpen(false);
          refreshProfileData();
        }}
      />
    </div>
  );
};

export default App;

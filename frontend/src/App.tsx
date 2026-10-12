import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { PatientSnapshotBanner } from './components/PatientSnapshotBanner';
import { DocumentUploadCard } from './components/DocumentUploadCard';
import { TargetedReviewModal } from './components/TargetedReviewModal';
import { ObservationCharts } from './components/ObservationCharts';
import { AssistantChat } from './components/AssistantChat';
import { TimelineSection } from './components/TimelineSection';
import { VoiceAgentModal } from './components/VoiceAgentModal';
import { DoctorPortal } from './components/DoctorPortal';
import { PatientDoctorPortal } from './components/PatientDoctorPortal';
import { PharmacyRestockCard } from './components/PharmacyRestockCard';
import { FileText, Stethoscope, Pill } from 'lucide-react';
import { api, setAuthToken } from './api';

export const App: React.FC = () => {
  const [role, setRole] = useState<'patient' | 'doctor'>('patient');
  const [patientTab, setPatientTab] = useState<'records' | 'doctors' | 'pharmacy'>('records');
  const [language, setLanguage] = useState('en');
  const [careProfiles, setCareProfiles] = useState<any[]>([]);
  const [activeProfileId, setActiveProfileId] = useState<string>('');
  const [snapshot, setSnapshot] = useState<any | null>(null);
  const [timelineEvents, setTimelineEvents] = useState<any[]>([]);
  const [reviews, setReviews] = useState<{ pending_observations: any[]; pending_medications: any[] }>({
    pending_observations: [],
    pending_medications: [],
  });
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  const [selectedLabTest, setSelectedLabTest] = useState('HbA1c');

  // Initial load: authenticate with demo token and fetch profiles
  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Auto-authenticate default session
        const authRes = await api.verifyOTP('+919876543210', '123456');
        setAuthToken(authRes.access_token);

        const profiles = await api.listCareProfiles();
        setCareProfiles(profiles);

        // Prefer father's profile for rich chronic demonstration if available
        const father = profiles.find((p: any) => p.relationship === 'father');
        const defaultId = father ? father.id : profiles[0]?.id || '';
        setActiveProfileId(defaultId);
      } catch (err) {
        console.error('App init error:', err);
      }
    };
    initializeApp();
  }, []);

  // Whenever active care profile changes, refresh data
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

  const reviewCount =
    (reviews.pending_observations?.length || 0) + (reviews.pending_medications?.length || 0);

  return (
    <div className="min-h-screen flex flex-col">
      <Header
        currentRole={role}
        setRole={setRole}
        careProfiles={careProfiles}
        activeProfileId={activeProfileId}
        setActiveProfileId={setActiveProfileId}
        language={language}
        setLanguage={setLanguage}
        onOpenVoice={() => setIsVoiceModalOpen(true)}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-8 py-6">
        {role === 'patient' ? (
          <div className="space-y-6">
            {/* iOS Segmented Navigation Bar */}
            <div className="flex items-center justify-center">
              <div className="bg-slate-200/60 p-1 rounded-2xl flex items-center gap-1 shadow-inner backdrop-blur-md">
                <button
                  onClick={() => setPatientTab('records')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    patientTab === 'records'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5 text-sky-600" />
                  <span>Health Records & AI</span>
                </button>

                <button
                  onClick={() => setPatientTab('doctors')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    patientTab === 'doctors'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Stethoscope className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Doctor Messaging & Portal</span>
                </button>

                <button
                  onClick={() => setPatientTab('pharmacy')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    patientTab === 'pharmacy'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Pill className="w-3.5 h-3.5 text-amber-600" />
                  <span>Pharmacy & Restock</span>
                </button>
              </div>
            </div>

            {patientTab === 'records' && (
              <>
                {/* Snapshot */}
                <PatientSnapshotBanner
                  snapshot={snapshot}
                  onSelectLab={(labName) => setSelectedLabTest(labName)}
                />

                {/* Document Ingestion & Targeted Reviews */}
                <DocumentUploadCard
                  activeProfileId={activeProfileId}
                  onUploadSuccess={refreshProfileData}
                  onOpenReviews={() => setIsReviewModalOpen(true)}
                  reviewCount={reviewCount}
                />

                {/* Two-column layout: Observation trend charts & Grounded AI Assistant */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <ObservationCharts
                    activeProfileId={activeProfileId}
                    selectedTestName={selectedLabTest}
                  />
                  <AssistantChat
                    activeProfileId={activeProfileId}
                    language={language}
                    onActionCommitted={refreshProfileData}
                  />
                </div>

                {/* Longitudinal Memory Timeline */}
                <TimelineSection events={timelineEvents} />
              </>
            )}

            {patientTab === 'doctors' && (
              <PatientDoctorPortal
                activeProfileId={activeProfileId}
                onAppointmentRequested={refreshProfileData}
              />
            )}

            {patientTab === 'pharmacy' && (
              <PharmacyRestockCard activeProfileId={activeProfileId} />
            )}
          </div>
        ) : (
          <DoctorPortal />
        )}
      </main>

      {/* Modals */}
      <TargetedReviewModal
        isOpen={isReviewModalOpen}
        onClose={() => setIsReviewModalOpen(false)}
        reviews={reviews}
        onReviewResolved={() => {
          refreshProfileData();
          setIsReviewModalOpen(false);
        }}
      />

      <VoiceAgentModal
        isOpen={isVoiceModalOpen}
        onClose={() => setIsVoiceModalOpen(false)}
        activeProfileId={activeProfileId}
        language={language}
      />

      {/* Footer */}
      <footer className="py-6 text-center text-xs text-slate-400 border-t border-slate-200/40">
        MediTrace 2.1 — Longitudinal Health Memory & Deterministic Assistant • India DPDP Act / ABDM Ready
      </footer>
    </div>
  );
};

export default App;

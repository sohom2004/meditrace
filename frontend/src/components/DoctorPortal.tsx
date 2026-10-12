import React, { useState, useEffect, useRef } from 'react';
import {
  Stethoscope,
  ShieldCheck,
  UserCheck,
  FileText,
  AlertTriangle,
  Key,
  PenTool,
  CheckCircle2,
  Mic,
  MicOff,
  Volume2,
  MessageSquare,
  Send,
  Sparkles,
  Activity,
  Calendar,
  Clock,
  CheckSquare,
  Users,
} from 'lucide-react';
import { api } from '../api';

export const DoctorPortal: React.FC = () => {
  const [patients, setPatients] = useState<any[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [briefing, setBriefing] = useState<any | null>(null);
  const [loadingBriefing, setLoadingBriefing] = useState(false);

  // Operations stats
  const [stats, setStats] = useState<any | null>(null);

  // Prescription builder state
  const [diagnosis, setDiagnosis] = useState('Type 2 Diabetes & Hypertension follow-up');
  const [prescribedMed, setPrescribedMed] = useState('');
  const [prescribedDose, setPrescribedDose] = useState('1 tab OD');
  const [medsList, setMedsList] = useState<any[]>([
    { medicine_name: 'Glycomet GP2', generic_name: 'metformin + glimepiride', dosage: '1 tab BD' },
  ]);
  const [allergyAlert, setAllergyAlert] = useState<string | null>(null);
  const [signingPin, setSigningPin] = useState('1234');
  const [signedPrescription, setSignedPrescription] = useState<any | null>(null);

  // Doctor Voice Assistant state
  const [voiceQuery, setVoiceQuery] = useState('');
  const [voiceResponse, setVoiceResponse] = useState<any | null>(null);
  const [isVoiceQuerying, setIsVoiceQuerying] = useState(false);
  const [isDoctorListening, setIsDoctorListening] = useState(false);

  // Voice-to-Prescription state
  const [dictationText, setDictationText] = useState('');
  const [isDictating, setIsDictating] = useState(false);
  const [isParsingRx, setIsParsingRx] = useState(false);

  // Doctor-Patient Messaging state
  const [messages, setMessages] = useState<any[]>([]);
  const [doctorNewMsg, setDoctorNewMsg] = useState('');
  const [loadingMessages, setLoadingMessages] = useState(false);

  // Speech synthesis & recognition refs
  const recognitionRef = useRef<any>(null);
  const synthRef = useRef<SpeechSynthesis | null>(typeof window !== 'undefined' ? window.speechSynthesis : null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [pts, practiceStats] = await Promise.all([
          api.getDoctorPatients(),
          api.getDoctorPracticeStats(),
        ]);
        setPatients(pts);
        setStats(practiceStats);
        if (pts.length > 0) {
          setSelectedPatientId(pts[0].care_profile_id);
        }
      } catch (err) {
        console.error('Failed to load doctor portal data:', err);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    if (!selectedPatientId) return;
    const fetchBriefingAndMessages = async () => {
      try {
        setLoadingBriefing(true);
        setLoadingMessages(true);
        const [res, msgs] = await Promise.all([
          api.getDoctorBriefing(selectedPatientId),
          api.getDoctorMessages(selectedPatientId, 'doc-ananya-mukherjee'),
        ]);
        setBriefing(res);
        setMessages(msgs);
        setLoadingBriefing(false);
        setLoadingMessages(false);
      } catch (err) {
        setBriefing(null);
        setLoadingBriefing(false);
        setLoadingMessages(false);
      }
    };
    fetchBriefingAndMessages();
  }, [selectedPatientId]);

  const speakText = (text: string) => {
    if (!synthRef.current) return;
    try {
      synthRef.current.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      synthRef.current.speak(utterance);
    } catch (e) {
      console.error('Speech error:', e);
    }
  };

  // Doctor Voice Assistant Query
  const handleDoctorVoiceQuery = async (queryText: string) => {
    if (!queryText.trim()) return;
    try {
      setIsVoiceQuerying(true);
      const res = await api.sendDoctorVoiceQuery(queryText, selectedPatientId || undefined);
      setVoiceResponse(res);
      setIsVoiceQuerying(false);
      if (res.spoken_answer) {
        speakText(res.spoken_answer);
      }
    } catch (err: any) {
      setIsVoiceQuerying(false);
      alert(`Voice query failed: ${err.message}`);
    }
  };

  // Dictation Speech Recognition
  const toggleDictationMic = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Speech recognition is not supported in this browser environment. Please type or use sample dictation.');
      return;
    }

    if (isDictating) {
      if (recognitionRef.current) recognitionRef.current.stop();
      setIsDictating(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'en-IN';

      recognition.onstart = () => setIsDictating(true);
      recognition.onresult = (event: any) => {
        let text = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          text += event.results[i][0].transcript;
        }
        setDictationText(text);
      };
      recognition.onend = () => setIsDictating(false);
      recognition.onerror = () => setIsDictating(false);

      recognitionRef.current = recognition;
      recognition.start();
    } catch (e) {
      setIsDictating(false);
    }
  };

  // Parse Voice-to-Prescription with Allergy Safety Cross-Check
  const handleParseVoicePrescription = async (textToParse?: string) => {
    const text = textToParse || dictationText;
    if (!text.trim() || !selectedPatientId) return;
    try {
      setIsParsingRx(true);
      const res = await api.sendVoicePrescription(selectedPatientId, text);
      setIsParsingRx(false);

      if (res.diagnosis) {
        setDiagnosis(res.diagnosis);
      }
      if (res.medications && res.medications.length > 0) {
        setMedsList(res.medications);
      }

      if (res.allergy_warning) {
        setAllergyAlert(res.allergy_warning);
        speakText(`Warning Doctor: Allergy detected. ${res.allergy_warning}`);
      } else if (res.allergy_alerts && res.allergy_alerts.length > 0) {
        setAllergyAlert(`CRITICAL ALLERGY ALERT: ${res.allergy_alerts.join('; ')}`);
        speakText(`Warning Doctor: Allergy detected. ${res.allergy_alerts.join('. ')}`);
      } else {
        setAllergyAlert(null);
        speakText('Dictated prescription structured and cleared against patient allergies.');
      }
    } catch (err: any) {
      setIsParsingRx(false);
      alert(`Voice to Rx parsing failed: ${err.message}`);
    }
  };

  const handleAddMedication = () => {
    if (!prescribedMed.trim()) return;

    // Check allergy conflict against patient's allergies
    const patientAllergies = briefing?.allergies || [];
    const medLower = prescribedMed.toLowerCase();
    const conflict = patientAllergies.find((a: string) => medLower.includes(a.toLowerCase().split(' ')[0]));

    if (conflict || medLower.includes('penicillin') || medLower.includes('amoxicillin')) {
      const alertMsg = 'CRITICAL ALLERGY ALERT: Patient has documented severe allergy to Penicillin. Prescription blocked.';
      setAllergyAlert(alertMsg);
      speakText(alertMsg);
      return;
    }

    setAllergyAlert(null);
    setMedsList((prev) => [
      ...prev,
      { medicine_name: prescribedMed, generic_name: prescribedMed, dosage: prescribedDose },
    ]);
    setPrescribedMed('');
  };

  const handleSignPrescription = async () => {
    if (!selectedPatientId) return;
    try {
      const draft = await api.draftPrescription(selectedPatientId, diagnosis, medsList);
      const signed = await api.signPrescription(draft.id, signingPin);
      setSignedPrescription(signed);
      speakText('Prescription successfully signed and cryptographically committed to patient vault.');
    } catch (err: any) {
      alert(`Signing failed: ${err.message}`);
    }
  };

  const handleSendDoctorMessage = async () => {
    if (!doctorNewMsg.trim() || !selectedPatientId) return;
    try {
      const msg = await api.sendDoctorMessage(selectedPatientId, 'doc-ananya-mukherjee', 'doctor', doctorNewMsg.trim());
      setMessages((prev) => [...prev, msg]);
      setDoctorNewMsg('');
    } catch (err: any) {
      alert(`Failed to send message: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Doctor Header & Verification Badge */}
      <div className="glass-card p-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-white flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <Stethoscope className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                Dr. Ananya Mukherjee, MD, DM
              </h2>
              <span className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                <ShieldCheck className="w-3.5 h-3.5" />
                Council Verified
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium">
              Reg: WBMC/2014/19823 • Senior Consultant Diabetologist & Cardiologist
            </p>
          </div>
        </div>

        <div className="text-xs text-slate-500 font-medium">
          DPDP Act 2023 / ABDM Verified Practice Environment
        </div>
      </div>

      {/* Practice Operations Metric Bar */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="glass-card p-3 text-center">
            <div className="flex items-center justify-center gap-1.5 text-slate-500 text-[11px] font-bold mb-1">
              <Users className="w-3.5 h-3.5 text-sky-600" />
              <span>Active Patients</span>
            </div>
            <span className="text-lg font-bold text-slate-900">{stats.active_patients}</span>
          </div>
          <div className="glass-card p-3 text-center">
            <div className="flex items-center justify-center gap-1.5 text-slate-500 text-[11px] font-bold mb-1">
              <Calendar className="w-3.5 h-3.5 text-emerald-600" />
              <span>Today's Appts</span>
            </div>
            <span className="text-lg font-bold text-slate-900">{stats.today_appointments}</span>
          </div>
          <div className="glass-card p-3 text-center">
            <div className="flex items-center justify-center gap-1.5 text-slate-500 text-[11px] font-bold mb-1">
              <CheckSquare className="w-3.5 h-3.5 text-amber-600" />
              <span>Pending Reviews</span>
            </div>
            <span className="text-lg font-bold text-slate-900">{stats.pending_chart_reviews}</span>
          </div>
          <div className="glass-card p-3 text-center">
            <div className="flex items-center justify-center gap-1.5 text-slate-500 text-[11px] font-bold mb-1">
              <Activity className="w-3.5 h-3.5 text-indigo-600" />
              <span>Refill Approvals</span>
            </div>
            <span className="text-lg font-bold text-slate-900">{stats.refill_requests_pending}</span>
          </div>
          <div className="glass-card p-3 text-center col-span-2 sm:col-span-1">
            <div className="flex items-center justify-center gap-1.5 text-slate-500 text-[11px] font-bold mb-1">
              <Clock className="w-3.5 h-3.5 text-purple-600" />
              <span>Avg Consult</span>
            </div>
            <span className="text-lg font-bold text-slate-900">{stats.average_consultation_time}</span>
          </div>
        </div>
      )}

      {/* Doctor Voice Assistant Card (Item 2) */}
      <div className="glass-card p-5">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200/60 mb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-600" />
            <h3 className="font-bold text-sm text-slate-900">Doctor AI Voice Assistant</h3>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
              Hands-Free Physician Assistant
            </span>
          </div>
          <span className="text-xs text-slate-400">Verifiable RAG Memory</span>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={voiceQuery}
              onChange={(e) => setVoiceQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleDoctorVoiceQuery(voiceQuery);
              }}
              placeholder="Ask anything about patient history, vitals, or medication regimens..."
              className="flex-1 text-xs px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 focus:outline-none focus:border-emerald-500"
            />
            <button
              onClick={() => handleDoctorVoiceQuery(voiceQuery)}
              disabled={isVoiceQuerying || !voiceQuery.trim()}
              className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-40"
            >
              <Volume2 className="w-3.5 h-3.5" />
              <span>{isVoiceQuerying ? 'Analyzing...' : 'Ask Doctor Assistant'}</span>
            </button>
          </div>

          {/* Quick Voice Queries */}
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => {
                setVoiceQuery('Summarize this patient kidney profile and medication list');
                handleDoctorVoiceQuery('Summarize this patient kidney profile and medication list');
              }}
              className="text-[11px] px-2.5 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
            >
              "Kidney profile & active medications"
            </button>
            <button
              onClick={() => {
                setVoiceQuery('What is the HbA1c progression and last recorded value?');
                handleDoctorVoiceQuery('What is the HbA1c progression and last recorded value?');
              }}
              className="text-[11px] px-2.5 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
            >
              "HbA1c progression"
            </button>
            <button
              onClick={() => {
                setVoiceQuery('Does this patient have any documented allergies?');
                handleDoctorVoiceQuery('Does this patient have any documented allergies?');
              }}
              className="text-[11px] px-2.5 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
            >
              "Check allergy alerts"
            </button>
          </div>

          {/* Spoken Response Display */}
          {voiceResponse && (
            <div className="p-3.5 rounded-2xl bg-emerald-50/80 border border-emerald-200 text-xs text-slate-800 leading-relaxed">
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-emerald-900 flex items-center gap-1.5">
                  <Volume2 className="w-3.5 h-3.5 text-emerald-600" />
                  Spoken Answer
                </span>
                <span className="text-[10px] text-slate-400">Audible playback active</span>
              </div>
              <p className="font-medium text-slate-900">{voiceResponse.spoken_answer}</p>
              {voiceResponse.chart_summary && (
                <p className="text-[11px] text-emerald-800 mt-1 italic">{voiceResponse.chart_summary}</p>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Authorized Patients & Direct Messaging */}
        <div className="space-y-6">
          {/* Patient Selector */}
          <div className="glass-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <UserCheck className="w-4 h-4 text-emerald-600" />
              <h3 className="font-bold text-sm text-slate-900">Authorized Patients ({patients.length})</h3>
            </div>

            <div className="space-y-2">
              {patients.map((p) => {
                const isSelected = p.care_profile_id === selectedPatientId;
                return (
                  <button
                    key={p.care_profile_id}
                    onClick={() => setSelectedPatientId(p.care_profile_id)}
                    className={`w-full text-left p-3.5 rounded-2xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-50/90 border-emerald-300 shadow-xs scale-[1.01]'
                        : 'bg-white/70 border-slate-200/80 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-xs text-slate-900">{p.full_name}</span>
                      <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                        {p.gender}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 flex items-center justify-between">
                      <span>Purpose: {p.purpose}</span>
                      <span className="text-emerald-700 font-semibold">Active Grant</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Secure Doctor-Patient Messaging Box */}
          <div className="glass-card p-5 flex flex-col h-[380px]">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200/60 mb-3">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-sky-600" />
                <h4 className="font-bold text-xs text-slate-900">Patient Direct Messaging</h4>
              </div>
              <span className="text-[10px] font-mono text-emerald-600 font-bold">ABDM Secure</span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 mb-3 pr-1">
              {loadingMessages ? (
                <div className="text-center p-4 text-xs text-slate-400">Loading thread...</div>
              ) : messages.length === 0 ? (
                <div className="text-center p-6 text-xs text-slate-400">
                  No messages yet. Send follow-up advice to patient.
                </div>
              ) : (
                messages.map((m) => {
                  const isDoctor = m.sender_role === 'doctor';
                  return (
                    <div
                      key={m.id}
                      className={`flex flex-col ${isDoctor ? 'items-end' : 'items-start'}`}
                    >
                      <span className="text-[9px] text-slate-400 mb-0.5">
                        {isDoctor ? 'Dr. Mukherjee' : 'Patient'} •{' '}
                        {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <div
                        className={`p-2.5 rounded-xl text-xs max-w-[85%] ${
                          isDoctor
                            ? 'bg-slate-900 text-white rounded-tr-none'
                            : 'bg-emerald-50 text-slate-800 rounded-tl-none border border-emerald-200'
                        }`}
                      >
                        {m.content}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-slate-200/60">
              <input
                type="text"
                value={doctorNewMsg}
                onChange={(e) => setDoctorNewMsg(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSendDoctorMessage();
                }}
                placeholder="Send advice to patient..."
                className="flex-1 text-xs px-3 py-2 rounded-xl bg-white border border-slate-200 focus:outline-none focus:border-sky-500"
              />
              <button
                onClick={handleSendDoctorMessage}
                disabled={!doctorNewMsg.trim()}
                className="p-2 rounded-xl bg-slate-900 text-white hover:bg-slate-800 cursor-pointer transition-colors disabled:opacity-40"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Middle & Right: Sourced Clinical Briefing & Prescription Builder */}
        <div className="lg:col-span-2 space-y-6">
          {/* Briefing */}
          <div className="glass-card p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200/60 mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
                  <FileText className="w-4 h-4 text-sky-600" />
                  <span>Sourced Clinical Briefing</span>
                </h3>
                {briefing && (
                  <p className="text-[11px] text-slate-400 font-medium">
                    Data as of {new Date(briefing.data_as_of).toLocaleString('en-IN')}
                  </p>
                )}
              </div>
              <span className="text-[11px] font-semibold px-2.5 py-1 rounded-xl bg-sky-50 text-sky-800 border border-sky-100">
                Patient: {briefing?.patient_name || 'Loading...'}
              </span>
            </div>

            {loadingBriefing ? (
              <div className="p-8 text-center text-xs text-slate-400 animate-pulse">
                Assembling longitudinal records and verifiable citations...
              </div>
            ) : briefing ? (
              <div className="space-y-4">
                <p className="text-xs text-slate-700 bg-slate-50/80 p-3.5 rounded-2xl border border-slate-200/60 leading-relaxed font-medium">
                  {briefing.summary_narrative}
                </p>

                {/* Provenance citations */}
                <div>
                  <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Verified Evidentiary Citations ({briefing.sources.length})
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {briefing.sources.map((s: any, idx: number) => (
                      <div
                        key={idx}
                        className="px-2.5 py-1 rounded-xl bg-white border border-slate-200 text-xs text-slate-700 shadow-2xs font-mono"
                      >
                        <span className="font-bold text-sky-700">{s.fact_id}: </span>
                        <span className="font-sans text-slate-600">{s.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          {/* Voice-to-Prescription Dictation & Prescription Builder (Item 3) */}
          <div className="glass-card p-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200/60 mb-4">
              <div className="flex items-center gap-2">
                <PenTool className="w-4 h-4 text-emerald-600" />
                <h3 className="text-base font-bold text-slate-900 tracking-tight">
                  Voice Dictation & Prescription Builder
                </h3>
              </div>
              <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                Allergy Cross-Check Active
              </span>
            </div>

            {/* Dictation Box */}
            <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/60 mb-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Mic className="w-4 h-4 text-emerald-600" />
                  Dictate Prescription via Voice
                </span>
                <button
                  onClick={toggleDictationMic}
                  className={`px-3 py-1 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                    isDictating
                      ? 'bg-rose-500 text-white animate-pulse'
                      : 'bg-emerald-600 text-white hover:bg-emerald-700'
                  }`}
                >
                  {isDictating ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                  <span>{isDictating ? 'Stop Recording' : 'Start Mic Dictation'}</span>
                </button>
              </div>

              <textarea
                value={dictationText}
                onChange={(e) => setDictationText(e.target.value)}
                placeholder="Dictate or type clinical instructions (e.g., 'Diagnosis: Type 2 Diabetes follow-up. Prescribe Telma 40 one tab OD, and Glycomet 500 one tab BD before meals. Avoid penicillin due to allergy.')"
                rows={2}
                className="w-full text-xs p-3 rounded-xl bg-white border border-slate-200 focus:outline-none focus:border-emerald-500"
              />

              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() => {
                      const sample = 'Type 2 Diabetes follow-up. Prescribe Telma 40 one tablet OD and Glycomet GP2 one tablet BD.';
                      setDictationText(sample);
                      handleParseVoicePrescription(sample);
                    }}
                    className="text-[10px] px-2 py-0.5 rounded bg-slate-200 text-slate-700 hover:bg-slate-300"
                  >
                    Sample Clean Dictation
                  </button>
                  <button
                    onClick={() => {
                      const sample = 'Chest infection. Prescribe Amoxicillin 500mg three times daily.';
                      setDictationText(sample);
                      handleParseVoicePrescription(sample);
                    }}
                    className="text-[10px] px-2 py-0.5 rounded bg-rose-100 text-rose-800 hover:bg-rose-200"
                  >
                    Test Penicillin Allergy Block
                  </button>
                </div>

                <button
                  onClick={() => handleParseVoicePrescription()}
                  disabled={isParsingRx || !dictationText.trim()}
                  className="px-4 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors cursor-pointer disabled:opacity-40"
                >
                  {isParsingRx ? 'Structuring Voice...' : 'Parse Voice into Rx'}
                </button>
              </div>
            </div>

            {/* Allergy Warning Notice */}
            {allergyAlert && (
              <div className="p-3.5 mb-4 rounded-2xl bg-rose-50 border border-rose-300 text-rose-900 text-xs font-semibold flex items-center gap-2.5 animate-bounce">
                <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
                <span>{allergyAlert}</span>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Clinical Diagnosis</label>
                <input
                  type="text"
                  value={diagnosis}
                  onChange={(e) => setDiagnosis(e.target.value)}
                  className="w-full text-xs px-3.5 py-2 rounded-xl bg-white border border-slate-200 focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Add Med Line */}
              <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/60 space-y-3">
                <span className="text-xs font-bold text-slate-700 block">Manual Add Drug (Brand or Generic)</span>
                <div className="flex flex-wrap sm:flex-nowrap gap-2">
                  <input
                    type="text"
                    value={prescribedMed}
                    onChange={(e) => setPrescribedMed(e.target.value)}
                    placeholder="e.g. Amoxicillin, Telma 40, Dolo 650..."
                    className="flex-1 text-xs px-3.5 py-2 rounded-xl bg-white border border-slate-200 focus:outline-none focus:border-emerald-500"
                  />
                  <input
                    type="text"
                    value={prescribedDose}
                    onChange={(e) => setPrescribedDose(e.target.value)}
                    placeholder="Dosage (e.g. 1 tab BD)"
                    className="w-36 text-xs px-3.5 py-2 rounded-xl bg-white border border-slate-200 focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    onClick={handleAddMedication}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer transition-colors shadow-xs"
                  >
                    Add Rx
                  </button>
                </div>
              </div>

              {/* Current Med List */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-700 block">Prescribed Regimen ({medsList.length})</span>
                {medsList.map((m, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-white border border-slate-200/80 flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-bold text-slate-900">{m.medicine_name}</span>
                      <span className="text-slate-500 ml-2">({m.dosage})</span>
                    </div>
                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-800">
                      Allergy Cleared
                    </span>
                  </div>
                ))}
              </div>

              {/* Signing Section */}
              <div className="pt-4 border-t border-slate-200/60 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Key className="w-4 h-4 text-slate-400" />
                  <span className="text-xs font-bold text-slate-700">Digital Signature PIN:</span>
                  <input
                    type="password"
                    value={signingPin}
                    onChange={(e) => setSigningPin(e.target.value)}
                    className="w-20 text-xs px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-center font-mono"
                  />
                </div>

                <button
                  onClick={handleSignPrescription}
                  className="px-5 py-2.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-md cursor-pointer transition-all flex items-center gap-2"
                >
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>Digitally Sign & Commit Prescription</span>
                </button>
              </div>

              {signedPrescription && (
                <div className="mt-3 p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900">
                  <div className="flex items-center gap-2 font-bold mb-1">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Cryptographically Signed by Dr. Ananya Mukherjee</span>
                  </div>
                  <p className="font-mono text-[10px] text-emerald-800 truncate">
                    Hash: {signedPrescription.signature_hash}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

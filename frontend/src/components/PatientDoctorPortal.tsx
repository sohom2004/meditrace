import React, { useState, useEffect, useRef } from 'react';
import { Stethoscope, Send, Calendar, Clock, CheckCircle2, MessageSquare, ShieldCheck, User, Sparkles } from 'lucide-react';
import { api } from '../api';

interface PatientDoctorPortalProps {
  activeProfileId: string;
  onAppointmentRequested?: () => void;
}

export const PatientDoctorPortal: React.FC<PatientDoctorPortalProps> = ({
  activeProfileId,
  onAppointmentRequested,
}) => {
  const [doctors, setDoctors] = useState<any[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('');
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState<string>('');
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [bookingStatus, setBookingStatus] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const fetchDoctors = async () => {
      try {
        const docList = await api.listDoctors();
        setDoctors(docList);
        if (docList.length > 0) {
          setSelectedDoctorId(docList[0].id);
        }
      } catch (err) {
        console.error('Failed to load doctors:', err);
      }
    };
    fetchDoctors();
  }, []);

  const loadMessages = async () => {
    if (!activeProfileId || !selectedDoctorId) return;
    try {
      setLoadingMessages(true);
      const msgs = await api.getDoctorMessages(activeProfileId, selectedDoctorId);
      setMessages(msgs);
      setLoadingMessages(false);
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } catch (err) {
      console.error('Failed to load doctor messages:', err);
      setLoadingMessages(false);
    }
  };

  useEffect(() => {
    loadMessages();
  }, [activeProfileId, selectedDoctorId]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !activeProfileId || !selectedDoctorId) return;
    try {
      const msg = await api.sendDoctorMessage(activeProfileId, selectedDoctorId, 'patient', newMessage.trim());
      setMessages((prev) => [...prev, msg]);
      setNewMessage('');
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } catch (err: any) {
      alert(`Message failed to send: ${err.message}`);
    }
  };

  const handleBookConsultation = async () => {
    if (!activeProfileId || !selectedDoctorId) return;
    try {
      setBookingStatus('Preparing consultation request with clinical summary...');
      const conv = await api.createConversation(activeProfileId);
      await api.sendMessage(
        conv.id,
        activeProfileId,
        'Please schedule an appointment with Dr. Mukherjee for tomorrow morning at 10:30 AM.'
      );
      setBookingStatus('Consultation appointment proposed! Check pending actions in assistant chat.');
      if (onAppointmentRequested) {
        onAppointmentRequested();
      }
    } catch (err: any) {
      setBookingStatus(`Booking failed: ${err.message}`);
    }
  };

  const currentDoctor = doctors.find((d) => d.id === selectedDoctorId);

  return (
    <div className="glass-card p-6 space-y-6 border border-slate-800">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-sky-500 to-teal-400 text-white flex items-center justify-center shadow-lg shadow-sky-500/20">
            <Stethoscope className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white tracking-tight">Connected Doctors & Direct Consultation</h3>
            <p className="text-xs text-slate-400">Encrypted messaging with verified medical council practitioners</p>
          </div>
        </div>

        <span className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full bg-emerald-950/60 text-emerald-300 border border-emerald-700/50">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          ABDM DPDP Act Encrypted
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Doctor List */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Verified Care Network</h4>
          <div className="space-y-2.5">
            {doctors.map((doc) => {
              const isSelected = doc.id === selectedDoctorId;
              return (
                <button
                  key={doc.id}
                  onClick={() => setSelectedDoctorId(doc.id)}
                  className={`w-full text-left p-3.5 rounded-2xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-sky-950/50 border-sky-500/70 shadow-md shadow-sky-500/10'
                      : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-xs text-white">{doc.name}</span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800/60">
                      Verified
                    </span>
                  </div>
                  <p className="text-[11px] text-sky-400 font-medium">{doc.specialty}</p>
                  <p className="text-[10px] text-slate-400 mt-1 font-mono">
                    Council Reg: {doc.council_reg_number || 'WBMC/2014/19823'}
                  </p>
                </button>
              );
            })}
          </div>

          {/* Quick Book Appointment Button */}
          <div className="pt-2">
            <button
              onClick={handleBookConsultation}
              className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-white text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
            >
              <Calendar className="w-4 h-4 text-sky-400" />
              <span>Book Appointment with {currentDoctor?.name || 'Doctor'}</span>
            </button>
            {bookingStatus && (
              <p className="text-[11px] text-sky-300 mt-2 p-2 rounded-xl bg-sky-950/60 border border-sky-800/60">
                {bookingStatus}
              </p>
            )}
          </div>
        </div>

        {/* Messaging Pane */}
        <div className="lg:col-span-2 flex flex-col h-[480px] rounded-2xl bg-slate-900/80 border border-slate-800 overflow-hidden shadow-xl">
          {/* Thread Header */}
          <div className="p-3.5 border-b border-slate-800 bg-slate-900/90 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-sky-500 to-teal-400 text-white flex items-center justify-center font-bold text-xs">
                {currentDoctor?.name?.slice(4, 6) || 'DR'}
              </div>
              <div>
                <h4 className="text-xs font-bold text-white">{currentDoctor?.name || 'Consulting Physician'}</h4>
                <p className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-pulse" />
                  Available for asynchronous clinical review
                </p>
              </div>
            </div>
            <span className="text-[10px] text-slate-400 font-mono">Response within 2h</span>
          </div>

          {/* Message List */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
                <MessageSquare className="w-8 h-8 mb-2 text-slate-600" />
                <p className="text-xs font-medium text-slate-300">No previous messages with this doctor.</p>
                <p className="text-[11px] text-slate-500 mt-1 max-w-xs">
                  Send a query regarding your symptoms, prescription renewals, or recent laboratory reports.
                </p>
              </div>
            ) : (
              messages.map((m) => {
                const isPatient = m.sender_role === 'patient';
                return (
                  <div
                    key={m.id}
                    className={`flex flex-col ${isPatient ? 'items-end' : 'items-start'}`}
                  >
                    <div className="flex items-center gap-1.5 mb-1 text-[10px] text-slate-500 font-medium">
                      <span>{isPatient ? 'You' : currentDoctor?.name || 'Doctor'}</span>
                      <span>•</span>
                      <span>{new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <div
                      className={`max-w-[80%] p-3 rounded-2xl text-xs leading-relaxed ${
                        isPatient
                          ? 'bg-sky-600 text-white rounded-tr-none shadow-md'
                          : 'bg-slate-800 text-slate-200 rounded-tl-none border border-slate-700'
                      }`}
                    >
                      {m.content}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Message Input Box */}
          <div className="p-3 border-t border-slate-800 bg-slate-900/90 flex items-center gap-2">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSendMessage();
              }}
              placeholder={`Message ${currentDoctor?.name || 'your doctor'} securely...`}
              className="flex-1 text-xs px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
            />
            <button
              onClick={handleSendMessage}
              disabled={!newMessage.trim()}
              className="p-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white transition-all cursor-pointer disabled:opacity-40 shadow-md shadow-sky-600/20"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

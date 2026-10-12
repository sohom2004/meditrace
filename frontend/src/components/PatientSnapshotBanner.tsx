import React from 'react';
import { AlertTriangle, Pill, Activity, Calendar, ShieldCheck, HeartPulse } from 'lucide-react';

interface SnapshotBannerProps {
  snapshot: any;
  onSelectLab?: (labName: string) => void;
}

export const PatientSnapshotBanner: React.FC<SnapshotBannerProps> = ({ snapshot, onSelectLab }) => {
  if (!snapshot || !snapshot.patient) {
    return (
      <div className="glass-card p-6 animate-pulse">
        <div className="h-4 bg-slate-200 rounded w-1/3 mb-3"></div>
        <div className="h-3 bg-slate-100 rounded w-2/3"></div>
      </div>
    );
  }

  const { patient, allergies, active_medications, recent_observations, upcoming_appointments } = snapshot;

  return (
    <section className="glass-card p-5 sm:p-6 mb-6">
      {/* Top Patient Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200/50">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-sky-400 to-indigo-500 text-white flex items-center justify-center font-bold text-lg shadow-md shadow-sky-500/15">
            {patient.name.charAt(0)}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">{patient.name}</h2>
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-semibold border border-slate-200/60 capitalize">
                {patient.relationship}
              </span>
              {patient.blood_group && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 font-semibold border border-rose-200/50">
                  {patient.blood_group}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5 font-medium">
              <span>{patient.gender}</span>
              {patient.dob && <span>• DOB: {patient.dob}</span>}
              {patient.abha_address && (
                <span className="flex items-center gap-1 text-teal-700 bg-teal-50 px-2 py-0.2 rounded font-mono text-[11px] border border-teal-200/50">
                  <ShieldCheck className="w-3 h-3" />
                  ABHA: {patient.abha_address}
                </span>
              )}
            </div>
          </div>
        </div>

        {upcoming_appointments && upcoming_appointments.length > 0 && (
          <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-sky-50/80 border border-sky-100 text-xs">
            <Calendar className="w-4 h-4 text-sky-600 shrink-0" />
            <div>
              <span className="font-semibold text-slate-900">Next Appointment: </span>
              <span className="text-sky-800 font-medium">{upcoming_appointments[0].doctor_name}</span>
              <span className="text-slate-500 ml-1">({upcoming_appointments[0].appointment_time})</span>
            </div>
          </div>
        )}
      </div>

      {/* Snapshot Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-4">
        {/* 1. Allergies */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 uppercase tracking-wider">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
            <span>Documented Allergies</span>
          </div>
          {allergies && allergies.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {allergies.map((a: any) => (
                <div
                  key={a.fact_id}
                  className="px-2.5 py-1.5 rounded-xl bg-amber-50/80 border border-amber-200/70 text-xs text-amber-900 font-medium flex items-center gap-1.5 shadow-xs"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0"></span>
                  <span className="font-semibold">{a.allergen}</span>
                  {a.reaction && <span className="text-[11px] text-amber-700">({a.reaction})</span>}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400 italic">No allergies documented (NKDA)</p>
          )}
        </div>

        {/* 2. Active Medications */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 uppercase tracking-wider">
            <Pill className="w-3.5 h-3.5 text-indigo-500" />
            <span>Active Medications ({active_medications?.length || 0})</span>
          </div>
          {active_medications && active_medications.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {active_medications.slice(0, 3).map((m: any) => (
                <div
                  key={m.fact_id}
                  className="px-2.5 py-1.5 rounded-xl bg-indigo-50/80 border border-indigo-200/70 text-xs text-indigo-900 font-medium shadow-xs"
                >
                  <span className="font-semibold">{m.medicine_name}</span>
                  <span className="text-[11px] text-indigo-600 block">{m.frequency || m.dosage}</span>
                </div>
              ))}
              {active_medications.length > 3 && (
                <span className="text-xs self-center text-slate-400 font-medium">
                  +{active_medications.length - 3} more
                </span>
              )}
            </div>
          ) : (
            <p className="text-xs text-slate-400 italic">No active prescriptions</p>
          )}
        </div>

        {/* 3. Latest Diagnostic Indicators */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 uppercase tracking-wider">
            <Activity className="w-3.5 h-3.5 text-sky-500" />
            <span>Key Diagnostic Trends</span>
          </div>
          {recent_observations && recent_observations.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {recent_observations.slice(0, 3).map((o: any) => {
                const isAbnormal = o.flag !== 'normal';
                return (
                  <button
                    key={o.fact_id}
                    onClick={() => onSelectLab && onSelectLab(o.name)}
                    className={`px-2.5 py-1.5 rounded-xl border text-xs font-medium transition-all cursor-pointer shadow-xs ${
                      isAbnormal
                        ? 'bg-rose-50/80 border-rose-200/80 text-rose-900 hover:bg-rose-100/80'
                        : 'bg-emerald-50/80 border-emerald-200/80 text-emerald-900 hover:bg-emerald-100/80'
                    }`}
                  >
                    <span className="font-semibold">{o.name}: </span>
                    <span>{o.value} {o.unit}</span>
                    <span className={`ml-1 text-[10px] uppercase font-bold px-1 rounded ${
                      isAbnormal ? 'bg-rose-200/60 text-rose-800' : 'bg-emerald-200/60 text-emerald-800'
                    }`}>
                      {o.flag}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-slate-400 italic">No recent lab observations</p>
          )}
        </div>
      </div>
    </section>
  );
};

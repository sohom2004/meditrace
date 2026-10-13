import React, { useState, useEffect } from 'react';
import {
  Activity,
  Heart,
  Pill,
  Calendar,
  AlertTriangle,
  TrendingDown,
  TrendingUp,
  Minus,
  ShieldCheck,
  Clock,
  CheckCircle2,
  ChevronRight,
  ArrowUpRight,
  Sparkles,
  FileText,
  Stethoscope,
  Mic,
  Plus,
} from 'lucide-react';
import { api } from '../api';

interface PatientDashboardProps {
  snapshot: any;
  activeProfileId: string;
  onNavigateTab: (tab: string) => void;
  onOpenReviews: () => void;
  reviewCount: number;
}

export const PatientDashboard: React.FC<PatientDashboardProps> = ({
  snapshot,
  activeProfileId,
  onNavigateTab,
  onOpenReviews,
  reviewCount,
}) => {
  const [selectedChartTest, setSelectedChartTest] = useState('HbA1c');
  const [comparison, setComparison] = useState<any>(null);
  const [trajectory, setTrajectory] = useState<any>(null);
  const [chartLoading, setChartLoading] = useState(false);
  const [takenMeds, setTakenMeds] = useState<Record<string, boolean>>({});

  const patient = snapshot?.patient || {
    name: 'Patient Profile',
    relationship: 'self',
    gender: 'Unknown',
    blood_group: 'B+',
    dob: '1985-01-01',
  };

  const allergies = snapshot?.allergies || [];
  const medications = snapshot?.active_medications || [];
  const appointments = snapshot?.upcoming_appointments || [];
  const observations = snapshot?.recent_observations || [];

  const chartTests = [
    { key: 'HbA1c', label: 'HbA1c', unit: '%' },
    { key: 'Fasting Blood Glucose', label: 'Fasting Glucose', unit: 'mg/dL' },
    { key: 'Serum Creatinine', label: 'Creatinine', unit: 'mg/dL' },
    { key: 'Hemoglobin', label: 'Hemoglobin', unit: 'g/dL' },
  ];

  useEffect(() => {
    const fetchComparisonAndTrajectory = async () => {
      if (!activeProfileId) return;
      try {
        setChartLoading(true);
        const [compRes, trajRes] = await Promise.allSettled([
          api.compareObservations(activeProfileId, selectedChartTest),
          api.getTrajectories(activeProfileId, selectedChartTest),
        ]);
        if (compRes.status === 'fulfilled') {
          setComparison(compRes.value);
        } else {
          setComparison(null);
        }
        if (trajRes.status === 'fulfilled') {
          setTrajectory(trajRes.value);
        } else {
          setTrajectory(null);
        }
      } catch (e) {
        setComparison(null);
        setTrajectory(null);
      } finally {
        setChartLoading(false);
      }
    };
    fetchComparisonAndTrajectory();
  }, [activeProfileId, selectedChartTest]);

  const toggleMedTaken = (name: string) => {
    setTakenMeds((prev) => ({ ...prev, [name]: !prev[name] }));
  };

  return (
    <div className="space-y-6">
      {/* 1. Header Profile & Glance Summary */}
      <div className="glass-card p-5 sm:p-6 relative overflow-hidden border border-slate-800">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-sky-500 to-teal-400 text-white flex items-center justify-center font-bold text-xl shadow-lg shadow-sky-500/20">
              {patient.name?.charAt(0) || 'P'}
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">{patient.name}</h1>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 capitalize font-medium">
                  {patient.relationship}
                </span>
                {patient.blood_group && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-rose-950/70 text-rose-300 border border-rose-800/40 font-mono font-semibold">
                    {patient.blood_group}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 mt-1">
                <span>{patient.gender}</span>
                {patient.dob && <span>• DOB: {patient.dob}</span>}
                {patient.abha_address && (
                  <span className="flex items-center gap-1 text-teal-400 font-mono bg-teal-950/40 px-2 py-0.5 rounded border border-teal-800/40">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    ABHA: {patient.abha_address}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {appointments && appointments.length > 0 && (
              <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900/90 border border-slate-800 text-xs">
                <Calendar className="w-4 h-4 text-sky-400 shrink-0" />
                <div>
                  <span className="text-slate-400">Next Visit: </span>
                  <span className="text-white font-semibold">{appointments[0].doctor_name}</span>
                  <span className="text-sky-400 ml-1.5 font-mono">({appointments[0].appointment_time})</span>
                </div>
              </div>
            )}

            {reviewCount > 0 && (
              <button
                onClick={onOpenReviews}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-950/60 hover:bg-amber-900/60 text-amber-300 border border-amber-600/50 text-xs font-semibold transition-all shadow-md"
              >
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <span>{reviewCount} Items To Review</span>
              </button>
            )}
          </div>
        </div>

        {/* Documented Allergies Alert Bar */}
        {allergies && allergies.length > 0 && (
          <div className="mt-4 pt-3.5 border-t border-slate-800/80 flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" />
              Documented Allergies:
            </span>
            {allergies.map((a: any) => (
              <span
                key={a.fact_id}
                className="px-2.5 py-1 rounded-lg bg-amber-950/40 border border-amber-600/40 text-amber-200 text-xs font-medium flex items-center gap-1.5"
              >
                <span>{a.allergen}</span>
                <span className="text-[10px] text-amber-400 font-mono">({a.severity || 'Recorded'})</span>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* 2. Key Clinical Metrics Grid (Dynamic Findings Tiles) */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
            <Activity className="w-4 h-4 text-sky-400" />
            Key Clinical Vitals & Lab Metrics
          </h2>
          <span className="text-xs text-slate-500 font-mono">
            {observations.length > 0 ? `${observations.length} Findings Grounded` : 'No Recorded Labs'}
          </span>
        </div>

        {(() => {
          const getObsVal = (obs: any) => {
            if (!obs) return '—';
            if (obs.value !== undefined && obs.value !== null) return obs.value;
            if (obs.value_numeric !== undefined && obs.value_numeric !== null) return obs.value_numeric;
            return '—';
          };

          const findObs = (keywords: string[]) => {
            return observations.find((o: any) => {
              const name = (o.name || o.display_name || '').toLowerCase();
              const code = (o.code_loinc || o.code || '').toLowerCase();
              return keywords.some((k) => name.includes(k.toLowerCase()) || code.includes(k.toLowerCase()));
            });
          };

          const glucoseObs = findObs(['fasting', 'glucose', '1558-6', 'sugar']);
          const hba1cObs = findObs(['hba1c', 'glycated', '4548-4']);
          const bpSysObs = findObs(['systolic', '8480-6']);
          const bpDiaObs = findObs(['diastolic', '8462-4']);
          const bpGeneralObs = findObs(['pressure', 'bp', '85354-9']);
          const bpObs = bpSysObs || bpGeneralObs;
          const creatObs = findObs(['creatinine', '2160-0', 'renal']);

          const glucoseVal = getObsVal(glucoseObs);
          const hba1cVal = getObsVal(hba1cObs);
          const bpVal = bpSysObs && bpDiaObs
            ? `${getObsVal(bpSysObs)}/${getObsVal(bpDiaObs)}`
            : bpObs ? `${getObsVal(bpObs)}` : '—';
          const creatVal = getObsVal(creatObs);

          return (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Tile 1: Fasting Glucose (Emerald) */}
              <div className="p-4 rounded-2xl glass-card tile-emerald glass-card-hover">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-emerald-400">Fasting Blood Glucose</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800/50 font-mono">
                    LOINC 1558-6
                  </span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-white tracking-tight">
                    {glucoseVal}
                  </span>
                  <span className="text-xs text-emerald-300 font-medium">
                    {glucoseObs?.unit || 'mg/dL'}
                  </span>
                </div>
                <div className="mt-2 text-[11px] text-emerald-400 flex items-center gap-1">
                  {glucoseObs && glucoseVal !== '—' ? (
                    glucoseObs.flag === 'normal' ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Normal fasting level</span>
                      </>
                    ) : (
                      <>
                        <TrendingUp className="w-3.5 h-3.5 text-rose-400" />
                        <span className="text-rose-400">
                          {glucoseObs.flag === 'abnormal_high' ? 'Elevated reading' : 'Borderline reading'}
                        </span>
                      </>
                    )
                  ) : (
                    <span className="text-slate-500">No report finding recorded</span>
                  )}
                </div>
                <div className="mt-2 text-[10px] text-slate-400">
                  {glucoseObs?.reference_range_low && glucoseObs?.reference_range_high
                    ? `Target: ${glucoseObs.reference_range_low} - ${glucoseObs.reference_range_high} ${glucoseObs.unit}`
                    : 'Target Range: 70 - 99 mg/dL'}
                </div>
              </div>

              {/* Tile 2: HbA1c (Purple) */}
              <div className="p-4 rounded-2xl glass-card tile-purple glass-card-hover">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-purple-400">Glycated Hemoglobin</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-950 text-purple-300 border border-purple-800/50 font-mono">
                    LOINC 4548-4
                  </span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-white tracking-tight">
                    {hba1cVal}
                  </span>
                  <span className="text-xs text-purple-300 font-medium">
                    {hba1cObs?.unit || '%'}
                  </span>
                </div>
                <div className="mt-2 text-[11px] flex items-center gap-1">
                  {hba1cObs && hba1cVal !== '—' ? (
                    Number(hba1cVal) <= 6.5 ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400">Normal Glycemic Index</span>
                      </>
                    ) : Number(hba1cVal) <= 7.0 ? (
                      <>
                        <TrendingDown className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400">Controlled (Diabetic Goal)</span>
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                        <span className="text-amber-400">Suboptimal Control</span>
                      </>
                    )
                  ) : (
                    <span className="text-slate-500">No report finding recorded</span>
                  )}
                </div>
                <div className="mt-2 text-[10px] text-slate-400">
                  {hba1cObs?.reference_range_low && hba1cObs?.reference_range_high
                    ? `Reference: ${hba1cObs.reference_range_low} - ${hba1cObs.reference_range_high}%`
                    : 'Goal: < 7.0% for Diabetics'}
                </div>
              </div>

              {/* Tile 3: Blood Pressure (Sky) */}
              <div className="p-4 rounded-2xl glass-card tile-sky glass-card-hover">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-sky-400">Blood Pressure</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-950 text-sky-300 border border-sky-800/50 font-mono">
                    LOINC 85354-9
                  </span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-white tracking-tight">
                    {bpVal}
                  </span>
                  <span className="text-xs text-sky-300 font-medium">
                    {bpObs?.unit || 'mmHg'}
                  </span>
                </div>
                <div className="mt-2 text-[11px] text-sky-300 flex items-center gap-1">
                  {bpObs && bpVal !== '—' ? (
                    bpObs.flag === 'normal' ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-sky-400" />
                        <span>Optimal range recorded</span>
                      </>
                    ) : (
                      <>
                        <Minus className="w-3.5 h-3.5 text-sky-400" />
                        <span>{bpObs.observed_at ? `Observed ${new Date(bpObs.observed_at).toLocaleDateString()}` : 'Active Monitoring'}</span>
                      </>
                    )
                  ) : (
                    <span className="text-slate-500">No report finding recorded</span>
                  )}
                </div>
                <div className="mt-2 text-[10px] text-slate-400">Standard: &lt; 130/80 mmHg</div>
              </div>

              {/* Tile 4: Serum Creatinine (Amber) */}
              <div className="p-4 rounded-2xl glass-card tile-amber glass-card-hover">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-amber-400">Serum Creatinine</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-800/50 font-mono">
                    LOINC 2160-0
                  </span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-white tracking-tight">
                    {creatVal}
                  </span>
                  <span className="text-xs text-amber-300 font-medium">
                    {creatObs?.unit || 'mg/dL'}
                  </span>
                </div>
                <div className="mt-2 text-[11px] text-emerald-400 flex items-center gap-1">
                  {creatObs && creatVal !== '—' ? (
                    creatObs.flag === 'normal' ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Normal Renal Clearance</span>
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                        <span className="text-rose-400">Abnormal Renal Index</span>
                      </>
                    )
                  ) : (
                    <span className="text-slate-500">No report finding recorded</span>
                  )}
                </div>
                <div className="mt-2 text-[10px] text-slate-400">
                  {creatObs?.reference_range_low && creatObs?.reference_range_high
                    ? `Reference: ${creatObs.reference_range_low} - ${creatObs.reference_range_high} ${creatObs.unit}`
                    : 'Reference: 0.6 - 1.2 mg/dL'}
                </div>
              </div>
            </div>
          );
        })()}
      </div>

      {/* 3. Medication Reminders & Schedules */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Medication Schedule List (2 cols) */}
        <div className="lg:col-span-2 glass-card p-5 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Pill className="w-4 h-4 text-sky-400" />
                Medication Reminders & Daily Doses
              </h3>
              <p className="text-xs text-slate-400">
                Track doses taken today and monitor refill stock
              </p>
            </div>
            <button
              onClick={() => onNavigateTab('pharmacy')}
              className="text-xs font-semibold text-sky-400 hover:text-sky-300 flex items-center gap-1 transition-colors"
            >
              <span>Refill Orders</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-2.5">
            {medications.length > 0 ? (
              medications.map((m: any) => {
                const isTaken = !!takenMeds[m.medicine_name];
                return (
                  <div
                    key={m.fact_id}
                    className={`p-3.5 rounded-xl border transition-all flex items-center justify-between ${
                      isTaken
                        ? 'bg-slate-900/40 border-slate-800 opacity-70'
                        : 'bg-slate-900/80 border-slate-800 hover:border-sky-500/30'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                        isTaken ? 'bg-slate-800 text-slate-500' : 'bg-sky-500/20 text-sky-400'
                      }`}>
                        <Pill className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-bold ${isTaken ? 'line-through text-slate-400' : 'text-white'}`}>
                            {m.medicine_name}
                          </span>
                          <span className="text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                            {m.dosage}
                          </span>
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5">
                          <span>{m.frequency}</span>
                          {m.generic_name && <span> • {m.generic_name}</span>}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => toggleMedTaken(m.medicine_name)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                        isTaken
                          ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-700/60'
                          : 'bg-slate-800 hover:bg-sky-600 text-slate-300 hover:text-white border border-slate-700'
                      }`}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{isTaken ? 'Dose Taken' : 'Mark Taken'}</span>
                    </button>
                  </div>
                );
              })
            ) : (
              <div className="p-6 text-center text-slate-400 text-xs">
                No active medications recorded for this care profile.
              </div>
            )}
          </div>
        </div>

        {/* Quick Assistant & Voice Trigger (1 col) */}
        <div className="glass-card p-5 border border-slate-800 flex flex-col justify-between space-y-4">
          <div>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-500 to-teal-400 text-white flex items-center justify-center mb-3 shadow-md shadow-sky-500/20">
              <Mic className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white tracking-tight">Voice-First Clinical Dialogue</h3>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Natasha is equipped with continuous voice conversation to explain lab results, identify medication conflicts, and summarize your medical history.
            </p>
          </div>

          <div className="space-y-2">
            <button
              onClick={() => onNavigateTab('chat')}
              className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-sky-500 to-teal-500 hover:from-sky-400 hover:to-teal-400 text-white font-semibold text-xs shadow-lg shadow-sky-500/25 flex items-center justify-center gap-2 transition-all"
            >
              <Mic className="w-4 h-4" />
              <span>Launch Continuous Voice</span>
            </button>
            <button
              onClick={() => onNavigateTab('reports')}
              className="w-full py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Upload Report or Prescription</span>
            </button>
          </div>
        </div>
      </div>

      {/* 4. Deterministic Observation Trends & Simple Interactive Chart */}
      <div className="glass-card p-5 border border-slate-800">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-400" />
              Deterministic Observation Trends
            </h3>
            <p className="text-xs text-slate-400">
              Deterministic mathematical comparison with unit alignment
            </p>
          </div>

          {/* Selector pills */}
          <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-slate-900 border border-slate-800">
            {chartTests.map((t) => (
              <button
                key={t.key}
                onClick={() => setSelectedChartTest(t.key)}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                  selectedChartTest === t.key
                    ? 'bg-sky-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Chart Card Content */}
        {chartLoading ? (
          <div className="p-8 text-center text-slate-400 text-xs animate-pulse">
            Computing mathematical delta and trends...
          </div>
        ) : comparison ? (
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2 p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs text-slate-400">Current Reading</span>
                    <div className="text-xl font-bold text-white">
                      {comparison.current_value} {comparison.normalized_unit}
                    </div>
                    <span className="text-[11px] text-slate-500 font-mono">Date: {comparison.current_date}</span>
                  </div>

                  {comparison.previous_value !== null && (
                    <div className="text-right">
                      <span className="text-xs text-slate-400">Previous Reading</span>
                      <div className="text-xl font-bold text-slate-300">
                        {comparison.previous_value} {comparison.normalized_unit}
                      </div>
                      <span className="text-[11px] text-slate-500 font-mono">Date: {comparison.previous_date}</span>
                    </div>
                  )}
                </div>

                {/* Simple Visual Trend Bar */}
                <div className="space-y-1.5 pt-2">
                  <div className="flex justify-between text-[11px] text-slate-400">
                    <span>Delta: {comparison.delta !== null ? (comparison.delta > 0 ? `+${comparison.delta}` : comparison.delta) : 'N/A'} {comparison.normalized_unit}</span>
                    <span>Percentage: {comparison.delta_percentage !== null ? `${comparison.delta_percentage}%` : 'Baseline'}</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        comparison.trend_direction === 'down'
                          ? 'bg-emerald-500 w-3/4'
                          : comparison.trend_direction === 'up'
                          ? 'bg-rose-500 w-4/5'
                          : 'bg-sky-500 w-1/2'
                      }`}
                    />
                  </div>
                </div>
              </div>

              {/* Clinical Interpretation Tile */}
              <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 flex flex-col justify-between">
                <div>
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Code-Verified Interpretation
                  </span>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {comparison.interpretation_note}
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between">
                  <span className="text-[10px] text-slate-500">Status Flag:</span>
                  <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                    comparison.status_flag === 'critical'
                      ? 'bg-rose-950 text-rose-300 border border-rose-800'
                      : comparison.status_flag === 'high'
                      ? 'bg-amber-950 text-amber-300 border border-amber-800'
                      : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                  }`}>
                    {comparison.status_flag?.toUpperCase() || 'NORMAL'}
                  </span>
                </div>
              </div>
            </div>

            {/* Dynamic Graph Trajectory & Provenance Timeline */}
            {trajectory?.data_points && trajectory.data_points.length > 0 && (
              <div className="p-4 rounded-2xl bg-slate-900/40 border border-slate-800/90 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-sky-400 uppercase tracking-wider">
                      Longitudinal Graph Trajectory
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-950 text-sky-300 border border-sky-800/50 font-mono">
                      {trajectory.data_points.length} Reports Linked
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-500 font-mono">
                    Deterministic temporal sequence
                  </span>
                </div>

                {/* SVG Line Chart for 2+ Points */}
                {trajectory.data_points.length >= 2 ? (
                  <div className="w-full overflow-x-auto py-2">
                    {(() => {
                      const pts = trajectory.data_points;
                      const vals = pts.map((p: any) => Number(p.value));
                      const minV = Math.min(...vals);
                      const maxV = Math.max(...vals);
                      const range = maxV === minV ? 1 : maxV - minV;
                      const svgW = 560;
                      const svgH = 140;
                      const padX = 50;
                      const padY = 24;
                      const plotW = svgW - padX * 2;
                      const plotH = svgH - padY * 2;

                      const coords = pts.map((p: any, idx: number) => {
                        const x = padX + (idx / (pts.length - 1)) * plotW;
                        const y = padY + plotH - ((Number(p.value) - minV) / range) * plotH;
                        return { x, y, p };
                      });

                      const pathD = coords.reduce(
                        (acc: string, curr: any, i: number) =>
                          i === 0 ? `M ${curr.x} ${curr.y}` : `${acc} L ${curr.x} ${curr.y}`,
                        ''
                      );
                      const areaD = `${pathD} L ${coords[coords.length - 1].x} ${svgH - padY} L ${coords[0].x} ${svgH - padY} Z`;

                      return (
                        <div className="relative">
                          <svg
                            viewBox={`0 0 ${svgW} ${svgH}`}
                            className="w-full h-36 overflow-visible"
                          >
                            <defs>
                              <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.25" />
                                <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.0" />
                              </linearGradient>
                            </defs>
                            {/* Gridlines */}
                            <line
                              x1={padX}
                              y1={padY + plotH}
                              x2={svgW - padX}
                              y2={padY + plotH}
                              stroke="#334155"
                              strokeDasharray="3 3"
                            />
                            <line
                              x1={padX}
                              y1={padY}
                              x2={svgW - padX}
                              y2={padY}
                              stroke="#334155"
                              strokeDasharray="3 3"
                            />
                            {/* Fill and Line */}
                            <path d={areaD} fill="url(#areaGradient)" />
                            <path
                              d={pathD}
                              fill="none"
                              stroke="#38bdf8"
                              strokeWidth="2.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                            {/* Points */}
                            {coords.map((c: any, i: number) => (
                              <g key={i}>
                                <circle
                                  cx={c.x}
                                  cy={c.y}
                                  r="5"
                                  className="fill-sky-400 stroke-slate-900 stroke-2 hover:r-7 transition-all cursor-pointer"
                                />
                                <text
                                  x={c.x}
                                  y={c.y - 10}
                                  textAnchor="middle"
                                  className="fill-white text-[11px] font-bold font-mono"
                                >
                                  {c.p.value} {c.p.unit}
                                </text>
                                <text
                                  x={c.x}
                                  y={svgH - 6}
                                  textAnchor="middle"
                                  className="fill-slate-400 text-[10px] font-mono"
                                >
                                  {c.p.date ? new Date(c.p.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : `Pt ${i+1}`}
                                </text>
                              </g>
                            ))}
                          </svg>
                        </div>
                      );
                    })()}
                  </div>
                ) : (
                  <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-xs text-slate-400 flex items-center justify-between">
                    <span>Baseline single report reading ({trajectory.data_points[0].value} {trajectory.data_points[0].unit}).</span>
                    <span className="text-slate-500">Upload subsequent reports to visualize temporal slope.</span>
                  </div>
                )}

                {/* Provenance Steps List */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 pt-1">
                  {trajectory.data_points.map((pt: any, idx: number) => (
                    <div
                      key={pt.node_id || idx}
                      className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800/80 text-xs space-y-1 hover:border-sky-500/30 transition-all"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-white">
                          Point #{idx + 1}: {pt.value} {pt.unit}
                        </span>
                        {pt.delta !== null && (
                          <span
                            className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-bold ${
                              pt.trend_direction === 'down'
                                ? 'bg-emerald-950 text-emerald-400'
                                : pt.trend_direction === 'up'
                                ? 'bg-rose-950 text-rose-400'
                                : 'bg-slate-800 text-slate-300'
                            }`}
                          >
                            {pt.delta > 0 ? `+${pt.delta}` : pt.delta} ({pt.delta_percentage}%)
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 truncate">
                        📄 {pt.document_title || 'Ingested Report'}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        Date: {pt.date || 'Recorded'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800 text-center text-xs text-slate-400">
            No historical records found for {selectedChartTest} on this profile. Upload a lab report in the Reports section to populate data points.
          </div>
        )}
      </div>
    </div>
  );
};

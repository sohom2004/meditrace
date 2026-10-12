import React, { useState, useEffect } from 'react';
import { TrendingDown, TrendingUp, Minus, Activity, ArrowRight, ShieldCheck } from 'lucide-react';
import { api } from '../api';

interface ObservationChartsProps {
  activeProfileId: string;
  selectedTestName?: string;
}

export const ObservationCharts: React.FC<ObservationChartsProps> = ({
  activeProfileId,
  selectedTestName = 'HbA1c',
}) => {
  const [activeTest, setActiveTest] = useState(selectedTestName);
  const [comparison, setComparison] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const tests = [
    { key: 'HbA1c', label: 'Hemoglobin A1c (HbA1c)', unit: '%' },
    { key: 'Fasting Blood Glucose', label: 'Fasting Blood Glucose', unit: 'mg/dL' },
    { key: 'Hemoglobin', label: 'Hemoglobin', unit: 'g/dL' },
    { key: 'Serum Creatinine', label: 'Serum Creatinine', unit: 'mg/dL' },
  ];

  useEffect(() => {
    if (selectedTestName) {
      setActiveTest(selectedTestName);
    }
  }, [selectedTestName]);

  useEffect(() => {
    const fetchComparison = async () => {
      try {
        setLoading(true);
        const res = await api.compareObservations(activeProfileId, activeTest);
        setComparison(res);
        setLoading(false);
      } catch (err) {
        setComparison(null);
        setLoading(false);
      }
    };
    fetchComparison();
  }, [activeProfileId, activeTest]);

  const renderTrendIcon = (direction: string) => {
    switch (direction) {
      case 'down':
        return <TrendingDown className="w-5 h-5 text-emerald-600" />;
      case 'up':
        return <TrendingUp className="w-5 h-5 text-rose-600" />;
      case 'stable':
        return <Minus className="w-5 h-5 text-sky-600" />;
      default:
        return <Activity className="w-5 h-5 text-indigo-600" />;
    }
  };

  return (
    <div className="glass-card p-5 mb-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Activity className="w-5 h-5 text-emerald-600" />
            <span>Deterministic Observation Comparison</span>
          </h3>
          <p className="text-xs text-slate-500 font-medium">
            Mathematical trend calculation & unit alignment computed deterministically in code
          </p>
        </div>

        {/* Test Selector Tabs */}
        <div className="flex flex-wrap gap-1.5 p-1 rounded-xl bg-slate-100/80 border border-slate-200/60 text-xs">
          {tests.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTest(t.key)}
              className={`px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                activeTest === t.key
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              {t.key}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="p-8 text-center text-xs text-slate-400 animate-pulse">
          Computing unit conversions and clinical delta...
        </div>
      ) : comparison ? (
        <div className="p-5 rounded-2xl bg-gradient-to-br from-white/90 to-slate-50/70 border border-slate-200/80 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center">
                {renderTrendIcon(comparison.trend_direction)}
              </div>
              <div>
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Current Reading
                </span>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-black text-slate-900 tracking-tight">
                    {comparison.current_value}
                  </span>
                  <span className="text-xs font-bold text-slate-500">{comparison.normalized_unit}</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                    comparison.status_flag === 'normal'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-rose-100 text-rose-800'
                  }`}>
                    {comparison.status_flag}
                  </span>
                </div>
              </div>
            </div>

            {comparison.previous_value !== null && (
              <div className="flex items-center gap-3 px-4 py-2 rounded-xl bg-slate-100/80 text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 block font-medium">Previous Baseline</span>
                  <span className="font-bold text-slate-700">
                    {comparison.previous_value} {comparison.normalized_unit}
                  </span>
                  <span className="text-[10px] text-slate-400 block">({comparison.previous_date})</span>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400" />
                <div>
                  <span className="text-[10px] text-slate-400 block font-medium">Calculated Delta</span>
                  <span className={`font-bold ${
                    comparison.delta < 0 ? 'text-emerald-700' : 'text-rose-700'
                  }`}>
                    {comparison.delta > 0 ? `+${comparison.delta}` : comparison.delta} {comparison.normalized_unit}
                  </span>
                  <span className="text-[10px] text-slate-500 block">({comparison.delta_percentage}%)</span>
                </div>
              </div>
            )}
          </div>

          <p className="text-xs text-slate-600 bg-white/80 p-3 rounded-xl border border-slate-200/50 leading-relaxed font-medium">
            <span className="font-bold text-slate-800">Deterministic Clinical Note: </span>
            {comparison.interpretation_note}
          </p>
        </div>
      ) : (
        <div className="p-6 text-center text-xs text-slate-400 italic">
          No observations recorded for {activeTest}. Upload a diagnostic report to track this trend.
        </div>
      )}
    </div>
  );
};

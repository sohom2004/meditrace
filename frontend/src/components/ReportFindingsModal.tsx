import React, { useState, useEffect } from 'react';
import {
  X,
  FileText,
  Activity,
  Pill,
  AlertTriangle,
  TrendingDown,
  TrendingUp,
  Minus,
  ShieldCheck,
  Share2,
  Calendar,
  CheckCircle2,
  Layers,
} from 'lucide-react';
import { api } from '../api';

interface ReportFindingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentId: string | null;
  documentName: string;
}

export const ReportFindingsModal: React.FC<ReportFindingsModalProps> = ({
  isOpen,
  onClose,
  documentId,
  documentName,
}) => {
  const [reportData, setReportData] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen || !documentId) return;

    const fetchFindings = async () => {
      try {
        setLoading(true);
        const data = await api.getReportFindings(documentId);
        setReportData(data);
      } catch (err) {
        console.error('Failed to load report findings:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchFindings();
  }, [isOpen, documentId]);

  if (!isOpen || !documentId) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="glass-modal w-full max-w-2xl rounded-3xl p-6 sm:p-7 relative border border-slate-700/80 shadow-2xl overflow-hidden max-h-[85vh] flex flex-col">
        {/* Glow backdrop */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 pb-4 border-b border-slate-800 shrink-0">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-sky-500 to-teal-400 text-white flex items-center justify-center shadow-lg shadow-sky-500/20">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
              <span>Report Findings & Graph Provenance</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-950 text-sky-400 border border-sky-800/50 font-mono">
                LOINC & ATC Mapped
              </span>
            </h2>
            <p className="text-xs text-slate-400 truncate max-w-md">{documentName}</p>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto py-4 space-y-4">
          {loading ? (
            <div className="p-12 text-center text-xs text-slate-400 animate-pulse">
              Traversing report findings and temporal graph edges...
            </div>
          ) : reportData && reportData.findings && reportData.findings.length > 0 ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-400 px-1">
                <span>Extracted Entities ({reportData.findings.length})</span>
                <span>Report Date: {reportData.uploaded_at ? new Date(reportData.uploaded_at).toLocaleDateString() : 'Recorded'}</span>
              </div>

              {reportData.findings.map((item: any, idx: number) => {
                const isObs = item.type === 'finding';
                const isMed = item.type === 'medication';
                const isCond = item.type === 'condition';

                return (
                  <div
                    key={item.id || idx}
                    className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 hover:border-slate-700 transition-all space-y-2"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <div className={`p-2 rounded-xl ${
                          isObs ? 'bg-sky-500/20 text-sky-400' : isMed ? 'bg-purple-500/20 text-purple-400' : 'bg-emerald-500/20 text-emerald-400'
                        }`}>
                          {isObs ? <Activity className="w-4 h-4" /> : isMed ? <Pill className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-white">{item.label}</span>
                            <span className="text-[10px] uppercase font-semibold px-2 py-0.2 rounded bg-slate-800 text-slate-300 font-mono">
                              {item.type}
                            </span>
                          </div>
                          {item.code && (
                            <span className="text-[10px] text-slate-400 font-mono block mt-0.5">
                              Canonical: {item.code}
                            </span>
                          )}
                        </div>
                      </div>

                      {item.value !== null && item.value !== undefined ? (
                        <div className="text-right">
                          <div className="text-base font-bold text-white">
                            {item.value} <span className="text-xs font-normal text-slate-400">{item.unit}</span>
                          </div>
                          {item.flag && (
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full inline-block mt-0.5 ${
                              item.flag === 'critical' || item.flag.includes('critical')
                                ? 'bg-rose-950 text-rose-300 border border-rose-800'
                                : item.flag === 'high' || item.flag === 'abnormal'
                                ? 'bg-amber-950 text-amber-300 border border-amber-800'
                                : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                            }`}>
                              {item.flag.toUpperCase()}
                            </span>
                          )}
                        </div>
                      ) : (
                        item.properties?.dosage && (
                          <span className="text-xs text-purple-300 font-mono bg-purple-950/60 px-2 py-0.5 rounded border border-purple-800/40">
                            {item.properties.dosage}
                          </span>
                        )
                      )}
                    </div>

                    {/* Temporal Edge Comparison (Delta vs past reports) */}
                    {item.comparison && (
                      <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5 text-emerald-400">
                          {item.comparison.trend === 'improved' ? (
                            <TrendingDown className="w-3.5 h-3.5 text-emerald-400" />
                          ) : item.comparison.trend === 'worsened' ? (
                            <TrendingUp className="w-3.5 h-3.5 text-rose-400" />
                          ) : (
                            <Minus className="w-3.5 h-3.5 text-sky-400" />
                          )}
                          <span className="text-[11px] text-slate-300">
                            {item.comparison.comparison_text || `Delta: ${item.comparison.delta} ${item.unit} (${item.comparison.delta_percentage}%)`}
                          </span>
                        </div>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded uppercase font-mono ${
                          item.comparison.trend === 'improved'
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/60'
                            : item.comparison.trend === 'worsened'
                            ? 'bg-rose-950 text-rose-300 border border-rose-800/60'
                            : 'bg-slate-800 text-slate-300'
                        }`}>
                          {item.comparison.trend}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-12 text-center text-xs text-slate-400 border border-slate-800/80 rounded-2xl bg-slate-900/30">
              No structured findings recorded for this document.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-slate-800 flex items-center justify-between shrink-0">
          <span className="text-[11px] text-slate-500 font-mono">
            Graph Node ID: {documentId}
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

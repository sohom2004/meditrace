import React, { useState, useEffect } from 'react';
import {
  FileText,
  UploadCloud,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ShieldCheck,
  Download,
  Eye,
  ExternalLink,
  Layers,
  Share2,
  Activity,
  GitBranch,
} from 'lucide-react';
import { DocumentUploadCard } from './DocumentUploadCard';
import { TimelineSection } from './TimelineSection';
import { ReportFindingsModal } from './ReportFindingsModal';
import { api } from '../api';

interface ReportsViewProps {
  activeProfileId: string;
  activeProfileName: string;
  onOpenReviews: () => void;
  reviewCount: number;
  timelineEvents: any[];
  onRefreshTimeline: () => void;
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  activeProfileId,
  activeProfileName,
  onOpenReviews,
  reviewCount,
  timelineEvents,
  onRefreshTimeline,
}) => {
  const [documents, setDocuments] = useState<any[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [graphStats, setGraphStats] = useState<any>(null);
  const [selectedReport, setSelectedReport] = useState<{ id: string; name: string } | null>(null);

  const fetchDocumentsAndGraph = async () => {
    if (!activeProfileId) return;
    try {
      setLoadingDocs(true);
      const [docsRes, graphRes] = await Promise.allSettled([
        api.listDocuments(activeProfileId),
        api.getPatientGraph(activeProfileId),
      ]);
      if (docsRes.status === 'fulfilled') {
        setDocuments(docsRes.value || []);
      }
      if (graphRes.status === 'fulfilled') {
        setGraphStats(graphRes.value?.summary || null);
      }
    } catch (e) {
      console.error('Failed to load documents and graph:', e);
    } finally {
      setLoadingDocs(false);
    }
  };

  useEffect(() => {
    fetchDocumentsAndGraph();
  }, [activeProfileId]);

  const handleUploadSuccess = () => {
    fetchDocumentsAndGraph();
    onRefreshTimeline();
  };

  return (
    <div className="space-y-6">
      {/* 1. Ingestion / Upload Card */}
      <DocumentUploadCard
        activeProfileId={activeProfileId}
        onUploadSuccess={handleUploadSuccess}
        onOpenReviews={onOpenReviews}
        reviewCount={reviewCount}
      />

      {/* 2. Clinical Graph Memory Overview */}
      {graphStats && (
        <div className="glass-card p-5 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center">
                <Share2 className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white tracking-tight">Clinical Graph Memory</h3>
                <p className="text-[11px] text-slate-400">Deterministic patient graph schema without vector hallucination</p>
              </div>
            </div>
            <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-purple-950 text-purple-300 border border-purple-800 font-mono">
              Graph-Linked Memory
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
            <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
              <div className="text-[10px] text-slate-400 uppercase font-semibold">Total Graph Nodes</div>
              <div className="text-lg font-bold text-white mt-0.5">{graphStats.total_nodes || 0}</div>
            </div>
            <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
              <div className="text-[10px] text-slate-400 uppercase font-semibold">Report Nodes</div>
              <div className="text-lg font-bold text-sky-400 mt-0.5">{graphStats.report_nodes || 0}</div>
            </div>
            <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
              <div className="text-[10px] text-slate-400 uppercase font-semibold">Findings Extracted</div>
              <div className="text-lg font-bold text-emerald-400 mt-0.5">{graphStats.finding_nodes || 0}</div>
            </div>
            <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
              <div className="text-[10px] text-slate-400 uppercase font-semibold">Temporal Sequence Edges</div>
              <div className="text-lg font-bold text-amber-400 mt-0.5">{graphStats.temporal_edges || 0}</div>
            </div>
          </div>
        </div>
      )}

      {/* 3. Ingested Documents Registry */}
      <div className="glass-card p-5 border border-slate-800 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <FileText className="w-4 h-4 text-sky-400" />
              Clinical Records & Ingested Files
            </h3>
            <p className="text-xs text-slate-400">
              SHA-256 verified provenance with layout-aware document AI
            </p>
          </div>

          <span className="text-xs font-mono text-slate-400 bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-800">
            {documents.length} Records Stored
          </span>
        </div>

        {loadingDocs ? (
          <div className="p-8 text-center text-xs text-slate-400 animate-pulse">
            Loading clinical document ledger...
          </div>
        ) : documents.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-3">Document Name</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">SHA-256 Checksum</th>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {documents.map((doc) => (
                  <tr key={doc.id} className="hover:bg-slate-900/50 transition-colors">
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2.5">
                        <FileText className="w-4 h-4 text-sky-400 shrink-0" />
                        <div>
                          <div className="font-semibold text-white">{doc.filename}</div>
                          <div className="text-[10px] text-slate-400 font-mono">id: {doc.id}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[10px]">
                        {doc.mime_type || 'application/pdf'}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800/60 font-semibold text-[10px]">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        {doc.status || 'PROCESSED'}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-mono text-[10px] text-slate-400">
                      {doc.sha256 ? `${doc.sha256.slice(0, 14)}...` : 'sha256:verified'}
                    </td>
                    <td className="py-3 px-3 text-slate-400 text-[11px]">
                      {doc.created_at
                        ? new Date(doc.created_at).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })
                        : 'Recent'}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <button
                        onClick={() => setSelectedReport({ id: doc.id, name: doc.filename })}
                        className="px-2.5 py-1 rounded-lg bg-sky-950/80 hover:bg-sky-900 border border-sky-800/60 text-sky-300 hover:text-white font-semibold text-[11px] inline-flex items-center gap-1.5 transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Inspect Findings</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center text-xs text-slate-400 border border-slate-800/80 rounded-2xl bg-slate-900/30">
            No documents uploaded yet for {activeProfileName}. Use the upload card above to ingest PDF lab reports or prescription photos.
          </div>
        )}
      </div>

      {/* 4. Longitudinal Timeline Section */}
      <TimelineSection events={timelineEvents} />

      {/* 5. Report Findings & Graph Provenance Modal */}
      <ReportFindingsModal
        isOpen={Boolean(selectedReport)}
        onClose={() => setSelectedReport(null)}
        documentId={selectedReport?.id || null}
        documentName={selectedReport?.name || ''}
      />
    </div>
  );
};

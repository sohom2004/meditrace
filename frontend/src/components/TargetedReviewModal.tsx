import React, { useState } from 'react';
import { X, Check, Edit3, ShieldAlert, FileText, AlertTriangle } from 'lucide-react';
import { api } from '../api';

interface ReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  reviews: { pending_observations: any[]; pending_medications: any[] };
  onReviewResolved: () => void;
}

export const TargetedReviewModal: React.FC<ReviewModalProps> = ({
  isOpen,
  onClose,
  reviews,
  onReviewResolved,
}) => {
  const [editingFactId, setEditingFactId] = useState<string | null>(null);
  const [correctedValue, setCorrectedValue] = useState('');

  if (!isOpen) return null;

  const handleConfirm = async (factId: string) => {
    try {
      await api.confirmFact(factId, 'patient_confirmed');
      onReviewResolved();
    } catch (err: any) {
      alert(`Error confirming: ${err.message}`);
    }
  };

  const handleCorrect = async (factId: string) => {
    try {
      await api.confirmFact(factId, 'corrected', correctedValue);
      setEditingFactId(null);
      setCorrectedValue('');
      onReviewResolved();
    } catch (err: any) {
      alert(`Error correcting: ${err.message}`);
    }
  };

  const hasItems =
    (reviews.pending_observations?.length || 0) + (reviews.pending_medications?.length || 0) > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="glass-modal w-full max-w-lg rounded-3xl p-6 sm:p-7 border border-slate-800 shadow-2xl">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <ShieldAlert className="w-5 h-5 text-amber-400" />
            <h3 className="font-bold text-white text-base">Targeted Clinical Verification</h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-slate-400 mt-3">
          MediTrace flagged these high-risk extracted items (e.g. handwritten prescriptions or critical values) for your confirmation.
        </p>

        <div className="mt-4 space-y-3 max-h-96 overflow-y-auto pr-1">
          {!hasItems && (
            <div className="text-center py-8 text-xs text-slate-400 italic">
              All extracted clinical facts have been reviewed and verified!
            </div>
          )}

          {reviews.pending_medications?.map((m) => {
            const isEditing = editingFactId === m.fact_id;
            return (
              <div key={m.fact_id} className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-800/40">
                      Medication Fact
                    </span>
                    <h4 className="text-xs font-bold text-white mt-1">{m.medicine_name}</h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Dosage: {m.dosage || 'Not specified'} • {m.frequency || 'OD'}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleConfirm(m.fact_id)}
                      className="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer shadow-md shadow-emerald-600/20"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Confirm</span>
                    </button>
                    <button
                      onClick={() => {
                        setEditingFactId(m.fact_id);
                        setCorrectedValue(m.dosage || '');
                      }}
                      className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {isEditing && (
                  <div className="mt-3 pt-3 border-t border-slate-800 flex items-center gap-2">
                    <input
                      type="text"
                      value={correctedValue}
                      onChange={(e) => setCorrectedValue(e.target.value)}
                      placeholder="Enter corrected dosage..."
                      className="flex-1 text-xs px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-sky-500"
                    />
                    <button
                      onClick={() => handleCorrect(m.fact_id)}
                      className="px-3 py-1.5 rounded-xl bg-sky-600 text-white text-xs font-semibold hover:bg-sky-500"
                    >
                      Save
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-5 pt-3 border-t border-slate-800 flex justify-end">
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

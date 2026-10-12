import React, { useState } from 'react';
import { UploadCloud, Camera, FileText, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { api } from '../api';

interface UploadCardProps {
  activeProfileId: string;
  onUploadSuccess: () => void;
  onOpenReviews: () => void;
  reviewCount: number;
}

export const DocumentUploadCard: React.FC<UploadCardProps> = ({
  activeProfileId,
  onUploadSuccess,
  onOpenReviews,
  reviewCount,
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);
      setStatusMessage(`Computing SHA-256 and routing ${file.name}...`);
      setUploadProgress(25);

      const res = await api.uploadFile(activeProfileId, file);
      setUploadProgress(75);
      setStatusMessage(`Extracting structured clinical facts & LOINC codes...`);

      setTimeout(() => {
        setUploadProgress(100);
        setStatusMessage(`Document processed successfully! Status: ${res.status}`);
        setIsUploading(false);
        onUploadSuccess();
      }, 1000);
    } catch (err: any) {
      setIsUploading(false);
      setStatusMessage(`Error: ${err.message}`);
    }
  };

  const handleSimulateScan = async () => {
    // Generate synthetic handwritten prescription file for testing
    const sampleText = `
    APOLLO CLINIC OPD PRESCRIPTION
    Date: 2026-10-10
    Patient: Ramesh Sharma
    Diagnosis: Type 2 Diabetes, Hypertension
    Rx:
    1. Tab Dolo 650 SOS
    2. Tab Glycomet GP2 BD
    3. Tab Telma 40 OD morning
    Known Allergy: Penicillin
    `;
    const blob = new Blob([sampleText], { type: 'text/plain' });
    const file = new File([blob], 'Apollo_Clinic_OPD_Prescription.txt', { type: 'text/plain' });

    try {
      setIsUploading(true);
      setStatusMessage('Scanning prescription & routing via Vision-LLM...');
      setUploadProgress(40);
      const res = await api.uploadFile(activeProfileId, file);
      setUploadProgress(100);
      setIsUploading(false);
      setStatusMessage(`Ingestion complete! Extracted facts stored with provenance.`);
      onUploadSuccess();
    } catch (err: any) {
      setIsUploading(false);
      setStatusMessage(`Error: ${err.message}`);
    }
  };

  return (
    <div className="glass-card p-5 mb-6">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <div>
          <h3 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <UploadCloud className="w-5 h-5 text-sky-600" />
            <span>Prescription & Lab Report Ingestion</span>
          </h3>
          <p className="text-xs text-slate-500 font-medium">
            Multi-route ingestion (Digital PDF, Layout Document AI, Handwriting Vision-LLM)
          </p>
        </div>

        {reviewCount > 0 && (
          <button
            onClick={onOpenReviews}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-500 text-white text-xs font-semibold shadow-sm hover:bg-amber-600 transition-all cursor-pointer"
          >
            <AlertCircle className="w-4 h-4" />
            <span>{reviewCount} Targeted Review(s) Pending</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Upload File Input */}
        <label className="flex flex-col items-center justify-center p-6 rounded-2xl border-2 border-dashed border-sky-300/60 bg-sky-50/40 hover:bg-sky-50/70 transition-all cursor-pointer group">
          <UploadCloud className="w-8 h-8 text-sky-500 mb-2 group-hover:scale-110 transition-transform" />
          <span className="text-xs font-semibold text-slate-800">Upload PDF / Diagnostic Scan</span>
          <span className="text-[11px] text-slate-400 mt-0.5">SHA-256 deduplicated, direct to storage</span>
          <input
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.txt"
            onChange={handleFileChange}
            disabled={isUploading}
            className="hidden"
          />
        </label>

        {/* Camera Scanner Simulation */}
        <button
          onClick={handleSimulateScan}
          disabled={isUploading}
          className="flex flex-col items-center justify-center p-6 rounded-2xl border-2 border-dashed border-teal-300/60 bg-teal-50/40 hover:bg-teal-50/70 transition-all cursor-pointer group"
        >
          <Camera className="w-8 h-8 text-teal-600 mb-2 group-hover:scale-110 transition-transform" />
          <span className="text-xs font-semibold text-slate-800">Scan Rx / Handwritten Document</span>
          <span className="text-[11px] text-slate-400 mt-0.5">Vision-LLM OCR + Brand→Generic mapping</span>
        </button>
      </div>

      {/* Progress & Status */}
      {isUploading && (
        <div className="mt-4 p-3 rounded-xl bg-white/80 border border-slate-200/80">
          <div className="flex items-center justify-between text-xs font-semibold mb-1.5 text-slate-700">
            <span>{statusMessage}</span>
            <span>{uploadProgress}%</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-gradient-to-r from-sky-500 to-teal-400 h-1.5 transition-all duration-300"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}

      {!isUploading && statusMessage && (
        <div className="mt-3 text-xs font-medium text-emerald-700 bg-emerald-50 px-3 py-2 rounded-xl border border-emerald-200/50 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}
    </div>
  );
};

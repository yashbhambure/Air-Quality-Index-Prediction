"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { fetchBatchPredict } from "@/lib/api";

interface BatchUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function BatchUploadModal({ isOpen, onClose }: BatchUploadModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError(null);
      setSuccess(false);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError("Please select a CSV file first.");
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      const blob = await fetchBatchPredict(file);
      // Create download link for the predicted CSV
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `predicted_${file.name}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setSuccess(true);
      setFile(null);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Batch prediction failed. Please verify CSV feature headers.");
      }
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-[#0B0F14]/80 backdrop-blur-md"
          />

          {/* Dialog Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="relative z-10 w-full max-w-lg rounded-2xl border border-[#26313D] bg-[#151C24] p-6 shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[#202A34]">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#35D0C5]" />
                <h3 className="font-mono font-bold text-sm text-[#F2F5F7] uppercase tracking-wider">
                  Batch CSV Inference Pipeline
                </h3>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="text-[#64717E] hover:text-[#F2F5F7] font-mono text-sm px-2 py-1 rounded transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Description */}
            <p className="text-xs font-sans text-[#9AA7B4] mt-3 leading-relaxed">
              Upload a dataset with the 12 target pollutants. The trained PCA + Random Forest model will process all records and return a downloadable CSV with predicted AQI, category, and health advisory columns.
            </p>

            {/* Upload Area */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="mt-4 p-6 border-2 border-dashed border-[#26313D] hover:border-[#35D0C5] rounded-xl bg-[#10161D] cursor-pointer text-center transition-all group"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="hidden"
              />
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                className="w-8 h-8 mx-auto text-[#64717E] group-hover:text-[#35D0C5] transition-colors mb-2"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              {file ? (
                <div className="font-mono text-xs text-[#35D0C5]">
                  Selected: <span className="font-semibold">{file.name}</span> ({(file.size / 1024).toFixed(1)} KB)
                </div>
              ) : (
                <>
                  <p className="text-xs font-mono text-[#F2F5F7]">
                    Click to select or drop CSV file here
                  </p>
                  <p className="text-[10px] font-mono text-[#64717E] mt-1">
                    Accepts UTF-8 formatted .csv up to 10MB
                  </p>
                </>
              )}
            </div>

            {/* Status messages */}
            {error && (
              <div className="mt-3 p-3 rounded-lg bg-[#F05B5B]/10 border border-[#F05B5B]/30 text-xs font-mono text-[#F05B5B]">
                {error}
              </div>
            )}
            {success && (
              <div className="mt-3 p-3 rounded-lg bg-[#3CCB8E]/10 border border-[#3CCB8E]/30 text-xs font-mono text-[#3CCB8E]">
                Batch inference completed! CSV downloaded automatically.
              </div>
            )}

            {/* Actions */}
            <div className="mt-6 flex items-center justify-end gap-3 pt-3 border-t border-[#202A34]">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg text-xs font-mono text-[#9AA7B4] hover:text-[#F2F5F7] transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!file || isUploading}
                onClick={handleUpload}
                className={`px-5 py-2 rounded-lg text-xs font-mono font-bold uppercase tracking-wider transition-all ${
                  !file || isUploading
                    ? "bg-[#18212B] text-[#64717E] border border-[#26313D] cursor-not-allowed"
                    : "bg-[#35D0C5] text-[#0B0F14] hover:bg-[#5CE1E6] shadow-[0_0_16px_rgba(53,208,197,0.25)]"
                }`}
              >
                {isUploading ? "Processing Batch…" : "Run Batch Inference"}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

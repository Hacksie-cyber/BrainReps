import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trash2, X, AlertTriangle } from 'lucide-react';

interface DeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  isDeleting?: boolean;
}

export default function DeleteModal({ isOpen, onClose, onConfirm, title, message, isDeleting }: DeleteModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-100"
          >
            <div className="p-6 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50 mb-4">
                <Trash2 className="h-6 w-6 text-red-600" />
              </div>
              
              <h3 className="text-xl font-bold text-slate-800 tracking-tight mb-2">{title}</h3>
              <p className="text-sm text-slate-500 font-medium leading-relaxed italic mb-6">
                {message}
              </p>

              <div className="flex flex-col gap-2">
                <button
                  onClick={onConfirm}
                  disabled={isDeleting}
                  className="w-full py-3 bg-red-600 text-white rounded-xl font-bold text-sm transition-all hover:bg-red-700 active:scale-[0.98] disabled:opacity-50 shadow-lg shadow-red-600/20"
                >
                  {isDeleting ? 'Decommissioning...' : 'Confirm Permanent Deletion'}
                </button>
                <button
                  onClick={onClose}
                  disabled={isDeleting}
                  className="w-full py-3 bg-slate-50 text-slate-500 rounded-xl font-bold text-sm transition-all hover:bg-slate-100 active:scale-[0.98] disabled:opacity-50"
                >
                  Return to Dashboard
                </button>
              </div>
            </div>

            <div className="bg-slate-50 p-4 flex items-start gap-3">
              <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter text-left">
                Attention: This operation is destructive and cannot be reversed by system administrators once finalized.
              </p>
            </div>

            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-1 text-slate-300 hover:text-slate-500 rounded-full hover:bg-slate-50 transition-all"
            >
              <X className="h-4 w-4" />
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

import React from 'react';
import { AlertCircle } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'info';
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = 'SİL',
  cancelText = 'İPTAL',
  variant = 'danger'
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-[32px] shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-6 flex flex-col items-center text-center">
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 ${variant === 'danger' ? 'bg-red-50 text-red-500 dark:bg-red-950/30' : 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/30'}`}>
            <AlertCircle size={28} />
          </div>
          
          <h3 className="text-base font-semibold uppercase tracking-tight dark:text-white mb-2">{title}</h3>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 leading-relaxed">
            {message}
          </p>
        </div>

        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 flex gap-3">
          <button 
            onClick={onCancel}
            className="flex-1 py-3 text-[10px] font-semibold uppercase tracking-widest text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-2xl transition-all"
          >
            {cancelText}
          </button>
          <button 
            onClick={() => {
              onConfirm();
              onCancel();
            }}
            className={`flex-1 py-3 text-[10px] font-semibold uppercase tracking-widest text-white rounded-2xl shadow-lg transition-all active:scale-95 ${variant === 'danger' ? 'bg-red-500 shadow-red-100 dark:shadow-none hover:bg-red-600' : 'bg-indigo-600 shadow-indigo-100 dark:shadow-none hover:bg-indigo-700'}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

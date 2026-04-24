import React from 'react';
import { Sparkles, CheckCircle2, X, ArrowRight } from 'lucide-react';

interface UpdateItem {
  title: string;
  description: string;
}

interface UpdateModalProps {
  isOpen: boolean;
  version: string;
  onClose: () => void;
  updates: UpdateItem[];
}

export const UpdateModal: React.FC<UpdateModalProps> = ({ isOpen, version, onClose, updates }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-[32px] shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in zoom-in-95 duration-300">
        <div className="relative p-6 flex flex-col items-center text-center">
          <button 
            onClick={onClose} 
            className="absolute top-4 right-4 p-2 text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-full transition-colors"
          >
            <X size={18} />
          </button>

          <div className="w-16 h-16 bg-gradient-to-tr from-indigo-600 to-violet-500 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-indigo-200 dark:shadow-none animate-bounce">
            <Sparkles size={32} className="text-white" />
          </div>
          
          <h3 className="text-lg font-medium tracking-tight dark:text-white mb-1">Yeni Güncelleme!</h3>
          <div className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950/50 rounded-full mb-6">
            <span className="text-[10px] font-medium text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">Sürüm {version}</span>
          </div>

          <div className="w-full space-y-4 text-left">
            {updates.map((update, idx) => (
              <div key={idx} className="flex gap-3 animate-in slide-in-from-left duration-500" style={{ animationDelay: `${idx * 150}ms` }}>
                <div className="mt-0.5 flex-shrink-0">
                  <CheckCircle2 size={16} className="text-emerald-500" />
                </div>
                <div>
                  <h4 className="text-[11px] font-medium text-slate-800 dark:text-slate-200 uppercase tracking-tight">{update.title}</h4>
                  <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400 leading-relaxed">{update.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="p-4 bg-slate-50 dark:bg-slate-800/50">
          <button 
            onClick={onClose}
            className="w-full py-3.5 bg-indigo-600 text-white rounded-2xl text-[10px] font-medium uppercase tracking-widest shadow-lg shadow-indigo-100 dark:shadow-none hover:bg-indigo-700 transition-all active:scale-95 flex items-center justify-center gap-2"
          >
            KULLANMAYA BAŞLA <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};

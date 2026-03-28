import React from 'react';
import { ReceiptData, ViewMode } from '../types.ts';
import { Trash2, Calendar, ImageIcon } from 'lucide-react';

interface Props {
  receipts: ReceiptData[];
  onDelete: (id: string) => void;
  onView: (receipt: ReceiptData) => void;
  onCopySingle: (receipts: ReceiptData[]) => Promise<boolean>;
  viewMode: ViewMode;
  selectedIds?: string[];
  onToggleSelect?: (id: string) => void;
}

export const getCategoryColor = (category: string) => {
  const cat = category ? category.trim() : "";
  switch (cat) {
    case 'Fatura': return 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800';
    case 'Gıda ve Market': return 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800';
    case 'Araç ve Ulaşım': return 'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800';
    case 'Abonelik': return 'bg-violet-50 text-violet-600 border-violet-200 dark:bg-violet-950/30 dark:text-violet-400 dark:border-violet-800';
    case 'Kişisel Harcama': return 'bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-800';
    case 'Eş Kişisel': return 'bg-fuchsia-50 text-fuchsia-600 border-fuchsia-200 dark:bg-fuchsia-950/30 dark:text-fuchsia-400 dark:border-fuchsia-800';
    case 'Aile Sosyal': return 'bg-sky-50 text-sky-600 border-sky-200 dark:bg-sky-950/30 dark:text-sky-400 dark:border-sky-800';
    case 'Mobilya': return 'bg-orange-50 text-orange-600 border-orange-200 dark:bg-orange-950/30 dark:text-orange-400 dark:border-orange-800';
    default: return 'bg-slate-50 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700';
  }
};

export const ReceiptTable: React.FC<Props> = ({ receipts, onDelete, onView }) => {
  if (receipts.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 border border-dashed border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center text-center opacity-60">
        <Calendar size={32} className="text-slate-300 mb-2" />
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Henüz fiş eklenmemiş</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-800 overflow-hidden shadow-sm">
      <div className="divide-y divide-slate-50 dark:divide-slate-800">
        {receipts.map((r) => (
          <div 
            key={r.id} 
            onClick={() => onView(r)} 
            className="flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer transition-all active:bg-slate-100"
          >
            <div className={`w-1 self-stretch rounded-full ${getCategoryColor(r.category).split(' ')[1].replace('text-', 'bg-')}`}></div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="text-[10px] font-bold text-slate-800 dark:text-slate-100 truncate uppercase tracking-tight">
                  {r.vendor}
                </span>
                {r.imageUrl && <ImageIcon size={10} className="text-indigo-400 flex-shrink-0" />}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[8px] font-semibold text-slate-400 shrink-0">{r.date}</span>
                <span className={`text-[7px] font-bold px-1.5 py-0 rounded-full border uppercase tracking-tighter truncate max-w-[80px] ${getCategoryColor(r.category)}`}>
                  {r.category}
                </span>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1.5 shrink-0 ml-1">
              <div className="text-xs font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                {r.total.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} <span className="text-[8px] font-semibold text-indigo-500">₺</span>
              </div>
              <button 
                onClick={(e) => { e.stopPropagation(); onDelete(r.id); }} 
                className="p-1 text-slate-300 hover:text-red-500 dark:hover:text-red-400 transition-colors"
              >
                <Trash2 size={12} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

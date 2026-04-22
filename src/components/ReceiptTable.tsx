import React from 'react';
import { ReceiptData, ViewMode } from '../types.ts';
import { Trash2, Calendar, ImageIcon, ChevronRight } from 'lucide-react';
import { motion } from 'motion/react';

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
    case 'Fatura': return 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800';
    case 'Gıda ve Market': return 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800';
    case 'Araç ve Ulaşım': return 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800';
    case 'Abonelik': return 'bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-950/30 dark:text-violet-400 dark:border-violet-800';
    case 'Kişisel Harcama': return 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-800';
    case 'Eş Kişisel': return 'bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200 dark:bg-fuchsia-950/30 dark:text-fuchsia-400 dark:border-fuchsia-800';
    case 'Aile Sosyal': return 'bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-950/30 dark:text-sky-400 dark:border-sky-800';
    case 'Mobilya': return 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-950/30 dark:text-orange-400 dark:border-orange-800';
    default: return 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700';
  }
};

export const ReceiptTable: React.FC<Props> = ({ receipts, onDelete, onView }) => {
  const formatDateForDisplay = (dateStr: string) => {
    if (!dateStr) return '';
    if (dateStr.includes('-')) {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        return `${parts[2].padStart(2, '0')}.${parts[1].padStart(2, '0')}.${parts[0]}`;
      }
    }
    return dateStr;
  };

  if (receipts.length === 0) {
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white dark:bg-slate-900 rounded-[32px] p-12 border border-dashed border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center text-center opacity-60"
      >
        <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-full mb-4">
          <Calendar size={32} className="text-slate-300" />
        </div>
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Henüz fiş eklenmemiş</p>
      </motion.div>
    );
  }

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05
      }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0 }
  };

  return (
    <motion.div 
      variants={container}
      initial="hidden"
      animate="show"
      className="space-y-0"
    >
      {receipts.map((r) => (
        <motion.div 
          key={r.id} 
          variants={item}
          whileHover={{ scale: 1.01, x: 2 }}
          whileTap={{ scale: 0.99 }}
          onClick={() => onView(r)} 
          className="group bg-white dark:bg-slate-900 rounded-[20px] border border-slate-200/50 dark:border-slate-800/60 p-1.5 flex items-center gap-2 transition-all hover:border-indigo-200 dark:hover:border-indigo-900/50 hover:shadow-lg hover:shadow-slate-200/50 dark:hover:shadow-none cursor-pointer"
        >
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-inner ${getCategoryColor(r.category).split(' ')[0]}`}>
             <div className={`w-1.5 h-1.5 rounded-full ${getCategoryColor(r.category).split(' ')[1].replace('text-', 'bg-')}`}></div>
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="text-[13px] font-semibold text-slate-900 dark:text-slate-100 truncate uppercase tracking-tight font-display leading-none">
                {r.vendor}
              </span>
              {r.imageUrl && (
                <div className="p-0.5 bg-indigo-50 dark:bg-indigo-950/30 rounded text-indigo-500">
                  <ImageIcon size={8} />
                </div>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[8px] font-medium text-slate-400 shrink-0 tabular-nums">{formatDateForDisplay(r.date)}</span>
              <div className="w-0.5 h-0.5 rounded-full bg-slate-200 dark:bg-slate-800"></div>
              <span className={`text-[7px] font-bold px-1.5 py-0 rounded-md border uppercase tracking-wider truncate max-w-[100px] ${getCategoryColor(r.category)}`}>
                {r.category}
              </span>
            </div>
          </div>
          
          <div className="flex flex-col items-end gap-1 shrink-0 ml-1">
            <div className="text-sm font-bold text-slate-900 dark:text-slate-100 tabular-nums font-display">
              {r.total.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} <span className="text-[9px] font-semibold text-indigo-500">₺</span>
            </div>
            <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <button 
                onClick={(e) => { e.stopPropagation(); onDelete(r.id); }} 
                className="p-1 text-slate-300 hover:text-red-500 dark:hover:text-red-400 bg-slate-50 dark:bg-slate-800 rounded-md transition-colors"
              >
                <Trash2 size={12} />
              </button>
              <ChevronRight size={14} className="text-slate-300" />
            </div>
          </div>
        </motion.div>
      ))}
    </motion.div>
  );
};

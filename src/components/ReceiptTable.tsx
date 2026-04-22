import React from 'react';
import { ReceiptData, ViewMode } from '../types.ts';
import { Trash2, Calendar, ImageIcon, ChevronRight, ScanText } from 'lucide-react';
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

export const getVendorLogo = (vendor: string) => {
  const v = vendor.toUpperCase();
  // Markets
  if (v.includes('BİM') || v.includes('BIM')) return 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Bim_logo.svg/200px-Bim_logo.svg.png';
  if (v.includes('A101')) return 'https://upload.wikimedia.org/wikipedia/tr/b/b8/A101_logo.png';
  if (v.includes('MİGROS') || v.includes('MIGROS')) return 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/15/Migros_logo.svg/200px-Migros_logo.svg.png';
  if (v.includes('ŞOK') || v.includes('SOK')) return 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f3/%C5%9Eok_Market_logo.svg/200px-%C5%9Eok_Market_logo.svg.png';
  if (v.includes('CARREFOUR')) return 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5b/Carrefour_logo.svg/200px-Carrefour_logo.svg.png';
  if (v.includes('TARIM KREDİ') || v.includes('KOOPERATİF')) return 'https://www.tarimkredi.org.tr/media/1001/tk-logo-2022.png';
  if (v.includes('METRO')) return 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e4/Metro-Logo.svg/200px-Metro-Logo.svg.png';
  
  // Fuel
  if (v.includes('SHELL')) return 'https://upload.wikimedia.org/wikipedia/en/thumb/e/e8/Shell_logo.svg/200px-Shell_logo.svg.png';
  if (v.includes('OPET')) return 'https://upload.wikimedia.org/wikipedia/en/thumb/d/d4/Opet_logo.png/200px-Opet_logo.png';
  if (v.includes('BP ')) return 'https://upload.wikimedia.org/wikipedia/en/thumb/d/d2/BP_Logo.svg/200px-BP_Logo.svg.png';
  if (v.includes('PETROL OFİSİ') || v.includes('PETROL OFISI')) return 'https://upload.wikimedia.org/wikipedia/tr/thumb/d/d6/Petrol_Ofisi_Logo.svg/200px-Petrol_Ofisi_Logo.svg.png';
  
  // Food & Coffee
  if (v.includes('STARBUCKS')) return 'https://upload.wikimedia.org/wikipedia/en/thumb/d/d3/Starbucks_Corporation_Logo_2011.svg/200px-Starbucks_Corporation_Logo_2011.svg.png';
  if (v.includes('BURGER KING')) return 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/85/Burger_King_logo_%282021%29.svg/200px-Burger_King_logo_%282021%29.svg.png';
  if (v.includes('TRENDYOL')) return 'https://cdn.dsmcdn.com/sfid/dev/68798af4-0fca-443b-a9b0-951c6a282924.png';
  if (v.includes('GETİR') || v.includes('GETIR')) return 'https://upload.wikimedia.org/wikipedia/commons/1/1b/Getir_logo.svg';
  return null;
};

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

const LogoIcon: React.FC<{ vendor: string, category: string }> = ({ vendor, category }) => {
  const logoUrl = getVendorLogo(vendor);
  const [error, setError] = React.useState(false);

  return (
    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden relative bg-white dark:bg-slate-800`}>
      {/* Base Layer: Company Logo Fallback */}
      <div className="absolute inset-0 flex items-center justify-center bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600">
        <ScanText size={18} />
      </div>

      {/* Top Layer: Vendor Logo Image */}
      {logoUrl && !error && (
        <img 
          src={logoUrl} 
          alt={vendor}
          onError={() => setError(true)}
          className="absolute inset-0 w-full h-full object-contain p-1.5 bg-white dark:bg-slate-900 transition-opacity duration-300"
        />
      )}
    </div>
  );
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
          <LogoIcon vendor={r.vendor} category={r.category} />
          
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

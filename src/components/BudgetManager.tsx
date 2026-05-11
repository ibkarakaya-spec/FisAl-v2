import React, { useState, useMemo, useEffect } from 'react';
import { ReceiptData, BudgetLimit } from '../types.ts';
import { 
  Trash2, 
  Plus, 
  Loader2, 
  Calendar, 
  TrendingUp,
  BarChart,
  Repeat,
  Settings,
  X,
  FileDown,
  ArrowUpRight,
  TrendingDown
} from 'lucide-react';
import { getCategoryColor } from './ReceiptTable.tsx';
import { motion, AnimatePresence } from 'motion/react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import * as XLSX from 'xlsx';

interface Props {
  receipts: ReceiptData[];
  categories: string[];
  setCategories: React.Dispatch<React.SetStateAction<string[]>>;
  availableMonths: string[];
  onAddReceipt: (receipt: ReceiptData) => void;
  onDeleteReceipt: (id: string) => void;
  onViewReceipt: (receipt: ReceiptData) => void;
  exportMode?: 'detailed' | 'summary';
  selectedMonth: string;
  setSelectedMonth: (month: string) => void;
  selectedIds?: string[];
  onToggleSelect?: (id: string) => void;
}

export const BudgetManager: React.FC<Props> = ({ 
  receipts, 
  categories,
  setCategories,
  availableMonths, 
  onAddReceipt, 
  onDeleteReceipt, 
  onViewReceipt, 
  selectedMonth,
  setSelectedMonth,
  selectedIds = [],
  onToggleSelect
}) => {
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

  const [selectedCategory, setSelectedCategory] = useState<string>('Hepsi');
  const [editingLimitCategory, setEditingLimitCategory] = useState<string | null>(null);
  const [showTransfer, setShowTransfer] = useState(false);
  const [showManageCategories, setShowManageCategories] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [transferForm, setTransferForm] = useState({ from: '', to: '', amount: '' });
  const [activeWeekTooltip, setActiveWeekTooltip] = useState<number | null>(null);
  
  const [manualForm, setManualForm] = useState(() => {
    const savedDate = localStorage.getItem('app_last_manual_date');
    return {
      konu: '', 
      kategori: categories[0] || '', 
      market: '', 
      tarih: savedDate || new Date().toISOString().split('T')[0], 
      ucret: ''
    };
  });

  const [allLimits, setAllLimits] = useState<Record<string, BudgetLimit[]>>(() => {
    const saved = localStorage.getItem('budget_limits_by_month');
    return saved ? JSON.parse(saved) : {};
  });

  useEffect(() => {
    localStorage.setItem('app_last_manual_date', manualForm.tarih);
  }, [manualForm.tarih]);

  useEffect(() => {
    localStorage.setItem('budget_limits_by_month', JSON.stringify(allLimits));
  }, [allLimits]);

  const activeMonthKey = selectedMonth === "Hepsi" ? availableMonths[0] : selectedMonth;

  const currentLimits = useMemo(() => {
    const monthLimits = allLimits[activeMonthKey] || [];
    return categories.map(cat => {
      const existing = monthLimits.find(l => l.category === cat);
      return existing || { category: cat, limit: 0 };
    });
  }, [allLimits, activeMonthKey, categories]);

  const currentMonthReceipts = useMemo(() => {
    const parseDateForSort = (dateStr: string) => {
      if (!dateStr) return '0000-00-00';
      if (dateStr.includes('.')) {
        const [d, m, y] = dateStr.split('.');
        return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
      }
      return dateStr;
    };

    return receipts.filter(r => {
      if (selectedMonth === "Hepsi") return true;
      if (!r.date) return false;
      let rMonth = '';
      if (r.date.includes('.')) {
        const parts = r.date.split('.');
        rMonth = `${parts[2]}-${parts[1].padStart(2, '0')}`;
      } else if (r.date.includes('-')) {
        rMonth = r.date.substring(0, 7);
      }
      return rMonth === selectedMonth;
    }).sort((a, b) => {
      const dateA = parseDateForSort(a.date);
      const dateB = parseDateForSort(b.date);
      if (dateA !== dateB) return dateB.localeCompare(dateA);
      return (b.timestamp || 0) - (a.timestamp || 0);
    });
  }, [receipts, selectedMonth]);

  const filteredReceipts = useMemo(() => {
    if (selectedCategory === 'Hepsi') return currentMonthReceipts;
    return currentMonthReceipts.filter(r => r.category.trim() === selectedCategory);
  }, [currentMonthReceipts, selectedCategory]);

  const categoryTotalSpent = useMemo(() => filteredReceipts.reduce((sum, r) => sum + r.total, 0), [filteredReceipts]);
  
  const spentPerCategory = useMemo(() => {
    const totals: Record<string, number> = {};
    currentMonthReceipts.forEach(r => { totals[r.category] = (totals[r.category] || 0) + r.total; });
    return totals;
  }, [currentMonthReceipts]);

  const weeklyStats = useMemo(() => {
    const weeks = [0, 0, 0, 0, 0];
    filteredReceipts.forEach(r => {
      const day = parseInt(r.date.split('.')[0]);
      if (day <= 7) weeks[0] += r.total;
      else if (day <= 14) weeks[1] += r.total;
      else if (day <= 21) weeks[2] += r.total;
      else if (day <= 28) weeks[3] += r.total;
      else weeks[4] += r.total;
    });
    return weeks;
  }, [filteredReceipts]);

  const maxWeekly = useMemo(() => Math.max(...weeklyStats, 1), [weeklyStats]);

  const handleLimitChange = (category: string, value: string) => {
    const numValue = parseFloat(value) || 0;
    const newLimits = currentLimits.map(l => l.category === category ? { ...l, limit: numValue } : l);
    setAllLimits(prev => ({ ...prev, [activeMonthKey]: newLimits }));
  };

  const handleDeleteCategory = (catName: string) => {
    if (!confirm(`${catName} kategorisi silinsin mi?`)) return;
    const updatedCategories = categories.filter(c => c !== catName);
    setCategories(updatedCategories);
    const updatedAllLimits = { ...allLimits };
    Object.keys(updatedAllLimits).forEach(month => {
      updatedAllLimits[month] = (updatedAllLimits[month] || []).filter(l => l.category !== catName);
    });
    setAllLimits(updatedAllLimits);
    if (selectedCategory === catName) setSelectedCategory('Hepsi');
  };

  const handleTransfer = () => {
    const amount = parseFloat(transferForm.amount) || 0;
    if (amount <= 0 || !transferForm.from || !transferForm.to) return;
    const newLimits = currentLimits.map(l => {
      if (l.category === transferForm.from) return { ...l, limit: Math.max(0, l.limit - amount) };
      if (l.category === transferForm.to) return { ...l, limit: l.limit + amount };
      return l;
    });
    setAllLimits(prev => ({ ...prev, [activeMonthKey]: newLimits }));
    setShowTransfer(false);
    setTransferForm({ from: '', to: '', amount: '' });
  };

  const handleAddManual = () => {
    if (!manualForm.konu || !manualForm.ucret) return;
    const price = parseFloat(manualForm.ucret.replace(',', '.')) || 0;
    const [y, m, d] = manualForm.tarih.split('-');
    onAddReceipt({
      id: Math.random().toString(36).substr(2, 9),
      vendor: manualForm.market.toUpperCase() || manualForm.konu.toUpperCase(),
      date: `${d}.${m}.${y}`,
      total: price,
      currency: '₺',
      category: manualForm.kategori || categories[0],
      tax: 0,
      items: [{ name: manualForm.konu.toUpperCase(), price, quantity: 1 }],
      confidence: 1,
      timestamp: Date.now()
    });
    setManualForm({ ...manualForm, konu: '', market: '', ucret: '' });
  };

  const exportToExcel = () => {
    const monthName = selectedMonth === "Hepsi" ? "Tüm Zamanlar" : activeMonthKey;
    const dateStr = new Date().toLocaleDateString('tr-TR');

    // Create worksheet data
    const worksheetData = [
      ["BÜTÇE RAPORU"],
      ["Dönem:", monthName],
      ["Oluşturulma Tarihi:", dateStr],
      [],
      ["ÖZET"],
      ["Toplam Harcama:", `${categoryTotalSpent.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}₺`],
      ["Seçili Kategori:", selectedCategory],
      ["Fiş Sayısı:", filteredReceipts.length],
      [],
      ["HARCAMA DETAYLARI"],
      ["Tarih", "Mağaza", "Kategori", "Tutar (₺)"]
    ];

    filteredReceipts.forEach(r => {
      worksheetData.push([
        formatDateForDisplay(r.date),
        r.vendor.toUpperCase(),
        r.category.toUpperCase(),
        r.total
      ]);
    });

    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Harcama Raporu");

    // Auto-size columns
    const colWidths = [
      { wch: 15 }, // Tarih
      { wch: 30 }, // Mağaza
      { wch: 20 }, // Kategori
      { wch: 15 }  // Tutar
    ];
    worksheet['!cols'] = colWidths;

    XLSX.writeFile(workbook, `Butce_Raporu_${monthName.replace(' ', '_')}.xlsx`);
  };

  const exportToPDF = async () => {
    const input = document.getElementById('budget-content');
    if (!input) return;
    
    // Create a temporary container for a professional PDF layout
    const printContainer = document.createElement('div');
    printContainer.style.position = 'fixed';
    printContainer.style.left = '-9999px';
    printContainer.style.top = '0';
    printContainer.style.width = '800px';
    printContainer.style.padding = '40px';
    printContainer.style.background = '#ffffff';
    printContainer.style.color = '#000000';
    printContainer.style.fontFamily = 'Inter, sans-serif';
    
    const dateStr = new Date().toLocaleDateString('tr-TR');
    const monthName = selectedMonth === "Hepsi" ? "Tüm Zamanlar" : activeMonthKey;

    printContainer.innerHTML = `
      <div style="border-bottom: 4px solid #4f46e5; padding-bottom: 20px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: flex-end;">
        <div>
          <h1 style="font-size: 32px; font-weight: 900; color: #1e1b4b; margin: 0; letter-spacing: -1px;">BÜTÇE RAPORU</h1>
          <p style="font-size: 14px; color: #64748b; margin: 5px 0 0 0; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">${monthName}</p>
        </div>
        <div style="text-align: right;">
          <p style="font-size: 10px; color: #94a3b8; margin: 0; font-weight: bold;">OLUŞTURULMA TARİHİ</p>
          <p style="font-size: 14px; color: #1e1b4b; margin: 0; font-weight: 800;">${dateStr}</p>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-bottom: 40px;">
        <div style="background: #f8fafc; padding: 20px; border-radius: 16px; border: 1px solid #e2e8f0;">
          <p style="font-size: 10px; color: #64748b; margin: 0 0 8px 0; font-weight: bold; text-transform: uppercase;">TOPLAM HARCAMA</p>
          <p style="font-size: 24px; font-weight: 900; color: #4f46e5; margin: 0;">${categoryTotalSpent.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}₺</p>
        </div>
        <div style="background: #f8fafc; padding: 20px; border-radius: 16px; border: 1px solid #e2e8f0;">
          <p style="font-size: 10px; color: #64748b; margin: 0 0 8px 0; font-weight: bold; text-transform: uppercase;">KATEGORİ</p>
          <p style="font-size: 24px; font-weight: 900; color: #1e1b4b; margin: 0;">${selectedCategory}</p>
        </div>
        <div style="background: #f8fafc; padding: 20px; border-radius: 16px; border: 1px solid #e2e8f0;">
          <p style="font-size: 10px; color: #64748b; margin: 0 0 8px 0; font-weight: bold; text-transform: uppercase;">FİŞ SAYISI</p>
          <p style="font-size: 24px; font-weight: 900; color: #1e1b4b; margin: 0;">${filteredReceipts.length}</p>
        </div>
      </div>

      <div>
        <h2 style="font-size: 14px; font-weight: 800; color: #1e1b4b; margin-bottom: 15px; text-transform: uppercase; letter-spacing: 1px; display: flex; align-items: center; gap: 10px;">
          <span style="width: 4px; height: 16px; background: #4f46e5; border-radius: 2px;"></span>
          HARCAMA DETAYLARI
        </h2>
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="text-align: left; border-bottom: 2px solid #e2e8f0;">
              <th style="padding: 12px; font-size: 10px; color: #64748b; text-transform: uppercase;">TARİH</th>
              <th style="padding: 12px; font-size: 10px; color: #64748b; text-transform: uppercase;">MAĞAZA</th>
              <th style="padding: 12px; font-size: 10px; color: #64748b; text-transform: uppercase;">KATEGORİ</th>
              <th style="padding: 12px; font-size: 10px; color: #64748b; text-transform: uppercase; text-align: right;">TUTAR</th>
            </tr>
          </thead>
          <tbody>
            ${filteredReceipts.map(r => `
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 12px; font-size: 11px; color: #64748b;">${formatDateForDisplay(r.date)}</td>
                <td style="padding: 12px; font-size: 11px; font-weight: 700; color: #1e1b4b;">${r.vendor.toUpperCase()}</td>
                <td style="padding: 12px; font-size: 10px;"><span style="background: #f1f5f9; padding: 2px 8px; border-radius: 10px; font-weight: 700; color: #475569;">${r.category.toUpperCase()}</span></td>
                <td style="padding: 12px; font-size: 12px; font-weight: 800; text-align: right; color: #1e1b4b;">${r.total.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}₺</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <div style="margin-top: 50px; text-align: center; border-top: 1px solid #f1f5f9; padding-top: 20px;">
        <p style="font-size: 10px; color: #94a3b8; font-weight: 600;">BU RAPOR OTOMATİK OLARAK OLUŞTURULMUŞTUR. © ${new Date().getFullYear()} AKILLI FİŞ YÖNETİMİ</p>
      </div>
    `;

    document.body.appendChild(printContainer);
    
    try {
      const canvas = await html2canvas(printContainer, { 
        scale: 2, 
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Butce_Raporu_${monthName.replace(' ', '_')}.pdf`);
    } finally {
      document.body.removeChild(printContainer);
    }
  };

  return (
    <div className="space-y-1.5 pb-2" id="budget-content">
      <div className="no-print flex items-center justify-between gap-1 mb-1">
        <div className="flex items-center gap-1 bg-white/50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 rounded-lg px-2 py-0.5">
          <Calendar size={10} className="text-slate-400" />
          <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="text-[11px] font-medium bg-transparent dark:text-slate-200 outline-none cursor-pointer">
            <option value="Hepsi">Tümü</option>
            {availableMonths.map(m => {
              const [y, mm] = m.split('-');
              const ms = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
              return <option key={m} value={m}>{`${ms[parseInt(mm) - 1]} ${y}`}</option>;
            })}
          </select>
        </div>
        <div className="flex gap-1">
          <button onClick={exportToPDF} className="p-1.5 bg-rose-50 dark:bg-rose-950/20 text-rose-600 rounded-lg border border-rose-100 dark:border-rose-900/30 flex items-center gap-1">
            <FileDown size={14} /> <span className="text-[10px] font-bold">PDF</span>
          </button>
          <button onClick={exportToExcel} className="p-1.5 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 rounded-lg border border-emerald-100 dark:border-emerald-900/30 flex items-center gap-1">
            <FileDown size={14} /> <span className="text-[10px] font-bold">EXCEL</span>
          </button>
          <button onClick={() => setShowTransfer(true)} className="p-1.5 bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 rounded-lg border border-indigo-100 dark:border-indigo-900/30"><Repeat size={14} /></button>
          <button onClick={() => setShowManageCategories(true)} className="p-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 rounded-lg border border-slate-200 dark:border-slate-700"><Settings size={14} /></button>
        </div>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="no-print space-y-4"
      >
        <div className="bg-white dark:bg-slate-950/50 rounded-2xl border border-slate-100 dark:border-slate-900 shadow-sm overflow-hidden mb-1">
          <table className="w-full text-left table-fixed">
            <thead className="bg-slate-50 dark:bg-slate-900/40 text-[9px] font-medium text-slate-400 uppercase tracking-widest border-b dark:border-slate-900">
              <tr>
                <th className="px-3 py-1.5 w-4/12">KAT</th>
                <th className="px-1 py-1.5 text-right w-4/12">LİMİT</th>
                <th className="px-1 py-1.5 text-right w-4/12 pr-3">KALAN</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-900">
              {currentLimits.map((l) => {
                const spent = spentPerCategory[l.category] || 0;
                const remaining = l.limit - spent;
                const isEditing = editingLimitCategory === l.category;
                
                return (
                  <tr key={l.category} className="text-[11px] dark:text-slate-400 group hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors">
                    <td className="px-3 py-1.5 font-medium truncate uppercase tracking-tight text-slate-800 dark:text-slate-200">{l.category}</td>
                    <td 
                      className="px-1 py-1.5 text-right cursor-pointer" 
                      onClick={() => setEditingLimitCategory(l.category)}
                    >
                      {isEditing ? (
                        <div className="flex items-center justify-end">
                          <input 
                            autoFocus
                            type="number" 
                            value={l.limit || ''} 
                            onBlur={() => setEditingLimitCategory(null)}
                            onChange={e => handleLimitChange(l.category, e.target.value)} 
                            onKeyDown={e => e.key === 'Enter' && setEditingLimitCategory(null)}
                            className="w-full bg-slate-50 dark:bg-slate-800 border-none text-right text-[12px] font-medium text-indigo-500 outline-none rounded px-1 py-0.5 shadow-inner font-display" 
                            placeholder="0" 
                          />
                        </div>
                      ) : (
                        <div className="text-[12px] font-medium text-indigo-500 tabular-nums font-display group-hover:underline decoration-indigo-200">
                          {l.limit.toLocaleString('tr-TR', { minimumFractionDigits: 1 })}<span className="text-[10px] ml-0.5 opacity-50">₺</span>
                        </div>
                      )}
                    </td>
                    <td className={`px-1 py-1.5 pr-3 text-right font-medium tabular-nums font-display ${remaining < 0 ? 'text-rose-500' : 'text-slate-900 dark:text-slate-100'}`}>
                      {remaining.toLocaleString('tr-TR', { minimumFractionDigits: 1 })}<span className="text-[10px] ml-0.5 opacity-40 text-slate-400">₺</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <motion.div 
          whileHover={{ scale: 1.005 }}
          className="bg-white dark:bg-slate-950/40 rounded-2xl p-1.5 border border-slate-100 dark:border-slate-900 space-y-0.5"
        >
          <div className="grid grid-cols-2 gap-1">
            <input placeholder="Harcama" className="w-full bg-slate-50 dark:bg-slate-900/50 px-2.5 py-1.5 rounded-lg text-[10px] font-medium uppercase outline-none" value={manualForm.konu} onChange={e => setManualForm({...manualForm, konu: e.target.value})} />
            <input placeholder="Market" className="w-full bg-slate-50 dark:bg-slate-900/50 px-2.5 py-1.5 rounded-lg text-[10px] font-medium uppercase outline-none" value={manualForm.market} onChange={e => setManualForm({...manualForm, market: e.target.value})} />
          </div>
          <div className="flex gap-1">
            <select className="flex-1 bg-slate-50 dark:bg-slate-900/50 px-2 py-1.5 rounded-lg text-[10px] font-medium uppercase outline-none cursor-pointer" value={manualForm.kategori} onChange={e => setManualForm({...manualForm, kategori: e.target.value})}>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <input type="date" className="flex-1 bg-slate-50 dark:bg-slate-900/50 px-2 py-1.5 rounded-lg text-[10px] font-medium outline-none" value={manualForm.tarih} onChange={e => setManualForm({...manualForm, tarih: e.target.value})} />
          </div>
          <div className="flex items-center gap-1">
            <div className="flex-1 relative">
              <input placeholder="0.00" className="w-full bg-indigo-50/20 dark:bg-slate-900/50 px-2.5 py-1.5 rounded-lg text-[12px] font-medium text-right outline-none font-display text-indigo-600" value={manualForm.ucret} onChange={e => setManualForm({...manualForm, ucret: e.target.value})} />
              <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-indigo-300 font-medium text-[10px]">₺</div>
            </div>
            <motion.button 
              whileTap={{ scale: 0.9 }}
              onClick={handleAddManual} 
              className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
            >
              <Plus size={14} />
            </motion.button>
          </div>
        </motion.div>

        <div className="space-y-1">
          <div className="flex flex-col gap-0.5">
            <div className="flex gap-1 overflow-x-auto no-scrollbar px-0.5">
              <motion.button 
                whileTap={{ scale: 0.95 }}
                onClick={() => setSelectedCategory('Hepsi')} 
                className={`px-3.5 py-2 rounded-xl text-[9px] font-medium uppercase whitespace-nowrap border transition-all ${selectedCategory === 'Hepsi' ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-200 dark:shadow-none' : 'bg-white dark:bg-slate-900 text-slate-500 border-slate-200/60 dark:border-slate-800 hover:border-slate-300'}`}
              >
                HEPSİ
              </motion.button>
              {categories.map(cat => (
                <motion.button 
                  whileTap={{ scale: 0.95 }}
                  key={cat} 
                  onClick={() => setSelectedCategory(cat)} 
                  className={`px-3.5 py-2 rounded-xl text-[9px] font-medium uppercase whitespace-nowrap border transition-all ${selectedCategory === cat ? getCategoryColor(cat) + ' border-transparent shadow-md' : 'bg-white dark:bg-slate-900 text-slate-500 border-slate-200/60 dark:border-slate-800 hover:border-slate-300'}`}
                >
                  {cat}
                </motion.button>
              ))}
            </div>

            <motion.div 
              layout
              className="bg-indigo-600 dark:bg-indigo-700 rounded-[28px] p-5 text-white shadow-xl shadow-indigo-100 dark:shadow-none border border-white/10 relative overflow-hidden group"
            >
              <div className="absolute -right-4 -top-4 opacity-10 group-hover:scale-110 transition-transform">
                <TrendingUp size={120} />
              </div>
              
              <div className="flex items-center justify-between mb-4 relative z-10">
                <div className="flex flex-col">
                  <span className="text-[9px] font-medium uppercase tracking-[0.2em] opacity-70 mb-0.5">{selectedCategory === 'Hepsi' ? 'Toplam Harcama' : selectedCategory}</span>
                  <div className="text-3xl font-medium tracking-tighter tabular-nums font-display">
                    {categoryTotalSpent.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}<span className="text-base ml-1 opacity-50">₺</span>
                  </div>
                </div>
                <div className="bg-white/20 backdrop-blur-md p-2.5 rounded-xl">
                  <ArrowUpRight size={20} />
                </div>
              </div>
              
              <div className="space-y-2 relative z-10">
                <div className="flex items-center gap-1.5">
                  <BarChart size={10} className="opacity-70" />
                  <span className="text-[8px] font-medium uppercase tracking-[0.2em] opacity-70">Haftalık Analiz</span>
                </div>
                <div className="flex gap-1.5 items-end h-10">
                  {weeklyStats.map((val, idx) => {
                    const h = (val / maxWeekly) * 100;
                    return (
                      <div 
                        key={idx} 
                        className="flex-1 flex flex-col items-center gap-1 group/week relative h-full cursor-pointer"
                        onClick={() => setActiveWeekTooltip(activeWeekTooltip === idx ? null : idx)}
                      >
                        <AnimatePresence>
                          {activeWeekTooltip === idx && (
                            <motion.div 
                              initial={{ opacity: 0, scale: 0.8, y: 5 }}
                              animate={{ opacity: 1, scale: 1, y: 0 }}
                              exit={{ opacity: 0, scale: 0.8, y: 5 }}
                              className="absolute -top-8 left-1/2 -translate-x-1/2 bg-white text-indigo-600 text-[9px] font-medium py-1 px-2.5 rounded-lg shadow-2xl z-30 whitespace-nowrap"
                            >
                              {val.toLocaleString('tr-TR', { minimumFractionDigits: 0 })}₺
                            </motion.div>
                          )}
                        </AnimatePresence>
                        
                        <div className="w-full bg-white/10 rounded-md overflow-hidden h-full flex items-end">
                          <motion.div 
                            initial={{ height: 0 }}
                            animate={{ height: `${Math.max(h, 8)}%` }}
                            className={`w-full transition-colors duration-300 ${activeWeekTooltip === idx ? 'bg-indigo-300' : 'bg-white'}`} 
                          ></motion.div>
                        </div>
                        <span className={`text-[6px] font-medium tracking-widest transition-opacity ${activeWeekTooltip === idx ? 'opacity-100' : 'opacity-50'}`}>H{idx+1}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-[28px] border border-slate-200/50 dark:border-slate-800 shadow-sm overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
            {filteredReceipts.length > 0 ? (
              filteredReceipts.map((r) => {
                const isSelected = selectedIds.includes(r.id);
                return (
                  <motion.div 
                    layout
                    key={r.id} 
                    className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors group border-l-4 ${
                      isSelected 
                        ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-500' 
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/30 border-transparent dark:border-slate-800'
                    }`}
                  >
                    {onToggleSelect && (
                      <div 
                        className="shrink-0 p-1"
                        onClick={(e) => { e.stopPropagation(); onToggleSelect(r.id); }}
                      >
                        <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                          isSelected ? 'bg-indigo-600 border-indigo-600' : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700'
                        }`}>
                          {isSelected && <div className="w-1.5 h-1.5 bg-white rounded-full"></div>}
                        </div>
                      </div>
                    )}
                    <div className="flex-1 flex items-center gap-3 min-w-0" onClick={() => onViewReceipt(r)}>
                      <div className={`w-1 h-8 rounded-full shrink-0 ${getCategoryColor(r.category).split(' ')[1].replace('text-', 'bg-')}`}></div>
                      <div className="flex-1 min-w-0">
                        <span className="font-medium block truncate uppercase text-[10px] text-slate-800 dark:text-slate-100 leading-tight mb-0.5 tracking-tight group-hover:text-indigo-600 transition-colors font-display tracking-tight">{r.vendor}</span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[8px] font-medium text-slate-400 tabular-nums">{formatDateForDisplay(r.date)}</span>
                          <div className="w-0.5 h-0.5 rounded-full bg-slate-200 dark:bg-slate-800"></div>
                          <span className={`text-[7px] font-medium px-1.5 py-0 rounded-md border uppercase tracking-wider truncate max-w-[80px] ${getCategoryColor(r.category)}`}>{r.category}</span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end shrink-0 ml-1">
                        <div className="text-xs font-medium text-slate-900 dark:text-slate-100 tabular-nums font-display mb-0.5">{r.total.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}<span className="text-[9px] ml-0.5 opacity-40">₺</span></div>
                        <motion.button 
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={(e) => { e.stopPropagation(); onDeleteReceipt(r.id); }} 
                          className="p-1 text-slate-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-md transition-all"
                        >
                          <Trash2 size={12} />
                        </motion.button>
                      </div>
                    </div>
                  </motion.div>
                );
              })
            ) : (
              <div className="py-12 flex flex-col items-center justify-center text-center px-6">
                 <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-full mb-3">
                   <TrendingDown size={24} className="text-slate-300" />
                 </div>
                 <p className="text-[10px] font-medium text-slate-400 uppercase tracking-widest">Bu kategoride harcama yok</p>
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {showTransfer && (
        <div className="fixed inset-0 z-[100] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-xs rounded-3xl p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center">
              <h4 className="text-[10px] font-medium uppercase tracking-widest text-slate-400">Bütçe Transferi</h4>
              <X size={18} onClick={() => setShowTransfer(false)} className="text-slate-400 cursor-pointer" />
            </div>
            <div className="space-y-3">
              <select className="w-full p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl text-xs font-medium" value={transferForm.from} onChange={e => setTransferForm({...transferForm, from: e.target.value})}><option value="">Nereden Alınsın?</option>{categories.map(c => <option key={c} value={c}>{c}</option>)}</select>
              <select className="w-full p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl text-xs font-medium" value={transferForm.to} onChange={e => setTransferForm({...transferForm, to: e.target.value})}><option value="">Nereye Aktarılsın?</option>{categories.map(c => <option key={c} value={c}>{c}</option>)}</select>
              <input type="number" placeholder="Tutar (₺)" className="w-full p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl text-xs font-medium" value={transferForm.amount} onChange={e => setTransferForm({...transferForm, amount: e.target.value})} />
              <button onClick={handleTransfer} className="w-full py-4 bg-indigo-600 text-white rounded-2xl text-[10px] font-medium uppercase shadow-lg">Aktar</button>
            </div>
          </div>
        </div>
      )}

      {showManageCategories && (
        <div className="fixed inset-0 z-[100] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-xs rounded-3xl p-6 space-y-4 shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
            <div className="flex justify-between items-center">
              <h4 className="text-[10px] font-medium uppercase tracking-widest text-slate-400">Kategori Yönetimi</h4>
              <X size={18} onClick={() => setShowManageCategories(false)} className="text-slate-400 cursor-pointer" />
            </div>
            <div className="flex gap-2">
              <input className="flex-1 p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl text-xs font-medium outline-none" placeholder="Yeni Ad..." value={newCatName} onChange={e => setNewCatName(e.target.value)} />
              <button onClick={() => { if(newCatName && !categories.includes(newCatName)) { setCategories([...categories, newCatName]); setNewCatName(""); } }} className="bg-indigo-600 text-white w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg"><Plus size={24} /></button>
            </div>
            <div className="overflow-y-auto space-y-2 pr-1 custom-scrollbar">
              {categories.map(cat => (
                <div key={cat} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border dark:border-slate-700">
                  <span className="text-[11px] font-medium uppercase">{cat}</span>
                  <Trash2 size={16} className="text-red-400 cursor-pointer" onClick={() => handleDeleteCategory(cat)} />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

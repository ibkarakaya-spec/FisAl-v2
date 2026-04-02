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
  FileDown
} from 'lucide-react';
import { getCategoryColor } from './ReceiptTable.tsx';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

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
  setSelectedMonth
}) => {
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
    return receipts.filter(r => {
      if (selectedMonth === "Hepsi") return true;
      let rMonth = r.date.includes('.') ? `${r.date.split('.')[2]}-${r.date.split('.')[1]}` : r.date.substring(0, 7);
      return rMonth === selectedMonth;
    }).sort((a, b) => b.date.split('.').reverse().join('-').localeCompare(a.date.split('.').reverse().join('-')));
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

  const exportToPDF = () => {
    window.print();
  };

  return (
    <div className="space-y-4 pb-10" id="budget-content">
      <div className="no-print flex items-center justify-between gap-1">
        <div className="flex items-center gap-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1 shadow-sm">
          <Calendar size={12} className="text-slate-400" />
          <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="text-[10px] font-semibold bg-transparent dark:text-slate-200 outline-none cursor-pointer">
            <option value="Hepsi">Tümü</option>
            {availableMonths.map(m => {
              const [y, mm] = m.split('-');
              const ms = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
              return <option key={m} value={m}>{`${ms[parseInt(mm) - 1]} ${y}`}</option>;
            })}
          </select>
        </div>
        <div className="flex gap-1">
          <button onClick={exportToPDF} className="p-1.5 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 rounded-lg border border-emerald-100 dark:border-emerald-900/30"><FileDown size={14} /></button>
          <button onClick={() => setShowTransfer(true)} className="p-1.5 bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 rounded-lg border border-indigo-100 dark:border-indigo-900/30"><Repeat size={14} /></button>
          <button onClick={() => setShowManageCategories(true)} className="p-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 rounded-lg border border-slate-200 dark:border-slate-700"><Settings size={14} /></button>
        </div>
      </div>

      <div className="no-print space-y-4">
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <table className="w-full text-left table-fixed">
            <thead className="bg-slate-50 dark:bg-slate-800/40 text-[8px] font-bold text-slate-400 uppercase tracking-widest border-b dark:border-slate-800">
              <tr>
                <th className="px-3 py-2.5 w-4/12">KATEGORİ</th>
                <th className="px-1 py-2.5 text-right w-4/12">LİMİT (₺)</th>
                <th className="px-1 py-2.5 text-right w-4/12">KALAN (₺)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
              {currentLimits.map((l) => {
                const spent = spentPerCategory[l.category] || 0;
                const remaining = l.limit - spent;
                const isEditing = editingLimitCategory === l.category;
                
                return (
                  <tr key={l.category} className="text-[10px] dark:text-slate-400">
                    <td className="px-3 py-2 font-semibold truncate uppercase">{l.category}</td>
                    <td 
                      className="px-1 py-2 text-right cursor-pointer group" 
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
                            className="w-full bg-slate-100 dark:bg-slate-800 border-none text-right text-[11px] font-bold text-indigo-500 outline-none rounded px-1" 
                            placeholder="0" 
                          />
                        </div>
                      ) : (
                        <div className="text-[11px] font-semibold text-indigo-500 tabular-nums">
                          {l.limit.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}<span className="text-[10px] font-bold">₺</span>
                        </div>
                      )}
                    </td>
                    <td className={`px-1 py-2 text-right font-bold tabular-nums ${remaining < 0 ? 'text-red-500' : 'dark:text-slate-100'}`}>
                      {remaining.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}₺
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl p-3 border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <input placeholder="Harcama Adı" className="w-full bg-slate-50 dark:bg-slate-800 px-3 py-2 rounded-xl text-[10px] font-semibold uppercase outline-none" value={manualForm.konu} onChange={e => setManualForm({...manualForm, konu: e.target.value})} />
            <input placeholder="Market" className="w-full bg-slate-50 dark:bg-slate-800 px-3 py-2 rounded-xl text-[10px] font-semibold uppercase outline-none" value={manualForm.market} onChange={e => setManualForm({...manualForm, market: e.target.value})} />
          </div>
          <div className="flex gap-2">
            <select className="flex-1 bg-slate-50 dark:bg-slate-800 px-2 py-2 rounded-xl text-[10px] font-bold uppercase outline-none" value={manualForm.kategori} onChange={e => setManualForm({...manualForm, kategori: e.target.value})}>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <input type="date" className="flex-1 bg-slate-50 dark:bg-slate-800 px-2 py-2 rounded-xl text-[10px] font-bold outline-none" value={manualForm.tarih} onChange={e => setManualForm({...manualForm, tarih: e.target.value})} />
          </div>
          <div className="flex items-center gap-2">
            <input placeholder="Tutar (₺)" className="flex-1 bg-indigo-50/30 dark:bg-slate-800 px-3 py-2 rounded-xl text-xs font-bold text-right outline-none" value={manualForm.ucret} onChange={e => setManualForm({...manualForm, ucret: e.target.value})} />
            <button onClick={handleAddManual} className="bg-indigo-600 text-white w-10 h-10 rounded-xl flex items-center justify-center shadow-lg active:scale-90 transition-transform"><Plus size={20} /></button>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex flex-col gap-2">
            <div className="flex gap-1 overflow-x-auto no-scrollbar px-1 pb-1">
              <button onClick={() => setSelectedCategory('Hepsi')} className={`px-4 py-1.5 rounded-full text-[9px] font-bold uppercase whitespace-nowrap border transition-all ${selectedCategory === 'Hepsi' ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' : 'bg-white dark:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-800'}`}>HEPSİ</button>
              {categories.map(cat => (
                <button key={cat} onClick={() => setSelectedCategory(cat)} className={`px-4 py-1.5 rounded-full text-[9px] font-bold uppercase whitespace-nowrap border transition-all ${selectedCategory === cat ? getCategoryColor(cat) + ' shadow-sm' : 'bg-white dark:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-800'}`}>{cat}</button>
              ))}
            </div>

            <div className="bg-indigo-600 dark:bg-indigo-700 rounded-3xl p-4 text-white shadow-xl border border-white/10 relative overflow-hidden">
              <div className="flex items-center justify-between mb-4">
                <div className="flex flex-col">
                  <span className="text-[8px] font-bold uppercase tracking-widest opacity-60">{selectedCategory === 'Hepsi' ? 'Toplam Harcama' : selectedCategory}</span>
                  <div className="text-2xl font-extrabold tracking-tighter tabular-nums">{categoryTotalSpent.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}₺</div>
                </div>
                <div className="bg-white/20 p-2 rounded-2xl"><TrendingUp size={20} /></div>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <BarChart size={10} className="opacity-60" />
                  <span className="text-[7px] font-bold uppercase tracking-widest opacity-60">Haftalık Dağılım</span>
                </div>
                <div className="flex gap-1.5 items-end h-8">
                  {weeklyStats.map((val, idx) => {
                    const h = (val / maxWeekly) * 100;
                    return (
                      <div 
                        key={idx} 
                        className="flex-1 flex flex-col items-center gap-1 group relative h-full cursor-pointer"
                        onClick={() => setActiveWeekTooltip(activeWeekTooltip === idx ? null : idx)}
                      >
                        {activeWeekTooltip === idx && (
                          <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-[7px] font-bold py-1 px-1.5 rounded-lg shadow-xl z-30 whitespace-nowrap animate-in fade-in slide-in-from-bottom-1">
                            {val.toLocaleString('tr-TR', { minimumFractionDigits: 0 })}₺
                          </div>
                        )}
                        
                        <div className="w-full bg-white/10 rounded-sm overflow-hidden h-full flex items-end">
                          <div 
                            className={`w-full transition-all duration-500 ${activeWeekTooltip === idx ? 'bg-indigo-300' : 'bg-white'}`} 
                            style={{ height: `${Math.max(h, 5)}%` }}
                          ></div>
                        </div>
                        <span className={`text-[5px] font-bold transition-opacity ${activeWeekTooltip === idx ? 'opacity-100' : 'opacity-40'}`}>H{idx+1}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden divide-y divide-slate-50 dark:divide-slate-800">
            {filteredReceipts.map((r) => (
              <div key={r.id} onClick={() => onViewReceipt(r)} className="flex items-center gap-3 px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/30 cursor-pointer transition-colors">
                <div className={`w-1 self-stretch rounded-full ${getCategoryColor(r.category).split(' ')[1].replace('text-', 'bg-')}`}></div>
                <div className="flex-1 min-w-0">
                  <span className="font-bold block truncate uppercase text-[10px] text-slate-800 dark:text-slate-100 leading-tight mb-0.5">{r.vendor}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[8px] font-semibold text-slate-400">{r.date}</span>
                    <span className={`text-[7px] font-bold px-1.5 py-0 rounded-full border uppercase tracking-tighter truncate max-w-[80px] ${getCategoryColor(r.category)}`}>{r.category}</span>
                  </div>
                </div>
                <div className="flex flex-col items-end shrink-0 ml-1">
                  <div className="text-[11px] font-bold text-slate-900 dark:text-slate-100 tabular-nums">{r.total.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}₺</div>
                  <button onClick={(e) => { e.stopPropagation(); onDeleteReceipt(r.id); }} className="p-1 text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={12} /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {showTransfer && (
        <div className="fixed inset-0 z-[100] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-xs rounded-3xl p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center">
              <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Bütçe Transferi</h4>
              <X size={18} onClick={() => setShowTransfer(false)} className="text-slate-400 cursor-pointer" />
            </div>
            <div className="space-y-3">
              <select className="w-full p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl text-xs font-bold" value={transferForm.from} onChange={e => setTransferForm({...transferForm, from: e.target.value})}><option value="">Nereden Alınsın?</option>{categories.map(c => <option key={c} value={c}>{c}</option>)}</select>
              <select className="w-full p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl text-xs font-bold" value={transferForm.to} onChange={e => setTransferForm({...transferForm, to: e.target.value})}><option value="">Nereye Aktarılsın?</option>{categories.map(c => <option key={c} value={c}>{c}</option>)}</select>
              <input type="number" placeholder="Tutar (₺)" className="w-full p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl text-xs font-bold" value={transferForm.amount} onChange={e => setTransferForm({...transferForm, amount: e.target.value})} />
              <button onClick={handleTransfer} className="w-full py-4 bg-indigo-600 text-white rounded-2xl text-[10px] font-bold uppercase shadow-lg">Aktar</button>
            </div>
          </div>
        </div>
      )}

      {showManageCategories && (
        <div className="fixed inset-0 z-[100] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-xs rounded-3xl p-6 space-y-4 shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
            <div className="flex justify-between items-center">
              <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Kategori Yönetimi</h4>
              <X size={18} onClick={() => setShowManageCategories(false)} className="text-slate-400 cursor-pointer" />
            </div>
            <div className="flex gap-2">
              <input className="flex-1 p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl text-xs font-bold outline-none" placeholder="Yeni Ad..." value={newCatName} onChange={e => setNewCatName(e.target.value)} />
              <button onClick={() => { if(newCatName && !categories.includes(newCatName)) { setCategories([...categories, newCatName]); setNewCatName(""); } }} className="bg-indigo-600 text-white w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg"><Plus size={24} /></button>
            </div>
            <div className="overflow-y-auto space-y-2 pr-1 custom-scrollbar">
              {categories.map(cat => (
                <div key={cat} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border dark:border-slate-700">
                  <span className="text-[11px] font-bold uppercase">{cat}</span>
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

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
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

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

  const exportToExcel = async () => {
    const monthName = selectedMonth === "Hepsi" ? "Tüm Zamanlar" : activeMonthKey;
    const dateStr = new Date().toLocaleDateString('tr-TR');

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Harcama Raporu');

    // Header Styles
    const mainHeaderStyle: Partial<ExcelJS.Style> = {
      font: { name: 'Inter', size: 16, bold: true, color: { argb: 'FFFFFFFF' } },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } },
      alignment: { vertical: 'middle', horizontal: 'center' }
    };

    const subHeaderStyle: Partial<ExcelJS.Style> = {
      font: { name: 'Inter', size: 10, bold: true, color: { argb: 'FF1E1B4B' } },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } },
      border: { bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } } }
    };

    const tableHeaderStyle: Partial<ExcelJS.Style> = {
      font: { name: 'Inter', size: 10, bold: true, color: { argb: 'FFFFFFFF' } },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E1B4B' } },
      alignment: { vertical: 'middle', horizontal: 'center' },
      border: {
        top: { style: 'thin', color: { argb: 'FF000000' } },
        bottom: { style: 'thin', color: { argb: 'FF000000' } }
      }
    };

    // Title
    worksheet.mergeCells('A1:G1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = 'BÜTÇE VE HARCAMA RAPORU';
    titleCell.style = mainHeaderStyle;
    worksheet.getRow(1).height = 40;

    // Report Info
    worksheet.addRow(['Rapor Dönemi:', monthName]);
    worksheet.addRow(['Oluşturulma:', dateStr]);
    worksheet.addRow(['Toplam Harcama:', `${categoryTotalSpent.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}₺`]);
    worksheet.addRow(['Seçili Kategori:', selectedCategory]);
    worksheet.addRow([]);

    // Data Table Headers
    const headerRow = worksheet.addRow(['TARİH', 'MAĞAZA', 'KATEGORİ', 'FİŞ TOPLAM', 'ÜRÜN ADI', 'BİRİM FİYAT', 'ADET']);
    headerRow.eachCell((cell) => {
      cell.style = tableHeaderStyle;
    });
    worksheet.getRow(headerRow.number).height = 25;

    // Data
    filteredReceipts.forEach(r => {
      if (r.items && r.items.length > 0) {
        r.items.forEach((item, idx) => {
          const row = worksheet.addRow([
            idx === 0 ? formatDateForDisplay(r.date) : "",
            idx === 0 ? r.vendor.toUpperCase() : "",
            idx === 0 ? r.category.toUpperCase() : "",
            idx === 0 ? r.total : "",
            item.name.toUpperCase(),
            item.price,
            item.quantity || 1
          ]);

          // Styling for rows
          if (idx === 0) {
            row.eachCell((cell, colNumber) => {
              if (colNumber <= 4) cell.font = { bold: true };
              cell.border = { top: { style: 'thin', color: { argb: 'FFF1F5F9' } } };
            });
          }
          
          // Number formatting
          row.getCell(4).numFmt = '#,##0.00"₺"';
          row.getCell(6).numFmt = '#,##0.00"₺"';
        });
      } else {
        const row = worksheet.addRow([
          formatDateForDisplay(r.date),
          r.vendor.toUpperCase(),
          r.category.toUpperCase(),
          r.total,
          "BİLİNMEYEN ÜRÜN",
          r.total,
          1
        ]);
        row.getCell(4).numFmt = '#,##0.00"₺"';
        row.getCell(6).numFmt = '#,##0.00"₺"';
        row.font = { bold: true };
      }
    });

    // Column Widths
    worksheet.columns = [
      { width: 15 }, // Tarih
      { width: 25 }, // Mağaza
      { width: 20 }, // Kategori
      { width: 15 }, // Fiş Toplam
      { width: 35 }, // Ürün Adı
      { width: 15 }, // Birim Fiyat
      { width: 10 }  // Adet
    ];

    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), `Butce_Raporu_${monthName.replace(' ', '_')}.xlsx`);
  };

  const exportToPDF = async () => {
    const input = document.getElementById('budget-content');
    if (!input) return;
    
    // Create a temporary container for a professional PDF layout
    const printContainer = document.createElement('div');
    printContainer.style.position = 'fixed';
    printContainer.style.left = '-9999px';
    printContainer.style.top = '0';
    printContainer.style.width = '210mm'; // A4 width
    printContainer.style.padding = '20mm';
    printContainer.style.background = '#ffffff';
    printContainer.style.color = '#000000';
    printContainer.style.fontFamily = 'Inter, sans-serif';
    
    const dateStr = new Date().toLocaleDateString('tr-TR');
    const monthName = selectedMonth === "Hepsi" ? "Tüm Zamanlar" : activeMonthKey;

    printContainer.innerHTML = `
      <div style="border-bottom: 5px solid #1e1b4b; padding-bottom: 25px; margin-bottom: 35px; display: flex; justify-content: space-between; align-items: flex-end;">
        <div>
          <h1 style="font-size: 36px; font-weight: 900; color: #1e1b4b; margin: 0; letter-spacing: -1.5px;">BÜTÇE RAPORU</h1>
          <p style="font-size: 16px; color: #4f46e5; margin: 5px 0 0 0; font-weight: 700; text-transform: uppercase; letter-spacing: 2px;">${monthName}</p>
        </div>
        <div style="text-align: right;">
          <p style="font-size: 11px; color: #94a3b8; margin: 0; font-weight: 800; text-transform: uppercase;">RAPOR TARİHİ</p>
          <p style="font-size: 16px; color: #1e1b4b; margin: 0; font-weight: 900;">${dateStr}</p>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 25px; margin-bottom: 45px;">
        <div style="background: #f8fafc; padding: 25px; border-radius: 20px; border: 1px solid #e2e8f0; border-bottom: 4px solid #4f46e5;">
          <p style="font-size: 11px; color: #64748b; margin: 0 0 10px 0; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">TOPLAM HARCAMA</p>
          <p style="font-size: 28px; font-weight: 950; color: #1e1b4b; margin: 0; letter-spacing: -1px;">${categoryTotalSpent.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}₺</p>
        </div>
        <div style="background: #f8fafc; padding: 25px; border-radius: 20px; border: 1px solid #e2e8f0; border-bottom: 4px solid #1e1b4b;">
          <p style="font-size: 11px; color: #64748b; margin: 0 0 10px 0; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">KATEGORİ</p>
          <p style="font-size: 28px; font-weight: 950; color: #1e1b4b; margin: 0; letter-spacing: -1px;">${selectedCategory}</p>
        </div>
        <div style="background: #f8fafc; padding: 25px; border-radius: 20px; border: 1px solid #e2e8f0; border-bottom: 4px solid #10b981;">
          <p style="font-size: 11px; color: #64748b; margin: 0 0 10px 0; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">FİŞ SAYISI</p>
          <p style="font-size: 28px; font-weight: 950; color: #1e1b4b; margin: 0; letter-spacing: -1px;">${filteredReceipts.length}</p>
        </div>
      </div>

      <div>
        <h2 style="font-size: 16px; font-weight: 900; color: #1e1b4b; margin-bottom: 25px; text-transform: uppercase; letter-spacing: 1.5px; display: flex; align-items: center; gap: 12px;">
          <span style="width: 6px; height: 20px; background: #4f46e5; border-radius: 3px;"></span>
          HARCAMA VE ÜRÜN DETAYLARI
        </h2>
        <table style="width: 100%; border-collapse: separate; border-spacing: 0;">
          <thead>
            <tr style="text-align: left; background: #1e1b4b;">
              <th style="padding: 15px; font-size: 11px; color: #ffffff; text-transform: uppercase; border-top-left-radius: 12px; font-weight: 800;">TARİH / MAĞAZA</th>
              <th style="padding: 15px; font-size: 11px; color: #ffffff; text-transform: uppercase; font-weight: 800;">ÜRÜN / HİZMET</th>
              <th style="padding: 15px; font-size: 11px; color: #ffffff; text-transform: uppercase; text-align: right; border-top-right-radius: 12px; font-weight: 800;">TUTAR</th>
            </tr>
          </thead>
          <tbody>
            ${filteredReceipts.map(r => `
              <tr style="background: #f8fafc; border-top: 2px solid #ffffff;">
                <td style="padding: 15px; vertical-align: top; width: 30%;">
                  <div style="font-size: 10px; color: #64748b; font-weight: 700; margin-bottom: 4px;">${formatDateForDisplay(r.date)}</div>
                  <div style="font-size: 13px; font-weight: 900; color: #1e1b4b; text-transform: uppercase;">${r.vendor}</div>
                  <div style="margin-top: 6px;"><span style="background: #e2e8f0; padding: 2px 8px; border-radius: 6px; font-size: 9px; font-weight: 800; color: #475569; text-transform: uppercase;">${r.category}</span></div>
                  <div style="margin-top: 8px; font-size: 14px; font-weight: 900; color: #4f46e5;">TOPLAM: ${r.total.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}₺</div>
                </td>
                <td colspan="2" style="padding: 0; vertical-align: top;">
                  <table style="width: 100%; border-collapse: collapse;">
                    <tbody>
                      ${(r.items && r.items.length > 0 ? r.items : [{ name: 'BİLİNMEYEN ÜRÜN', price: r.total, quantity: 1 }]).map((item, idx) => `
                        <tr style="border-bottom: 1px solid #e2e8f0;">
                          <td style="padding: 12px 15px; font-size: 11px; color: #475569; font-weight: 600;">
                            ${item.name.toUpperCase()} 
                            <span style="color: #94a3b8; font-size: 9px; margin-left: 5px;">(X${item.quantity || 1})</span>
                          </td>
                          <td style="padding: 12px 15px; font-size: 11px; font-weight: 800; text-align: right; color: #1e1b4b; width: 100px;">
                            ${item.price.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}₺
                          </td>
                        </tr>
                      `).join('')}
                    </tbody>
                  </table>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <div style="margin-top: 60px; text-align: center; border-top: 2px dashed #e2e8f0; padding-top: 30px;">
        <p style="font-size: 11px; color: #94a3b8; font-weight: 700; letter-spacing: 1px;">BU RAPOR FİŞAI AKILLI TAKİP SİSTEMİ TARAFINDAN OLUŞTURULMUŞTUR.</p>
        <p style="font-size: 10px; color: #cbd5e1; margin-top: 5px;">© ${new Date().getFullYear()} TÜM HAKLARI SAKLIDIR.</p>
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
      
      // Multi-page logic
      let heightLeft = pdfHeight;
      let position = 0;
      const pageHeight = pdf.internal.pageSize.getHeight();

      pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
      heightLeft -= pageHeight;

      while (heightLeft >= 0) {
        position = heightLeft - pdfHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
        heightLeft -= pageHeight;
      }

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
        className="bg-brand dark:bg-brand/90 rounded-[32px] p-7 text-white shadow-2xl shadow-brand/20 relative overflow-hidden group"
      >
        <div className="absolute -right-8 -top-8 w-48 h-48 bg-white/5 rounded-full blur-3xl group-hover:bg-white/10 transition-colors"></div>
        
        <div className="flex items-center justify-between mb-6 relative z-10">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-medium uppercase tracking-[0.2em] opacity-70 leading-none">{selectedCategory === 'Hepsi' ? 'Toplam Harcama' : selectedCategory}</span>
            <div className="text-4xl font-medium tracking-tighter tabular-nums flex items-baseline gap-1.5 font-display">
              {categoryTotalSpent.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
              <span className="text-xl font-serif italic text-white/40">₺</span>
            </div>
          </div>
          <div className="bg-white/10 backdrop-blur-xl p-3 rounded-2xl border border-white/10">
            <TrendingUp size={24} />
          </div>
        </div>
        
        <div className="space-y-3 relative z-10">
          <div className="flex items-center gap-2">
            <BarChart size={12} className="opacity-70" />
            <span className="text-[9px] font-medium uppercase tracking-[0.2em] opacity-70">Haftalık Dağılım</span>
          </div>
          <div className="flex gap-2 items-end h-12">
            {weeklyStats.map((val, idx) => {
              const h = (val / maxWeekly) * 100;
              return (
                <div 
                  key={idx} 
                  className="flex-1 flex flex-col items-center gap-1.5 group/week relative h-full cursor-pointer"
                  onClick={() => setActiveWeekTooltip(activeWeekTooltip === idx ? null : idx)}
                >
                  <AnimatePresence>
                    {activeWeekTooltip === idx && (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.8, y: 5 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.8, y: 5 }}
                        className="absolute -top-10 left-1/2 -translate-x-1/2 bg-white text-brand text-[10px] font-medium py-1.5 px-3 rounded-xl shadow-2xl z-30 whitespace-nowrap"
                      >
                        {val.toLocaleString('tr-TR', { minimumFractionDigits: 0 })}₺
                      </motion.div>
                    )}
                  </AnimatePresence>
                  
                  <div className="w-full bg-white/10 rounded-full overflow-hidden h-full flex items-end">
                    <motion.div 
                      initial={{ height: 0 }}
                      animate={{ height: `${Math.max(h, 15)}%` }}
                      className={`w-full transition-all duration-500 rounded-full ${activeWeekTooltip === idx ? 'bg-white' : 'bg-white/60'}`} 
                    ></motion.div>
                  </div>
                  <span className={`text-[7px] font-medium tracking-widest transition-opacity ${activeWeekTooltip === idx ? 'opacity-100' : 'opacity-40'}`}>H{idx+1}</span>
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
                        <span className="text-[13px] font-serif italic font-medium block truncate uppercase text-slate-900 dark:text-white leading-tight mb-0.5 tracking-tight group-hover:text-brand transition-colors">{r.vendor}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-medium text-slate-400 tabular-nums">{formatDateForDisplay(r.date)}</span>
                          <div className="w-0.5 h-0.5 rounded-full bg-slate-200 dark:bg-slate-800"></div>
                          <span className={`text-[8px] font-medium px-2 py-0.5 rounded-full border uppercase tracking-wider truncate max-w-[80px] ${getCategoryColor(r.category)}`}>{r.category}</span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end shrink-0 ml-1">
                        <div className="text-[15px] font-medium text-slate-900 dark:text-white tabular-nums font-display flex items-baseline gap-0.5">
                          {r.total.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                          <span className="text-[11px] font-serif italic text-slate-300 dark:text-slate-600">₺</span>
                        </div>
                        <motion.button 
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={(e) => { e.stopPropagation(); onDeleteReceipt(r.id); }} 
                          className="p-1 px-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg transition-all"
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

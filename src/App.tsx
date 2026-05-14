import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  Camera, Loader2, LayoutDashboard, TrendingUp, X, Wallet, Settings as SettingsIcon, Cloud as CloudIcon, HardDrive, Plus, ArrowRight, ScanText, ChevronDown, Trash2, QrCode, Image as ImageIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { extractReceiptData, DEFAULT_CATEGORIES } from './services/geminiService.ts';
import { ReceiptData, AppStatus, ThemeMode } from './types.ts';
import { ReceiptTable } from './components/ReceiptTable.tsx';
import { ReceiptDetailModal } from './components/ReceiptDetailModal.tsx';
import { ProductHistory } from './components/ProductHistory.tsx';
import { BudgetManager } from './components/BudgetManager.tsx';
import { autoEnhance } from './services/imageProcessing.ts';
import { ConfirmModal } from './components/ConfirmModal.tsx';
import { SyncModal } from './components/SyncModal.tsx';
import { CameraCapture } from './components/CameraCapture.tsx';
import { ManualEntryModal } from './components/ManualEntryModal.tsx';
import { Keyboard } from 'lucide-react';

const App: React.FC = () => {
  const [isInitializing, setIsInitializing] = useState(false);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'prices' | 'budget'>('dashboard');
  const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [statusText, setStatusText] = useState<string>('');
  const [receipts, setReceipts] = useState<ReceiptData[]>(() => {
    const saved = localStorage.getItem('fis_ai_receipts');
    return saved ? JSON.parse(saved) : [];
  });
  const [categories, setCategories] = useState<string[]>(() => {
    const saved = localStorage.getItem('app_categories');
    return saved ? JSON.parse(saved) : DEFAULT_CATEGORIES;
  });
  const [selectedReceipt, setSelectedReceipt] = useState<ReceiptData | null>(null);
  const [theme, setTheme] = useState<ThemeMode>(() => (localStorage.getItem('app_theme') as ThemeMode) || 'system');
  const [showSettings, setShowSettings] = useState(false);
  const [confirmState, setConfirmState] = useState({ isOpen: false, title: '', message: '', onConfirm: () => {} });
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [showManualEntry, setShowManualEntry] = useState(false);
  
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  
  const [dashboardMonth, setDashboardMonth] = useState<string>(() => {
    return localStorage.getItem('app_last_selected_month') || "Hepsi";
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  const handleImportData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target?.result as string);
        if (Array.isArray(imported)) {
          const existingIds = new Set(receipts.map(r => r.id));
          const existingSignatures = new Set(receipts.map(r => `${r.vendor.toUpperCase()}|${r.date}|${r.total}`));
          
          let dupeCount = 0;
          const formattedReceipts: ReceiptData[] = [];

          imported.forEach((r: any) => {
            const rawPrice = r.total ?? r.price ?? r.ucret ?? r.amount;
            const parsedPrice = typeof rawPrice === 'number' ? rawPrice : parseFloat(String(rawPrice || '0').replace(',', '.')) || 0;
            const id = r.id || Math.random().toString(36).substr(2, 9);
            const signature = `${(r.vendor || r.market || 'BİLİNMEYEN').toUpperCase()}|${r.date || r.tarih || ''}|${parsedPrice}`;

            if (existingIds.has(id) || existingSignatures.has(signature)) {
              dupeCount++;
              return;
            }
            
            formattedReceipts.push({
              id,
              vendor: (r.vendor || r.market || 'BİLİNMEYEN').toUpperCase(),
              date: r.date || r.tarih || new Date().toLocaleDateString('tr-TR'),
              total: parsedPrice,
              currency: r.currency || '₺',
              category: r.category || r.kategori || 'Gıda ve Market',
              tax: r.tax || 0,
              items: Array.isArray(r.items) ? r.items : [],
              confidence: r.confidence || 1,
              timestamp: r.timestamp || Date.now(),
              imageUrl: r.imageUrl
            });
          });

          if (formattedReceipts.length > 0) {
            setReceipts(prev => [...prev, ...formattedReceipts]);
            alert(`${formattedReceipts.length} yeni fiş aktarıldı.${dupeCount > 0 ? ` (${dupeCount} kopya atlandı)` : ''}`);
          } else if (dupeCount > 0) {
            alert("Tüm fişler zaten mevcut. Hiçbir yeni veri eklenmedi.");
          } else {
            alert("Aktarılacak geçerli veri bulunamadı.");
          }
        }
      } catch (e) {
        alert("Geçersiz dosya formatı.");
      }
    };
    reader.readAsText(file);
    if (importInputRef.current) importInputRef.current.value = '';
  };

  const handleExportData = () => {
    try {
      const dataStr = JSON.stringify(receipts, null, 2);
      const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
      
      const exportFileDefaultName = `fis_ai_backup_${new Date().toISOString().split('T')[0]}.json`;
      
      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', dataUri);
      linkElement.setAttribute('download', exportFileDefaultName);
      linkElement.click();
    } catch (e) {
      alert("Dışa aktarma hatası.");
    }
  };

  const handleSyncImport = (imported: ReceiptData[]) => {
    if (!Array.isArray(imported)) return;
    
    const existingIds = new Set(receipts.map(r => r.id));
    const existingSignatures = new Set(receipts.map(r => `${r.vendor.toUpperCase()}|${r.date}|${r.total}`));
    
    let dupeCount = 0;
    const formattedReceipts: ReceiptData[] = [];
    const newCategories = new Set<string>();

    imported.forEach((r: any) => {
      const rawPrice = r.total ?? r.price ?? r.ucret ?? r.amount;
      const parsedPrice = typeof rawPrice === 'number' ? rawPrice : parseFloat(String(rawPrice || '0').replace(',', '.')) || 0;
      const id = r.id || Math.random().toString(36).substr(2, 9);
      const signature = `${(r.vendor || r.market || 'BİLİNMEYEN').toUpperCase()}|${r.date || r.tarih || ''}|${parsedPrice}`;

      if (existingIds.has(id) || existingSignatures.has(signature)) {
        dupeCount++;
        return;
      }
      
      const category = (r.category || r.kategori || 'Gıda ve Market').trim();
      newCategories.add(category);

      formattedReceipts.push({
        id,
        vendor: (r.vendor || r.market || 'BİLİNMEYEN').toUpperCase(),
        date: r.date || r.tarih || new Date().toLocaleDateString('tr-TR'),
        total: parsedPrice,
        currency: r.currency || '₺',
        category,
        tax: r.tax || 0,
        items: Array.isArray(r.items) ? r.items : [],
        confidence: r.confidence || 1,
        timestamp: r.timestamp || Date.now(),
        imageUrl: r.imageUrl
      });
    });

    if (formattedReceipts.length > 0) {
      setReceipts(prev => [...prev, ...formattedReceipts]);
      
      // Update categories if new ones found
      setCategories(prev => {
        const current = new Set(prev);
        let changed = false;
        newCategories.forEach(cat => {
          if (!current.has(cat)) {
            current.add(cat);
            changed = true;
          }
        });
        return changed ? Array.from(current) : prev;
      });
    }
  };

  const activeReceipts = useMemo(() => {
    const parseDateForSort = (dateStr: string) => {
      if (!dateStr) return '0000-00-00';
      // DD.MM.YYYY veya YYYY-MM-DD formatlarını normalize et
      if (dateStr.includes('.')) {
        const [d, m, y] = dateStr.split('.');
        return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
      }
      return dateStr; // Varsayılan olarak YYYY-MM-DD olduğu varsayılır
    };

    // Yinelenenleri filtrele (Vendor + Date + Total signature)
    const seen = new Set<string>();
    const uniqueReceipts = receipts.filter(r => {
      const signature = `${r.vendor.toUpperCase()}|${r.date}|${r.total}`;
      if (seen.has(signature)) return false;
      seen.add(signature);
      return true;
    });

    return [...uniqueReceipts].sort((a, b) => {
      const dateA = parseDateForSort(a.date);
      const dateB = parseDateForSort(b.date);
      if (dateA !== dateB) return dateB.localeCompare(dateA);
      return (b.timestamp || 0) - (a.timestamp || 0);
    });
  }, [receipts]);

  useEffect(() => {
    setIsInitializing(false);
  }, []);

  useEffect(() => {
    localStorage.setItem('app_categories', JSON.stringify(categories));
  }, [categories]);

  useEffect(() => {
    localStorage.setItem('app_last_selected_month', dashboardMonth);
  }, [dashboardMonth]);

  const availableMonths = useMemo(() => {
    const monthsSet = new Set<string>();
    const now = new Date();
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    monthsSet.add(currentMonthKey);

    if (now.getDate() >= 16) {
      const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      const nextMonthKey = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}`;
      monthsSet.add(nextMonthKey);
    }

    activeReceipts.forEach(r => {
      if (!r.date) return;
      if (r.date.includes('.')) {
        const parts = r.date.split('.');
        if (parts.length === 3) monthsSet.add(`${parts[2]}-${parts[1].padStart(2, '0')}`);
      } else if (r.date.includes('-')) {
        const parts = r.date.split('-');
        if (parts.length === 3) monthsSet.add(`${parts[0]}-${parts[1].padStart(2, '0')}`);
      }
    });

    return Array.from(monthsSet).sort().reverse();
  }, [activeReceipts]);

  useEffect(() => {
    if (isInitializing) return;
    try {
      const dataToSave = JSON.stringify(receipts);
      if (dataToSave.length > 4 * 1024 * 1024) {
        const cleaned = receipts.map((r, idx) => idx > 10 ? { ...r, imageUrl: undefined } : r);
        localStorage.setItem('fis_ai_receipts', JSON.stringify(cleaned));
      } else {
        localStorage.setItem('fis_ai_receipts', dataToSave);
      }
    } catch (e) {
      console.error("Storage Error", e);
    }
  }, [receipts, isInitializing]);

  useEffect(() => {
    const root = window.document.documentElement;
    const mode = theme === 'system' ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : theme;
    if (mode === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
    localStorage.setItem('app_theme', theme);
  }, [theme]);

  const resetEverything = () => {
    localStorage.clear();
    window.location.reload();
  };

  const processFile = async (file: File, index?: number, total?: number) => {
    const prefix = total && total > 1 ? `[${(index || 0) + 1}/${total}] ` : '';
    try {
      setStatusText(`${prefix}Görsel İyileştiriliyor...`);
      const optimizedImg = await autoEnhance(file);
      
      setStatusText(`${prefix}Analiz Ediliyor...`);
      // Mevcut kategorileri Gemini'ye gönderiyoruz
      const data = await extractReceiptData(optimizedImg, categories, (msg) => {
        setStatusText(`${prefix}${msg}`);
      });
      
      const rawCategory = data.category || categories[0] || 'Gıda ve Market';
      const finalCategory = rawCategory.trim();
      
      // Kategori listede yoksa ekle (case-insensitive kontrol)
      setCategories(prev => {
        const normalizedCats = prev.map(c => c.trim().toUpperCase());
        if (!normalizedCats.includes(finalCategory.toUpperCase())) {
          return [...prev, finalCategory];
        }
        return prev;
      });

      const newReceipt: ReceiptData = {
        id: Math.random().toString(36).substr(2, 9),
        vendor: (data.vendor || 'BİLİNMEYEN MAĞAZA').toUpperCase(),
        date: data.date || new Date().toLocaleDateString('tr-TR'),
        total: Number(data.total) || 0,
        currency: '₺',
        category: finalCategory,
        tax: 0,
        items: data.items || [],
        confidence: 1,
        timestamp: Date.now(),
        imageUrl: optimizedImg,
      };
      
      const signature = `${newReceipt.vendor.toUpperCase()}|${newReceipt.date}|${newReceipt.total}`;
      
      let isDupe = false;
      setReceipts(prev => {
        const dupe = prev.find(r => `${r.vendor.toUpperCase()}|${r.date}|${r.total}` === signature);
        if (dupe) {
          isDupe = true;
          return prev;
        }
        return [newReceipt, ...prev];
      });

      if (isDupe) {
        setStatusText(`${prefix}Aynı fiş zaten mevcut, atlandı.`);
        return;
      }
      
      setDashboardMonth("Hepsi"); 
      setActiveTab('dashboard');
    } catch (err: any) {
      console.error("İşlem Hatası:", err);
      let userMessage = 'Fiş işlenirken bir sorun oluştu.';
      let details = '';
      
      let errorMsg = err.message || "";
      
      // Eğer hata mesajı JSON ise içindeki mesajı ayıklamaya çalış
      try {
        if (errorMsg.startsWith('{')) {
          const parsed = JSON.parse(errorMsg);
          if (parsed.error?.message) errorMsg = parsed.error.message;
        }
      } catch (e) {}
      
      if (errorMsg.includes('429') || errorMsg.includes('RESOURCE_EXHAUSTED') || errorMsg.includes('quota')) {
        userMessage = 'Tüm modellerin ücretsiz kullanım limitine ulaşıldı. Lütfen birkaç dakika bekleyin.';
      } else if (errorMsg.includes('503') || errorMsg.includes('high demand')) {
        userMessage = 'Google servisleri şu an çok yoğun. Lütfen biraz bekleyip tekrar deneyin.';
      } else if (errorMsg.includes('API key not valid')) {
        userMessage = 'API anahtarı geçersiz. Lütfen ayarları kontrol edin.';
      } else {
        // Bilinmeyen hatalar için teknik detayı ekle
        details = `\n\nDetay: ${errorMsg.substring(0, 150)}`;
      }
      
      alert(`Hata: ${userMessage}${details}`);
      throw err;
    }
  };

  const handleCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    const files = Array.from(e.target.files) as File[];
    setStatus(AppStatus.PROCESSING);
    
    try {
      for (let i = 0; i < files.length; i++) {
        await processFile(files[i], i, files.length);
      }
    } catch (err) {
      console.error("Yükleme Hatası:", err);
    } finally {
      setStatus(AppStatus.IDLE);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleCameraCapture = async (blob: Blob) => {
    setShowCamera(false);
    setStatus(AppStatus.PROCESSING);
    try {
      const file = new File([blob], `capture_${Date.now()}.jpg`, { type: 'image/jpeg' });
      await processFile(file);
    } catch (err) {
      console.error("Kamera Kayıt Hatası:", err);
    } finally {
      setStatus(AppStatus.IDLE);
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleDeleteSelected = () => {
    if (selectedIds.length === 0) return;
    
    setConfirmState({
      isOpen: true,
      title: `${selectedIds.length} Kayıt Silinsin mi?`,
      message: "Seçilen tüm kayıtlar kalıcı olarak silinecektir.",
      onConfirm: () => {
        setReceipts(prev => prev.filter(r => !selectedIds.includes(r.id)));
        setSelectedIds([]);
      }
    });
  };

  const handleExportSelected = () => {
    if (selectedIds.length === 0) return;
    const selectedReceipts = receipts.filter(r => selectedIds.includes(r.id));
    
    try {
      const dataStr = JSON.stringify(selectedReceipts, null, 2);
      const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
      const exportFileDefaultName = `fis_ai_selected_export_${new Date().toISOString().split('T')[0]}.json`;
      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', dataUri);
      linkElement.setAttribute('download', exportFileDefaultName);
      linkElement.click();
    } catch (e) {
      alert("Dışa aktarma hatası.");
    }
  };

  return (
    <div className="min-h-screen pb-16 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-200 transition-colors">
      {isInitializing ? (
        <div className="fixed inset-0 z-[100] bg-white dark:bg-slate-950 flex flex-col items-center justify-center">
          <Loader2 className="animate-spin text-indigo-600 mb-4" size={32} />
          <h1 className="text-xs font-medium uppercase tracking-widest opacity-40">FişAI Yükleniyor...</h1>
        </div>
      ) : (
        <>
          <header className="sticky top-0 z-40 bg-white/60 dark:bg-slate-950/60 backdrop-blur-xl border-b border-slate-200/40 dark:border-slate-800/50 h-14 flex items-center justify-between px-6">
            <div className="flex items-center gap-2">
              <motion.div 
                whileHover={{ rotate: 15, scale: 1.1 }}
                className="bg-indigo-600 rounded-xl text-white font-medium w-8 h-8 flex items-center justify-center text-sm shadow-xl shadow-indigo-500/30"
              >
                <div className="relative">
                  <ScanText size={18} />
                </div>
              </motion.div>
              <h1 className="text-sm font-medium uppercase italic tracking-tighter bg-gradient-to-r from-slate-900 to-slate-500 dark:from-white dark:to-slate-400 bg-clip-text text-transparent flex items-center gap-1.5">
                Fiş<span className="text-indigo-600">AI</span>
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <motion.button 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowSettings(true)} 
                className="p-2 text-slate-400 hover:text-indigo-600 bg-slate-50 dark:bg-slate-900 rounded-xl transition-all"
              >
                <SettingsIcon size={18} />
              </motion.button>
            </div>
          </header>

          <main className="max-w-xl mx-auto px-4 pt-1.5 space-y-1">
            <AnimatePresence mode="wait">
              {status === AppStatus.PROCESSING && (
                <motion.div 
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="bg-indigo-600 rounded-3xl p-5 text-white flex flex-col items-center justify-center gap-3 shadow-xl shadow-indigo-600/20"
                >
                   <div className="bg-white/20 p-2 rounded-full">
                     <Loader2 size={24} className="animate-spin" />
                   </div>
                   <div className="text-center">
                     <span className="text-[10px] font-medium uppercase tracking-[0.2em] block mb-1 opacity-70">İşlem Yapılıyor</span>
                     <span className="text-xs font-medium">{statusText}</span>
                   </div>
                </motion.div>
              )}
            </AnimatePresence>

            {activeTab === 'dashboard' && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="space-y-1 pt-1"
              >
                <div className="flex items-center gap-2 mb-3 px-2">
                   <div className="w-6 h-6 bg-indigo-600 rounded-lg flex items-center justify-center text-white shadow-lg shadow-indigo-600/20">
                      <ScanText size={14} />
                   </div>
                   <h2 className="text-[15px] font-medium text-slate-800 dark:text-white uppercase tracking-tight">Ana Sayfa</h2>
                </div>
                
                <div className="grid grid-cols-1 gap-1">
                  <div className="bg-white dark:bg-slate-900 p-3 rounded-[24px] border border-slate-200/50 dark:border-slate-800 shadow-sm relative overflow-hidden group font-sans">
                    <div className="absolute top-0 right-0 p-6 opacity-[0.03] dark:opacity-[0.05] group-hover:scale-110 transition-transform">
                      <Wallet size={80} />
                    </div>
                    
                    <div className="flex justify-between items-start mb-1">
                      <div className="space-y-0.5">
                        <span className="text-[11px] font-medium text-indigo-600 dark:text-indigo-400 uppercase tracking-widest block">Toplam Harcama</span>
                        <div className="text-2xl font-medium tracking-tight tabular-nums flex items-baseline gap-1 font-display">
                          {activeReceipts
                            .filter(r => {
                              if (dashboardMonth === 'Hepsi') return true;
                              const rMonth = r.date.includes('.') ? `${r.date.split('.')[2]}-${r.date.split('.')[1]}` : r.date.substring(0, 7);
                              return rMonth === dashboardMonth;
                            })
                            .reduce((s, r) => s + r.total, 0)
                            .toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                          <span className="text-base font-medium text-slate-300 dark:text-slate-700">₺</span>
                        </div>
                      </div>
                      
                      <div className="relative group">
                        <select 
                          value={dashboardMonth} 
                          onChange={e => setDashboardMonth(e.target.value)} 
                          className="bg-indigo-50 dark:bg-slate-800 px-3 py-1.5 pr-8 rounded-xl text-[12px] font-medium text-indigo-700 dark:text-slate-200 border-none outline-none cursor-pointer appearance-none shadow-sm group-hover:bg-indigo-100 dark:group-hover:bg-slate-700 transition-all active:scale-95"
                        >
                          <option value="Hepsi">Tüm Zamanlar</option>
                          {availableMonths.map(m => {
                            const [y, mm] = m.split('-');
                            const ms = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
                            return <option key={m} value={m}>{`${ms[parseInt(mm) - 1]} ${y}`}</option>;
                          })}
                        </select>
                        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-indigo-400 group-hover:text-indigo-600 transition-colors">
                           <ChevronDown size={12} />
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-medium text-slate-400 uppercase tracking-widest">Fiş Sayısı</span>
                        <span className="text-base font-medium font-display">{activeReceipts.length}</span>
                      </div>
                      <div className="h-6 w-px bg-slate-100 dark:bg-slate-800"></div>
                      <div className="flex flex-col">
                        <span className="text-[10px] font-medium text-slate-400 uppercase tracking-widest">Ortalama</span>
                        <span className="text-base font-medium font-display">
                          {(activeReceipts.length > 0 ? activeReceipts.reduce((s, r) => s + r.total, 0) / activeReceipts.length : 0).toLocaleString('tr-TR', { maximumFractionDigits: 0 })}
                          <span className="text-[12px] ml-0.5 opacity-40">₺</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 w-full">
                    <motion.button 
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setShowCamera(true)} 
                      disabled={status === AppStatus.PROCESSING} 
                      className="flex-[2] bg-slate-900 dark:bg-white text-white dark:text-slate-900 py-3 rounded-[20px] flex items-center justify-center gap-2 shadow-xl active:shadow-inner transition-all group overflow-hidden relative"
                    >
                       <div className="absolute inset-0 bg-indigo-600 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out"></div>
                       <Camera size={18} className="relative z-10" /> 
                       <span className="text-[13px] font-medium uppercase tracking-widest relative z-10">Fiş Tara</span>
                    </motion.button>
                    <motion.button 
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setShowManualEntry(true)} 
                      disabled={status === AppStatus.PROCESSING} 
                      className="w-12 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-[20px] flex items-center justify-center shadow-sm active:shadow-inner transition-all hover:bg-slate-200 dark:hover:bg-slate-700"
                      title="Manuel Ekle"
                    >
                       <Keyboard size={18} /> 
                    </motion.button>
                    <motion.button 
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => fileInputRef.current?.click()} 
                      disabled={status === AppStatus.PROCESSING} 
                      className="w-12 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-[20px] flex items-center justify-center shadow-sm active:shadow-inner transition-all hover:bg-slate-200 dark:hover:bg-slate-700"
                      title="Galeriden Seç"
                    >
                       <ImageIcon size={18} /> 
                    </motion.button>
                  </div>
                </div>

                <div className="pt-2">
                  <div className="flex justify-between items-center mb-2 px-2">
                    <h3 className="text-[12px] font-medium text-slate-400 uppercase tracking-[0.2em]">Son İşlemler</h3>
                        <div className="h-px flex-1 mx-4 bg-slate-100 dark:bg-slate-800"></div>
                      </div>
                  
                    <ReceiptTable 
                      receipts={activeReceipts.filter(r => {
                        if (dashboardMonth === 'Hepsi') return true;
                        if (!r.date) return false;
                        let rMonth = '';
                        if (r.date.includes('.')) {
                          const parts = r.date.split('.');
                          rMonth = `${parts[2]}-${parts[1].padStart(2, '0')}`;
                        } else if (r.date.includes('-')) {
                          rMonth = r.date.substring(0, 7);
                        }
                        return rMonth === dashboardMonth;
                      })}
                      onDelete={id => setConfirmState({ isOpen: true, title: "Silinsin mi?", message: "Bu kayıt kalıcı olarak kaldırılacak.", onConfirm: () => setReceipts(p => p.filter(r => r.id !== id)) })} 
                      onView={setSelectedReceipt} 
                      onCopySingle={() => Promise.resolve(true)}
                      viewMode="standard" 
                      selectedIds={selectedIds}
                      onToggleSelect={handleToggleSelect}
                    />
                  </div>
                </motion.div>
              )}

          <AnimatePresence>
            {selectedIds.length > 0 && (
              <motion.div 
                initial={{ y: 100, x: '-50%', opacity: 0 }}
                animate={{ y: 0, x: '-50%', opacity: 1 }}
                exit={{ y: 100, x: '-50%', opacity: 0 }}
                className="fixed bottom-20 left-1/2 z-50 bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-6 min-w-[300px]"
              >
                <div className="flex flex-col">
                  <span className="text-[10px] font-medium uppercase tracking-widest opacity-60">Seçili</span>
                  <span className="text-sm font-medium">{selectedIds.length} Kayıt</span>
                </div>
                <div className="h-8 w-px bg-white/20 dark:bg-slate-200"></div>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={handleExportSelected}
                    className="p-2 hover:bg-white/10 dark:hover:bg-slate-100 rounded-xl transition-colors flex flex-col items-center gap-1"
                  >
                    <CloudIcon size={16} />
                    <span className="text-[8px] font-medium uppercase tracking-tighter">Aktar</span>
                  </button>
                  <button 
                    onClick={handleDeleteSelected}
                    className="p-2 hover:bg-rose-500/20 text-rose-400 rounded-xl transition-colors flex flex-col items-center gap-1"
                  >
                    <Trash2 size={16} />
                    <span className="text-[8px] font-medium uppercase tracking-tighter">Sil</span>
                  </button>
                  <button 
                    onClick={() => setSelectedIds([])}
                    className="p-2 hover:bg-white/10 dark:hover:bg-slate-100 rounded-xl transition-colors flex flex-col items-center gap-1"
                  >
                    <X size={16} />
                    <span className="text-[8px] font-medium uppercase tracking-tighter">İptal</span>
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

            {activeTab === 'prices' && <ProductHistory receipts={activeReceipts} />}
            {activeTab === 'budget' && (
              <BudgetManager 
                receipts={activeReceipts} 
                categories={categories}
                setCategories={setCategories}
                availableMonths={availableMonths} 
                onAddReceipt={async (r) => {
                  setReceipts(x => [r, ...x]);
                }}
                onDeleteReceipt={async (id) => {
                  setReceipts(p => p.filter(r => r.id !== id));
                }}
                onViewReceipt={setSelectedReceipt} 
                selectedMonth={dashboardMonth}
                setSelectedMonth={setDashboardMonth}
                selectedIds={selectedIds}
                onToggleSelect={handleToggleSelect}
              />
            )}
          </main>

          {showSettings && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md">
              <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-[24px] p-6 space-y-4 shadow-2xl border dark:border-slate-800">
                <div className="flex justify-between items-center mb-1">
                  <h3 className="text-[12px] font-medium text-slate-400 uppercase tracking-widest">Ayarlar</h3>
                  <button onClick={() => setShowSettings(false)} className="p-1.5 bg-slate-50 dark:bg-slate-800 rounded-full text-slate-400 font-medium"><X size={16} /></button>
                </div>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2.5">
                    <button onClick={() => importInputRef.current?.click()} className="py-3 text-indigo-600 bg-indigo-50 dark:bg-indigo-950/20 rounded-xl text-[11px] font-medium uppercase tracking-widest transition-colors hover:bg-indigo-100">İçe Aktar</button>
                    <button onClick={handleExportData} className="py-3 text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20 rounded-xl text-[11px] font-medium uppercase tracking-widest transition-colors hover:bg-emerald-100">Cihaza Kaydet</button>
                  </div>
                  
                  <button 
                    onClick={() => {
                       setShowSettings(false);
                       setShowSyncModal(true);
                    }}
                    className="w-full py-3 flex items-center justify-center gap-2.5 bg-indigo-600 text-white rounded-xl text-[11px] font-medium uppercase tracking-widest shadow-lg shadow-indigo-500/20 transition-all hover:bg-indigo-700 active:scale-95"
                  >
                    <QrCode size={14} />
                    QR ile Eşitle (Offline)
                  </button>

                  <input type="file" ref={importInputRef} onChange={handleImportData} accept=".json" className="hidden" />
                </div>
              </div>
            </div>
          )}

          {showSyncModal && (
            <SyncModal 
              receipts={receipts}
              availableMonths={availableMonths}
              onClose={() => setShowSyncModal(false)}
              onImport={handleSyncImport}
            />
          )}

          {showCamera && (
            <CameraCapture 
              onCapture={handleCameraCapture}
              onClose={() => setShowCamera(false)}
            />
          )}

          <ManualEntryModal 
            isOpen={showManualEntry}
            onClose={() => setShowManualEntry(false)}
            categories={categories}
            onAdd={(data) => {
              setReceipts(prev => [data, ...prev]);
            }}
          />

          {selectedReceipt && (
            <ReceiptDetailModal 
              receipt={selectedReceipt} 
              categories={categories}
              onClose={() => setSelectedReceipt(null)} 
              onUpdate={u => setReceipts(r => r.map(x => x.id === u.id ? u : x))} 
            />
          )}

          <ConfirmModal 
            isOpen={confirmState.isOpen} 
            title={confirmState.title} 
            message={confirmState.message} 
            onConfirm={confirmState.onConfirm} 
            onCancel={() => setConfirmState(p => ({ ...p, isOpen: false }))} 
          />

          <nav className="fixed bottom-3 left-1/2 -translate-x-1/2 w-fit min-w-[200px] z-40 bg-white/70 dark:bg-slate-950/70 backdrop-blur-3xl border border-slate-200/40 dark:border-slate-800/50 rounded-2xl shadow-[0_8px_32px_-12px_rgba(0,0,0,0.3)] px-1 py-1">
            <div className="flex justify-between items-center relative gap-0.5">
              {[
                { id: 'dashboard', label: 'Ana Sayfa', icon: LayoutDashboard },
                { id: 'prices', label: 'Fiyatlar', icon: TrendingUp },
                { id: 'budget', label: 'Bütçe', icon: Wallet },
              ].map((item) => (
                <button 
                  key={item.id} 
                  onClick={() => setActiveTab(item.id as any)} 
                  className={`flex-1 flex flex-row items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl transition-all relative ${
                    activeTab === item.id 
                      ? 'text-indigo-600' 
                      : 'text-slate-400 opacity-60 hover:opacity-100'
                  }`}
                >
                  {activeTab === item.id && (
                    <motion.div 
                      layoutId="activeTab"
                      className="absolute inset-0 bg-indigo-50 dark:bg-indigo-950/40 rounded-xl -z-10"
                      transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
                    />
                  )}
                  <item.icon size={15} strokeWidth={activeTab === item.id ? 2 : 1.5} className="shrink-0" />
                  <span className={`text-[9px] uppercase tracking-tight leading-none whitespace-nowrap ${activeTab === item.id ? 'font-medium' : 'font-medium opacity-70'}`}>
                    {item.label}
                  </span>
                </button>
              ))}
            </div>
          </nav>
          <input type="file" ref={fileInputRef} onChange={handleCapture} accept="image/*" multiple className="hidden" />
        </>
      )}
    </div>
  );
};

export default App;

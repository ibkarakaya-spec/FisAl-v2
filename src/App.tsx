import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  Camera, Loader2, LayoutDashboard, TrendingUp, X, Wallet, Settings as SettingsIcon, Cloud as CloudIcon, HardDrive, Plus, ArrowRight
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
  
  const [dashboardMonth, setDashboardMonth] = useState<string>(() => {
    return localStorage.getItem('app_last_selected_month') || "Hepsi";
  });

  const [isGoogleConnected, setIsGoogleConnected] = useState(false);
  const [isExportingToDrive, setIsExportingToDrive] = useState(false);

  useEffect(() => {
    fetch('/api/auth/google/status')
      .then(r => r.json())
      .then(data => setIsGoogleConnected(data.connected))
      .catch(err => console.error(err));
  }, []);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS' && event.data.service === 'google_drive') {
        setIsGoogleConnected(true);
        alert("Google Drive bağlantısı başarıyla kuruldu!");
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleConnectGoogleDrive = async () => {
    try {
      const res = await fetch('/api/auth/google/url');
      const data = await res.json();
      if (data.error) {
        alert(data.error);
        return;
      }
      window.open(data.url, 'google_auth', 'width=600,height=700');
    } catch (e) {
      console.error(e);
      alert("Bağlantı URL'i alınamadı. Server ayarlarını kontrol edin.");
    }
  };

  const handleExportToGoogleDrive = async () => {
    if (!isGoogleConnected) {
      handleConnectGoogleDrive();
      return;
    }

    setIsExportingToDrive(true);
    try {
      const res = await fetch('/api/drive/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: receipts,
          filename: `fis_ai_full_backup_${new Date().toISOString().split('T')[0]}.json`
        })
      });
      
      const result = await res.json();
      if (res.ok) {
        alert("Veriler Google Drive'a başarıyla yüklendi!");
      } else {
        if (res.status === 401) {
          setIsGoogleConnected(false);
          alert("Oturum süresi dolmuş. Lütfen tekrar bağlanın.");
          handleConnectGoogleDrive();
        } else {
          alert("Hata: " + (result.error || "Yükleme başarısız."));
        }
      }
    } catch (e) {
      console.error(e);
      alert("Yükleme sırasında teknik bir hata oluştu.");
    } finally {
      setIsExportingToDrive(false);
    }
  };

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
          const formattedReceipts: ReceiptData[] = imported.map((r: any) => {
            const rawPrice = r.total ?? r.price ?? r.ucret ?? r.amount;
            const parsedPrice = typeof rawPrice === 'number' ? rawPrice : parseFloat(String(rawPrice || '0').replace(',', '.')) || 0;
            
            return {
              id: r.id || Math.random().toString(36).substr(2, 9),
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
            };
          });
          setReceipts(prev => [...prev, ...formattedReceipts]);
          alert("Veriler başarıyla içe aktarıldı.");
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

    return [...receipts].sort((a, b) => {
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
      
      console.log("Yeni fiş ekleniyor:", newReceipt);
      setReceipts(prev => [newReceipt, ...prev]);
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

  return (
    <div className="min-h-screen pb-24 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-200 transition-colors">
      {isInitializing ? (
        <div className="fixed inset-0 z-[100] bg-white dark:bg-slate-950 flex flex-col items-center justify-center">
          <Loader2 className="animate-spin text-indigo-600 mb-4" size={32} />
          <h1 className="text-xs font-bold uppercase tracking-widest opacity-40">FişAI Yükleniyor...</h1>
        </div>
      ) : (
        <>
          <header className="sticky top-0 z-40 bg-white/60 dark:bg-slate-950/60 backdrop-blur-xl border-b border-slate-200/40 dark:border-slate-800/50 h-14 flex items-center justify-between px-6">
            <div className="flex items-center gap-2">
              <motion.div 
                whileHover={{ rotate: 15 }}
                className="bg-indigo-600 rounded-xl text-white font-semibold w-8 h-8 flex items-center justify-center text-sm shadow-lg shadow-indigo-500/30"
              >
                ₺
              </motion.div>
              <h1 className="text-sm font-semibold uppercase italic tracking-tighter bg-gradient-to-r from-slate-900 to-slate-500 dark:from-white dark:to-slate-400 bg-clip-text text-transparent">
                Fiş<span className="text-indigo-600">AI</span>
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <motion.button 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowSettings(true)} 
                className="p-2 text-slate-400 hover:text-indigo-600 bg-slate-50 dark:bg-slate-900 rounded-xl"
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
                     <span className="text-[10px] font-bold uppercase tracking-[0.2em] block mb-1 opacity-70">İşlem Yapılıyor</span>
                     <span className="text-xs font-semibold">{statusText}</span>
                   </div>
                </motion.div>
              )}
            </AnimatePresence>

            {activeTab === 'dashboard' && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-1"
              >
                <div className="grid grid-cols-1 gap-1">
                  <div className="bg-white dark:bg-slate-900 p-3.5 rounded-[28px] border border-slate-200/50 dark:border-slate-800 shadow-sm relative overflow-hidden group font-sans">
                    <div className="absolute top-0 right-0 p-6 opacity-[0.03] dark:opacity-[0.05] group-hover:scale-110 transition-transform">
                      <Wallet size={100} />
                    </div>
                    
                    <div className="flex justify-between items-start mb-1.5">
                      <div className="space-y-0.5">
                        <span className="text-[9px] font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest block">Toplam Harcama</span>
                        <div className="text-3xl font-semibold tracking-tight tabular-nums flex items-baseline gap-1 font-display">
                          {activeReceipts
                            .filter(r => {
                              if (dashboardMonth === 'Hepsi') return true;
                              const rMonth = r.date.includes('.') ? `${r.date.split('.')[2]}-${r.date.split('.')[1]}` : r.date.substring(0, 7);
                              return rMonth === dashboardMonth;
                            })
                            .reduce((s, r) => s + r.total, 0)
                            .toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                          <span className="text-base font-bold text-slate-300 dark:text-slate-700">₺</span>
                        </div>
                      </div>
                      
                      <select 
                        value={dashboardMonth} 
                        onChange={e => setDashboardMonth(e.target.value)} 
                        className="bg-slate-50 dark:bg-slate-800 px-3 py-1.5 rounded-full text-[9px] font-bold dark:text-slate-300 border-none outline-none cursor-pointer appearance-none shadow-inner"
                      >
                        <option value="Hepsi">Tüm Zamanlar</option>
                        {availableMonths.map(m => {
                          const [y, mm] = m.split('-');
                          const ms = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
                          return <option key={m} value={m}>{`${ms[parseInt(mm) - 1]} ${y}`}</option>;
                        })}
                      </select>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="flex flex-col">
                        <span className="text-[8px] font-medium text-slate-400 uppercase tracking-widest">Fiş Sayısı</span>
                        <span className="text-lg font-semibold font-display">{activeReceipts.length}</span>
                      </div>
                      <div className="h-6 w-px bg-slate-100 dark:bg-slate-800"></div>
                      <div className="flex flex-col">
                        <span className="text-[8px] font-medium text-slate-400 uppercase tracking-widest">Ortalama</span>
                        <span className="text-lg font-semibold font-display">
                          {(activeReceipts.length > 0 ? activeReceipts.reduce((s, r) => s + r.total, 0) / activeReceipts.length : 0).toLocaleString('tr-TR', { maximumFractionDigits: 0 })}
                          <span className="text-xs ml-0.5 opacity-40">₺</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  <motion.button 
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => fileInputRef.current?.click()} 
                    disabled={status === AppStatus.PROCESSING} 
                    className="w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 py-2.5 rounded-[24px] flex items-center justify-center gap-2 shadow-xl active:shadow-inner transition-all group overflow-hidden relative"
                  >
                     <div className="absolute inset-0 bg-indigo-600 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out"></div>
                     <Plus size={20} className="relative z-10" /> 
                     <span className="text-xs font-semibold uppercase tracking-widest relative z-10">Fiş Tara</span>
                  </motion.button>
                </div>

                <div className="pt-2">
                  <div className="flex justify-between items-center mb-4 px-2">
                    <h3 className="text-[10px] font-semibold text-slate-400 uppercase tracking-[0.2em]">Son İşlemler</h3>
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
                  />
                </div>
              </motion.div>
            )}

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
              />
            )}
          </main>

          {showSettings && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md">
              <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-[24px] p-6 space-y-4 shadow-2xl border dark:border-slate-800">
                <div className="flex justify-between items-center mb-1">
                  <h3 className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Ayarlar</h3>
                  <button onClick={() => setShowSettings(false)} className="p-1.5 bg-slate-50 dark:bg-slate-800 rounded-full text-slate-400 font-semibold"><X size={16} /></button>
                </div>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2.5">
                    <button onClick={() => importInputRef.current?.click()} className="py-3 text-indigo-600 bg-indigo-50 dark:bg-indigo-950/20 rounded-xl text-[9px] font-semibold uppercase tracking-widest transition-colors hover:bg-indigo-100">İçe Aktar</button>
                    <button onClick={handleExportData} className="py-3 text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20 rounded-xl text-[9px] font-semibold uppercase tracking-widest transition-colors hover:bg-emerald-100">Cihaza Kaydet</button>
                  </div>
                  
                  <button 
                    onClick={handleExportToGoogleDrive} 
                    disabled={isExportingToDrive}
                    className={`w-full py-3 flex items-center justify-center gap-2.5 rounded-xl text-[9px] font-semibold uppercase tracking-widest transition-all ${
                      isGoogleConnected 
                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' 
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {isExportingToDrive ? (
                      <Loader2 className="animate-spin" size={14} />
                    ) : (
                      <CloudIcon size={14} />
                    )}
                    {isGoogleConnected ? "Drive'a Yedekle" : "Google Drive Bağla"}
                  </button>

                  <input type="file" ref={importInputRef} onChange={handleImportData} accept=".json" className="hidden" />
                </div>
              </div>
            </div>
          )}

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

          <nav className="fixed bottom-4 left-1/2 -translate-x-1/2 w-[calc(100%-4rem)] max-w-[280px] z-40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl border border-slate-200/50 dark:border-slate-800/50 rounded-[24px] shadow-2xl px-1 py-1">
            <div className="flex justify-between items-center relative gap-1">
              {[
                { id: 'dashboard', label: 'Ana Sayfa', icon: LayoutDashboard },
                { id: 'prices', label: 'Fiyatlar', icon: TrendingUp },
                { id: 'budget', label: 'Bütçe', icon: Wallet },
              ].map((item) => (
                <button 
                  key={item.id} 
                  onClick={() => setActiveTab(item.id as any)} 
                  className={`flex-1 flex flex-col items-center gap-0.5 py-1.5 rounded-[18px] transition-all relative ${
                    activeTab === item.id 
                      ? 'text-indigo-600' 
                      : 'text-slate-400 opacity-60 hover:opacity-100'
                  }`}
                >
                  {activeTab === item.id && (
                    <motion.div 
                      layoutId="activeTab"
                      className="absolute inset-0 bg-indigo-50 dark:bg-indigo-950/30 rounded-[18px] -z-10"
                      transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                    />
                  )}
                  <item.icon size={18} strokeWidth={activeTab === item.id ? 2 : 1.5} />
                  <span className="text-[7.5px] font-semibold uppercase tracking-tight">{item.label}</span>
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

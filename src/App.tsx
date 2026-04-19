import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  Camera, Loader2, LayoutDashboard, TrendingUp, X, Wallet, Settings as SettingsIcon
} from 'lucide-react';
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
          const formattedReceipts: ReceiptData[] = imported.map((r: any) => ({
            id: Math.random().toString(36).substr(2, 9),
            vendor: r.vendor || 'BİLİNMEYEN',
            date: r.date || new Date().toLocaleDateString('tr-TR'),
            total: typeof r.price === 'number' ? r.price : parseFloat(String(r.price).replace(',', '.')) || 0,
            currency: '₺',
            category: r.category || 'Gıda ve Market',
            tax: 0,
            items: [],
            confidence: 1,
            timestamp: Date.now(),
          }));
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
          <header className="sticky top-0 z-40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200/60 dark:border-slate-800 h-10 flex items-center justify-between px-4">
            <div className="flex items-center gap-1.5">
              <div className="bg-indigo-600 rounded-lg text-white font-medium w-[18px] h-[18px] flex items-center justify-center text-[10px]">₺</div>
              <h1 className="text-[10px] font-black uppercase italic tracking-tighter">Fiş<span className="text-indigo-600">AI</span></h1>
            </div>
            <button onClick={() => setShowSettings(true)} className="p-1.5 text-slate-400 hover:text-indigo-600">
              <SettingsIcon size={16} />
            </button>
          </header>

          <main className="max-w-xl mx-auto px-3 pt-3 space-y-3">
            {status === AppStatus.PROCESSING && (
              <div className="bg-indigo-600 rounded-xl p-3 text-white flex items-center justify-center gap-2 shadow-lg animate-pulse">
                 <Loader2 size={14} className="animate-spin" />
                 <span className="text-[9px] font-bold uppercase tracking-widest">{statusText}</span>
              </div>
            )}

            {activeTab === 'dashboard' && (
              <div className="space-y-3">
                <div className="bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200/50 dark:border-slate-800 shadow-sm">
                  <div className="flex justify-between items-center mb-0.5">
                    <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Harcama Toplamı</span>
                    <select value={dashboardMonth} onChange={e => setDashboardMonth(e.target.value)} className="bg-transparent text-[10px] font-bold dark:text-slate-300 outline-none cursor-pointer">
                      <option value="Hepsi">Tümü</option>
                      {availableMonths.map(m => {
                        const [y, mm] = m.split('-');
                        const ms = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
                        return <option key={m} value={m}>{`${ms[parseInt(mm) - 1]} ${y}`}</option>;
                      })}
                    </select>
                  </div>
                  <div className="text-2xl font-black tracking-tighter tabular-nums flex items-baseline gap-0.5">
                    {activeReceipts
                      .filter(r => {
                        if (dashboardMonth === 'Hepsi') return true;
                        const rMonth = r.date.includes('.') ? `${r.date.split('.')[2]}-${r.date.split('.')[1]}` : r.date.substring(0, 7);
                        return rMonth === dashboardMonth;
                      })
                      .reduce((s, r) => s + r.total, 0)
                      .toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                    <span className="text-sm font-bold text-indigo-600">₺</span>
                  </div>
                </div>

                <button onClick={() => fileInputRef.current?.click()} disabled={status === AppStatus.PROCESSING} className="w-full bg-indigo-600 text-white py-3.5 rounded-xl flex items-center justify-center gap-2.5 shadow-lg active:scale-95 transition-all">
                   <Camera size={20} /> <span className="text-[11px] font-bold uppercase tracking-widest">Fiş Tara</span>
                </button>

                <div className="pt-1">
                  <h3 className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2 px-1">Geçmiş İşlemler</h3>
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
              </div>
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
              <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-[32px] p-8 space-y-5 shadow-2xl border dark:border-slate-800">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Ayarlar</h3>
                  <button onClick={() => setShowSettings(false)} className="p-2 bg-slate-50 dark:bg-slate-800 rounded-full"><X size={20} /></button>
                </div>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <button onClick={() => importInputRef.current?.click()} className="py-4 text-indigo-600 bg-indigo-50 dark:bg-indigo-950/20 rounded-2xl text-[10px] font-bold uppercase tracking-widest">İçe Aktar</button>
                    <button onClick={handleExportData} className="py-4 text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20 rounded-2xl text-[10px] font-bold uppercase tracking-widest">Dışa Aktar</button>
                  </div>
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

          <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-t dark:border-slate-800 pb-safe">
            <div className="max-w-xl mx-auto flex justify-around py-3">
              {[
                { id: 'dashboard', label: 'Ana Sayfa', icon: LayoutDashboard },
                { id: 'prices', label: 'Fiyatlar', icon: TrendingUp },
                { id: 'budget', label: 'Bütçe', icon: Wallet },
              ].map((item) => (
                <button key={item.id} onClick={() => setActiveTab(item.id as any)} className={`flex flex-col items-center gap-1 px-6 py-1 ${activeTab === item.id ? 'text-indigo-600' : 'text-slate-400 opacity-50'}`}>
                  <item.icon size={20} strokeWidth={activeTab === item.id ? 2.5 : 2} />
                  <span className="text-[9px] font-bold uppercase tracking-tighter">{item.label}</span>
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

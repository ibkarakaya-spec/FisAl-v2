import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  Camera, Loader2, LayoutDashboard, TrendingUp, X, Wallet, Settings as SettingsIcon, Cloud, RotateCw
} from 'lucide-react';
import { extractReceiptData, DEFAULT_CATEGORIES } from './services/geminiService.ts';
import { ReceiptData, AppStatus, ThemeMode } from './types.ts';
import { ReceiptTable } from './components/ReceiptTable.tsx';
import { ReceiptDetailModal } from './components/ReceiptDetailModal.tsx';
import { ProductHistory } from './components/ProductHistory.tsx';
import { appendToGoogleSheet, uploadImageToDrive } from './services/sheetService.ts';
import { BudgetManager } from './components/BudgetManager.tsx';
import { autoEnhance } from './services/imageProcessing.ts';
import { ConfirmModal } from './components/ConfirmModal.tsx';

const App: React.FC = () => {
  const [isInitializing, setIsInitializing] = useState(true);
  const [initError, setInitError] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'prices' | 'budget'>('dashboard');
  const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [statusText, setStatusText] = useState<string>('');
  const [receipts, setReceipts] = useState<ReceiptData[]>([]);
  const [categories, setCategories] = useState<string[]>(() => {
    const saved = localStorage.getItem('app_categories');
    return saved ? JSON.parse(saved) : DEFAULT_CATEGORIES;
  });
  const [selectedReceipt, setSelectedReceipt] = useState<ReceiptData | null>(null);
  const [theme, setTheme] = useState<ThemeMode>(() => (localStorage.getItem('app_theme') as ThemeMode) || 'system');
  const [showSettings, setShowSettings] = useState(false);
  const [confirmState, setConfirmState] = useState({ isOpen: false, title: '', message: '', onConfirm: () => {} });
  const [sheetWebhookUrl, setSheetWebhookUrl] = useState<string>(localStorage.getItem('sheet_webhook_url') || '');
  const [driveSyncEnabled, setDriveSyncEnabled] = useState<boolean>(() => localStorage.getItem('drive_sync_enabled') === 'true');
  
  const [dashboardMonth, setDashboardMonth] = useState<string>(() => {
    return localStorage.getItem('app_last_selected_month') || "Hepsi";
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const [driveImportUrl, setDriveImportUrl] = useState<string>('');

  const handleImportData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target?.result as string);
        if (Array.isArray(imported)) {
          setReceipts(prev => [...prev, ...imported]);
          alert("Veriler başarıyla içe aktarıldı.");
        }
      } catch (e) {
        alert("Geçersiz dosya formatı.");
      }
    };
    reader.readAsText(file);
    if (importInputRef.current) importInputRef.current.value = '';
  };

  const handleImportFromDrive = async () => {
    if (!driveImportUrl) return;
    try {
      const response = await fetch(driveImportUrl);
      const imported = await response.json();
      if (Array.isArray(imported)) {
        setReceipts(prev => [...prev, ...imported]);
        alert("Google Drive'dan veriler başarıyla içe aktarıldı.");
      } else {
        alert("Dosya içeriği geçerli bir fiş listesi değil.");
      }
    } catch (e) {
      alert("Google Drive'dan veri çekilemedi. Bağlantının herkese açık olduğundan emin olun.");
    }
  };

  const activeReceipts = useMemo(() => {
    return receipts.filter(r => categories.includes(r.category));
  }, [receipts, categories]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('fis_ai_receipts');
      if (raw) {
        const parsed = JSON.parse(raw);
        setReceipts(Array.isArray(parsed) ? parsed : []);
      }
    } catch (e) {
      setInitError(true);
    } finally {
      setIsInitializing(false);
    }
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
      if (r.date && r.date.includes('.')) {
        const parts = r.date.split('.');
        if (parts.length === 3) monthsSet.add(`${parts[2]}-${parts[1]}`);
      }
    });

    return Array.from(monthsSet).sort().reverse();
  }, [activeReceipts]);

  useEffect(() => {
    if (isInitializing || initError) return;
    try {
      const dataToSave = JSON.stringify(receipts);
      if (dataToSave.length > 4 * 1024 * 1024) {
        const cleaned = receipts.map((r, idx) => idx > 10 ? { ...r, imageUrl: undefined } : r);
        localStorage.setItem('fis_ai_receipts', JSON.stringify(cleaned));
      } else {
        localStorage.setItem('fis_ai_receipts', dataToSave);
      }
      localStorage.setItem('drive_sync_enabled', String(driveSyncEnabled));
      localStorage.setItem('sheet_webhook_url', sheetWebhookUrl);
    } catch (e) {
      console.error("Storage Error", e);
    }
  }, [receipts, sheetWebhookUrl, driveSyncEnabled, isInitializing, initError]);

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

  const processFile = async (file: File) => {
    try {
      setStatusText('İyileştiriliyor...');
      const optimizedImg = await autoEnhance(file);
      
      setStatusText('Analiz Ediliyor...');
      const data = await extractReceiptData(optimizedImg, categories);
      
      let driveUrl = undefined;
      let finalLocalImage: string | undefined = optimizedImg;

      if (driveSyncEnabled && sheetWebhookUrl) {
        setStatusText('Yedekleniyor...');
        const fileName = `FIS_${Date.now()}.jpg`;
        driveUrl = await uploadImageToDrive(sheetWebhookUrl, optimizedImg, fileName) || undefined;
        if (driveUrl) finalLocalImage = undefined;
      }

      const newReceipt: ReceiptData = {
        id: Math.random().toString(36).substr(2, 9),
        vendor: (data.vendor || 'BİLİNMEYEN').toUpperCase(),
        date: data.date || new Date().toLocaleDateString('tr-TR'),
        total: data.total || 0,
        currency: '₺',
        category: data.category || (categories[0] || 'Gıda ve Market'),
        tax: 0,
        items: data.items || [],
        confidence: 1,
        timestamp: Date.now(),
        imageUrl: finalLocalImage,
        driveUrl: driveUrl
      };
      
      setReceipts(prev => [newReceipt, ...prev]);
      
      if (sheetWebhookUrl) {
        setStatusText('Aktarılıyor...');
        await appendToGoogleSheet(sheetWebhookUrl, [newReceipt], dashboardMonth);
      }
    } catch (err) {
      alert(`Okuma Hatası: Lütfen fişi tekrar çekin.`);
    }
  };

  const handleCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    const files = Array.from(e.target.files) as File[];
    setStatus(AppStatus.PROCESSING);
    for (const file of files) await processFile(file);
    setStatus(AppStatus.IDLE);
    if (fileInputRef.current) fileInputRef.current.value = '';
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
                      const rMonth = r.date.includes('.') ? `${r.date.split('.')[2]}-${r.date.split('.')[1]}` : r.date.substring(0, 7);
                      return rMonth === dashboardMonth;
                    }).sort((a, b) => b.date.split('.').reverse().join('-').localeCompare(a.date.split('.').reverse().join('-')))} 
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
                onAddReceipt={r => setReceipts(x => [r, ...x])} 
                onDeleteReceipt={id => setReceipts(p => p.filter(r => r.id !== id))} 
                onViewReceipt={setSelectedReceipt} 
                webhookUrl={sheetWebhookUrl} 
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
                  <div className="space-y-2">
                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1">Google Sheets Webhook</label>
                    <input className="w-full bg-slate-50 dark:bg-slate-800 border dark:border-slate-700 p-4 rounded-2xl text-xs font-bold outline-none" value={sheetWebhookUrl} onChange={e => setSheetWebhookUrl(e.target.value)} />
                  </div>
                  <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl">
                    <Cloud size={20} className="text-indigo-600" />
                    <span className="text-[11px] font-bold uppercase">Drive Yedekleme</span>
                    <button onClick={() => setDriveSyncEnabled(!driveSyncEnabled)} className={`w-12 h-6 rounded-full relative ${driveSyncEnabled ? 'bg-indigo-600' : 'bg-slate-300'}`}>
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${driveSyncEnabled ? 'right-1' : 'left-1'}`} />
                    </button>
                  </div>
                  <button onClick={() => { if(confirm('Tüm veriler silinsin mi?')) resetEverything(); }} className="w-full py-4 text-red-500 bg-red-50 dark:bg-red-950/20 rounded-2xl text-[10px] font-bold uppercase tracking-widest">Hafızayı Sıfırla</button>
                  <button onClick={() => importInputRef.current?.click()} className="w-full py-4 text-indigo-600 bg-indigo-50 dark:bg-indigo-950/20 rounded-2xl text-[10px] font-bold uppercase tracking-widest">Dosyadan İçe Aktar</button>
                  <input type="file" ref={importInputRef} onChange={handleImportData} accept=".json" className="hidden" />
                  <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1">Google Drive JSON URL</label>
                    <input className="w-full bg-slate-50 dark:bg-slate-800 border dark:border-slate-700 p-4 rounded-2xl text-xs font-bold outline-none" placeholder="https://drive.google.com/..." value={driveImportUrl} onChange={e => setDriveImportUrl(e.target.value)} />
                    <button onClick={handleImportFromDrive} className="w-full py-4 text-indigo-600 bg-indigo-50 dark:bg-indigo-950/20 rounded-2xl text-[10px] font-bold uppercase tracking-widest">Drive'dan İçe Aktar</button>
                  </div>
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

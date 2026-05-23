import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  Camera, Loader2, LayoutDashboard, TrendingUp, X, Wallet, Settings as SettingsIcon, Cloud as CloudIcon, HardDrive, Plus, ArrowRight, ScanText, ChevronDown, Trash2, QrCode, Image as ImageIcon,
  Award, BarChart2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { extractReceiptData, extractAkbankTextData, DEFAULT_CATEGORIES } from './services/geminiService.ts';
import { ReceiptData, AppStatus, ThemeMode } from './types.ts';
import { ReceiptTable, getCategoryColor } from './components/ReceiptTable.tsx';
import { ReceiptDetailModal } from './components/ReceiptDetailModal.tsx';
import { ProductHistory } from './components/ProductHistory.tsx';
import { BudgetManager } from './components/BudgetManager.tsx';
import { autoEnhance } from './services/imageProcessing.ts';
import { ConfirmModal } from './components/ConfirmModal.tsx';
import { SyncModal } from './components/SyncModal.tsx';
import { CameraCapture } from './components/CameraCapture.tsx';
import { ManualEntryModal } from './components/ManualEntryModal.tsx';
import { AkbankImportModal } from './components/AkbankImportModal.tsx';
import { PwaInstallModal } from './components/PwaInstallModal.tsx';
import { Keyboard, Sparkles, AlertCircle, Check } from 'lucide-react';

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
  const [showAkbankModal, setShowAkbankModal] = useState(false);
  const [showAndroidShareTip, setShowAndroidShareTip] = useState(() => {
    return localStorage.getItem('hide_android_share_tip') !== 'true';
  });
  
  // PWA states for managing direct Android/browser installation
  const [deferredPrompt, setDeferredPrompt] = useState<any | null>(null);
  const [isAppInstalled, setIsAppInstalled] = useState(false);
  const [showPwaInstallModal, setShowPwaInstallModal] = useState(false);
  
  // States for handling Web Share Target (Android PDF / Image / Text share)
  const [sharedImportData, setSharedImportData] = useState<any | null>(null);
  const [sharedImportError, setSharedImportError] = useState<string | null>(null);
  const [isFetchingShared, setIsFetchingShared] = useState(false);
  
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  
  const [dashboardMonth, setDashboardMonth] = useState<string>(() => {
    return localStorage.getItem('app_last_selected_month') || "Hepsi";
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target?.result as string);
        if (Array.isArray(imported)) {
          handleSyncImport(imported);
        } else {
          alert("Geçersiz dosya formatı: Veri listesi (Array) olmalı.");
        }
      } catch (e) {
        alert("Dosya okunamadı veya JSON formatı hatalı.");
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
    try {
      if (!Array.isArray(imported)) {
        console.warn("Sync import: data is not an array");
        return;
      }
      
      const existingIds = new Set(receipts.map(r => String(r.id)));
      const existingSignatures = new Set(receipts.map(r => 
        `${r.vendor.toUpperCase().trim()}|${r.date.trim()}|${Number(r.total).toFixed(2)}`
      ));
      
      let dupeCount = 0;
      const formattedReceipts: ReceiptData[] = [];
      const newCategories = new Set<string>();

      imported.forEach((r: any) => {
        if (!r) return;
        
        const rawPrice = r.total ?? r.price ?? r.ucret ?? r.amount;
        const parsedPrice = typeof rawPrice === 'number' ? rawPrice : parseFloat(String(rawPrice || '0').replace(',', '.')) || 0;
        
        const id = String(r.id || Math.random().toString(36).substr(2, 9));
        const vendor = String(r.vendor || r.market || 'BİLİNMEYEN').toUpperCase().trim();
        const date = String(r.date || r.tarih || new Date().toLocaleDateString('tr-TR')).trim();
        
        const signature = `${vendor}|${date}|${parsedPrice.toFixed(2)}`;

        if (existingIds.has(id) || existingSignatures.has(signature)) {
          dupeCount++;
          return;
        }
        
        const category = String(r.category || r.kategori || 'Gıda ve Market').trim();
        newCategories.add(category);

        formattedReceipts.push({
          id,
          vendor,
          date,
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
    } catch (err) {
      console.error("Sync import failed:", err);
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

    // Dynamic listeners for capturing browser PWA installation trigger
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setIsAppInstalled(true);
    };

    const checkPwaInstalledMode = () => {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
      setIsAppInstalled(!!isStandalone);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);
    checkPwaInstalledMode();

    // Handle PWA Web Share Target URL params (Android PDF/Image/Text share)
    const urlParams = new URLSearchParams(window.location.search);
    const sharedId = urlParams.get('sharedId');
    const sharedFile = urlParams.get('shared-file');
    const shareError = urlParams.get('shareError');

    if (sharedId) {
      setIsFetchingShared(true);
      setSharedImportError(null);
      fetch(`/api/shared-target/${sharedId}`)
        .then((res) => res.json())
        .then((result) => {
          if (result.success && result.data) {
            setSharedImportData(result.data);
            setActiveTab('dashboard');
          } else {
            setSharedImportError(result.error || "Paylaşılan veri süresi dolmuş veya hatalı.");
          }
        })
        .catch((err) => {
          console.error("Shared target fetch error:", err);
          setSharedImportError("Paylaşılan veri sunucudan yüklenirken bir hata oluştu.");
        })
        .finally(() => {
          setIsFetchingShared(false);
          // Clear URL parameters so they don't persist on page refresh
          window.history.replaceState({}, document.title, window.location.pathname);
        });
    } else if (sharedFile === 'true') {
      setIsFetchingShared(true);
      setSharedImportError(null);
      (async () => {
        try {
          if (!('caches' in window)) {
            throw new Error("Tarayıcınız yerel paylaşım önbelleğini desteklemiyor.");
          }
          const cache = await caches.open('pwa-shares');
          const [metadataRes, fileRes] = await Promise.all([
            cache.match('/shares/latest-metadata'),
            cache.match('/shares/latest-file')
          ]);

          let metadata = { title: '', text: '' };
          if (metadataRes) {
            metadata = await metadataRes.json();
          }

          const savedCategories = localStorage.getItem('app_categories');
          const currentCats = savedCategories ? JSON.parse(savedCategories) : categories;

          if (fileRes) {
            const blob = await fileRes.blob();
            const reader = new FileReader();
            reader.onloadend = async () => {
              const base64 = reader.result as string;
              try {
                setStatus(AppStatus.PROCESSING);
                setStatusText("Paylaşılan görsel çözümleniyor...");
                const data = await extractReceiptData(base64, currentCats, (msg) => setStatusText(msg));
                if (fileRes.headers.get('Content-Type')?.startsWith('image/')) {
                  data.imageUrl = base64;
                }
                setSharedImportData(data);
                setStatus(AppStatus.IDLE);
                setActiveTab('dashboard');
              } catch (err: any) {
                console.error("Shared file gemini extraction failed:", err);
                setSharedImportError("Görsel analiz edilemedi: " + (err.message || err));
                setStatus(AppStatus.IDLE);
              }
            };
            reader.onerror = () => {
              setSharedImportError("Paylaşılan görsel okunurken hata oluştu.");
              setIsFetchingShared(false);
            };
            reader.readAsDataURL(blob);
          } else if (metadata.text) {
            try {
              setStatus(AppStatus.PROCESSING);
              setStatusText("Paylaşılan metin çözümleniyor...");
              const data = await extractAkbankTextData(metadata.text, currentCats, (msg) => setStatusText(msg));
              setSharedImportData(data);
              setStatus(AppStatus.IDLE);
              setActiveTab('dashboard');
            } catch (err: any) {
              console.error("Shared text extraction failed:", err);
              setSharedImportError("Metin analiz edilemedi: " + (err.message || err));
              setStatus(AppStatus.IDLE);
            }
          } else {
            setSharedImportError("Paylaşılan dosya veya metin bulunamadı.");
          }

          await Promise.all([
            cache.delete('/shares/latest-metadata'),
            cache.delete('/shares/latest-file')
          ]);
        } catch (err: any) {
          console.error("Error reading shared data from client cache:", err);
          setSharedImportError("Paylaşılan veri okunurken hata oluştu: " + (err.message || err));
        } finally {
          setIsFetchingShared(false);
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      })();
    } else if (shareError) {
      setSharedImportError(
        shareError === 'NoDataExtracted' 
          ? "Paylaşılan belgeden geçerli bir işlem verisi çıkartılamadı." 
          : `Paylaşım Hatası: ${decodeURIComponent(shareError)}`
      );
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  // Helper function to trigger interactive Android/PWA installation
  const triggerInstallPrompt = () => {
    setShowPwaInstallModal(true);
  };

  const handleNativeInstallTrigger = async () => {
    if (!deferredPrompt) return;
    try {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      console.log(`PWA install user choice: ${outcome}`);
      setDeferredPrompt(null);
    } catch (err) {
      console.error("Installation prompt error:", err);
    }
  };

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

  const dashboardFilteredReceipts = useMemo(() => {
    return activeReceipts.filter(r => {
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
    });
  }, [activeReceipts, dashboardMonth]);

  const mostSpentCategory = useMemo(() => {
    const categoryTotals: Record<string, number> = {};
    dashboardFilteredReceipts.forEach(r => {
      const cat = r.category || 'Gıda ve Market';
      categoryTotals[cat] = (categoryTotals[cat] || 0) + r.total;
    });
    let maxCat = '';
    let maxAmount = 0;
    Object.entries(categoryTotals).forEach(([cat, amount]) => {
      if (amount > maxAmount) {
        maxAmount = amount;
        maxCat = cat;
      }
    });
    return { category: maxCat || null, amount: maxAmount };
  }, [dashboardFilteredReceipts]);

  const last7DaysTrend = useMemo(() => {
    const days = [];
    const now = new Date();
    const dayNames = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
    
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(now.getDate() - i);
      
      const dayVal = String(d.getDate()).padStart(2, '0');
      const monthVal = String(d.getMonth() + 1).padStart(2, '0');
      const yearVal = d.getFullYear();
      
      const dotFormat = `${dayVal}.${monthVal}.${yearVal}`;
      const label = `${dayVal}/${monthVal}`;
      const dayName = dayNames[d.getDay()];
      
      days.push({
        dotFormat,
        label,
        dayName,
        total: 0
      });
    }

    activeReceipts.forEach(r => {
      if (!r.date) return;
      let rDate = r.date.trim();
      if (rDate.includes('-')) {
        const parts = rDate.split('-');
        if (parts.length === 3) {
          rDate = `${parts[2].padStart(2, '0')}.${parts[1].padStart(2, '0')}.${parts[0]}`;
        }
      }
      
      const match = days.find(d => d.dotFormat === rDate);
      if (match) {
        match.total += r.total;
      }
    });

    return days;
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
                className="space-y-2 pt-1"
              >
                <div className="flex items-center gap-2 mb-2 px-2">
                   <div className="w-6 h-6 bg-indigo-600 rounded-lg flex items-center justify-center text-white shadow-lg shadow-indigo-600/20">
                      <ScanText size={14} />
                   </div>
                   <h2 className="text-[15px] font-medium text-slate-800 dark:text-white uppercase tracking-tight">Ana Sayfa</h2>
                </div>

                {showAndroidShareTip && (
                  <div className="bg-gradient-to-br from-indigo-50/70 to-blue-50/50 dark:from-slate-900 dark:to-slate-900/60 border border-indigo-100/80 dark:border-indigo-950/40 p-5 rounded-[24px] mb-3 relative overflow-hidden text-slate-700 dark:text-slate-300 font-sans shadow-sm">
                    <button 
                      onClick={() => {
                        setShowAndroidShareTip(false);
                        localStorage.setItem('hide_android_share_tip', 'true');
                      }}
                      className="absolute top-3.5 right-3.5 p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-slate-800 rounded-full transition-all"
                      title="Kapat"
                    >
                      <X size={14} />
                    </button>
                    
                    <div className="flex gap-3 items-start">
                      <div className="p-2 bg-indigo-500/10 rounded-xl text-indigo-600 dark:text-indigo-400 shrink-0">
                        <Sparkles size={16} className="animate-pulse" />
                      </div>
                      <div className="space-y-1.5 pr-6">
                        <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-1">
                          Android Paylaşım Rehberi
                        </h4>
                        <p className="text-[11px] leading-relaxed font-semibold text-slate-600 dark:text-slate-400">
                          Telefonunuzdan PDF dekont paylaşırken **FişAI** uygulamasını listede görebilmek için:
                        </p>
                        <ul className="list-decimal list-inside text-[11px] font-medium pt-1 space-y-1.5 text-slate-600 dark:text-slate-300">
                          <li>Uygulamayı tarayıcınızdan (Chrome/Samsung Internet) <span className="font-bold text-indigo-600 dark:text-indigo-400 hover:underline">"Ana Ekrana Ekle"</span> veya <span className="font-bold text-indigo-600 dark:text-indigo-400 hover:underline">"Yükle"</span> seçeneğiyle telefonunuza yükleyin.</li>
                          <li>Paylaşım menüsünde FişAI görünmüyorsa; uygulamayı telefonunuzdan tamamen silin ve Chrome ile tekrar yükleyin (Böylece Android paylaşım kaydını yeniler).</li>
                          <li>Artık herhangi bir PDF veya fiş görselini paylaşırken ve **FişAI**'ı seçtiğinizde yapay zeka tarafından otomatik çözümlenir!</li>
                        </ul>

                        {!isAppInstalled && (
                          <div className="pt-3.5">
                            <button
                              onClick={triggerInstallPrompt}
                              className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold uppercase tracking-widest px-4 py-3 rounded-2xl flex items-center justify-center gap-1.5 shadow-md shadow-indigo-600/20 active:scale-95 transition-all font-sans"
                            >
                              <Plus size={14} />
                              Hemen Telefonuna Yükle (Kur)
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="grid grid-cols-1 gap-2">
                  {/* Toplam Harcama */}
                  <div className="bg-white dark:bg-slate-900 p-4 rounded-[24px] border border-slate-200/50 dark:border-slate-800 shadow-sm relative overflow-hidden group font-sans">
                    <div className="absolute top-0 right-0 p-6 opacity-[0.03] dark:opacity-[0.05] group-hover:scale-110 transition-transform">
                      <Wallet size={80} />
                    </div>
                    
                    <div className="flex justify-between items-start mb-2">
                      <div className="space-y-0.5">
                        <span className="text-[11px] font-medium text-indigo-600 dark:text-indigo-400 uppercase tracking-widest block">Toplam Harcama</span>
                        <div className="text-2xl font-medium tracking-tight tabular-nums flex items-baseline gap-1 font-display">
                          {dashboardFilteredReceipts
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
                        <span className="text-base font-medium font-display">{dashboardFilteredReceipts.length}</span>
                      </div>
                      <div className="h-6 w-px bg-slate-100 dark:bg-slate-800"></div>
                      <div className="flex flex-col">
                        <span className="text-[10px] font-medium text-slate-400 uppercase tracking-widest">Ortalama</span>
                        <span className="text-base font-medium font-display">
                          {(dashboardFilteredReceipts.length > 0 ? dashboardFilteredReceipts.reduce((s, r) => s + r.total, 0) / dashboardFilteredReceipts.length : 0).toLocaleString('tr-TR', { maximumFractionDigits: 0 })}
                          <span className="text-[12px] ml-0.5 opacity-40">₺</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* En Çok Harcanan Kategori & Son 7 Günlük Trend Row */}
                  <div className="grid grid-cols-2 gap-2">
                    {/* Left Card: Most Spent Category */}
                    <div className="bg-white dark:bg-slate-900 p-4 rounded-[24px] border border-slate-200/50 dark:border-slate-800 shadow-sm relative overflow-hidden group flex flex-col justify-between h-[125px]">
                      <div className="absolute top-0 right-0 p-4 opacity-[0.03] dark:opacity-[0.05] group-hover:scale-110 transition-transform">
                        <Award size={64} />
                      </div>
                      
                      <div>
                        <span className="text-[10px] font-medium text-slate-400 uppercase tracking-widest block mb-1">En Çok Harcanan</span>
                        {mostSpentCategory.category ? (
                          <div className="space-y-1.5">
                            <span className={`inline-block text-[10px] font-bold px-2 rounded-md border uppercase tracking-wider ${getCategoryColor(mostSpentCategory.category)}`}>
                              {mostSpentCategory.category}
                            </span>
                            <div className="text-xl font-medium tracking-tight tabular-nums flex items-baseline gap-0.5 font-display text-slate-900 dark:text-white mt-1">
                              {mostSpentCategory.amount.toLocaleString('tr-TR', { minimumFractionDigits: 0 })}
                              <span className="text-xs font-semibold text-slate-400">₺</span>
                            </div>
                          </div>
                        ) : (
                          <p className="text-[11px] text-slate-400 font-medium">Veri bulunmuyor</p>
                        )}
                      </div>
                    </div>

                    {/* Right Card: Last 7 Days Trend */}
                    <div className="bg-white dark:bg-slate-900 p-4 rounded-[24px] border border-slate-200/50 dark:border-slate-800 shadow-sm flex flex-col justify-between relative overflow-hidden group h-[125px]">
                      <div className="absolute top-0 right-0 p-4 opacity-[0.03] dark:opacity-[0.05] group-hover:scale-110 transition-transform">
                        <BarChart2 size={64} />
                      </div>

                      <div>
                        <span className="text-[10px] font-medium text-slate-400 uppercase tracking-widest block mb-1">Son 7 Günlük</span>
                        <div className="text-xl font-medium tracking-tight tabular-nums flex items-baseline gap-0.5 font-display text-slate-900 dark:text-white">
                          {last7DaysTrend.reduce((sum, d) => sum + d.total, 0).toLocaleString('tr-TR', { minimumFractionDigits: 0 })}
                          <span className="text-xs font-semibold text-slate-400">₺</span>
                        </div>
                      </div>
                      
                      {/* Micro Spark bars */}
                      <div className="flex gap-1 items-end h-[30px] relative z-10">
                        {last7DaysTrend.map((day, idx) => {
                          const maxVal = Math.max(...last7DaysTrend.map(d => d.total), 1);
                          const barHeight = Math.max((day.total / maxVal) * 100, 6);
                          return (
                            <div key={idx} className="flex-1 flex flex-col items-center h-full group/day relative cursor-pointer">
                              <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-[8px] font-medium px-1 py-0.5 rounded shadow pointer-events-none opacity-0 group-hover/day:opacity-100 transition-opacity z-20 whitespace-nowrap">
                                {day.total.toFixed(0)}₺
                              </div>
                              <div className="w-full bg-slate-50 dark:bg-slate-800 group-hover/day:bg-indigo-500 rounded-t-[2px] h-full flex items-end">
                                <motion.div 
                                  initial={{ height: 0 }}
                                  animate={{ height: `${barHeight}%` }}
                                  className={`w-full rounded-t-[2px] transition-colors duration-300 ${day.total > 0 ? 'bg-indigo-500 dark:bg-indigo-400' : 'bg-slate-200/50 dark:bg-slate-700/50'}`}
                                />
                              </div>
                              <span className="text-[6px] font-black text-slate-400 mt-1 dark:text-slate-500 tracking-tighter block scale-90">
                                {day.dayName[0]}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Buttons */}
                  <div className="flex gap-2 w-full mt-1">
                    <motion.button 
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setShowCamera(true)} 
                      disabled={status === AppStatus.PROCESSING} 
                      className="flex-[1.8] bg-slate-900 dark:bg-white text-white dark:text-slate-900 py-3 rounded-[20px] flex items-center justify-center gap-2 shadow-xl active:shadow-inner transition-all group overflow-hidden relative min-w-[107px]"
                    >
                       <div className="absolute inset-0 bg-indigo-600 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out"></div>
                       <Camera size={16} className="relative z-10" /> 
                       <span className="text-[12px] font-medium uppercase tracking-widest relative z-10 font-sans">Fiş Tara</span>
                    </motion.button>
                    
                    <motion.button 
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setShowAkbankModal(true)} 
                      disabled={status === AppStatus.PROCESSING} 
                      className="flex-[1.5] bg-red-600 hover:bg-red-700 text-white py-3 rounded-[20px] flex items-center justify-center gap-1.5 shadow-xl transition-all relative overflow-hidden text-center min-w-[95px]"
                    >
                       <Sparkles size={13} className="animate-pulse text-red-100" />
                       <span className="text-[11px] font-black uppercase tracking-wider font-sans">Akbank</span>
                    </motion.button>

                    <motion.button 
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setShowManualEntry(true)} 
                      disabled={status === AppStatus.PROCESSING} 
                      className="w-11 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-[20px] flex items-center justify-center shadow-sm active:shadow-inner transition-all hover:bg-slate-200 dark:hover:bg-slate-700"
                      title="Manuel Ekle"
                    >
                       <Keyboard size={16} /> 
                    </motion.button>
                    <motion.button 
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => fileInputRef.current?.click()} 
                      disabled={status === AppStatus.PROCESSING} 
                      className="w-11 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-[20px] flex items-center justify-center shadow-sm active:shadow-inner transition-all hover:bg-slate-200 dark:hover:bg-slate-700"
                      title="Galeriden Seç"
                    >
                       <ImageIcon size={16} /> 
                    </motion.button>
                  </div>
                </div>

                <div className="pt-2">
                  <div className="flex justify-between items-center mb-2 px-2">
                    <h3 className="text-[12px] font-medium text-slate-400 uppercase tracking-[0.2em]">Son İşlemler</h3>
                        <div className="h-px flex-1 mx-4 bg-slate-100 dark:bg-slate-800"></div>
                      </div>
                  
                    <ReceiptTable 
                      receipts={dashboardFilteredReceipts}
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

                  <input type="file" ref={importInputRef} onChange={handleFileImport} accept=".json" className="hidden" />
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

          <AkbankImportModal 
            isOpen={showAkbankModal}
            onClose={() => setShowAkbankModal(false)}
            categories={categories}
            onAdd={(data) => {
              setReceipts(prev => [data, ...prev]);
              setDashboardMonth("Hepsi");
              setActiveTab('dashboard');
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

          <PwaInstallModal
            isOpen={showPwaInstallModal}
            onClose={() => setShowPwaInstallModal(false)}
            deferredPrompt={deferredPrompt}
            onTriggerInstall={handleNativeInstallTrigger}
          />

          {/* Loading Shared Content Overlay */}
          {isFetchingShared && (
            <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/60 backdrop-blur-sm">
              <div className="bg-white dark:bg-slate-900 rounded-[30px] p-6 max-w-sm w-full mx-4 flex flex-col items-center text-center shadow-2xl border border-slate-100 dark:border-slate-800">
                <div className="p-4 bg-indigo-50 dark:bg-indigo-950/20 rounded-full text-indigo-600 dark:text-indigo-400 mb-4">
                  <Loader2 size={32} className="animate-spin" />
                </div>
                <h3 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white mb-2 font-sans">Paylaşılan Akbank Dekontu</h3>
                <p className="text-[11px] text-slate-500 font-medium">Gemini Yapay Zeka ile paylaşılan PDF/belge çözümleniyor, lütfen bekleyin...</p>
              </div>
            </div>
          )}

          {/* Shared Content Error Modal */}
          {sharedImportError && (
            <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/60 backdrop-blur-sm">
              <div className="bg-white dark:bg-slate-900 rounded-[30px] p-6 max-w-sm w-full mx-4 flex flex-col items-center text-center shadow-2xl border border-red-500/10">
                <div className="p-4 bg-red-50 dark:bg-red-950/20 rounded-full text-red-600 dark:text-red-400 mb-4 border border-red-500/10 animate-bounce">
                  <AlertCircle size={32} />
                </div>
                <h3 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white mb-2 font-sans">Çözümleme Başarısız</h3>
                <p className="text-xs text-slate-500 mb-6 font-medium leading-relaxed">{sharedImportError}</p>
                <button
                  onClick={() => setSharedImportError(null)}
                  className="w-full py-3 bg-red-600 text-white hover:bg-red-700 rounded-2xl text-[10px] uppercase font-bold tracking-widest active:scale-95 transition-all shadow-lg shadow-red-500/15"
                >
                  Kapat
                </button>
              </div>
            </div>
          )}

          {/* Shared Content Confirmation Modal */}
          {sharedImportData && (
            <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm animate-fade-in" onClick={() => setSharedImportData(null)} />
              
              <div className="bg-white dark:bg-slate-900 rounded-[30px] shadow-2xl overflow-hidden relative z-10 border border-slate-100 dark:border-slate-800 w-full max-w-sm max-h-[90vh] flex flex-col">
                <div className="bg-gradient-to-r from-red-600 to-red-700 p-5 text-white">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Sparkles size={14} className="text-red-200 animate-pulse" />
                    <span className="text-[9px] uppercase font-black tracking-wider text-red-100">Android Akbank Paylaşımı</span>
                  </div>
                  <h3 className="text-md font-black tracking-tight font-sans">Akıllı Transfer Aktarımı</h3>
                  <p className="text-[10px] text-red-100 mt-1 mb-0 font-medium">Android paylaşım modülü ile gelen Akbank dekontu çözümlendi.</p>
                </div>

                <div className="p-5 overflow-y-auto space-y-4">
                  <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/10 rounded-2xl p-4 text-emerald-800 dark:text-emerald-400 space-y-3">
                    <div className="flex items-center gap-1 font-bold text-xs uppercase tracking-wider">
                      <Check size={14} />
                      Otomatik Çözümlendi!
                    </div>

                    <div className="space-y-2 mt-2 p-3 bg-white dark:bg-slate-950 rounded-xl border border-emerald-500/10">
                      <div className="flex justify-between border-b pb-1 border-slate-100 dark:border-slate-800">
                        <span className="text-[10px] text-slate-400 uppercase font-black">Alici / Açiklama</span>
                        <input
                          type="text"
                          value={sharedImportData.vendor}
                          onChange={(e) => setSharedImportData({ ...sharedImportData, vendor: e.target.value })}
                          className="text-xs font-bold text-slate-900 dark:text-white uppercase outline-none text-right bg-transparent max-w-[150px] focus:ring-1 focus:ring-indigo-500 rounded font-sans"
                        />
                      </div>
                      <div className="flex justify-between border-b pb-1 border-slate-100 dark:border-slate-800">
                        <span className="text-[10px] text-slate-400 uppercase font-black">Miktar</span>
                        <input
                          type="number"
                          value={sharedImportData.total}
                          onChange={(e) => setSharedImportData({ ...sharedImportData, total: Number(e.target.value) })}
                          className="text-sm font-black text-rose-600 dark:text-rose-400 outline-none text-right bg-transparent max-w-[110px] focus:ring-1 focus:ring-indigo-500 rounded font-mono"
                        />
                      </div>
                      <div className="flex justify-between border-b pb-1 border-slate-100 dark:border-slate-800">
                        <span className="text-[10px] text-slate-400 uppercase font-black">İşlem Tarihi</span>
                        <input
                          type="text"
                          value={sharedImportData.date}
                          onChange={(e) => setSharedImportData({ ...sharedImportData, date: e.target.value })}
                          className="text-xs font-bold text-slate-900 dark:text-white outline-none text-right bg-transparent max-w-[110px] focus:ring-1 focus:ring-indigo-500 rounded font-sans"
                        />
                      </div>
                      <div className="flex flex-col gap-1.5 mt-1 pt-1">
                        <span className="text-[10px] text-slate-400 uppercase font-black font-sans">Kategori Belirle</span>
                        <div className="flex flex-wrap gap-1">
                          {categories.map((cat) => (
                            <button
                              key={cat}
                              onClick={() => setSharedImportData({ ...sharedImportData, category: cat })}
                              className={`text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-lg transition-all ${sharedImportData.category === cat ? "bg-indigo-600 text-white" : "bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-100"}`}
                            >
                              {cat}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => setSharedImportData(null)}
                      className="flex-1 py-3 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-2xl text-[10px] uppercase font-bold tracking-widest active:scale-[0.98] transition-all"
                    >
                      Vazgeç
                    </button>
                    <button
                      onClick={() => {
                        const newReceipt: ReceiptData = {
                          id: Math.random().toString(36).substr(2, 9),
                          vendor: (sharedImportData.vendor || 'AKBANK PAYLAŞIM').toUpperCase(),
                          date: sharedImportData.date || new Date().toLocaleDateString('tr-TR'),
                          total: Number(sharedImportData.total) || 0,
                          currency: '₺',
                          category: sharedImportData.category || categories[0],
                          tax: 0,
                          items: [
                            {
                              name: sharedImportData.vendor ? `${sharedImportData.vendor} Transferi` : 'Akbank Transferi',
                              price: Number(sharedImportData.total) || 0,
                              quantity: 1
                            }
                          ],
                          confidence: 1.0,
                          timestamp: Date.now(),
                          imageUrl: sharedImportData.imageUrl
                        };
                        setReceipts(prev => [newReceipt, ...prev]);
                        setSharedImportData(null);
                        setDashboardMonth("Hepsi");
                        setActiveTab('dashboard');
                      }}
                      className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-2xl text-[10px] uppercase font-bold tracking-widest shadow-lg shadow-red-600/30 active:scale-[0.98] transition-all flex items-center justify-center gap-1 font-sans"
                    >
                      Onayla ve Ekle
                      <ArrowRight size={14} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

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

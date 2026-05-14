import React, { useState, useEffect, useMemo, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Html5Qrcode } from 'html5-qrcode';
import { X, QrCode, Scan, Download, Upload, CheckCircle2, AlertCircle, ChevronLeft, ChevronRight, Image as ImageIcon, Camera, Share2, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ReceiptData } from '../types';

interface SyncModalProps {
  receipts: ReceiptData[];
  onImport: (importedReceipts: ReceiptData[]) => void;
  onClose: () => void;
  availableMonths: string[];
}

export const SyncModal: React.FC<SyncModalProps> = ({ receipts, onImport, onClose, availableMonths }) => {
  const [mode, setMode] = useState<'selection' | 'export' | 'import'>('selection');
  const [selectedMonth, setSelectedMonth] = useState<string>(availableMonths[0] || 'Hepsi');
  const [selectedCategory, setSelectedCategory] = useState<string>('Hepsi');
  const [syncStatus, setSyncStatus] = useState<{ success?: boolean; message?: string } | null>(null);

  const availableCategories = useMemo(() => {
    const cats = new Set(receipts.map(r => r.category));
    return Array.from(cats).sort();
  }, [receipts]);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [useFileFallback, setUseFileFallback] = useState(false);
  
  // States for Sequential QR (Animated)
  const [exportChunkIndex, setExportChunkIndex] = useState(0);
  const [importChunks, setImportChunks] = useState<Record<number, string>>({});
  const [importTotal, setImportTotal] = useState(0);
  
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Helper to compress/decompress data for QR
  const compressData = (data: ReceiptData[]) => {
    return data.map(r => ({
      v: r.vendor,
      d: r.date,
      t: r.total,
      c: r.category,
      u: r.currency,
      s: r.timestamp,
      i: r.id,
      x: r.tax,
      m: (r.items || []).map(item => ({
        n: item.name,
        p: item.price,
        q: item.quantity
      }))
    }));
  };

  const decompressData = (data: any[]) => {
    if (!Array.isArray(data)) return [];
    
    return data.map(r => {
      // If it looks like compressed format (v is vendor key)
      if (r && typeof r === 'object' && 'v' in r) {
        return {
          vendor: String(r.v || 'BİLİNMEYEN').toUpperCase(),
          date: String(r.d || new Date().toLocaleDateString('tr-TR')),
          total: Number(r.t) || 0,
          category: String(r.c || 'Diğer'),
          currency: String(r.u || '₺'),
          timestamp: Number(r.s) || Date.now(),
          id: String(r.i || Math.random().toString(36).substr(2, 9)),
          tax: Number(r.x) || 0,
          items: Array.isArray(r.m) ? r.m.map((item: any) => ({
            name: String(item.n || 'Ürün'),
            price: Number(item.p) || 0,
            quantity: Number(item.q) || 1
          })) : [],
          confidence: 1
        };
      }
      
      // Fallback for raw format
      return {
        ...r,
        vendor: String(r.vendor || r.market || 'BİLİNMEYEN').toUpperCase(),
        total: Number(r.total || 0),
        items: Array.isArray(r.items) ? r.items : [],
        id: r.id || Math.random().toString(36).substr(2, 9)
      } as ReceiptData;
    });
  };

  // Filter receipts for export
  const exportData = useMemo(() => {
    const filtered = receipts.filter(r => {
      const matchesMonth = selectedMonth === 'Hepsi' || (r.date.includes('.') ? `${r.date.split('.')[2]}-${r.date.split('.')[1]}` : r.date.substring(0, 7)) === selectedMonth;
      const matchesCategory = selectedCategory === 'Hepsi' || r.category === selectedCategory;
      return matchesMonth && matchesCategory;
    });

    return compressData(filtered);
  }, [receipts, selectedMonth, selectedCategory]);

  const qrValue = useMemo(() => {
    try {
      const fullData = JSON.stringify(exportData);
      
      // If data is small enough, return as is
      if (fullData.length <= 1500) {
        return fullData;
      }
      
      // Split into chunks if too large (Sequential QR)
      const CHUNK_SIZE = 800;
      const chunks = [];
      for (let i = 0; i < fullData.length; i += CHUNK_SIZE) {
        chunks.push(fullData.substring(i, i + CHUNK_SIZE));
      }
      
      const index = exportChunkIndex % chunks.length;
      return `SEQ|${index}|${chunks.length}|${chunks[index]}`;
    } catch (e) {
      return '';
    }
  }, [exportData, exportChunkIndex]);

  const isSequential = useMemo(() => {
    try {
      return JSON.stringify(exportData).length > 1500;
    } catch (e) {
      return false;
    }
  }, [exportData]);

  const totalExportChunks = useMemo(() => {
    try {
      const fullData = JSON.stringify(exportData);
      return Math.ceil(fullData.length / 800);
    } catch (e) {
      return 1;
    }
  }, [exportData]);

  // Auto-cycle chunks if sequential
  useEffect(() => {
    if (mode === 'export' && isSequential) {
      const interval = setInterval(() => {
        setExportChunkIndex(prev => (prev + 1) % totalExportChunks);
      }, 1000); // Faster cycling for better pickup
      return () => clearInterval(interval);
    }
  }, [mode, isSequential, totalExportChunks]);

  const handleScanSuccess = async (decodedText: string) => {
    try {
      let dataStr = decodedText.trim();
      
      // Handle WhatsApp prefix
      const prefix = 'BÜTÇE_VERİSİ:';
      const startIndex = dataStr.indexOf(prefix);
      if (startIndex !== -1) {
        dataStr = dataStr.substring(startIndex + prefix.length).trim();
      }

      // Check for Sequential QR format: SEQ|index|total|data
      if (dataStr.startsWith('SEQ|')) {
        const parts = dataStr.split('|');
        if (parts.length >= 4) {
          const index = parseInt(parts[1]);
          const total = parseInt(parts[2]);
          const payload = parts.slice(3).join('|');

          setImportTotal(total);
          setImportChunks(prev => {
            const next = { ...prev, [index]: payload };
            
            // Check if we have all chunks
            if (Object.keys(next).length === total) {
              const fullData = Array.from({ length: total })
                .map((_, i) => next[i])
                .join('');
              
              // Process full data
              setTimeout(() => finalizeImport(fullData), 100);
            }
            return next;
          });
          return;
        }
      }

      // Handle direct JSON (Static QR or Clipboard)
      finalizeImport(dataStr);
    } catch (e) {
      console.error("Parse error:", e);
      setSyncStatus({ success: false, message: "Veri okunamadı. Lütfen metnin tamamını kopyaladığınızdan emin olun." });
    }
  };

  const finalizeImport = (dataStr: string) => {
    try {
      let cleanStr = dataStr.trim();
      
      // Find the first '[' and last ']' to isolate the JSON array
      const firstBracket = cleanStr.indexOf('[');
      const lastBracket = cleanStr.lastIndexOf(']');
      
      if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
        cleanStr = cleanStr.substring(firstBracket, lastBracket + 1);
      }

      let imported;
      try {
        imported = JSON.parse(cleanStr);
      } catch (parseError) {
        console.error("JSON parse failed", parseError);
        setSyncStatus({ success: false, message: "Veri formatı hatalı. Lütfen QR kodu tam okuttuğunuzdan emin olun." });
        return;
      }
      
      // Check if it's compressed format
      if (Array.isArray(imported) && imported.length > 0 && typeof imported[0] === 'object' && ('v' in imported[0] || 'vendor' in imported[0])) {
        imported = decompressData(imported);
      }

      if (Array.isArray(imported)) {
        if (imported.length === 0) {
          setSyncStatus({ success: false, message: "Aktarılacak kayıt bulunamadı." });
          return;
        }
        
        onImport(imported as ReceiptData[]);
        setSyncStatus({ success: true, message: `${imported.length} kayıt başarıyla aktarıldı.` });
        stopScanner();
        setTimeout(() => {
          setMode('selection');
          setImportChunks({});
          setImportTotal(0);
        }, 2000);
      } else {
        setSyncStatus({ success: false, message: "Veri bir liste (Array) olmalı." });
      }
    } catch (e) {
      console.error("Finalize import error:", e);
      setSyncStatus({ success: false, message: "Bilinmeyen bir hata oluştu." });
    }
  };

  const handleClipboardImport = async () => {
    try {
      let text = "";
      
      // Try modern clipboard API
      try {
        if (navigator.clipboard && navigator.clipboard.readText) {
          text = await navigator.clipboard.readText();
        }
      } catch (e) {
        console.warn("Clipboard API failed", e);
      }

      // Fallback to prompt if clipboard API failed or returned empty
      if (!text) {
        text = window.prompt("WhatsApp'tan kopyaladığınız kodu buraya yapıştırın:") || "";
      }

      if (text.trim()) {
        handleScanSuccess(text);
      } else if (text === "") {
        setSyncStatus({ success: false, message: "Pano boş veya yapıştırma iptal edildi." });
      }
    } catch (err) {
      setSyncStatus({ success: false, message: "Erişim hatası oluştu." });
    }
  };

  const handleShareData = async () => {
    const dataToShare = receipts.filter(r => {
      const matchesMonth = selectedMonth === 'Hepsi' || (r.date.includes('.') ? `${r.date.split('.')[2]}-${r.date.split('.')[1]}` : r.date.substring(0, 7)) === selectedMonth;
      const matchesCategory = selectedCategory === 'Hepsi' || r.category === selectedCategory;
      return matchesMonth && matchesCategory;
    });

    const fileName = `butce_paylasim_${new Date().toISOString().split('T')[0]}.json`;
    const jsonString = JSON.stringify(dataToShare, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const file = new File([blob], fileName, { type: 'application/json' });

    // 1. Try Native File Sharing (Best for mobile app/WhatsApp)
    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: 'Bütçe Veri Paylaşımı',
          text: 'Bütçe verilerim (Uygulama içine aktarılabilir)',
        });
        return;
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        console.warn("File share failed, trying text share...", err);
      }
    }

    // 2. Try Text Sharing (Compressed message)
    const compressedText = `BÜTÇE_VERİSİ:${JSON.stringify(compressData(dataToShare))}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Bütçe Verileri',
          text: compressedText
        });
        return;
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        console.warn("Text share failed, trying clipboard...", err);
      }
    }

    // 3. Last fallback: Copy to Clipboard
    try {
      await navigator.clipboard.writeText(compressedText);
      setSyncStatus({ success: true, message: "Veri paylaşılamadı ama kopyalandı! WhatsApp'a yapıştırabilirsiniz." });
      setTimeout(() => setSyncStatus(null), 3000);
    } catch (err) {
      // 4. Last resort: Download
      handleDownloadFile();
    }
  };

  const handleDownloadFile = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(receipts));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href",     dataStr);
    downloadAnchorNode.setAttribute("download", `butce_yedek_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const isStartingRef = useRef(false);
  const isTransitioningRef = useRef(false);

  const startScanner = async () => {
    if (isStartingRef.current || isTransitioningRef.current) {
      console.warn("Scanner already starting or transitioning");
      return;
    }
    
    const element = document.getElementById("qr-reader");
    if (!element) {
      console.warn("QR reader element not found yet");
      return;
    }

    try {
      isStartingRef.current = true;
      isTransitioningRef.current = true;
      setIsCameraActive(false);
      
      // Safety cleanup
      if (scannerRef.current) {
        try {
          if (scannerRef.current.isScanning()) {
            await scannerRef.current.stop();
            // Critical: give some time for the library to release resources
            await new Promise(r => setTimeout(r, 200));
          }
        } catch (e) {
          console.warn("Cleanup stop failed", e);
        }
      } else {
        scannerRef.current = new Html5Qrcode("qr-reader");
      }

      const config = {
        fps: 15,
        qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
          const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
          const qrboxSize = Math.floor(minEdge * 0.7);
          return { width: qrboxSize, height: qrboxSize };
        },
        aspectRatio: 1.0
      };

      try {
        await scannerRef.current.start(
          { facingMode: { ideal: "environment" } },
          config,
          handleScanSuccess,
          () => {} // Ignore scan errors
        );
      } catch (err) {
        console.warn("Starting with ideal environment failed, trying simple environment...", err);
        // Fallback to simple environment
        await scannerRef.current.start(
          { facingMode: "environment" },
          config,
          handleScanSuccess,
          () => {}
        );
      }

      setIsCameraActive(true);
      setSyncStatus(null);
    } catch (err) {
      console.error("Final camera start error", err);
      setIsCameraActive(false);
      
      if (mode === 'import' && !useFileFallback) {
        setSyncStatus({ 
          success: false, 
          message: "Kamera erişimi engellendi veya cihazda kamera bulunamadı. Lütfen tarayıcı izinlerini kontrol edin veya resim seçerek tarayın." 
        });
      }
    } finally {
      isStartingRef.current = false;
      isTransitioningRef.current = false;
    }
  };

  const stopScanner = async () => {
    if (!scannerRef.current || isTransitioningRef.current) return;
    
    try {
      isTransitioningRef.current = true;
      if (scannerRef.current.isScanning()) {
        await scannerRef.current.stop();
        // Give space
        await new Promise(r => setTimeout(r, 100));
      }
      setIsCameraActive(false);
    } catch (err) {
      console.error("Camera stop error", err);
    } finally {
      isTransitioningRef.current = false;
    }
  };

  const handleFileScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSyncStatus({ message: "Dosya inceleniyor..." });

    // IF JSON FILE: Read directly as text
    if (file.type === 'application/json' || file.name.endsWith('.json')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        handleScanSuccess(text);
      };
      reader.onerror = () => setSyncStatus({ success: false, message: "Dosya okuma hatası." });
      reader.readAsText(file);
      return;
    }

    // IF IMAGE: Try QR Scan
    if (!scannerRef.current) {
      scannerRef.current = new Html5Qrcode("qr-reader");
    }

    try {
      const decodedText = await scannerRef.current.scanFile(file, true);
      handleScanSuccess(decodedText);
    } catch (err) {
      console.error("File scan error", err);
      setSyncStatus({ success: false, message: "Fotoğrafta QR kod bulunamadı veya dosya geçersiz." });
    }
  };

  useEffect(() => {
    if (mode === 'import') {
      setImportChunks({});
      setImportTotal(0);
      setSyncStatus(null);
    }
    
    if (mode === 'import' && !useFileFallback) {
      const timer = setTimeout(() => {
        startScanner();
      }, 500);
      return () => {
        clearTimeout(timer);
        stopScanner();
      };
    } else if (mode !== 'import' || useFileFallback) {
      stopScanner();
    }
  }, [mode, useFileFallback]);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[32px] overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800"
      >
        <div className="flex justify-between items-center p-6 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white">
              <QrCode size={18} />
            </div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-800 dark:text-white">QR Senkronizasyon</h3>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-400">
            <X size={20} />
          </button>
        </div>

        <div className="p-6">
          <AnimatePresence mode="wait">
            {mode === 'selection' && (
              <motion.div 
                key="selection"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-4"
              >
                <div className="text-center space-y-2 mb-6">
                  <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
                    İşlem türünü seçin
                  </p>
                </div>
                
                <div className="grid grid-cols-1 gap-3">
                  <button 
                    onClick={() => setMode('export')}
                    className="flex items-center gap-4 p-5 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400 rounded-2xl hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition-all border border-indigo-100/50 dark:border-indigo-500/20 group"
                  >
                    <div className="w-12 h-12 bg-white dark:bg-indigo-900/40 rounded-xl flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                      <Download size={24} />
                    </div>
                    <div className="text-left">
                      <span className="block font-bold text-sm uppercase tracking-tight">Veri Gönder</span>
                      <span className="text-[11px] opacity-70">QR Kod oluşturarak eşinizle paylaşın</span>
                    </div>
                    <ChevronRight size={18} className="ml-auto opacity-40" />
                  </button>

                  <button 
                    onClick={() => {
                      setMode('import');
                      setUseFileFallback(false);
                    }}
                    className="flex items-center gap-4 p-5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 rounded-2xl hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-all border border-emerald-100/50 dark:border-emerald-500/20 group"
                  >
                    <div className="w-12 h-12 bg-white dark:bg-emerald-900/40 rounded-xl flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                      <Scan size={24} />
                    </div>
                    <div className="text-left">
                      <span className="block font-bold text-sm uppercase tracking-tight">Veri Al (Kamera)</span>
                      <span className="text-[11px] opacity-70">Eşinizin QR kodunu kamerayla tarayın</span>
                    </div>
                    <ChevronRight size={18} className="ml-auto opacity-40" />
                  </button>

                  <button 
                    onClick={() => {
                      setMode('import');
                      setUseFileFallback(true);
                      setTimeout(() => fileInputRef.current?.click(), 100);
                    }}
                    className="flex items-center gap-4 p-5 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 rounded-2xl hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-all border border-amber-100/50 dark:border-amber-500/20 group"
                  >
                    <div className="w-12 h-12 bg-white dark:bg-amber-900/40 rounded-xl flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                      <ImageIcon size={24} />
                    </div>
                    <div className="text-left">
                      <span className="block font-bold text-sm uppercase tracking-tight">Resimden Al (Çözüm)</span>
                      <span className="text-[11px] opacity-70">QR kodun ekran görüntüsünü seçin</span>
                    </div>
                    <ChevronRight size={18} className="ml-auto opacity-40" />
                  </button>
                </div>
              </motion.div>
            )}

            {mode === 'export' && (
              <motion.div 
                key="export"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6 flex flex-col items-center"
              >
                <div className="w-full flex flex-col gap-3">
                  <div className="flex items-center gap-3">
                    <button onClick={() => setMode('selection')} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors">
                      <ChevronLeft size={20} />
                    </button>
                    <select 
                      value={selectedMonth} 
                      onChange={e => setSelectedMonth(e.target.value)} 
                      className="flex-1 bg-slate-100 dark:bg-slate-800 px-4 py-2 rounded-xl text-sm font-semibold text-slate-700 dark:text-slate-200 border-none outline-none cursor-pointer"
                    >
                      <option value="Hepsi">Tüm Zamanlar</option>
                      {availableMonths.map(m => {
                        const [y, mm] = m.split('-');
                        const ms = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
                        return <option key={m} value={m}>{`${ms[parseInt(mm) - 1]} ${y}`}</option>;
                      })}
                    </select>
                  </div>
                  
                  <div className="flex items-center gap-3 pl-12">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 min-w-fit">Kategori:</span>
                    <select 
                      value={selectedCategory} 
                      onChange={e => setSelectedCategory(e.target.value)} 
                      className="flex-1 bg-slate-100 dark:bg-slate-800 px-4 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-300 border-none outline-none cursor-pointer"
                    >
                      <option value="Hepsi">Tüm Kategoriler</option>
                      {availableCategories.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="text-center">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-4">
                    {exportData.length} Kayıt Gönderiliyor
                  </p>
                  
                  <div className="space-y-6 flex flex-col items-center">
                    <div className="p-6 bg-white dark:bg-white rounded-3xl shadow-xl relative">
                      <QRCodeSVG 
                        value={qrValue} 
                        size={256}
                        level="L"
                        includeMargin={true}
                      />
                      
                      {isSequential && (
                        <div className="absolute top-2 right-2 bg-indigo-600 text-white text-[9px] font-bold px-2 py-1 rounded-full animate-pulse">
                          {((exportChunkIndex % totalExportChunks) + 1)} / {totalExportChunks}
                        </div>
                      )}
                    </div>
                    
                    {isSequential && (
                      <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                        <motion.div 
                          className="bg-indigo-500 h-full"
                          initial={{ width: 0 }}
                          animate={{ width: `${((exportChunkIndex % totalExportChunks) + 1) / totalExportChunks * 100}%` }}
                        />
                      </div>
                    )}

                    <button 
                      onClick={handleShareData}
                      className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold text-[10px] uppercase tracking-widest bg-indigo-50 dark:bg-indigo-900/20 px-4 py-2 rounded-full hover:bg-indigo-100 transition-colors"
                    >
                      <Share2 size={14} />
                      WhatsApp / Dosya ile Gönder
                    </button>
                    
                    {isSequential && (
                      <p className="text-[10px] text-indigo-500 font-medium animate-pulse">
                        Dinamik QR Aktif: Eşiniz taranana kadar kamerasını tutmalı.
                      </p>
                    )}
                  </div>
                </div>

                <p className="text-[10px] text-center text-slate-500 dark:text-slate-400 px-8 italic">
                  Eşiniz "Veri Al" moduna girerek bu kodu tarayabilir veya ekran görüntüsü alıp resim olarak yükleyebilir.
                </p>
              </motion.div>
            )}

            {mode === 'import' && (
              <motion.div 
                key="import"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="space-y-4"
              >
                <div className="flex items-center justify-between gap-4 mb-4">
                  <div className="flex items-center gap-2">
                    <button onClick={() => setMode('selection')} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors">
                      <ChevronLeft size={20} />
                    </button>
                    <p className="text-sm font-semibold uppercase tracking-tight text-slate-700 dark:text-slate-200">
                      {useFileFallback ? "Resimden Tara" : "Kamera Aktif"}
                    </p>
                  </div>
                  
                  {!useFileFallback && (
                    <div className="flex gap-2">
                      <button 
                        onClick={() => {
                          stopScanner();
                          setTimeout(startScanner, 300);
                        }}
                        className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors text-slate-400"
                        title="Kamerayı Yenile"
                      >
                        <RefreshCw size={16} />
                      </button>
                       <button 
                        onClick={handleClipboardImport}
                        className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-1.5 rounded-lg"
                      >
                        Panodan Al
                      </button>
                      <button 
                        onClick={() => setUseFileFallback(true)}
                        className="text-[10px] font-bold uppercase tracking-widest text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 px-3 py-1.5 rounded-lg"
                      >
                        Resim/Dosya
                      </button>
                    </div>
                  )}
                </div>

                <div className="relative rounded-[32px] overflow-hidden bg-slate-900 aspect-square border border-slate-200 dark:border-slate-800">
                  <div id="qr-reader" className={`w-full h-full ${useFileFallback ? 'hidden' : 'block'}`}></div>
                  
                  {!useFileFallback && !isCameraActive && !syncStatus && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-white/60">
                      <Camera size={48} className="mb-4 opacity-20" />
                      <p className="text-xs mb-6 px-8 leading-relaxed">
                        Kamera otomatik olarak başlatılamadıysa aşağıdaki butona dokunun.
                      </p>
                      <button 
                        onClick={startScanner}
                        disabled={isStartingRef.current}
                        className="bg-indigo-600 active:bg-indigo-700 disabled:opacity-50 text-white px-8 py-3 rounded-2xl text-xs font-bold uppercase tracking-widest shadow-xl flex items-center gap-2"
                      >
                        {isStartingRef.current ? <RefreshCw size={16} className="animate-spin" /> : <Scan size={16} />}
                        {isStartingRef.current ? "Başlatılıyor..." : "Kamerayı Başlat"}
                      </button>
                    </div>
                  )}

                  {!useFileFallback && importTotal > 0 && !syncStatus && isCameraActive && (
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10">
                      <div className="bg-indigo-600/90 text-white px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest backdrop-blur-md shadow-lg border border-white/20">
                        {Object.keys(importChunks).length} / {importTotal} Parça Okundu
                      </div>
                    </div>
                  )}

                  {useFileFallback && !syncStatus && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-slate-400">
                      <ImageIcon size={48} className="mb-4 opacity-20" />
                      <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest shadow-lg"
                      >
                        Dosya Seç
                      </button>
                    </div>
                  )}

                  {syncStatus && (
                    <div className={`absolute inset-0 z-10 flex flex-col items-center justify-center p-6 text-center backdrop-blur-md ${syncStatus.success ? 'bg-emerald-500/90' : 'bg-rose-500/90'} text-white`}>
                      {syncStatus.success ? <CheckCircle2 size={48} /> : <AlertCircle size={48} />}
                      <p className="mt-4 font-bold uppercase tracking-widest">{syncStatus.success ? 'Başarılı' : 'Hata'}</p>
                      <p className="text-sm mt-1">{syncStatus.message}</p>
                      
                      {!syncStatus.success && (
                        <button 
                          onClick={() => setSyncStatus(null)}
                          className="mt-6 text-[10px] uppercase font-bold tracking-widest bg-white/20 px-4 py-2 rounded-full"
                        >
                          Tekrar Dene
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  accept="image/*" 
                  onChange={handleFileScan}
                />

                <p className="text-[10px] text-center text-slate-500 dark:text-slate-400 px-4">
                  {useFileFallback 
                    ? "QR kodun bulunduğu fotoğrafı veya ekran görüntüsünü seçin." 
                    : "Eşinizin cihazındaki QR kodu kadrajın içine yerleştirin."}
                  {!useFileFallback && !syncStatus && (
                    <span className="block mt-2 text-indigo-500 font-medium cursor-pointer hover:underline" onClick={() => window.open(window.location.href, '_blank')}>
                      Kamera açılmıyorsa yeni sekmede deneyin →
                    </span>
                  )}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
};

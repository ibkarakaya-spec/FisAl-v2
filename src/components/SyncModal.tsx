import React, { useState, useEffect, useMemo, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Html5Qrcode } from 'html5-qrcode';
import { X, QrCode, Scan, Download, Upload, CheckCircle2, AlertCircle, ChevronLeft, ChevronRight, Image as ImageIcon, Camera } from 'lucide-react';
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
  const [syncStatus, setSyncStatus] = useState<{ success?: boolean; message?: string } | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [useFileFallback, setUseFileFallback] = useState(false);
  
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Helper to compress/decompress data for QR
  const compressData = (data: any[]) => {
    return data.map(r => ({
      v: r.vendor,
      d: r.date,
      t: r.total,
      c: r.category,
      u: r.currency,
      s: r.timestamp,
      i: r.id
    }));
  };

  const decompressData = (data: any[]) => {
    return data.map(r => ({
      vendor: r.v,
      date: r.d,
      total: r.t,
      category: r.c,
      currency: r.u,
      timestamp: r.s,
      id: r.i,
      tax: 0,
      items: [],
      confidence: 1
    }));
  };

  // Filter receipts for export
  const exportData = useMemo(() => {
    const filtered = receipts.filter(r => {
      if (selectedMonth === 'Hepsi') return true;
      const rMonth = r.date.includes('.') ? `${r.date.split('.')[2]}-${r.date.split('.')[1]}` : r.date.substring(0, 7);
      return rMonth === selectedMonth;
    });

    return compressData(filtered);
  }, [receipts, selectedMonth]);

  const qrValue = useMemo(() => {
    try {
      return JSON.stringify(exportData);
    } catch (e) {
      return '';
    }
  }, [exportData]);

  const isTooLarge = qrValue.length > 2800; // Limit with compression

  const handleScanSuccess = (decodedText: string) => {
    try {
      let imported = JSON.parse(decodedText);
      
      // Check if it's compressed format
      if (Array.isArray(imported) && imported.length > 0 && imported[0].v !== undefined) {
        imported = decompressData(imported);
      }

      if (Array.isArray(imported)) {
        onImport(imported as ReceiptData[]);
        setSyncStatus({ success: true, message: `${imported.length} kayıt başarıyla aktarıldı.` });
        stopScanner();
        setTimeout(() => setMode('selection'), 2000);
      } else {
        setSyncStatus({ success: false, message: "Geçersiz veri formatı." });
      }
    } catch (e) {
      setSyncStatus({ success: false, message: "Veri okunamadı veya geçersiz veri içeriyor." });
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

  const startScanner = async () => {
    const element = document.getElementById("qr-reader");
    if (!element) return;

    try {
      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode("qr-reader");
      }

      await scannerRef.current.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        handleScanSuccess,
        () => {} // Ignore scan errors
      );
      setIsCameraActive(true);
      setSyncStatus(null);
    } catch (err) {
      console.error("Camera start error", err);
      setIsCameraActive(false);
      setUseFileFallback(true);
      setSyncStatus({ 
        success: false, 
        message: "Kamera başlatılamadı. İzinlerinizi kontrol edin veya resim seçerek tarayın." 
      });
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current && scannerRef.current.isScanning) {
      try {
        await scannerRef.current.stop();
        setIsCameraActive(false);
      } catch (err) {
        console.error("Camera stop error", err);
      }
    }
  };

  const handleFileScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!scannerRef.current) {
      scannerRef.current = new Html5Qrcode("qr-reader");
    }

    setSyncStatus({ message: "Resim taranıyor..." });

    try {
      const decodedText = await scannerRef.current.scanFile(file, true);
      handleScanSuccess(decodedText);
    } catch (err) {
      console.error("File scan error", err);
      setSyncStatus({ success: false, message: "Resimde QR kod bulunamadı." });
    }
  };

  useEffect(() => {
    if (mode === 'import' && !useFileFallback) {
      const timer = setTimeout(() => {
        startScanner();
      }, 500);
      return () => {
        clearTimeout(timer);
        stopScanner();
      };
    } else if (mode !== 'import') {
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
                <div className="w-full flex items-center justify-between gap-4">
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

                <div className="text-center">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-4">
                    {exportData.length} Kayıt Gönderiliyor
                  </p>
                  
                  {isTooLarge ? (
                    <div className="p-8 bg-amber-50 dark:bg-amber-900/20 rounded-2xl border border-amber-100 dark:border-amber-500/20 text-amber-700 dark:text-amber-400 space-y-4">
                      <AlertCircle className="mx-auto" size={32} />
                      <p className="text-xs font-semibold">Veri Miktarı QR Kapasitesini Aşıyor!</p>
                      <p className="text-[10px] leading-relaxed">
                        Seçilen dönemdeki kayıt sayısı tek bir QR kod içine sığdırılamaz kadar büyük. 
                      </p>
                      <button 
                        onClick={handleDownloadFile}
                        className="w-full py-3 bg-amber-600 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest shadow-lg"
                      >
                        Dosya Oluştur ve Paylaş (Offline)
                      </button>
                    </div>
                  ) : (
                    <div className="p-6 bg-white dark:bg-white rounded-3xl shadow-xl">
                      <QRCodeSVG 
                        value={qrValue} 
                        size={256}
                        level="L"
                        includeMargin={true}
                      />
                    </div>
                  )}
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
                    <button 
                      onClick={() => setUseFileFallback(true)}
                      className="text-[10px] font-bold uppercase tracking-widest text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 px-3 py-1.5 rounded-lg"
                    >
                      Resim Yükle
                    </button>
                  )}
                </div>

                <div className="relative rounded-[32px] overflow-hidden bg-slate-900 aspect-square border border-slate-200 dark:border-slate-800">
                  <div id="qr-reader" className={`w-full h-full ${useFileFallback ? 'hidden' : 'block'}`}></div>
                  
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

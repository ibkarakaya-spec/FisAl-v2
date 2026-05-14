import React, { useState, useEffect, useMemo } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { X, QrCode, Scan, Download, Upload, CheckCircle2, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
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

  // Filter receipts for export
  const exportData = useMemo(() => {
    const filtered = receipts.filter(r => {
      if (selectedMonth === 'Hepsi') return true;
      const rMonth = r.date.includes('.') ? `${r.date.split('.')[2]}-${r.date.split('.')[1]}` : r.date.substring(0, 7);
      return rMonth === selectedMonth;
    });

    // Remove heavy image data for QR sync
    return filtered.map(({ imageUrl, ...rest }) => rest);
  }, [receipts, selectedMonth]);

  const qrValue = useMemo(() => {
    try {
      return JSON.stringify(exportData);
    } catch (e) {
      return '';
    }
  }, [exportData]);

  const isTooLarge = qrValue.length > 2500; // Rough limit for readable QR codes

  useEffect(() => {
    let scanner: Html5QrcodeScanner | null = null;
    let isMounted = true;

    if (mode === 'import') {
      // Small delay to ensure the div with id="qr-reader" is in the DOM
      // after the AnimatePresence transition
      const timer = setTimeout(() => {
        if (!isMounted) return;
        
        const element = document.getElementById("qr-reader");
        if (!element) {
          console.warn("QR reader element not found yet, retrying...");
          return;
        }

        try {
          scanner = new Html5QrcodeScanner(
            "qr-reader",
            { fps: 10, qrbox: { width: 250, height: 250 } },
            /* verbose= */ false
          );

          scanner.render((decodedText) => {
            try {
              const imported = JSON.parse(decodedText);
              if (Array.isArray(imported)) {
                onImport(imported as ReceiptData[]);
                setSyncStatus({ success: true, message: `${imported.length} kayıt başarıyla aktarıldı.` });
                if (scanner) scanner.clear().catch(console.error);
                setTimeout(() => setMode('selection'), 2000);
              } else {
                setSyncStatus({ success: false, message: "Geçersiz veri formatı." });
              }
            } catch (e) {
              setSyncStatus({ success: false, message: "QR kod okunamadı veya geçersiz veri içeriyor." });
            }
          }, (error) => {
            // Handle scan failure
          });
        } catch (err) {
          console.error("Scanner initialization error", err);
        }
      }, 100);

      return () => {
        isMounted = false;
        clearTimeout(timer);
        if (scanner) {
          scanner.clear().catch(err => console.error("Scanner clear error", err));
        }
      };
    }
  }, [mode, onImport]);

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
                    onClick={() => setMode('import')}
                    className="flex items-center gap-4 p-5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 rounded-2xl hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-all border border-emerald-100/50 dark:border-emerald-500/20 group"
                  >
                    <div className="w-12 h-12 bg-white dark:bg-emerald-900/40 rounded-xl flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                      <Scan size={24} />
                    </div>
                    <div className="text-left">
                      <span className="block font-bold text-sm uppercase tracking-tight">Veri Al</span>
                      <span className="text-[11px] opacity-70">Eşinizin QR kodunu kamerayla tarayın</span>
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
                    <div className="p-8 bg-rose-50 dark:bg-rose-900/20 rounded-2xl border border-rose-100 dark:border-rose-500/20 text-rose-600 dark:text-rose-400 space-y-3">
                      <AlertCircle className="mx-auto" size={32} />
                      <p className="text-xs font-semibold">Veri Miktarı Çok Fazla!</p>
                      <p className="text-[10px] leading-relaxed">
                        Seçilen aydaki veri miktarı QR kod kapasitesini aşıyor. Lütfen daha az kayıt içeren bir dönem seçin.
                      </p>
                    </div>
                  ) : (
                    <div className="p-6 bg-white dark:bg-white rounded-3xl shadow-xl">
                      <QRCodeSVG 
                        value={qrValue} 
                        size={256}
                        level="M"
                        includeMargin={true}
                      />
                    </div>
                  )}
                </div>

                <p className="text-[10px] text-center text-slate-500 dark:text-slate-400 px-8 italic">
                  Eşiniz "Veri Al" moduna girerek bu kodu tarayabilir. İndirim ve kampanya verileriniz korunur.
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
                <div className="flex items-center gap-4 mb-4">
                  <button onClick={() => setMode('selection')} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors">
                    <ChevronLeft size={20} />
                  </button>
                  <p className="text-sm font-semibold uppercase tracking-tight text-slate-700 dark:text-slate-200">
                    Tarayıcı Aktif
                  </p>
                </div>

                <div className="relative rounded-[32px] overflow-hidden bg-slate-900 aspect-square border border-slate-200 dark:border-slate-800">
                  <div id="qr-reader" className="w-full h-full"></div>
                  
                  {syncStatus && (
                    <div className={`absolute inset-0 z-10 flex flex-col items-center justify-center p-6 text-center backdrop-blur-md ${syncStatus.success ? 'bg-emerald-500/90' : 'bg-rose-500/90'} text-white`}>
                      {syncStatus.success ? <CheckCircle2 size={48} /> : <AlertCircle size={48} />}
                      <p className="mt-4 font-bold uppercase tracking-widest">{syncStatus.success ? 'Başarılı' : 'Hata'}</p>
                      <p className="text-sm mt-1">{syncStatus.message}</p>
                    </div>
                  )}
                </div>

                <p className="text-[10px] text-center text-slate-500 dark:text-slate-400 px-4">
                  Eşinizin cihazındaki QR kodu kadrajın içine yerleştirin.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
};

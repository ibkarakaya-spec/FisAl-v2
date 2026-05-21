import React, { useState, useEffect, useRef } from 'react';
import { X, Clipboard, Image as ImageIcon, Sparkles, Loader2, AlertCircle, Check, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { extractAkbankTextData, extractReceiptData } from '../services/geminiService.ts';
import { autoEnhance } from '../services/imageProcessing.ts';
import { ReceiptData } from '../types.ts';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (data: ReceiptData) => void;
  categories: string[];
}

export const AkbankImportModal: React.FC<Props> = ({ isOpen, onClose, onAdd, categories }) => {
  const [activeTab, setActiveTab] = useState<'text' | 'image'>('text');
  const [copiedText, setCopiedText] = useState('');
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [parsedResult, setParsedResult] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  // Handle clipboard text automatically if they click a button
  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setCopiedText(text);
      }
    } catch (err) {
      setError('Pano okuma izni verilmedi. Lütfen metni kendiniz yapıştırın.');
    }
  };

  // Clipboard Paste Event Handler for the entire Modal
  useEffect(() => {
    const handleGlobalPaste = async (e: ClipboardEvent) => {
      if (!isOpen) return;
      
      const text = e.clipboardData?.getData('text');
      const files = e.clipboardData?.files;

      if (files && files.length > 0) {
        const file = files[0];
        if (file.type.startsWith('image/')) {
          setActiveTab('image');
          handleSelectedFile(file);
        }
      } else if (text && activeTab === 'text') {
        setCopiedText(prev => prev ? `${prev}\n${text}` : text);
      }
    };

    window.addEventListener('paste', handleGlobalPaste);
    return () => window.removeEventListener('paste', handleGlobalPaste);
  }, [isOpen, activeTab]);

  const handleSelectedFile = (file: File) => {
    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreviewImage(e.target?.result as string);
    };
    reader.readAsDataURL(file);
    setParsedResult(null);
    setError(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      handleSelectedFile(file);
    }
  };

  const handleProcessText = async () => {
    if (!copiedText.trim()) {
      setError('Lütfen Akbank transfer detay metnini yapıştırın.');
      return;
    }
    
    setIsProcessing(true);
    setError(null);
    setStatusText('Gemini Yapay Zeka ile Akbank Metni Çözümleniyor...');
    
    try {
      const data = await extractAkbankTextData(copiedText, categories, (msg) => {
        setStatusText(msg);
      });
      
      setParsedResult(data);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Metin analiz edilirken bir hata oluştu. Lütfen geçerli bir işlem metni yapıştırın.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleProcessImage = async () => {
    if (!selectedFile) {
      setError('Lütfen bir Akbank dekont ekran görüntüsü yükleyin.');
      return;
    }

    setIsProcessing(true);
    setError(null);
    setStatusText('Görsel İyileştiriliyor...');

    try {
      const optimizedImg = await autoEnhance(selectedFile);
      setStatusText('Gemini Yapay Zeka ile Ekran Görüntüsü Analiz Ediliyor...');
      const data = await extractReceiptData(optimizedImg, categories, (msg) => {
        setStatusText(msg);
      });

      setParsedResult({
        ...data,
        imageUrl: optimizedImg
      });
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Ekran görüntüsü analiz edilemedi. Lütfen net bir dekont görüntüsü yüklemeyi deneyin.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSaveResult = () => {
    if (!parsedResult) return;

    const newReceipt: ReceiptData = {
      id: Math.random().toString(36).substr(2, 9),
      vendor: (parsedResult.vendor || 'AKBANK MOBİL TRANSFER').toUpperCase(),
      date: parsedResult.date || new Date().toLocaleDateString('tr-TR'),
      total: Number(parsedResult.total) || 0,
      currency: '₺',
      category: parsedResult.category || categories[0] || 'Kişisel Harcama',
      tax: 0,
      items: parsedResult.items || [
        {
          name: parsedResult.vendor ? `${parsedResult.vendor} Transferi` : 'Akbank Transferi',
          price: Number(parsedResult.total) || 0,
          quantity: 1
        }
      ],
      confidence: 1.0,
      timestamp: Date.now(),
      imageUrl: parsedResult.imageUrl
    };

    onAdd(newReceipt);
    handleReset();
    onClose();
  };

  const handleReset = () => {
    setCopiedText('');
    setPreviewImage(null);
    setSelectedFile(null);
    setParsedResult(null);
    setError(null);
    setIsProcessing(false);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
          />
          
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            className="w-full max-w-md bg-white dark:bg-slate-900 rounded-[30px] shadow-2xl overflow-hidden relative z-10 border border-slate-100 dark:border-slate-800 flex flex-col max-h-[90vh]"
          >
            {/* Header with Akbank Accent */}
            <div className="bg-gradient-to-r from-red-600 to-red-700 p-5 text-white relative">
              <div className="flex items-center gap-2 mb-1">
                <Sparkles size={16} className="text-red-200 animate-pulse" />
                <span className="text-[10px] uppercase font-black tracking-widest text-red-100">Akbank Direkt Aktarım</span>
              </div>
              <h3 className="text-lg font-black tracking-tight">Akbank Mobil Akıllı Aktarma</h3>
              <p className="text-[11px] text-red-100 mt-1">Akbank uygulamasından kopyaladığınız metni veya ekran görüntüsünü direkt olarak yapıştırın.</p>
              
              <button 
                onClick={onClose}
                className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-xl transition-all text-white"
              >
                <X size={18} />
              </button>
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-rose-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 p-1 gap-1">
              <button
                onClick={() => { setActiveTab('text'); setParsedResult(null); }}
                className={`flex-1 py-2.5 text-xs font-bold rounded-2xl flex items-center justify-center gap-1.5 transition-all ${activeTab === 'text' ? 'bg-white dark:bg-slate-900 shadow-sm text-red-600 dark:text-red-400' : 'text-slate-400 hover:text-slate-600'}`}
              >
                <Clipboard size={14} />
                Metin Yapıştır
              </button>
              <button
                onClick={() => { setActiveTab('image'); setParsedResult(null); }}
                className={`flex-1 py-2.5 text-xs font-bold rounded-2xl flex items-center justify-center gap-1.5 transition-all ${activeTab === 'image' ? 'bg-white dark:bg-slate-900 shadow-sm text-red-600 dark:text-red-400' : 'text-slate-400 hover:text-slate-600'}`}
              >
                <ImageIcon size={14} />
                Ekran Görüntüsü
              </button>
            </div>

            <div className="p-5 flex-1 overflow-y-auto space-y-4">
              {error && (
                <div className="p-3 bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 text-xs font-medium rounded-xl border border-red-100 dark:border-red-900/30 flex items-start gap-2">
                  <AlertCircle size={16} className="shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {isProcessing ? (
                <div className="py-8 flex flex-col items-center justify-center gap-3">
                  <div className="p-4 bg-red-50 dark:bg-red-950/20 rounded-full text-red-600 dark:text-red-400">
                    <Loader2 size={32} className="animate-spin" />
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-black uppercase tracking-widest text-red-600 dark:text-red-400">İŞLENİYOR</p>
                    <p className="text-[11px] text-slate-500 font-medium mt-1">{statusText}</p>
                  </div>
                </div>
              ) : parsedResult ? (
                /* Parsed Preview Area */
                <div className="space-y-4">
                  <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40 rounded-2xl p-4 text-emerald-800 dark:text-emerald-400">
                    <div className="flex items-center gap-1.5 mb-2 font-bold text-xs uppercase tracking-wider">
                      <Check size={14} />
                      Yapay Zeka Başarıyla Çözdü!
                    </div>
                    
                    <div className="space-y-2 mt-3 p-3 bg-white dark:bg-slate-950 rounded-xl border border-emerald-500/10">
                      <div className="flex justify-between border-b pb-1 border-slate-100 dark:border-slate-800">
                        <span className="text-[10px] text-slate-400 uppercase font-black">Alici / Açiklama</span>
                        <span className="text-xs font-bold text-slate-900 dark:text-white uppercase">{parsedResult.vendor}</span>
                      </div>
                      <div className="flex justify-between border-b pb-1 border-slate-100 dark:border-slate-800">
                        <span className="text-[10px] text-slate-400 uppercase font-black">Miktar</span>
                        <span className="text-sm font-black text-rose-600 dark:text-rose-400">{parsedResult.total.toFixed(2)} ₺</span>
                      </div>
                      <div className="flex justify-between border-b pb-1 border-slate-100 dark:border-slate-800">
                        <span className="text-[10px] text-slate-400 uppercase font-black">İşlem Tarihi</span>
                        <span className="text-xs font-bold text-slate-900 dark:text-white">{parsedResult.date}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[10px] text-slate-400 uppercase font-black font-sans">Belirlenen Kategori</span>
                        <span className="text-xs font-black text-indigo-600 uppercase tracking-widest bg-indigo-50 dark:bg-indigo-950/30 px-2.5 py-0.5 rounded-lg">{parsedResult.category || "Kişisel Harcama"}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => setParsedResult(null)}
                      className="flex-1 py-3 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-2xl text-[10px] uppercase font-bold tracking-widest active:scale-[0.98] transition-all"
                    >
                      Yeniden Dene
                    </button>
                    <button
                      onClick={handleSaveResult}
                      className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-2xl text-[10px] uppercase font-bold tracking-widest shadow-lg shadow-red-600/30 active:scale-[0.98] transition-all flex items-center justify-center gap-1"
                    >
                      Listeye Aktar
                      <ArrowRight size={14} />
                    </button>
                  </div>
                </div>
              ) : (
                /* Primary Upload / Paste Area */
                <div className="space-y-4">
                  {activeTab === 'text' ? (
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Metin Girin</span>
                        <button
                          type="button"
                          onClick={handlePasteClipboard}
                          className="text-[10px] font-black uppercase tracking-wider text-red-600 dark:text-red-400 hover:underline flex items-center gap-1"
                        >
                          Panodan Yapıştır
                        </button>
                      </div>
                      <textarea
                        value={copiedText}
                        onChange={(e) => setCopiedText(e.target.value)}
                        placeholder="Akbank paylaşılan FAST/EFT dekont metnini veya banka harcama mesajını buraya yapıştırın... 

Örn: 'Akbank FAST ile Ahmet Kaya kişisine 500TL gönderildi.' veya direkt dekont paylaşım yazısı."
                        className="w-full h-36 bg-slate-50 dark:bg-slate-800/40 border-none rounded-2xl p-4 text-xs font-medium focus:ring-2 focus:ring-red-500 outline-none transition-all dark:text-white"
                      />
                      
                      <div className="text-[10px] text-slate-400 italic font-medium leading-relaxed bg-slate-50 dark:bg-slate-950/10 p-3 rounded-xl border border-slate-100 dark:border-slate-800/40">
                        <span className="text-red-500 font-bold">Kısayol:</span> Bu modal açıkken ekranın herhangi bir yerinde klavyenizden <kbd className="bg-slate-200 dark:bg-slate-800 px-1 py-0.5 rounded text-[9px] font-bold">Ctrl+V</kbd> (Yapıştır) yaptığınızda, kopyalanan Akbank metni veya dekont görseli otomatik olarak algılanır.
                      </div>

                      <button
                        onClick={handleProcessText}
                        className="w-full bg-red-600 hover:bg-red-700 text-white py-3.5 rounded-2xl text-[10px] uppercase font-bold tracking-widest shadow-lg shadow-red-600/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                      >
                        <Sparkles size={16} />
                        Akıllı Metin Analizi Yap
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div 
                        ref={dropZoneRef}
                        onDragOver={handleDragOver}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                        className="border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl p-6 text-center cursor-pointer hover:border-red-500/50 dark:hover:border-red-500/30 transition-all flex flex-col items-center justify-center gap-2 bg-slate-50 dark:bg-slate-800/10 hover:bg-slate-100/50"
                      >
                        <input 
                          type="file" 
                          ref={fileInputRef} 
                          onChange={(e) => e.target.files?.[0] && handleSelectedFile(e.target.files[0])}
                          accept="image/*" 
                          className="hidden" 
                        />
                        
                        {previewImage ? (
                          <div className="relative w-full aspect-video rounded-2xl overflow-hidden border">
                            <img src={previewImage} alt="Akbank Screenshot" className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-slate-950/40 flex items-center justify-center text-white text-xs font-black uppercase tracking-wider opacity-0 hover:opacity-100 transition-opacity">
                              Görseli Değiştir
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="p-3 bg-red-50 dark:bg-red-950/10 rounded-full text-red-600 dark:text-red-400">
                              <ImageIcon size={28} />
                            </div>
                            <div>
                              <p className="text-xs font-bold text-slate-800 dark:text-white">Ekran Görüntüsü Yükleyin</p>
                              <p className="text-[10px] text-slate-400 font-medium mt-1">Sürükleyip bırakın, tıklayarak seçin veya Ctrl+V ile yapıştırın</p>
                            </div>
                          </>
                        )}
                      </div>

                      <div className="text-[10px] text-slate-400 italic font-medium leading-relaxed bg-slate-50 dark:bg-slate-950/10 p-3 rounded-xl border border-slate-100 dark:border-slate-800/40">
                        <span className="text-red-500 font-bold font-sans">Hızlı Ipucu:</span> Akbank dekont paylaşım penceresinden alınan ekran görüntüsü, alıcı ve tutar bilgilerini anında çözümler.
                      </div>

                      <button
                        onClick={handleProcessImage}
                        disabled={!selectedFile}
                        className={`w-full py-3.5 rounded-2xl text-[10px] uppercase font-bold tracking-widest shadow-lg active:scale-[0.98] transition-all flex items-center justify-center gap-2 ${selectedFile ? 'bg-red-600 hover:bg-red-700 text-white shadow-red-600/20' : 'bg-slate-100 text-slate-400 dark:bg-slate-800 cursor-not-allowed shadow-none'}`}
                      >
                        <Sparkles size={16} />
                        Görseli Yapay Zeka ile Tara
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

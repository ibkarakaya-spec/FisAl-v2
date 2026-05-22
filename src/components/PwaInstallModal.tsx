import React, { useState } from 'react';
import { X, Smartphone, Sparkles, Plus, ArrowRight, Check, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface PwaInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
  deferredPrompt: any;
  onTriggerInstall: () => void;
}

export const PwaInstallModal: React.FC<PwaInstallModalProps> = ({
  isOpen,
  onClose,
  deferredPrompt,
  onTriggerInstall,
}) => {
  const [activeTab, setActiveTab] = useState<'android' | 'ios'>('android');
  const [copiedLink, setCopiedLink] = useState(false);

  if (!isOpen) return null;

  const currentUrl = window.location.href;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(currentUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-[28px] shadow-2xl w-full max-w-md overflow-hidden relative z-10 text-slate-800 dark:text-slate-100 font-sans"
        >
          {/* Header */}
          <div className="p-6 border-b border-slate-100 dark:border-slate-800/80 flex justify-between items-center relative bg-gradient-to-r from-indigo-50/20 to-indigo-50/5 dark:from-indigo-950/10 dark:to-transparent">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-xl flex items-center justify-center">
                <Smartphone size={20} />
              </div>
              <div>
                <h3 className="text-[15px] font-bold text-slate-950 dark:text-white uppercase tracking-tight">FişAI Uygulamasını Yükle</h3>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium tracking-wide">PWA Teknolojisiyle Çevrimdışı ve Hızlı Kullanım</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Body Content */}
          <div className="p-6 space-y-5">
            {/* Info Notice about Iframes / Preview */}
            {window.self !== window.top && (
              <div className="flex gap-2.5 p-3.5 bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/10 dark:border-amber-500/20 rounded-2xl text-[11px] text-amber-700 dark:text-amber-400 font-medium">
                <Info size={16} className="shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  Şu an bir önizleme (iframe) içerisindesiniz. Uygulamayı telefonunuza yükleyebilmek için sağ üstteki butondan <span className="font-bold">Yeni Sekmede Aç</span> yaparak devam etmelisiniz.
                </p>
              </div>
            )}

            {/* Direct Instant Install Option */}
            {deferredPrompt && (
              <div className="p-4 bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-950/20 dark:to-indigo-900/10 border border-indigo-100 dark:border-indigo-950/30 rounded-2xl space-y-3">
                <div className="flex gap-2">
                  <Sparkles size={16} className="text-indigo-600 dark:text-indigo-400 mt-0.5 shrink-0 animate-pulse" />
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">Hızlı Kurulum Hazır!</h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium leading-relaxed">Android cihazınız bu uygulama kurulumu türünü doğrudan destekliyor.</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    onTriggerInstall();
                    onClose();
                  }}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[11px] uppercase tracking-wider py-3 px-4 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 transition-all active:scale-95"
                >
                  <Plus size={14} />
                  Şimdi Yükle
                </button>
              </div>
            )}

            {/* OS Selection Tabs */}
            <div className="flex bg-slate-100 dark:bg-slate-800/60 p-1 rounded-xl">
              <button
                onClick={() => setActiveTab('android')}
                className={`flex-1 py-2 text-[11px] font-bold uppercase tracking-wider rounded-lg transition-all ${
                  activeTab === 'android'
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-white shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800'
                }`}
              >
                Android (Chrome)
              </button>
              <button
                onClick={() => setActiveTab('ios')}
                className={`flex-1 py-2 text-[11px] font-bold uppercase tracking-wider rounded-lg transition-all ${
                  activeTab === 'ios'
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-white shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800'
                }`}
              >
                iOS (Safari)
              </button>
            </div>

            {/* Tab Panels */}
            <div className="space-y-4 pt-1 max-h-[220px] overflow-y-auto pr-1">
              {activeTab === 'android' ? (
                <div className="space-y-3.5 text-xs text-slate-600 dark:text-slate-300">
                  <div className="flex items-start gap-3">
                    <span className="w-5 h-5 bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">1</span>
                    <p className="leading-relaxed">
                      Tarayıcınızın (tercihen <span className="font-semibold text-slate-900 dark:text-white">Google Chrome</span> veya <span className="font-semibold text-slate-900 dark:text-white">Samsung Internet</span>) sağ üst köşesindeki <span className="font-bold text-indigo-600 dark:text-indigo-400">Üç Nokta (⋮)</span> butonuna dokunun.
                    </p>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="w-5 h-5 bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">2</span>
                    <p className="leading-relaxed">
                      Açılan menüden <span className="font-semibold text-slate-900 dark:text-white">"Ana Ekrana Ekle"</span> veya <span className="font-semibold text-slate-900 dark:text-white">"Uygulamayı yükle / Kur"</span> seçeneğine tıklayın.
                    </p>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="w-5 h-5 bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">3</span>
                    <p className="leading-relaxed">
                      Uygulama telefonunuza yüklenecektir. Artık diğer uygulamalardan dekont PDF'i veya resim paylaşırken <span className="font-bold text-slate-900 dark:text-white">FişAI</span> seçeneğini görebilirsiniz!
                    </p>
                  </div>
                  <div className="p-3 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100/50 dark:border-indigo-950/30 rounded-xl text-[11px] text-indigo-700/80 dark:text-indigo-400 font-medium">
                    💡 <span className="font-bold">Önemli:</span> Eğer paylaşım listesinde FişAI görünmüyorsa; uygulamayı telefonunuzdan tamamen kaldırıp Chrome ile tekrar yükleyin. Bu, Android paylaşım kaydını sıfırlar.
                  </div>
                </div>
              ) : (
                <div className="space-y-3.5 text-xs text-slate-600 dark:text-slate-300 font-sans">
                  <div className="flex items-start gap-3">
                    <span className="w-5 h-5 bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">1</span>
                    <p className="leading-relaxed">
                      Uygulamayı mutlaka <span className="font-semibold text-slate-900 dark:text-white">Safari</span> tarayıcısı ile açın. (Diğer tarayıcılar iOS üzerinde PWA kurma yetkisine sahip değildir).
                    </p>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="w-5 h-5 bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">2</span>
                    <p className="leading-relaxed">
                      Safari'nin altındaki (veya üstündeki) <span className="font-bold text-indigo-600 dark:text-indigo-400">Paylaş (Yukarı Ok kutucuğu)</span> simgesine dokunun.
                    </p>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="w-5 h-5 bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">3</span>
                    <p className="leading-relaxed">
                      Menüyü aşağı kaydırıp <span className="font-semibold text-slate-900 dark:text-white">"Ana Ekrana Ekle"</span> seçeneğine tıklayın ve onaylayın.
                    </p>
                  </div>
                  <div className="p-3 bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/10 dark:border-amber-500/20 rounded-xl text-[11px] text-amber-700 dark:text-amber-400 font-medium">
                    ⚠️ <span className="font-bold">iOS Notu:</span> Apple kısıtlamaları gereği iOS, doğrudan PDF/Görüntü paylaşımını diğer uygulamalardan PWA'ya aktarmayı (Web Share Target) tam olarak desteklemez. Ancak uygulamayı ana ekrana ekleyince hızlıca dosyaları sürükleyip bırakabilir veya ana sayfa üzerindeki yükleme alanını kullanabilirsiniz.
                  </div>
                </div>
              )}
            </div>

            {/* Application URL Copying Actions for convenience */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row gap-2 justify-between items-center text-[11px] text-slate-500">
              <span className="text-center sm:text-left">Bu bağlantıyı kopyalayıp telefonunda açabilirsin:</span>
              <button
                onClick={handleCopyLink}
                className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200/50 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-200 transition-colors flex items-center gap-1 shrink-0 font-medium font-sans"
              >
                {copiedLink ? (
                  <>
                    <Check size={11} className="text-emerald-500" />
                    Bağlantı Kopyalandı
                  </>
                ) : (
                  <>
                    <ArrowRight size={11} />
                    Bağlantıyı Kopyala
                  </>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

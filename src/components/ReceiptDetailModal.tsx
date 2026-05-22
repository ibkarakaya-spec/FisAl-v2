import React, { useState, useEffect } from 'react';
import { ReceiptData, ReceiptItem } from '../types.ts';
import { X, Store, Trash2, ZoomIn, ZoomOut, Maximize2, RotateCw, RefreshCw, ChevronRight, ShoppingBag } from 'lucide-react';
import { processImage } from '../services/imageProcessing.ts';
import { motion, AnimatePresence } from 'motion/react';

interface PriceInputProps {
  value: number;
  onChange: (val: number) => void;
  className?: string;
}

const PriceInput: React.FC<PriceInputProps> = ({ value, onChange, className }) => {
  const [tempValue, setTempValue] = useState(() => {
    return value === 0 ? '' : value.toString().replace('.', ',');
  });

  useEffect(() => {
    const normalizedTemp = parseFloat(tempValue.replace(',', '.')) || 0;
    if (normalizedTemp !== value) {
      setTempValue(value === 0 ? '' : value.toString().replace('.', ','));
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/[^0-9.,]/g, '');
    const parts = val.split(/[.,]/);
    if (parts.length > 2) {
      val = parts[0] + ',' + parts.slice(1).join('');
    }
    setTempValue(val);
    const parsedNum = parseFloat(val.replace(',', '.')) || 0;
    onChange(parsedNum);
  };

  const handleBlur = () => {
    const parsedNum = parseFloat(tempValue.replace(',', '.')) || 0;
    setTempValue(parsedNum === 0 ? '' : parsedNum.toString().replace('.', ','));
  };

  return (
    <input
      type="text"
      inputMode="decimal"
      className={className}
      value={tempValue}
      onChange={handleChange}
      onBlur={handleBlur}
      placeholder="0,00"
    />
  );
};

interface Props {
  receipt: ReceiptData | null;
  categories: string[];
  onClose: () => void;
  onUpdate: (updated: ReceiptData) => void;
}

export const ReceiptDetailModal: React.FC<Props> = ({ receipt, categories, onClose, onUpdate }) => {
  const [editData, setEditData] = useState<ReceiptData | null>(null);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [isRotating, setIsRotating] = useState(false);

  useEffect(() => {
    if (receipt) setEditData({ ...receipt });
  }, [receipt]);

  if (!receipt || !editData) return null;

  const handleRotate = async () => {
    if (!editData.imageUrl || isRotating) return;
    setIsRotating(true);
    try {
      const rotated = await processImage(editData.imageUrl, { contrast: 1.0, brightness: 1.0, grayscale: false, rotation: 90 });
      setEditData({ ...editData, imageUrl: rotated });
    } catch (e) {
      console.error(e);
    } finally {
      setIsRotating(false);
    }
  };

  const handleSave = () => {
    const rawTotal = editData.items.reduce((sum, item) => sum + (Number(item.price) || 0), 0);
    const newTotal = Math.round(rawTotal * 100) / 100;
    onUpdate({ ...editData, total: newTotal });
    onClose();
  };

  const handleItemChange = (index: number, field: keyof ReceiptItem, value: any) => {
    const newItems = [...editData.items];
    newItems[index] = { ...newItems[index], [field]: value };
    setEditData({ ...editData, items: newItems });
  };

  return (
    <>
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md"
      >
        <motion.div 
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.9, y: 20 }}
          className="bg-white dark:bg-slate-900 w-full max-w-5xl max-h-[90vh] rounded-[32px] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.3)] overflow-hidden flex flex-col md:flex-row border border-white/10 dark:border-slate-800"
        >
          <div className="w-full md:w-5/12 bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-2 border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-800 h-64 md:h-auto relative group">
            {editData.imageUrl ? (
              <>
                <motion.img 
                  layoutId={receipt.id}
                  src={editData.imageUrl} 
                  className="max-w-full max-h-full rounded-2xl shadow-xl object-contain cursor-zoom-in group-hover:scale-[1.02] transition-transform duration-500" 
                  alt="fiş" 
                  onClick={() => setIsFullScreen(true)} 
                />
                <div className="absolute bottom-4 left-4 flex gap-2">
                  <motion.button 
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleRotate} 
                    disabled={isRotating} 
                    className="p-2.5 bg-white/90 dark:bg-slate-800/90 text-slate-700 dark:text-slate-100 rounded-xl shadow-xl flex items-center gap-1.5 text-[9px] font-medium uppercase tracking-widest backdrop-blur-md"
                  >
                    {isRotating ? <RefreshCw size={12} className="animate-spin" /> : <RotateCw size={12} />} 90°
                  </motion.button>
                </div>
                <motion.button 
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setIsFullScreen(true)} 
                  className="absolute bottom-4 right-4 p-2.5 bg-indigo-600 text-white rounded-xl shadow-xl flex items-center gap-1.5 text-[9px] font-medium uppercase tracking-widest"
                >
                  <Maximize2 size={12} /> Büyüt
                </motion.button>
              </>
            ) : (
              <div className="text-slate-300 dark:text-slate-800 flex flex-col items-center opacity-40">
                <Store size={48} />
                <span className="text-[9px] font-medium mt-3 uppercase tracking-[0.2em]">Görsel Bulunmuyor</span>
              </div>
            )}
          </div>

          <div className="flex-1 flex flex-col h-full overflow-hidden bg-white dark:bg-slate-900">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between sticky top-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl z-10">
              <div className="flex items-center gap-2.5">
                 <div className="w-9 h-9 bg-indigo-50 dark:bg-indigo-950/30 rounded-xl flex items-center justify-center text-indigo-600">
                    <ShoppingBag size={18} />
                 </div>
                 <div>
                    <h3 className="text-xs font-medium text-slate-900 dark:text-white uppercase tracking-tight font-display">Kayıt <span className="text-indigo-600">Detayları</span></h3>
                    <p className="text-[9px] font-medium text-slate-400 uppercase tracking-widest">ID: {receipt.id.slice(0, 8)}</p>
                 </div>
              </div>
              <div className="flex items-center gap-2.5">
                <motion.button 
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleSave} 
                  className="px-5 py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl text-[9px] font-medium uppercase tracking-widest shadow-lg active:shadow-inner"
                >
                  Güncelle
                </motion.button>
                <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-400 transition-colors"><X size={18} /></button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
              <section className="space-y-1">
                <div className="flex items-center gap-2 mb-0.5">
                   <div className="w-1 h-3 bg-indigo-600 rounded-full"></div>
                   <h4 className="text-[10px] font-medium text-slate-400 uppercase tracking-[0.2em]">Genel Bilgiler</h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <div className="space-y-0.5">
                    <label className="text-[9px] font-medium text-slate-500 uppercase tracking-widest ml-1">İşletme Adı</label>
                    <input className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-xl font-medium text-xs text-slate-900 dark:text-white outline-none focus:ring-4 ring-indigo-500/5 transition-all shadow-inner uppercase" value={editData.vendor} onChange={e => setEditData({...editData, vendor: e.target.value})} />
                  </div>
                  <div className="space-y-0.5">
                    <label className="text-[9px] font-medium text-slate-500 uppercase tracking-widest ml-1">İşlem Tarihi</label>
                    <input className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-xl font-medium text-xs text-slate-900 dark:text-white outline-none focus:ring-4 ring-indigo-500/5 transition-all tabular-nums shadow-inner" value={editData.date} onChange={e => setEditData({...editData, date: e.target.value})} />
                  </div>
                  <div className="col-span-1 md:col-span-2 space-y-0.5">
                    <label className="text-[9px] font-medium text-slate-500 uppercase tracking-widest ml-1">Kategori</label>
                    <select className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-xl font-medium text-xs text-slate-900 dark:text-white outline-none focus:ring-4 ring-indigo-500/5 transition-all cursor-pointer appearance-none shadow-inner" value={editData.category} onChange={e => setEditData({...editData, category: e.target.value})}>
                      {categories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
              </section>

              <section className="space-y-2">
                <div className="flex items-center justify-between mb-0.5">
                   <div className="flex items-center gap-2">
                      <div className="w-1 h-3 bg-indigo-600 rounded-full"></div>
                      <h4 className="text-[10px] font-medium text-slate-400 uppercase tracking-[0.2em]">Ürün Listesi</h4>
                   </div>
                  <motion.button 
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setEditData({...editData, items: [...editData.items, {name: '', price: 0, quantity: 1}]})} 
                    className="text-[10px] font-medium text-indigo-600 bg-indigo-50 dark:bg-indigo-950/30 px-4 py-2 rounded-xl"
                  >
                    + YENİ ÜRÜN
                  </motion.button>
                </div>
                <div className="space-y-2">
                  <AnimatePresence mode="popLayout">
                    {editData.items.map((item, idx) => (
                      <motion.div 
                        layout
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 10 }}
                        key={idx} 
                        className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-[24px] border border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row gap-2 sm:gap-3.5 items-stretch sm:items-center group/item hover:border-indigo-200 transition-colors"
                      >
                        <div className="flex-1 space-y-1 min-w-0">
                           <label className="text-[8px] font-medium text-slate-500 uppercase tracking-widest ml-1">Ürün Adı</label>
                           <input 
                             className="w-full bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-800 px-3 py-2 rounded-xl text-[11px] font-medium text-slate-900 dark:text-white outline-none focus:ring-2 ring-indigo-500/10 uppercase placeholder:text-slate-400" 
                             placeholder="Ürün Adı Yazınız..."
                             value={item.name} 
                             onChange={e => handleItemChange(idx, 'name', e.target.value)} 
                           />
                        </div>

                        <div className="flex items-center gap-2">
                          <div className="w-20 sm:w-20 space-y-1 shrink-0">
                             <label className="text-[8px] font-medium text-slate-500 uppercase tracking-widest ml-1">Miktar</label>
                             <input 
                               type="number" 
                               step="any"
                               className="w-full bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-800 px-3 py-2 rounded-xl text-[11px] font-medium text-center text-slate-900 dark:text-white outline-none focus:ring-2 ring-indigo-500/10 tabular-nums" 
                               value={item.quantity} 
                               onChange={e => handleItemChange(idx, 'quantity', Number(e.target.value))} 
                             />
                          </div>
                          <div className="flex-1 sm:w-28 space-y-1">
                             <label className="text-[8px] font-medium text-slate-500 uppercase tracking-widest ml-1">Fiyat</label>
                             <div className="relative">
                                <PriceInput 
                                  className="w-full bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-800 px-3 py-2 pl-7 rounded-xl text-[11px] font-medium text-right text-slate-900 dark:text-white outline-none focus:ring-2 ring-indigo-500/10 tabular-nums" 
                                  value={item.price} 
                                  onChange={val => handleItemChange(idx, 'price', val)} 
                                />
                                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-indigo-500 font-medium text-[10px]">₺</div>
                             </div>
                          </div>
                          <motion.button 
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => setEditData({...editData, items: editData.items.filter((_, i) => i !== idx)})} 
                            className="p-2 text-slate-300 hover:text-rose-500 mt-4 sm:mt-0 shrink-0"
                          >
                            <Trash2 size={16} />
                          </motion.button>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </section>

              <div className="pt-4 sticky bottom-0 bg-white dark:bg-slate-900 z-20 pb-4">
                <div className="bg-indigo-600 rounded-[28px] p-6 text-white flex justify-between items-center shadow-2xl shadow-indigo-200 dark:shadow-none border border-white/10">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-medium uppercase tracking-[0.2em] opacity-70 mb-1">Hesaplanan Toplam</span>
                    <div className="text-3xl font-medium tabular-nums font-display">
                      {(Math.round(editData.items.reduce((s, i) => s + (Number(i.price) || 0), 0) * 100) / 100).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}<span className="text-lg ml-1 opacity-50">₺</span>
                    </div>
                  </div>
                  <div className="h-12 w-px bg-white/10 hidden sm:block"></div>
                  <div className="hidden sm:flex flex-col items-end">
                     <span className="text-[10px] font-medium uppercase tracking-[0.2em] opacity-70 mb-1">Durum</span>
                     <div className="px-3 py-1 bg-white/20 rounded-full text-[10px] font-medium uppercase tracking-widest">Doğrulandı</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>

      <AnimatePresence>
        {isFullScreen && editData.imageUrl && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-slate-950 flex flex-col items-center justify-center p-4 backdrop-blur-3xl"
          >
            <div className="absolute top-6 right-6 flex gap-3 z-[110]">
              <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => setZoomLevel(z => Math.min(z + 0.5, 4))} className="p-4 bg-white/10 text-white rounded-[20px] backdrop-blur-md border border-white/5"><ZoomIn size={24} /></motion.button>
              <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => setZoomLevel(z => Math.max(z - 0.5, 1))} className="p-4 bg-white/10 text-white rounded-[20px] backdrop-blur-md border border-white/5"><ZoomOut size={24} /></motion.button>
              <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => setIsFullScreen(false)} className="p-4 bg-rose-500 dark:bg-rose-600 text-white rounded-[20px] shadow-xl shadow-rose-500/20"><X size={24} /></motion.button>
            </div>
            <div className="w-full h-full overflow-auto flex items-center justify-center no-scrollbar p-12">
              <img 
                src={editData.imageUrl} 
                className="max-w-none transition-transform duration-300 shadow-2xl rounded-2xl" 
                style={{ transform: `scale(${zoomLevel})` }} 
                alt="fiş zoom" 
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

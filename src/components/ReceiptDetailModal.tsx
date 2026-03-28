import React, { useState, useEffect } from 'react';
import { ReceiptData, ReceiptItem } from '../types.ts';
import { X, Store, Trash2, ZoomIn, ZoomOut, Maximize2, RotateCw, RefreshCw } from 'lucide-react';
import { processImage } from '../services/imageProcessing.ts';

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
    const newTotal = editData.items.reduce((sum, item) => sum + (Number(item.price) || 0), 0);
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
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
        <div className="bg-white dark:bg-slate-900 w-full max-w-4xl max-h-[95vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row border border-white/10 dark:border-slate-800">
          <div className="w-full md:w-2/5 bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-2 border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-800 h-64 md:h-auto relative">
            {editData.imageUrl ? (
              <>
                <img src={editData.imageUrl} className="max-w-full max-h-full rounded-xl shadow-lg object-contain cursor-zoom-in" alt="fiş" onClick={() => setIsFullScreen(true)} />
                <div className="absolute bottom-4 left-4 flex gap-2">
                  <button onClick={handleRotate} disabled={isRotating} className="p-2.5 bg-white/90 dark:bg-slate-800/90 text-slate-700 dark:text-slate-100 rounded-xl shadow-md flex items-center gap-1.5 text-[10px] font-bold">
                    {isRotating ? <RefreshCw size={14} className="animate-spin" /> : <RotateCw size={14} />} DÖNDÜR
                  </button>
                </div>
                <button onClick={() => setIsFullScreen(true)} className="absolute bottom-4 right-4 p-2.5 bg-indigo-600 text-white rounded-xl shadow-md flex items-center gap-1.5 text-[10px] font-bold">
                  <Maximize2 size={14} /> TAM EKRAN
                </button>
              </>
            ) : (
              <div className="text-slate-300 dark:text-slate-800 flex flex-col items-center opacity-40">
                <Store size={40} />
                <span className="text-[9px] font-bold mt-2">Görsel Yok</span>
              </div>
            )}
          </div>

          <div className="flex-1 flex flex-col h-full overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between sticky top-0 bg-white dark:bg-slate-900 z-10">
              <h3 className="text-sm font-bold dark:text-white uppercase italic">Fiş <span className="text-indigo-600">Düzenle</span></h3>
              <div className="flex items-center gap-2">
                <button onClick={handleSave} className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-[10px] font-bold uppercase shadow-md active:scale-95">KAYDET</button>
                <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400"><X size={18} /></button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-[8px] font-bold text-slate-400 uppercase tracking-widest ml-1">Market</label>
                  <input className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border dark:border-slate-700 rounded-xl font-semibold text-[11px] outline-none dark:text-white" value={editData.vendor} onChange={e => setEditData({...editData, vendor: e.target.value})} />
                </div>
                <div>
                  <label className="text-[8px] font-bold text-slate-400 uppercase tracking-widest ml-1">Tarih</label>
                  <input className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border dark:border-slate-700 rounded-xl font-semibold text-[11px] outline-none dark:text-white" value={editData.date} onChange={e => setEditData({...editData, date: e.target.value})} />
                </div>
                <div>
                  <label className="text-[8px] font-bold text-slate-400 uppercase tracking-widest ml-1">Kategori</label>
                  <select className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border dark:border-slate-700 rounded-xl font-semibold text-[11px] outline-none dark:text-white" value={editData.category} onChange={e => setEditData({...editData, category: e.target.value})}>
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <label className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Ürünler</label>
                  <button onClick={() => setEditData({...editData, items: [...editData.items, {name: '', price: 0, quantity: 1}]})} className="text-[8px] font-bold text-indigo-600">+ EKLE</button>
                </div>
                {editData.items.map((item, idx) => (
                  <div key={idx} className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border dark:border-slate-800 flex gap-2 items-center">
                    <input className="flex-1 bg-white dark:bg-slate-800 border dark:border-slate-700 px-2 py-1.5 rounded-lg text-[10px] font-medium dark:text-white" value={item.name} onChange={e => handleItemChange(idx, 'name', e.target.value)} />
                    <input type="number" className="w-12 bg-white dark:bg-slate-800 border dark:border-slate-700 px-1 py-1.5 rounded-lg text-[10px] font-bold text-center dark:text-white" value={item.quantity} onChange={e => handleItemChange(idx, 'quantity', e.target.value)} />
                    <input type="number" className="w-20 bg-white dark:bg-slate-800 border dark:border-slate-700 px-2 py-1.5 rounded-lg text-[10px] font-bold text-right dark:text-white" value={item.price} onChange={e => handleItemChange(idx, 'price', e.target.value)} />
                    <button onClick={() => setEditData({...editData, items: editData.items.filter((_, i) => i !== idx)})} className="text-red-400"><Trash2 size={12} /></button>
                  </div>
                ))}
              </div>

              <div className="pt-4 sticky bottom-0 bg-white dark:bg-slate-900">
                <div className="bg-indigo-600 rounded-2xl p-4 text-white flex justify-between items-center shadow-lg">
                  <span className="text-[8px] font-bold uppercase tracking-widest opacity-70">Hesaplanan Toplam</span>
                  <span className="text-xl font-black tabular-nums">{editData.items.reduce((s, i) => s + (Number(i.price) || 0), 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {isFullScreen && editData.imageUrl && (
        <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center p-4">
          <div className="absolute top-4 right-4 flex gap-2">
            <button onClick={() => setZoomLevel(z => Math.min(z + 0.5, 4))} className="p-3 bg-white/10 text-white rounded-xl"><ZoomIn size={24} /></button>
            <button onClick={() => setZoomLevel(z => Math.max(z - 0.5, 1))} className="p-3 bg-white/10 text-white rounded-xl"><ZoomOut size={24} /></button>
            <button onClick={() => setIsFullScreen(false)} className="p-3 bg-red-500/20 text-red-500 rounded-xl"><X size={24} /></button>
          </div>
          <div className="w-full h-full overflow-auto flex items-center justify-center no-scrollbar">
            <img src={editData.imageUrl} className="max-w-none transition-transform duration-300" style={{ transform: `scale(${zoomLevel})` }} alt="fiş zoom" />
          </div>
        </div>
      )}
    </>
  );
};

import React, { useState } from 'react';
import { X, Save, ShoppingBag, Store, Tag, CreditCard } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ReceiptData } from '../types.ts';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (data: ReceiptData) => void;
  categories: string[];
}

export const ManualEntryModal: React.FC<Props> = ({ isOpen, onClose, onAdd, categories }) => {
  const [formData, setFormData] = useState({
    vendor: '',
    product: '',
    category: categories[0] || '',
    total: '',
    date: new Date().toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  });
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.vendor || !formData.total || !formData.category || !formData.product) {
      setError('Lütfen tüm zorunlu alanları doldurun.');
      return;
    }

    const price = parseFloat(formData.total.replace(',', '.'));
    if (isNaN(price)) {
      setError('Geçerli bir fiyat giriniz.');
      return;
    }

    const newReceipt: ReceiptData = {
      id: crypto.randomUUID(),
      vendor: formData.vendor.toUpperCase(),
      date: formData.date,
      total: price,
      currency: 'TL',
      category: formData.category,
      tax: 0,
      items: [
        {
          name: formData.product,
          price: price,
          quantity: 1
        }
      ],
      confidence: 1.0,
      timestamp: Date.now()
    };

    onAdd(newReceipt);
    setFormData({
      vendor: '',
      product: '',
      category: categories[0] || '',
      total: '',
      date: new Date().toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' })
    });
    onClose();
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
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-[24px] shadow-2xl overflow-hidden relative z-10 border border-slate-100 dark:border-slate-800"
          >
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-[11px] font-bold uppercase tracking-widest text-slate-800 dark:text-white">Manuel Fiş Ekle</h3>
              <button 
                onClick={onClose}
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
              >
                <X size={18} className="text-slate-500" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 space-y-3">
              {error && (
                <div className="p-2.5 bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 text-[10px] font-medium rounded-xl border border-rose-100 dark:border-rose-500/20">
                  {error}
                </div>
              )}

              <div className="space-y-1">
                <label className="text-[9px] font-extrabold uppercase tracking-widest text-slate-400 pl-1">Ürün / Açıklama</label>
                <div className="relative">
                  <ShoppingBag size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input 
                    type="text"
                    value={formData.product}
                    onChange={e => setFormData({ ...formData, product: e.target.value })}
                    placeholder="Elma, Süt, Kira vb."
                    className="w-full bg-slate-50 dark:bg-slate-800/50 border-none rounded-xl py-2.5 pl-10 pr-4 text-xs focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:text-white"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-extrabold uppercase tracking-widest text-slate-400 pl-1">Market / Mağaza</label>
                <div className="relative">
                  <Store size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input 
                    type="text"
                    value={formData.vendor}
                    onChange={e => setFormData({ ...formData, vendor: e.target.value })}
                    placeholder="Bim, Migros, Trendyol vb."
                    className="w-full bg-slate-50 dark:bg-slate-800/50 border-none rounded-xl py-2.5 pl-10 pr-4 text-xs focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] font-extrabold uppercase tracking-widest text-slate-400 pl-1">Kategori</label>
                  <div className="relative">
                    <Tag size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <select 
                      value={formData.category}
                      onChange={e => setFormData({ ...formData, category: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-slate-800/50 border-none rounded-xl py-2.5 pl-10 pr-4 text-xs focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:text-white appearance-none"
                    >
                      {categories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-extrabold uppercase tracking-widest text-slate-400 pl-1">Fiyat (TL)</label>
                  <div className="relative">
                    <CreditCard size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input 
                      type="text"
                      inputMode="decimal"
                      value={formData.total}
                      onChange={e => setFormData({ ...formData, total: e.target.value })}
                      placeholder="0.00"
                      className="w-full bg-slate-50 dark:bg-slate-800/50 border-none rounded-xl py-2.5 pl-10 pr-4 text-xs font-bold text-indigo-600 dark:text-indigo-400 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <button 
                  type="submit"
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3.5 rounded-xl flex items-center justify-center gap-2 font-bold uppercase tracking-widest text-[10px] shadow-lg shadow-indigo-600/20 active:scale-[0.98] transition-all"
                >
                  <Save size={16} />
                  Kaydet
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

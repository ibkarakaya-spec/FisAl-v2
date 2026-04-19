import React, { useState, useMemo } from 'react';
import { ReceiptData } from '../types.ts';
import { Search, TrendingDown, History, Store, Calendar, Image as ImageIcon, X } from 'lucide-react';

interface Props {
  receipts: ReceiptData[];
}

export const ProductHistory: React.FC<Props> = ({ receipts }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const productData = useMemo(() => {
    const history: Record<string, {
      name: string;
      purchases: Array<{
        date: string;
        vendor: string;
        price: number;
        quantity: number;
        unitPrice: number;
        imageUrl?: string;
      }>;
      minPrice: number;
      maxPrice: number;
      lastPrice: number;
    }> = {};

    const parseDateForSort = (dateStr: string) => {
      if (!dateStr) return '0000-00-00';
      if (dateStr.includes('.')) {
        const [d, m, y] = dateStr.split('.');
        return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
      }
      return dateStr;
    };

    receipts.forEach(r => {
      r.items.forEach(item => {
        const name = item.name.toLowerCase().trim();
        const unitPrice = item.unitPrice || (item.quantity > 0 ? item.price / item.quantity : item.price);
        
        if (!history[name]) {
          history[name] = {
            name: item.name,
            purchases: [],
            minPrice: unitPrice,
            maxPrice: unitPrice,
            lastPrice: unitPrice
          };
        }

        history[name].purchases.push({
          date: r.date,
          vendor: r.vendor,
          price: item.price,
          quantity: item.quantity,
          unitPrice: unitPrice,
          imageUrl: r.imageUrl
        });

        history[name].minPrice = Math.min(history[name].minPrice, unitPrice);
        history[name].maxPrice = Math.max(history[name].maxPrice, unitPrice);
        
        const sortedPurchases = [...history[name].purchases].sort((a, b) => parseDateForSort(b.date).localeCompare(parseDateForSort(a.date)));
        history[name].lastPrice = sortedPurchases[0].unitPrice;
      });
    });

    return Object.values(history).filter(p => 
      p.name.toLowerCase().includes(searchTerm.toLowerCase())
    ).sort((a, b) => b.purchases.length - a.purchases.length);
  }, [receipts, searchTerm]);

  return (
    <div className="space-y-5">
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
          <Search size={16} className="text-slate-400" />
        </div>
        <input 
          type="text" 
          placeholder="Ürün adı ile fiyat ara..." 
          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 pl-10 pr-4 py-3 rounded-2xl text-xs font-bold outline-none focus:border-indigo-300 dark:focus:border-indigo-800 shadow-sm transition-all"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="space-y-3 pb-8">
        {productData.length > 0 ? (
          productData.map((prod, idx) => (
            <div key={idx} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-800 overflow-hidden shadow-sm">
              <div className="p-4 flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-black text-slate-900 dark:text-slate-100 truncate leading-none mb-1.5 uppercase tracking-tight">{prod.name}</h4>
                  <div className="flex items-center gap-3">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                      <History size={10} /> {prod.purchases.length} Alım
                    </span>
                    <span className="text-[9px] font-bold text-indigo-500 uppercase tracking-widest flex items-center gap-1">
                      <TrendingDown size={10} /> En Az: {prod.minPrice.toLocaleString('tr-TR', {minimumFractionDigits: 2, maximumFractionDigits: 2})} ₺
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-black text-slate-900 dark:text-slate-100 leading-none">
                    {prod.lastPrice.toLocaleString('tr-TR', {minimumFractionDigits: 2, maximumFractionDigits: 2})} <span className="text-xs font-bold text-indigo-500">₺</span>
                  </div>
                  <div className="text-[8px] font-bold text-slate-400 uppercase mt-0.5 tracking-tighter">Son Fiyat</div>
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 px-4 py-2 divide-y divide-slate-100/50 dark:divide-slate-800">
                {prod.purchases.sort((a, b) => {
                  const parseDateForSort = (dateStr: string) => {
                    if (!dateStr) return '0000-00-00';
                    if (dateStr.includes('.')) {
                      const [d, m, y] = dateStr.split('.');
                      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
                    }
                    return dateStr;
                  };
                  return parseDateForSort(b.date).localeCompare(parseDateForSort(a.date));
                }).slice(0, 5).map((pur, pidx) => (
                  <div key={pidx} className="py-2 flex items-center justify-between text-[10px]">
                    <div className="flex flex-col min-w-0 flex-1">
                       <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1 truncate">
                          <span className="truncate uppercase">{pur.vendor}</span>
                          {pur.imageUrl && (
                            <button onClick={() => setSelectedImage(pur.imageUrl!)} className="ml-1 p-1 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-md text-indigo-600 shadow-sm flex-shrink-0">
                              <ImageIcon size={10} />
                            </button>
                          )}
                       </span>
                       <span className="text-[8px] text-slate-400 flex items-center gap-1 mt-0.5"><Calendar size={9} /> {pur.date}</span>
                    </div>
                    <div className="flex flex-col items-end flex-shrink-0 ml-4">
                       <span className="font-black text-slate-900 dark:text-slate-100 tabular-nums">
                         {pur.unitPrice.toLocaleString('tr-TR', {minimumFractionDigits: 2, maximumFractionDigits: 2})} ₺
                       </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        ) : (
          <div className="bg-white dark:bg-slate-900 p-12 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center text-center">
             <TrendingDown size={32} className="text-slate-200 dark:text-slate-700 mb-3" />
             <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Kayıtlı ürün bulunamadı</p>
          </div>
        )}
      </div>

      {selectedImage && (
        <div className="fixed inset-0 z-[70] bg-slate-900/90 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in" onClick={() => setSelectedImage(null)}>
          <div className="relative bg-white dark:bg-slate-800 p-2 rounded-3xl max-w-lg w-full shadow-2xl overflow-hidden animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
            <img src={selectedImage} alt="Fiş Görseli" className="w-full max-h-[80vh] object-contain rounded-2xl" />
            <button onClick={() => setSelectedImage(null)} className="absolute top-4 right-4 p-2 bg-black/50 text-white rounded-full"><X size={20} /></button>
          </div>
        </div>
      )}
    </div>
  );
};

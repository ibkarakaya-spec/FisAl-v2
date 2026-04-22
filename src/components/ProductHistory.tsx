import React, { useState, useMemo } from 'react';
import { ReceiptData } from '../types.ts';
import { Search, TrendingDown, History, Store, Calendar, Image as ImageIcon, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Props {
  receipts: ReceiptData[];
}

export const ProductHistory: React.FC<Props> = ({ receipts }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const formatDateForDisplay = (dateStr: string) => {
    if (!dateStr) return '';
    if (dateStr.includes('-')) {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        return `${parts[2].padStart(2, '0')}.${parts[1].padStart(2, '0')}.${parts[0]}`;
      }
    }
    return dateStr;
  };

  const productData = useMemo(() => {
    const history: Record<string, {
      name: string;
      category: string;
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
            category: r.category,
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
      });
    });

    Object.values(history).forEach(prod => {
      const sortedPurchases = [...prod.purchases].sort((a, b) => parseDateForSort(b.date).localeCompare(parseDateForSort(a.date)));
      prod.lastPrice = sortedPurchases[0].unitPrice;
    });

    const filtered = Object.values(history).filter(p => 
      p.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const groups: Record<string, typeof filtered> = {};
    filtered.forEach(p => {
      const cat = p.category || 'Diğer';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(p);
    });

    Object.keys(groups).forEach(cat => {
      groups[cat].sort((a, b) => a.name.localeCompare(b.name));
    });

    return groups;
  }, [receipts, searchTerm]);

  const getEmoji = (name: string) => {
    const n = name.toLowerCase();
    if (n.includes('süt')) return '🥛';
    if (n.includes('peynir')) return '🧀';
    if (n.includes('ekmek')) return '🍞';
    if (n.includes('yumurta')) return '🥚';
    if (n.includes('et') || n.includes('kıyma')) return '🥩';
    if (n.includes('tavuk')) return '🍗';
    if (n.includes('su') && !n.includes('sucuk')) return '💧';
    if (n.includes('sucuk') || n.includes('salam') || n.includes('sosis')) return '🌭';
    if (n.includes('elma') || n.includes('muz') || n.includes('meyve')) return '🍎';
    if (n.includes('domates') || n.includes('salatalık') || n.includes('sebze') || n.includes('biber') || n.includes('patlıcan')) return '🥦';
    if (n.includes('yoğurt') || n.includes('krema')) return '🍦';
    if (n.includes('zeytin')) return '🫒';
    if (n.includes('yağ')) return '🫗';
    if (n.includes('un') || n.includes('makarna')) return '🍝';
    if (n.includes('şeker') || n.includes('tatlı')) return '🍬';
    if (n.includes('çay') || n.includes('kahve') || n.includes('bitki çayı')) return '☕';
    if (n.includes('deterjan') || n.includes('sabun') || n.includes('çamaşır')) return '🧼';
    if (n.includes('şampuan') || n.includes('duş') || n.includes('bakım')) return '🧴';
    if (n.includes('peçete') || n.includes('kağıt') || n.includes('havlu')) return '🧻';
    if (n.includes('bisküvi') || n.includes('kek') || n.includes('gofret')) return '🍪';
    if (n.includes('çikolata')) return '🍫';
    if (n.includes('cips') || n.includes('kuruyemiş')) return '🍟';
    if (n.includes('kola') || n.includes('gazoz') || n.includes('içecek') || n.includes('fanta')) return '🥤';
    if (n.includes('makarna')) return '🍝';
    if (n.includes('pirinç') || n.includes('bulgur') || n.includes('bakliyat')) return '🍚';
    if (n.includes('salça') || n.includes('konserve')) return '🥫';
    if (n.includes('ekmek') || n.includes('simit') || n.includes('poğaça')) return '🥐';
    if (n.includes('cüzdan') || n.includes('para')) return '💰';
    if (n.includes('telefon') || n.includes('kulaklık') || n.includes('teknoloji')) return '📱';
    if (n.includes('kitap') || n.includes('dergi')) return '📚';
    if (n.includes('oyuncak')) return '🧸';
    if (n.includes('ilaç') || n.includes('eczane')) return '💊';
    return '📦';
  };

  const groupKeys = Object.keys(productData).sort();

  return (
    <div className="space-y-6">
      <motion.div 
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative group"
      >
        <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
          <Search size={18} className="text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
        </div>
        <input 
          type="text" 
          placeholder="Ürün adı ile fiyat ara..." 
          className="w-full bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 pl-12 pr-4 py-4 rounded-3xl text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-500 shadow-sm transition-all shadow-indigo-500/5"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </motion.div>

      <div className="space-y-8 pb-32">
        {groupKeys.length > 0 ? (
          groupKeys.map((catName) => (
            <motion.div 
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              key={catName} 
              className="space-y-4"
            >
              <div className="flex items-center gap-3 px-2">
                <div className="h-6 w-1 bg-indigo-600 rounded-full shadow-[0_0_10px_rgba(79,70,229,0.5)]"></div>
                <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">{catName}</h3>
              </div>
              
              <div className="grid grid-cols-1 gap-4">
                {productData[catName].map((prod, idx) => (
                  <motion.div 
                    key={idx} 
                    layout
                    whileHover={{ scale: 1.01 }}
                    className="bg-white dark:bg-slate-900 rounded-[32px] border border-slate-200/50 dark:border-slate-800 overflow-hidden shadow-sm hover:shadow-xl hover:shadow-slate-200/50 dark:hover:shadow-none transition-all group"
                  >
                    <div className="p-5 flex items-center gap-4">
                      <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-2xl flex items-center justify-center text-3xl shadow-inner shrink-0 group-hover:scale-110 transition-transform">
                        {getEmoji(prod.name)}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <h4 className="text-base font-black text-slate-900 dark:text-slate-100 truncate leading-tight uppercase tracking-tight font-display mb-1">{prod.name}</h4>
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                            <div className="p-1 bg-slate-100 dark:bg-slate-800 rounded">
                              <History size={10} />
                            </div>
                            {prod.purchases.length} Alım
                          </span>
                          <div className="hidden sm:block w-1 h-1 rounded-full bg-slate-200 dark:bg-slate-800"></div>
                          <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest flex items-center gap-1.5">
                             <div className="p-1 bg-emerald-50 dark:bg-emerald-950/30 rounded">
                               <TrendingDown size={10} />
                             </div>
                             Min: {prod.minPrice.toLocaleString('tr-TR', {minimumFractionDigits: 2})} ₺
                          </span>
                        </div>
                      </div>

                      <div className="text-right shrink-0 pl-2">
                        <div className="text-xl font-black text-slate-900 dark:text-slate-100 tabular-nums font-display">
                          {prod.lastPrice.toLocaleString('tr-TR', {minimumFractionDigits: 2})} <span className="text-xs font-bold text-indigo-500">₺</span>
                        </div>
                        <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Son Fiyat</div>
                      </div>
                    </div>

                    <div className="bg-slate-50/50 dark:bg-slate-800/30 border-t border-slate-100 dark:border-slate-800 px-6 py-2 divide-y divide-slate-100 dark:divide-slate-800">
                      {prod.purchases.sort((a, b) => {
                        const parse = (d: string) => {
                          if (d.includes('.')) {
                            const [dd, m, y] = d.split('.');
                            return `${y}-${m.padStart(2, '0')}-${dd.padStart(2, '0')}`;
                          }
                          return d;
                        };
                        return parse(b.date).localeCompare(parse(a.date));
                      }).slice(0, 3).map((pur, pidx) => (
                        <div key={pidx} className="py-2.5 flex items-center justify-between text-xs transition-colors hover:bg-white dark:hover:bg-slate-800 -mx-2 px-2 rounded-xl">
                          <div className="flex flex-col min-w-0 flex-1">
                             <div className="flex items-center gap-2 overflow-hidden">
                                <Store size={12} className="text-slate-400 shrink-0" />
                                <span className="font-bold text-slate-700 dark:text-slate-200 truncate uppercase text-[10px]">{pur.vendor}</span>
                                {pur.imageUrl && (
                                  <button onClick={() => setSelectedImage(pur.imageUrl!)} className="p-1.5 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-all shrink-0">
                                    <ImageIcon size={10} />
                                  </button>
                                )}
                             </div>
                             <span className="text-[9px] font-bold text-slate-400 px-5 mt-0.5 tabular-nums">{formatDateForDisplay(pur.date)}</span>
                          </div>
                          <div className="text-right ml-4">
                             <span className="font-black text-slate-900 dark:text-slate-100 tabular-nums font-display">
                               {pur.unitPrice.toLocaleString('tr-TR', {minimumFractionDigits: 2})} <span className="text-[9px] opacity-40">₺</span>
                             </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          ))
        ) : (
          <div className="bg-white dark:bg-slate-900 p-16 rounded-[40px] border border-dashed border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center text-center">
             <div className="bg-slate-50 dark:bg-slate-800 p-6 rounded-full mb-4">
                <TrendingDown size={40} className="text-slate-300 dark:text-slate-600" />
             </div>
             <p className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Kayıtlı ürün bulunamadı</p>
          </div>
        )}
      </div>

      <AnimatePresence>
        {selectedImage && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-6" 
            onClick={() => setSelectedImage(null)}
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="relative bg-white dark:bg-slate-900 p-3 rounded-[32px] max-w-lg w-full shadow-2xl overflow-hidden" 
              onClick={e => e.stopPropagation()}
            >
              <img src={selectedImage} alt="Fiş Görseli" className="w-full max-h-[80vh] object-contain rounded-2xl" />
              <button 
                onClick={() => setSelectedImage(null)} 
                className="absolute top-6 right-6 p-2 bg-black/60 text-white rounded-full backdrop-blur-md hover:bg-black/80 transition-colors"
              >
                <X size={24} />
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

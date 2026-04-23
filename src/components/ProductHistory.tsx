import React, { useState, useMemo } from 'react';
import { ReceiptData } from '../types.ts';
import { Search, TrendingDown, History, Store, Calendar, Image as ImageIcon, X, ChevronDown, ChevronRight, Layers } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Props {
  receipts: ReceiptData[];
}

export const ProductHistory: React.FC<Props> = ({ receipts }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});

  const toggleCategory = (cat: string) => {
    setExpandedCategories(prev => ({
      ...prev,
      [cat]: !prev[cat]
    }));
  };

  const toggleAll = (expand: boolean) => {
    const next: Record<string, boolean> = {};
    if (expand) {
      Object.keys(productData).forEach(cat => next[cat] = true);
    }
    setExpandedCategories(next);
  };

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
        const rawUnitPrice = item.unitPrice || (item.quantity > 0 ? item.price / item.quantity : item.price);
        const unitPrice = Math.round(rawUnitPrice * 100) / 100; // Round to 2 decimals
        
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

    const detectCategory = (name: string, broadCategory: string): { main: string, sub: string } => {
      const n = name.toLowerCase().trim();
      
      // Strict exclusions to prevent false positives
      if (n.includes('deterjan') || n.includes('sabun') || n.includes('şampuan') || n.includes('temizlik') || n.includes('yumuşatıcı') || n.includes('bulaşık') || n.includes('finish') || n.includes('fairy') || n.includes('ariel') || n.includes('omo') || n.includes('perwoll')) {
        return { main: 'Temizlik ve Bakım', sub: 'Ev ve Kişisel Temizlik' };
      }

      // 1. İçecekler (High priority keyword check)
      if (n.includes('su ') || n === 'su' || (n.includes('su') && !n.includes('sucuk') && !n.includes('susam') && !n.includes('soslu') && !n.includes('suda') && !n.includes('börek') && !n.includes('sulu') && !n.includes('suna') && !n.includes('sunu'))) return { main: 'İçecekler', sub: 'Su ve Maden Suyu' };
      if (n.includes('kola') || n.includes('fanta') || n.includes('gazoz') || n.includes('gazlı') || n.includes('meyve suyu') || n.includes('pepsi') || n.includes('sprite') || n.includes('fusetea') || n.includes('lipton ice') || n.includes('soğuk çay')) return { main: 'İçecekler', sub: 'Meyve Suları ve Gazlı İçecekler' };
      if (n.includes('çay') && !n.includes('çaya') && !n.includes('çaydanlık') && !n.includes('poğaça')) {
        if (n.includes('bitki') || n.includes('meyve çay') || n.includes('yeşil çay') || n.includes('form çay') || n.includes('ihlamur') || n.includes('adaçay') || n.includes('kuşburnu') || n.includes('rezene')) return { main: 'İçecekler', sub: 'Bitki ve Meyve Çayları' };
        return { main: 'İçecekler', sub: 'Çay ve Kahve çeşitleri' };
      }
      if (n.includes('kahve') || n.includes('nescafe') || n.includes('jacobs') || n.includes('mehmet efendi') || n.includes('filtre kahve') || n.includes('türk kahve')) return { main: 'İçecekler', sub: 'Çay ve Kahve çeşitleri' };

      // 1.5. Temel Gıda ve Bakliyat (Prioritized over snacks for items like sugar/salt)
      if (n.includes('şeker') && !n.includes('şekerleme') && !n.includes('sakız') && !n.includes('jelibon')) return { main: 'Temel Gıda ve Bakliyat', sub: 'Toz Şeker, Küp Şeker ve Tatlandırıcılar' };
      if (n.includes('tuz') && !n.includes('tuzlu fıstık') && !n.includes('tuzlu fındık')) return { main: 'Temel Gıda ve Bakliyat', sub: 'Yemeklik Tuz ve Baharatlar' };
      if (n.includes('un') && !n.includes('sabun') && !n.includes('unlu mamül')) return { main: 'Temel Gıda ve Bakliyat', sub: 'Un, İrmik ve Nişasta' };
      if (n.includes('makarna') || n.includes('mantı') || n.includes('spagetti') || n.includes('noodle')) return { main: 'Temel Gıda ve Bakliyat', sub: 'Makarna ve Mantı çeşitleri' };
      if (n.includes('pirinç') || n.includes('bulgur') || n.includes('mercimek') || n.includes('nohut') || n.includes('fasulye') || n.includes('bakliyat') || n.includes('barbunya')) return { main: 'Temel Gıda ve Bakliyat', sub: 'Pirinç, Bulgur ve Bakliyat çeşitleri' };
      if (n.includes('irmik') || n.includes('nişasta')) return { main: 'Temel Gıda ve Bakliyat', sub: 'Un, İrmik ve Nişasta' };
      if (n.includes('baharat') || n.includes('karabiber') || n.includes('nane') || n.includes('kekik') || n.includes('pul biber')) return { main: 'Temel Gıda ve Bakliyat', sub: 'Yemeklik Tuz ve Baharatlar' };
      if (n.includes('salça') || n.includes('konserve') || n.includes('turşu') || n.includes('mısır') || n.includes('bezelye') || n.includes('yaprak') || n.includes('tat') || n.includes('tukaş')) return { main: 'Temel Gıda ve Bakliyat', sub: 'Salça ve Konserve sebzeler' };

      // 2. Süt ve Kahvaltılık
      if (n.includes('yumurta')) return { main: 'Süt ve Kahvaltılık', sub: 'Yumurta' };
      if (n.includes('peynir') || n.includes('kaşar') || n.includes('lor') || n.includes('tulum') || n.includes('beyaz peynir') || n.includes('süzme') || n.includes('labne') || n.includes('hellim')) return { main: 'Süt ve Kahvaltılık', sub: 'Peynir çeşitleri (Beyaz, Kaşar, Lor vb.)' };
      if (n.includes('yoğurt') || n.includes('ayran') || n.includes('kefir') || n.includes('kaymak') || n.includes('krema')) return { main: 'Süt ve Kahvaltılık', sub: 'Yoğurt ve Ayran' };
      if (n.includes('süt') && !n.includes('sütlü')) return { main: 'Süt ve Kahvaltılık', sub: 'Süt ve Aromalı Sütler' };
      if (n.includes('zeytin')) return { main: 'Süt ve Kahvaltılık', sub: 'Zeytin (Siyah ve Yeşil)' };
      if (n.includes('tereyağ') || n.includes('margarin') || n.includes('becel') || n.includes('teremyağ')) return { main: 'Süt ve Kahvaltılık', sub: 'Tereyağı ve Margarin' };
      if (n.includes('bal') || n.includes('reçel') || n.includes('pekmez') || n.includes('tahin') || n.includes('helva')) return { main: 'Süt ve Kahvaltılık', sub: 'Reçel, Bal, Pekmez ve Helva' };
      if (n.includes('sürme çikolata') || n.includes('nutella') || n.includes('sarelle') || n.includes('çokokrem') || n.includes('fındık ezmesi')) return { main: 'Süt ve Kahvaltılık', sub: 'Sürme çikolata ve Ezmeler' };

      // 3. Et, Tavuk ve Balık
      if (n.includes('sucuk') || n.includes('salam') || n.includes('sosis') || n.includes('pastırma') || n.includes('şarküteri') || n.includes('füme') || n.includes('kavurma')) return { main: 'Et, Tavuk ve Balık', sub: 'Şarküteri (Sucuk, Salam, Sosis, Pastırma)' };
      if (n.includes('tavuk') || n.includes('hindi') || n.includes('baget') || n.includes('kanat') || n.includes('but') || n.includes('fileto')) return { main: 'Et, Tavuk ve Balık', sub: 'Tavuk ve Hindi eti' };
      if (n.includes('balık') || n.includes('deniz mahsul') || n.includes('ton balığı') || n.includes('karides') || n.includes('dardanel') || n.includes('mezgit') || n.includes('levrek')) return { main: 'Et, Tavuk ve Balık', sub: 'Balık ve Deniz mahsulleri' };
      if (n.includes('et') || n.includes('kıyma') || n.includes('kuşbaşı') || n.includes('dana') || n.includes('kuzu') || n.includes('bonfile') || n.includes('antrikot')) return { main: 'Et, Tavuk ve Balık', sub: 'Dana ve Kuzu eti ürünleri' };

      // 4. Meyve ve Sebze
      if (n.includes('domates') || n.includes('patates') || n.includes('soğan') || n.includes('biber') || n.includes('salatalık') || n.includes('sarısak') || n.includes('patlıcan') || n.includes('kabak') || n.includes('marul') || n.includes('maydanoz') || n.includes('sebze')) return { main: 'Meyve ve Sebze', sub: 'Taze Sebzeler' };
      if (n.includes('elma') || n.includes('muz') || n.includes('portakal') || n.includes('mandalina') || n.includes('limon') || n.includes('çilek') || n.includes('karpuz') || n.includes('kavun') || n.includes('üzüm') || n.includes('meyve')) return { main: 'Meyve ve Sebze', sub: 'Taze Meyveler' };
      if (n.includes('kuruyemiş') || n.includes('fındık') || n.includes('fıstık') || n.includes('ceviz') || n.includes('badem') || n.includes('leblebi') || n.includes('üzüm') || n.includes('kayısı') || n.includes('incir')) return { main: 'Meyve ve Sebze', sub: 'Kuru Meyve ve Kuruyemişler' };
      if (n.includes('zeytinyağı') || n.includes('sızma') || n.includes('riviera') || n.includes('komili') || n.includes('yudum')) return { main: 'Yağlar', sub: 'Zeytinyağı (Sızma ve Riviera)' };
      if (n.includes('ayçiçek')) return { main: 'Yağlar', sub: 'Ayçiçek Yağı' };
      if (n.includes('mısırözü') || n.includes('kanola')) return { main: 'Yağlar', sub: 'Mısırözü ve Kanola Yağı' };

      // 7. Atıştırmalıklar
      if (n.includes('bisküvi') || n.includes('kek') || n.includes('kurabiye') || n.includes('pötibör') || n.includes('negro') || n.includes('probis')) return { main: 'Atıştırmalıklar', sub: 'Bisküvi ve Kekler' };
      if (n.includes('çikolata') || n.includes('gofret') || n.includes('ülker') || n.includes('eti') || n.includes('milka') || n.includes('snickers')) return { main: 'Atıştırmalıklar', sub: 'Çikolata ve Gofretler' };
      if (n.includes('cips') || n.includes('lays') || n.includes('doritos') || n.includes('ruffles') || n.includes('patos')) return { main: 'Atıştırmalıklar', sub: 'Cips ve Kuruyemiş Paketleri' };
      if (n.includes('şekerleme') || n.includes('sakız') || n.includes('bonbon') || n.includes('jelibon') || n.includes('haribo') || n.includes('falım')) return { main: 'Atıştırmalıklar', sub: 'Şekerleme ve Sakızlar' };

      // 8. Dondurulmuş ve Hazır Gıda
      if (n.includes('pizza') || n.includes('börek') || n.includes('milföy') || n.includes('patates kızartması') || n.includes('hamburger')) return { main: 'Dondurulmuş ve Hazır Gıda', sub: 'Dondurulmuş Pizza, Börek ve Milföy' };
      if (n.includes('dondurulmuş') || n.includes('superfresh') || n.includes('feast')) return { main: 'Dondurulmuş ve Hazır Gıda', sub: 'Dondurulmuş Sebze ve Meyveler' };
      if (n.includes('çorba') || n.includes('hazır yemek') || n.includes('knorr') || n.includes('maggi') || n.includes('indomie')) return { main: 'Dondurulmuş ve Hazır Gıda', sub: 'Hazır Çorbalar ve Çabuk Makarnalar' };

      // 9. Ekmek ve Unlu Mamüller
      if (n.includes('ekmek') || n.includes('simit') || n.includes('poğaça') || n.includes('yufka') || n.includes('lavaş') || n.includes('bazlama')) return { main: 'Ekmek ve Unlu Mamüller', sub: 'Ekmek ve Unlu Mamüller' };

      // Default to broad category if "Gıda ve Market" is not matched
      if (broadCategory !== 'Gıda ve Market' && broadCategory !== 'Diğer' && broadCategory !== '') {
        return { main: broadCategory, sub: broadCategory };
      }

      return { main: 'Diğer', sub: 'Diğer Ürünler' };
    };

    const filtered = Object.values(history).filter(p => 
      p.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const groups: Record<string, { main: string, products: typeof filtered }> = {};
    filtered.forEach(p => {
      const { main, sub } = detectCategory(p.name, p.category);
      if (!groups[sub]) groups[sub] = { main, products: [] };
      groups[sub].products.push(p);
    });

    Object.keys(groups).forEach(sub => {
      groups[sub].products.sort((a, b) => a.name.localeCompare(b.name));
    });

    return groups;
  }, [receipts, searchTerm]);

  const getEmoji = (name: string) => {
    const n = name.toLowerCase();
    
    // Dairy & Breakfast
    if (n.includes('süt')) return '🥛';
    if (n.includes('peynir') || n.includes('kaşar')) return '🧀';
    if (n.includes('yoğurt') || n.includes('ayran')) return '🍦';
    if (n.includes('yumurta')) return '🥚';
    if (n.includes('zeytin')) return '🫒';
    if (n.includes('tereyağ') || n.includes('margarin')) return '🧈';
    if (n.includes('bal') || n.includes('reçel')) return '🍯';
    if (n.includes('ezme') || n.includes('nutella')) return '🍫';
    
    // Meat & Fish
    if (n.includes('sucuk') || n.includes('salam') || n.includes('sosis')) return '🌭';
    if (n.includes('tavuk') || n.includes('hindi')) return '🍗';
    if (n.includes('balık') || n.includes('karides')) return '🐟';
    if (n.includes('et') || n.includes('kıyma') || n.includes('dana')) return '🥩';
    
    // Produce
    if (n.includes('domates') || n.includes('biber') || n.includes('sebze')) return '🥦';
    if (n.includes('patates') || n.includes('soğan')) return '🥔';
    if (n.includes('elma') || n.includes('muz') || n.includes('meyve')) return '🍎';
    if (n.includes('fındık') || n.includes('fıstık') || n.includes('ceviz')) return '🥜';
    
    // Basic Food
    if (n.includes('makarna') || n.includes('mantı')) return '🍝';
    if (n.includes('pirinç') || n.includes('bulgur') || n.includes('mercimek')) return '🍚';
    if (n.includes('un') || n.includes('irmik')) return '🍞';
    if (n.includes('şeker') || n.includes('tuz')) return '🧂';
    if (n.includes('salça') || n.includes('turşu') || n.includes('konserve')) return '🥫';
    
    // Bakery
    if (n.includes('ekmek') || n.includes('simit') || n.includes('poğaça')) return '🥐';
    
    // Snacks
    if (n.includes('bisküvi') || n.includes('kek') || n.includes('kurabiye')) return '🍪';
    if (n.includes('çikolata') || n.includes('gofret')) return '🍫';
    if (n.includes('cips')) return '🍟';
    if (n.includes('şekerleme') || n.includes('jelibon')) return '🍬';
    
    // Drinks
    if (n.includes('çay')) return '🍵';
    if (n.includes('kahve')) return '☕';
    if (n.includes('su') || n.includes('soda')) return '💧';
    if (n.includes('kola') || n.includes('fanta') || n.includes('meyve suyu')) return '🥤';
    
    // Oil
    if (n.includes('yağ') || n.includes('sızma')) return '🫗';
    
    // Non-food
    if (n.includes('deterjan') || n.includes('sabun') || n.includes('temizlik')) return '🧼';
    if (n.includes('şampuan') || n.includes('bakım')) return '🧴';
    if (n.includes('kağıt') || n.includes('peçete')) return '🧻';
    
    return '📦';
  };

  const categoryImages: Record<string, string> = {
    'Temel Gıda ve Bakliyat': 'https://images.unsplash.com/photo-1590333746438-9993c3707178?q=80&w=800&auto=format&fit=crop', // Rice/Grains
    'Süt ve Kahvaltılık': 'https://images.unsplash.com/photo-1550583724-125581cc25fb?q=80&w=800&auto=format&fit=crop', // Milk
    'Et, Tavuk ve Balık': 'https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?q=80&w=800&auto=format&fit=crop', // Meat
    'Meyve ve Sebze': 'https://images.unsplash.com/photo-1610832958506-aa56368176cf?q=80&w=800&auto=format&fit=crop', // Vegetables
    'Yağlar': 'https://images.unsplash.com/photo-1474979266404-7eaacbad7391?q=80&w=800&auto=format&fit=crop', // Olive oil
    'Atıştırmalıklar': 'https://images.unsplash.com/photo-1590080875515-8a3a8dc3605e?q=80&w=800&auto=format&fit=crop', // Snacks
    'İçecekler': 'https://images.unsplash.com/photo-1544145945-f904253d0c7e?q=80&w=800&auto=format&fit=crop', // Drinks
    'Dondurulmuş ve Hazır Gıda': 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=800&auto=format&fit=crop', // Pizza/Ready
    'Ekmek ve Unlu Mamüller': 'https://images.unsplash.com/photo-1509440159596-0249088772ff?q=80&w=800&auto=format&fit=crop', // Bread
    'Temizlik ve Bakım': 'https://images.unsplash.com/photo-1584622781564-1d9876a13d00?q=80&w=800&auto=format&fit=crop', // Soap
    'Diğer': 'https://images.unsplash.com/photo-1534452203294-49c891ca7ee1?q=80&w=800&auto=format&fit=crop'
  };

  const groupKeys = Object.keys(productData).sort((a, b) => {
    // Custom sort order for main categories
    const mainOrder: Record<string, number> = {
      'Temel Gıda ve Bakliyat': 1,
      'Süt ve Kahvaltılık': 2,
      'Et, Tavuk ve Balık': 3,
      'Meyve ve Sebze': 4,
      'Yağlar': 5,
      'Atıştırmalıklar': 6,
      'İçecekler': 7,
      'Dondurulmuş ve Hazır Gıda': 8,
      'Ekmek ve Unlu Mamüller': 9,
      'Temizlik ve Bakım': 10
    };

    const orderA = mainOrder[productData[a].main] || 99;
    const orderB = mainOrder[productData[b].main] || 99;

    if (orderA !== orderB) return orderA - orderB;
    return a.localeCompare(b);
  });

  // Auto-expand on search
  useMemo(() => {
    if (searchTerm.trim().length > 0) {
      const next: Record<string, boolean> = {};
      groupKeys.forEach(cat => next[cat] = true);
      setExpandedCategories(next);
    }
  }, [searchTerm, groupKeys]);

  return (
    <div className="space-y-1">
      <div className="flex gap-1.5">
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative group flex-1"
        >
          <div className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none">
            <Search size={16} className="text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
          </div>
          <input 
            type="text" 
            placeholder="Ürün adı ile fiyat ara..." 
            className="w-full bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 pl-11 pr-4 py-3 rounded-2xl text-[11px] font-semibold outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-500 shadow-sm transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </motion.div>
        
        <div className="flex gap-1">
          <motion.button 
            whileTap={{ scale: 0.95 }}
            onClick={() => toggleAll(true)}
            className="p-3 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-2xl text-slate-400 hover:text-indigo-500 transition-colors shadow-sm"
            title="Tümünü Aç"
          >
            <ChevronDown size={18} />
          </motion.button>
          <motion.button 
            whileTap={{ scale: 0.95 }}
            onClick={() => toggleAll(false)}
            className="p-3 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-2xl text-slate-400 hover:text-indigo-500 transition-colors shadow-sm"
            title="Tümünü Kapat"
          >
            <ChevronRight size={18} />
          </motion.button>
        </div>
      </div>

      <div className="space-y-2 pb-24">
        {groupKeys.length > 0 ? (
          groupKeys.map((catName) => (
            <motion.div 
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              key={catName} 
              className="space-y-1.5"
            >
              <button 
                onClick={() => toggleCategory(catName)}
                className="w-full flex items-center justify-between gap-2 px-1 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-2xl transition-colors group text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="relative w-12 h-12 rounded-xl overflow-hidden shrink-0 shadow-sm border border-slate-100 dark:border-slate-800">
                    <img 
                      src={categoryImages[productData[catName].main] || categoryImages['Diğer']} 
                      alt={catName} 
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = categoryImages['Diğer'];
                      }}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    />
                    {!expandedCategories[catName] && (
                      <div className="absolute inset-0 bg-slate-900/5 backdrop-blur-[0.5px]"></div>
                    )}
                  </div>
                  <div>
                    <span className="text-[8px] font-bold text-indigo-500/80 uppercase tracking-widest block mb-0.5">{productData[catName].main}</span>
                    <h3 className={`text-[11px] font-semibold uppercase tracking-tight transition-colors leading-none ${expandedCategories[catName] ? 'text-slate-900 dark:text-white' : 'text-slate-500'}`}>
                      {catName}
                      <span className="ml-2 text-[9px] font-medium opacity-50 lowercase tracking-normal">({productData[catName].products.length} ürün)</span>
                    </h3>
                  </div>
                </div>
                <div className={`text-slate-300 group-hover:text-slate-400 transition-transform duration-300 mr-2 ${expandedCategories[catName] ? 'rotate-180' : ''}`}>
                  <ChevronDown size={14} />
                </div>
              </button>
              
              <AnimatePresence>
                {expandedCategories[catName] && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="grid grid-cols-1 gap-1 pb-2">
                      {productData[catName].products.map((prod, idx) => (
                        <motion.div 
                          key={idx} 
                          layout
                          whileHover={{ scale: 1.01 }}
                          className="bg-white dark:bg-slate-900 rounded-[24px] border border-slate-200/50 dark:border-slate-800 overflow-hidden shadow-sm transition-all group"
                        >
                    <div className="p-4 flex items-center gap-3.5">
                      <div className="w-12 h-12 bg-slate-50 dark:bg-slate-800 rounded-[18px] flex items-center justify-center text-2xl shadow-inner shrink-0 group-hover:scale-105 transition-transform">
                        {getEmoji(prod.name)}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <h4 className="text-[15px] font-bold text-slate-950 dark:text-white truncate leading-tight uppercase tracking-tight font-display mb-0.5">{prod.name}</h4>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center gap-1">
                            <History size={10} className="opacity-60" />
                            {prod.purchases.length} ALIM
                          </span>
                          <div className="w-0.5 h-0.5 rounded-full bg-slate-300 dark:bg-slate-700"></div>
                          <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest flex items-center gap-1">
                             <TrendingDown size={10} className="opacity-60" />
                             Min: {prod.minPrice.toLocaleString('tr-TR', {minimumFractionDigits: 2, maximumFractionDigits: 2})} ₺
                          </span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="text-lg font-semibold text-slate-900 dark:text-slate-100 tabular-nums font-display leading-none">
                          {prod.lastPrice.toLocaleString('tr-TR', {minimumFractionDigits: 2, maximumFractionDigits: 2})} <span className="text-[10px] font-semibold text-indigo-500">₺</span>
                        </div>
                        <div className="text-[8px] font-semibold text-slate-400 uppercase tracking-widest mt-1">Son</div>
                      </div>
                    </div>

                    <div className="bg-slate-50/50 dark:bg-slate-800/30 border-t border-slate-100 dark:border-slate-800 px-4 py-1.5 divide-y divide-slate-50 dark:divide-slate-800">
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
                        <div key={pidx} className="py-1.5 flex items-center justify-between text-[10px] transition-colors -mx-1 px-1 rounded-lg">
                          <div className="flex flex-col min-w-0 flex-1">
                             <div className="flex items-center gap-1.5 overflow-hidden">
                                <span className="font-bold text-slate-700 dark:text-slate-200 uppercase truncate text-[9px]">{pur.vendor}</span>
                                <span className="text-[8px] text-slate-400 font-bold tabular-nums shrink-0">{pur.date.substring(0, 5)}</span>
                             </div>
                          </div>
                          <div className="font-bold text-slate-600 dark:text-slate-400 tabular-nums ml-2">
                             {pur.unitPrice.toLocaleString('tr-TR', {minimumFractionDigits: 2, maximumFractionDigits: 2})} ₺
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      ))
        ) : (
          <div className="bg-white dark:bg-slate-900 p-16 rounded-[40px] border border-dashed border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center text-center">
             <div className="bg-slate-50 dark:bg-slate-800 p-6 rounded-full mb-4">
                <TrendingDown size={40} className="text-slate-300 dark:text-slate-600" />
             </div>
             <p className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em]">Kayıtlı ürün bulunamadı</p>
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

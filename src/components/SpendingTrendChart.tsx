import React, { useMemo } from 'react';
import { ReceiptData } from '../types.ts';
import { BarChart3 } from 'lucide-react';

interface Props {
  receipts: ReceiptData[];
  selectedMonth: string;
}

export const SpendingTrendChart: React.FC<Props> = ({ receipts, selectedMonth }) => {
  const chartData = useMemo(() => {
    const isAll = selectedMonth === 'Hepsi';
    const groupedData: Record<string, number> = {};

    receipts.forEach(r => {
      if (!isAll) {
        let rMonth = '';
        if (r.date.includes('.')) {
          const parts = r.date.split('.');
          rMonth = `${parts[2]}-${parts[1]}`;
        } else {
          rMonth = r.date.substring(0, 7);
        }
        if (rMonth !== selectedMonth) return;
      }

      let key = '';
      if (isAll) {
         key = r.date.includes('.') ? r.date.split('.')[2] + '-' + r.date.split('.')[1] : r.date.substring(0, 7);
      } else {
         key = r.date.includes('.') ? r.date.split('.')[0] : r.date.substring(8, 10);
      }

      groupedData[key] = (groupedData[key] || 0) + r.total;
    });

    let data = Object.entries(groupedData).map(([label, value]) => ({ label, value }));

    if (isAll) {
        data.sort((a, b) => a.label.localeCompare(b.label));
        if (data.length > 6) data = data.slice(data.length - 6);
    } else {
        data.sort((a, b) => parseInt(a.label) - parseInt(b.label));
    }

    return data;
  }, [receipts, selectedMonth]);

  const maxValue = Math.max(...chartData.map(d => d.value), 1);

  if (chartData.length === 0) return null;

  const isAll = selectedMonth === 'Hepsi';

  return (
    <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl shadow-sm border border-slate-200/50 dark:border-slate-800 flex flex-col h-28 transition-colors">
      <div className="flex items-center justify-between mb-1">
         <div className="flex items-center gap-1.5">
            <div className="bg-indigo-50 dark:bg-indigo-950/30 p-1 rounded-lg text-indigo-600">
               <BarChart3 size={12} />
            </div>
            <h3 className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-widest">
              {isAll ? 'Aylık Trend' : 'Günlük Dağılım'}
            </h3>
         </div>
         {chartData.length > 0 && (
           <span className="text-[11px] font-medium text-slate-400 uppercase">Max: {Math.round(maxValue)}₺</span>
         )}
      </div>

      <div className="flex-1 flex items-end gap-1 pt-3 pb-1">
        {chartData.map((item, index) => {
           const heightPercent = Math.max((item.value / maxValue) * 100, 4);
           return (
             <div key={index} className="flex-1 flex flex-col items-center justify-end h-full group relative cursor-pointer">
                <div className="mb-1 opacity-0 group-hover:opacity-100 transition-all absolute bottom-full bg-slate-900 text-white text-[10px] font-medium py-1 px-1.5 rounded shadow-lg z-20 pointer-events-none whitespace-nowrap">
                   {item.value.toFixed(0)} ₺
                </div>
                <div 
                  className="w-full max-w-[16px] bg-slate-100 dark:bg-slate-800 group-hover:bg-indigo-500 rounded-t-[3px] transition-all duration-300"
                  style={{ height: `${heightPercent}%` }}
                ></div>
                <span className="text-[9px] font-medium text-slate-400 mt-1 truncate w-full text-center">
                   {isAll ? item.label.split('-')[1] : item.label}
                </span>
             </div>
           );
        })}
      </div>
    </div>
  );
};

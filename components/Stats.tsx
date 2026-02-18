import React, { useMemo } from 'react';
import { ScannedReceipt } from '../types';
import { Icons } from './Icon';

interface StatsProps {
  receipts: ScannedReceipt[];
  showDetailLink?: boolean;
  onClickDetail?: () => void;
}

const COLORS: Record<string, string> = {
  '식비': 'bg-orange-400',
  '숙소': 'bg-blue-400',
  '교통': 'bg-green-400',
  '쇼핑': 'bg-purple-400',
  '관광': 'bg-pink-400',
  '기타': 'bg-slate-400',
};

const TEXT_COLORS: Record<string, string> = {
  '식비': 'text-orange-500',
  '숙소': 'text-blue-500',
  '교통': 'text-green-500',
  '쇼핑': 'text-purple-500',
  '관광': 'text-pink-500',
  '기타': 'text-slate-500',
};

const Stats: React.FC<StatsProps> = ({ receipts, showDetailLink = true, onClickDetail }) => {
  const { total, groups } = useMemo(() => {
    const totalSum = receipts.reduce((sum, r) => sum + r.amount, 0);
    const grouped = receipts.reduce((acc, curr) => {
      const existing = acc.find(item => item.name === curr.category);
      if (existing) { existing.value += curr.amount; } 
      else { acc.push({ name: curr.category, value: curr.amount }); }
      return acc;
    }, [] as { name: string; value: number }[]);
    grouped.sort((a, b) => b.value - a.value);
    return { total: totalSum, groups: grouped };
  }, [receipts]);

  if (receipts.length === 0) return null;

  const visibleGroups = groups.filter(g => (g.value / total) * 100 > 0);

  return (
    <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-md border border-white/30 dark:border-slate-700/50 p-5 rounded-3xl shadow-sm mb-6 transition-colors">
      <div className="flex justify-between items-center mb-6 text-sm font-semibold text-gray-700 dark:text-slate-300">
        <span>지출 분석</span>
        {showDetailLink && (
          <span 
            className="text-xs text-blue-500 dark:text-blue-400 flex items-center gap-1 cursor-pointer hover:underline"
            onClick={onClickDetail}
          >
             상세보기 <Icons.ChevronRight className="w-3 h-3" />
          </span>
        )}
      </div>

      <div className="w-full">
        <div className="flex w-full h-3 rounded-full overflow-hidden bg-gray-100 dark:bg-slate-700 mb-1.5">
          {visibleGroups.map((group) => {
            const widthPercent = total > 0 ? (group.value / total) * 100 : 0;
            return (
              <div 
                key={group.name}
                className={`h-full ${COLORS[group.name] || 'bg-gray-300'} border-r border-white/20 dark:border-slate-800/20 last:border-0 transition-all duration-500`}
                style={{ width: `${widthPercent}%` }}
              />
            );
          })}
        </div>

        <div className="flex w-full relative">
          {visibleGroups.map((group, idx) => {
             const widthPercent = total > 0 ? (group.value / total) * 100 : 0;
             const isLast = idx === visibleGroups.length - 1;
             const showLabel = widthPercent >= 5;
             
             return (
               <div 
                  key={group.name} 
                  style={{ width: `${widthPercent}%` }} 
                  className="flex flex-col items-start justify-start overflow-visible"
               >
                 <div className="flex items-start mt-0.5">
                    <div className={`w-0.5 h-2 rounded-full ${COLORS[group.name] || 'bg-gray-300'} mr-1 mt-0.5`}></div>
                    {showLabel && (
                        <div className="whitespace-nowrap z-10 flex flex-col items-start leading-none">
                            <span className={`text-[10px] font-bold ${TEXT_COLORS[group.name] || 'text-gray-500'} mb-0.5`}>
                            {group.name}
                            </span>
                            <span className="text-[10px] text-gray-400 dark:text-slate-500 font-medium">
                            {Math.round(widthPercent)}%
                            </span>
                        </div>
                    )}
                 </div>
               </div>
             );
          })}
        </div>
      </div>
    </div>
  );
};

export default Stats;
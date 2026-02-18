import React from 'react';
import { ScannedReceipt } from '../types';
import { CategoryIcon, Icons } from './Icon';

interface ReceiptCardProps {
  receipt: ScannedReceipt;
  onDelete: (id: string) => void;
  onClick?: (receipt: ScannedReceipt) => void;
  isDarkMode?: boolean;
}

const ReceiptCard: React.FC<ReceiptCardProps> = ({ receipt, onDelete, onClick, isDarkMode }) => {
  const formattedAmount = new Intl.NumberFormat('ko-KR', {
    style: 'currency',
    currency: 'KRW',
  }).format(receipt.amount);

  const originalAmount = receipt.currency !== 'KRW' 
    ? new Intl.NumberFormat('en-US', { style: 'currency', currency: receipt.currency }).format(receipt.amount)
    : null;

  const getCategoryColor = (cat: string) => {
    switch(cat) {
      case '식비': return isDarkMode ? 'bg-orange-900/30 text-orange-400' : 'bg-orange-100 text-orange-500';
      case '숙소': return isDarkMode ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-100 text-blue-500';
      case '교통': return isDarkMode ? 'bg-green-900/30 text-green-400' : 'bg-green-100 text-green-500';
      case '쇼핑': return isDarkMode ? 'bg-purple-900/30 text-purple-400' : 'bg-purple-100 text-purple-500';
      case '관광': return isDarkMode ? 'bg-pink-900/30 text-pink-400' : 'bg-pink-100 text-pink-500';
      default: return isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-gray-100 text-gray-500';
    }
  };

  return (
    <div 
      onClick={() => onClick && onClick(receipt)}
      className="flex items-center gap-4 bg-white dark:bg-slate-800 p-4 rounded-2xl mb-3 shadow-sm border border-gray-50 dark:border-slate-700 relative group cursor-pointer active:scale-[0.98] transition-all"
    >
       <button 
        onClick={(e) => {
          e.stopPropagation();
          onDelete(receipt.id);
        }}
        className="absolute -top-3 -right-3 bg-white dark:bg-slate-700 text-red-400 border border-red-100 dark:border-red-900/50 rounded-full p-2.5 shadow-md z-20 hover:text-red-600 transition-colors"
        aria-label="삭제"
      >
        <Icons.Trash2 className="w-4 h-4" />
      </button>

      <div className={`w-12 h-12 ${getCategoryColor(receipt.category)} rounded-xl flex items-center justify-center flex-shrink-0 transition-colors`}>
        <CategoryIcon category={receipt.category} className="w-6 h-6" />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-gray-800 dark:text-slate-100 truncate">{receipt.merchant_name}</p>
        <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-0.5 truncate">
          {receipt.date} | {receipt.category}
        </p>
      </div>

      <div className="text-right flex-shrink-0 max-w-[40%]">
        {originalAmount ? (
            <>
              <p className="text-sm font-bold text-gray-800 dark:text-slate-100 truncate">{originalAmount}</p>
              <p className="text-[10px] text-blue-500 dark:text-blue-400 truncate">≈ {formattedAmount}</p>
            </>
        ) : (
            <p className="text-sm font-bold text-gray-800 dark:text-slate-100 truncate">{formattedAmount}</p>
        )}
      </div>
    </div>
  );
};

export default ReceiptCard;
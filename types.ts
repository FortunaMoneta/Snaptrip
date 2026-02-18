export type Category = '식비' | '숙소' | '교통' | '쇼핑' | '관광' | '기타';

export interface ReceiptAnalysis {
  merchant_name: string;
  category: Category;
  amount: number;
  currency: string;
  date: string;
  time?: string; // HH:mm format (24hr)
  address: string | null;
  latitude?: number | null;
  longitude?: number | null;
  reasoning: string;
}

export interface ScannedReceipt extends ReceiptAnalysis {
  id: string;
  timestamp: number;
  memo?: string; // User's custom note
}

export interface Trip {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  budget: number;
  receipts: ScannedReceipt[];
  targetCurrency?: string; // e.g., 'JPY'
  exchangeRate?: number; // User defined fixed rate (average)
}

export interface AnalysisState {
  isLoading: boolean;
  error: string | null;
}
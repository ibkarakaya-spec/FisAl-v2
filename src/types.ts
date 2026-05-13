export interface ReceiptItem {
  name: string;
  price: number;
  quantity: number;
  unitPrice?: number;
}

export interface ReceiptData {
  id: string;
  vendor: string;
  date: string;
  total: number;
  currency: string;
  category: string;
  tax: number;
  items: ReceiptItem[];
  confidence: number;
  timestamp: number;
  imageUrl?: string;
  driveUrl?: string;
}

export enum AppStatus {
  IDLE = 'IDLE',
  PROCESSING = 'PROCESSING',
  ERROR = 'ERROR'
}

export type ThemeMode = 'light' | 'dark' | 'system';

export type ViewMode = 'standard' | 'detailed';

export interface BudgetLimit {
  category: string;
  limit: number;
  month: string;
}

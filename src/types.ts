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
}

export enum Priority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high'
}

export interface Task {
  id: string;
  groupId: string;
  memberUids: string[];
  title: string;
  description: string;
  completed: boolean;
  category: string;
  priority: Priority;
  dueDate?: string;
  createdBy: string;
  assignedTo?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Group {
  id: string;
  name: string;
  members: string[];
  ownerId: string;
  createdAt: string;
}

export type StorageMode = 'offline' | 'google';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

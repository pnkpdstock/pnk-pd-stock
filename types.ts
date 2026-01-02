
export interface User {
  id: string;
  firstName: string;
  lastName: string;
  username: string;
  password?: string;
}

export interface Product {
  id: string;
  thai_name: string;
  english_name: string;
  search_name: string; // เพิ่มฟิลด์สำหรับชื่อค้นหา
  manufacturer: string;
  contact_number?: string;
  min_stock?: number;
  photo?: string;
  status?: 'Active' | 'Cancelled';
  registered_by?: string; 
  created_at: string;
}

export interface StockItem {
  id: string;
  thai_name: string;
  english_name: string;
  batch_no: string;
  mfd: string;
  exp: string;
  manufacturer: string;
  quantity: number;
  status: 'In Stock' | 'Released';
  processed_by?: string; 
  patient_name?: string; 
  timestamp: string;
  release_timestamp?: string;
}

export interface ReceiptHistory {
  id: string;
  thai_name: string;
  english_name: string;
  batch_no: string;
  exp: string;
  quantity: number;
  processed_by: string;
  created_at: string;
}

export interface ReleaseHistory {
  id: string;
  thai_name: string;
  english_name: string;
  batch_no: string;
  exp: string;
  quantity: number;
  processed_by: string;
  patient_name: string;
  created_at: string;
}

export interface LabelExtractionResult {
  thaiName: string;
  englishName: string;
  searchName?: string; // เพิ่มใน result ด้วย
  batchNo: string;
  mfd: string;
  exp: string;
  manufacturer: string;
  image?: string;
  quantity?: number;
}

export enum View {
  INVENTORY = 'inventory',
  REGISTRATION = 'registration',
  STOCK_IN = 'stock_in',
  STOCK_OUT = 'stock_out',
  RECEIPT_HISTORY = 'receipt_history',
  RELEASE_HISTORY = 'release_history',
  SETTINGS = 'settings',
  USERS = 'users'
}

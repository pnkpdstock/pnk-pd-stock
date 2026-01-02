
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { StockItem, Product, User, ReceiptHistory, ReleaseHistory } from "../types";

let supabase: SupabaseClient | null = null;

const isValidUrl = (url: string) => {
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
};

const getSupabase = () => {
  if (supabase) return supabase;
  const config = localStorage.getItem('supabase_config');
  if (config) {
    try {
      const { url, key } = JSON.parse(config);
      if (url && key && isValidUrl(url)) {
        supabase = createClient(url.trim(), key.trim(), {
          auth: { persistSession: false }
        });
        return supabase;
      }
    } catch (e) {
      console.error("Supabase Init Error:", e);
    }
  }
  return null;
};

export const storageService = {
  configure: (url: string, key: string) => {
    if (!isValidUrl(url)) throw new Error("URL ไม่ถูกต้อง");
    supabase = createClient(url.trim(), key.trim(), {
      auth: { persistSession: false }
    });
    localStorage.setItem('supabase_config', JSON.stringify({ url: url.trim(), key: key.trim() }));
  },

  isConfigured: () => getSupabase() !== null,

  testConnection: async (url: string, key: string): Promise<boolean> => {
    if (!isValidUrl(url)) throw new Error("รูปแบบ URL ไม่ถูกต้อง");
    try {
      const tempClient = createClient(url.trim(), key.trim());
      const { error } = await tempClient.from('products').select('id').limit(1);
      if (error && error.code !== 'PGRST116') throw error;
      return true;
    } catch (err: any) {
      throw new Error(err.message || "ไม่สามารถเชื่อมต่อได้");
    }
  },

  migrateDatabase: async (): Promise<void> => {
    const client = getSupabase();
    if (!client) throw new Error("กรุณาตั้งค่า Cloud ก่อน");
    // หมายเหตุ: การใช้ RPC หรือ SQL โดยตรงผ่าน API อาจถูกจำกัดในบางโปรเจค 
    // หากวิธีนี้ไม่ได้ผล ผู้ใช้ควรไปที่ SQL Editor ใน Supabase แล้วรัน:
    // ALTER TABLE products ADD COLUMN IF NOT EXISTS search_name TEXT;
    const { error } = await client.rpc('exec_sql', { 
      sql_query: 'ALTER TABLE products ADD COLUMN IF NOT EXISTS search_name TEXT;' 
    });
    
    // ถ้าไม่มี RPC ให้ลอง insert column แบบหว่านแห (Supabase มักจะทำไม่ได้โดยตรงจาก Client)
    // แต่เราจะใช้วิธีแจ้งเตือนใน UI แทนถ้า error ยังคงอยู่
    if (error) {
      console.error("Migration via RPC failed, please run SQL manually:", error);
      throw new Error("ไม่สามารถอัปเดตอัตโนมัติได้ กรุณารัน SQL: ALTER TABLE products ADD COLUMN search_name TEXT; ใน Supabase SQL Editor");
    }
  },

  fetchUsers: async (): Promise<User[]> => {
    const client = getSupabase();
    if (!client) return [];
    const { data, error } = await client.from('users').select('*').order('username');
    if (error) throw error;
    return data as User[];
  },

  registerUser: async (user: Omit<User, 'id'>): Promise<User> => {
    const client = getSupabase();
    if (!client) throw new Error("กรุณาตั้งค่า Cloud ก่อน");
    const { data, error } = await client.from('users').insert([user]).select().single();
    if (error) throw error;
    return data as User;
  },

  fetchItems: async (): Promise<StockItem[]> => {
    const client = getSupabase();
    if (!client) return [];
    const { data, error } = await client.from('stock_items').select('*').order('timestamp', { ascending: false });
    if (error) throw error;
    return (data || []) as StockItem[];
  },

  saveReceiptHistory: async (history: Omit<ReceiptHistory, 'id' | 'created_at'>): Promise<void> => {
    const client = getSupabase();
    if (!client) throw new Error("กรุณาตั้งค่า Cloud ก่อน");
    const { error } = await client.from('receipt_history').insert([history]);
    if (error) throw error;
  },

  fetchReceiptHistory: async (): Promise<ReceiptHistory[]> => {
    const client = getSupabase();
    if (!client) return [];
    const { data, error } = await client.from('receipt_history').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []) as ReceiptHistory[];
  },

  saveReleaseHistory: async (history: Omit<ReleaseHistory, 'id' | 'created_at'>): Promise<void> => {
    const client = getSupabase();
    if (!client) throw new Error("กรุณาตั้งค่า Cloud ก่อน");
    const { error } = await client.from('release_history').insert([history]);
    if (error) throw error;
  },

  fetchReleaseHistory: async (): Promise<ReleaseHistory[]> => {
    const client = getSupabase();
    if (!client) return [];
    const { data, error } = await client.from('release_history').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []) as ReleaseHistory[];
  },

  saveItem: async (item: Omit<StockItem, 'id' | 'timestamp' | 'status'>, username?: string): Promise<StockItem> => {
    const client = getSupabase();
    if (!client) throw new Error("กรุณาตั้งค่า Cloud ก่อน");
    
    const timestamp = new Date().toISOString();
    const newItem = { 
      thai_name: item.thai_name,
      english_name: item.english_name,
      batch_no: item.batch_no,
      mfd: item.mfd,
      exp: item.exp,
      manufacturer: item.manufacturer,
      quantity: item.quantity,
      status: 'In Stock', 
      processed_by: username, 
      timestamp: timestamp 
    };

    const { data, error } = await client.from('stock_items').insert([newItem]).select().single();
    if (error) throw new Error(`บันทึกไม่สำเร็จ: ${error.message}`);

    try {
      await storageService.saveReceiptHistory({
        thai_name: item.thai_name,
        english_name: item.english_name,
        batch_no: item.batch_no,
        exp: item.exp,
        quantity: item.quantity,
        processed_by: username || 'System'
      });
    } catch (logErr) {
      console.error("History Log Error:", logErr);
    }

    return data as StockItem;
  },

  releaseItemByBatch: async (batch_no: string, qtyToRelease: number, username?: string, patient_name?: string): Promise<StockItem | null> => {
    const client = getSupabase();
    if (!client) throw new Error("กรุณาตั้งค่า Cloud ก่อน");

    const { data: items, error: findError } = await client
      .from('stock_items')
      .select('*')
      .eq('batch_no', batch_no)
      .eq('status', 'In Stock')
      .order('timestamp', { ascending: true });

    if (findError || !items || items.length === 0) return null;

    let totalAvailable = items.reduce((sum, i) => sum + (i.quantity || 1), 0);
    if (totalAvailable < qtyToRelease) return null;

    let remainingToRelease = qtyToRelease;
    let lastUpdatedItem = null;
    const firstItem = items[0];

    for (const item of items) {
      if (remainingToRelease <= 0) break;
      const currentQty = item.quantity || 1;
      
      if (currentQty <= remainingToRelease) {
        const { data, error } = await client
          .from('stock_items')
          .update({ 
            status: 'Released', 
            processed_by: username, 
            patient_name: patient_name,
            release_timestamp: new Date().toISOString() 
          })
          .eq('id', item.id).select().single();
        if (error) throw error;
        remainingToRelease -= currentQty;
        lastUpdatedItem = data;
      } else {
        await client.from('stock_items').update({ quantity: currentQty - remainingToRelease }).eq('id', item.id);
        const { id, ...itemWithoutId } = item;
        const { data: releasedData, error: insertError } = await client.from('stock_items').insert([{
          ...itemWithoutId,
          quantity: remainingToRelease,
          status: 'Released',
          processed_by: username,
          patient_name: patient_name,
          release_timestamp: new Date().toISOString()
        }]).select().single();
        if (insertError) throw insertError;
        remainingToRelease = 0;
        lastUpdatedItem = releasedData;
      }
    }

    try {
      await storageService.saveReleaseHistory({
        thai_name: firstItem.thai_name,
        english_name: firstItem.english_name,
        batch_no: batch_no,
        exp: firstItem.exp,
        quantity: qtyToRelease,
        processed_by: username || 'System',
        patient_name: patient_name || 'N/A'
      });
    } catch (err) {
      console.error("Failed to save release history:", err);
    }

    return lastUpdatedItem as StockItem;
  },

  fetchProducts: async (): Promise<Product[]> => {
    const client = getSupabase();
    if (!client) return [];
    // ระบุคอลัมน์ชัดเจนเพื่อหลีกเลี่ยง error ถ้า search_name ยังไม่มี
    // ถ้า select('*') แล้วพัง ให้ลอง select เฉพาะที่แน่ใจก่อน
    const { data, error } = await client.from('products').select('id, thai_name, english_name, manufacturer, contact_number, min_stock, photo, status, registered_by, created_at, search_name').order('thai_name');
    
    // ถ้าพังเพราะ search_name ไม่มี ให้ดึงแบบปกติก่อน
    if (error && error.message.includes('search_name')) {
      const { data: fallbackData, error: fallbackError } = await client.from('products').select('id, thai_name, english_name, manufacturer, contact_number, min_stock, photo, status, registered_by, created_at').order('thai_name');
      if (fallbackError) throw fallbackError;
      return (fallbackData || []) as Product[];
    }
    
    if (error) throw error;
    return (data || []) as Product[];
  },

  registerProduct: async (product: Omit<Product, 'id' | 'created_at'>, username?: string): Promise<Product> => {
    const client = getSupabase();
    if (!client) throw new Error("กรุณาตั้งค่า Cloud ก่อน");
    const { data, error } = await client.from('products').insert([{ 
      ...product, 
      status: 'Active', 
      registered_by: username 
    }]).select().single();
    if (error) throw error;
    return data as Product;
  },

  updateProduct: async (id: string, updates: Partial<Product>): Promise<Product> => {
    const client = getSupabase();
    if (!client) throw new Error("กรุณาตั้งค่า Cloud ก่อน");
    const { data, error } = await client.from('products').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return data as Product;
  }
};

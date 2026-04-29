// Local offline cache + outbox using Dexie (IndexedDB).
import Dexie, { type Table } from "dexie";

export interface CachedProduct {
  code: string;
  product_name: string;
  quantity: number;
  units_per_quantity: number;
  total_units: number;
  total_purchase_cost: number;
  selling_price_per_unit: number;
  created_at: string;
}

export interface CachedSale {
  id: string;
  code: string;
  units_sold: number;
  type: "normal" | "donated" | "spoilt";
  total_amount: number;
  created_at: string;
}

export interface CachedSettings {
  id: number;
  low_stock_threshold: number;
  email: string | null;
  updated_at: string;
}

export interface OutboxItem {
  id?: number;
  kind: "add_product" | "add_sale" | "save_settings";
  payload: any;
  created_at: string;
}

class SalesDB extends Dexie {
  products!: Table<CachedProduct, string>;
  sales!: Table<CachedSale, string>;
  settings!: Table<CachedSettings, number>;
  outbox!: Table<OutboxItem, number>;

  constructor() {
    super("smart_sales_manager");
    this.version(1).stores({
      products: "code, product_name, created_at",
      sales: "id, code, type, created_at",
      settings: "id",
      outbox: "++id, kind, created_at",
    });
  }
}

export const db = typeof indexedDB !== "undefined" ? new SalesDB() : (null as unknown as SalesDB);

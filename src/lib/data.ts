// Data layer that combines Supabase (cloud) with offline IndexedDB cache + outbox.
import { supabase } from "@/integrations/supabase/client";
import { db, type CachedProduct, type CachedSale, type CachedSettings } from "@/lib/offline-db";
import type { SaleType } from "@/lib/utils-sales";

export interface ProductWithStock extends CachedProduct {
  remaining_units: number;
  units_sold_total: number;
}

export function isOnline() {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}

// ---------- Sync from cloud ----------
export async function syncFromCloud() {
  if (!isOnline() || !db) return;
  const [{ data: prods }, { data: sls }, { data: stg }] = await Promise.all([
    supabase.from("products").select("*"),
    supabase.from("sales").select("*"),
    supabase.from("settings").select("*").eq("id", 1).maybeSingle(),
  ]);
  if (prods) {
    await db.products.clear();
    await db.products.bulkPut(prods as CachedProduct[]);
  }
  if (sls) {
    await db.sales.clear();
    await db.sales.bulkPut(sls as CachedSale[]);
  }
  if (stg) {
    await db.settings.put(stg as CachedSettings);
  }
}

// ---------- Outbox flush ----------
export async function flushOutbox() {
  if (!isOnline() || !db) return;
  const items = await db.outbox.orderBy("id").toArray();
  for (const item of items) {
    try {
      if (item.kind === "add_product") {
        const { error } = await supabase.from("products").insert(item.payload);
        if (error && !error.message.includes("duplicate")) throw error;
      } else if (item.kind === "add_sale") {
        const { error } = await supabase.from("sales").insert(item.payload);
        if (error) throw error;
      } else if (item.kind === "save_settings") {
        const { error } = await supabase.from("settings").upsert({ id: 1, ...item.payload });
        if (error) throw error;
      }
      await db.outbox.delete(item.id!);
    } catch (e) {
      console.error("Outbox item failed, will retry:", e);
      break;
    }
  }
  await syncFromCloud();
}

// ---------- Reads (offline-first) ----------
export async function getProducts(): Promise<ProductWithStock[]> {
  if (!db) return [];
  const [products, sales] = await Promise.all([
    db.products.orderBy("created_at").reverse().toArray(),
    db.sales.toArray(),
  ]);
  const soldByCode = new Map<string, number>();
  for (const s of sales) {
    soldByCode.set(s.code, (soldByCode.get(s.code) || 0) + Number(s.units_sold));
  }
  return products.map((p) => {
    const sold = soldByCode.get(p.code) || 0;
    return {
      ...p,
      units_sold_total: sold,
      remaining_units: Number(p.total_units) - sold,
    };
  });
}

export async function getProductWithStock(code: string): Promise<ProductWithStock | null> {
  const all = await getProducts();
  return all.find((p) => p.code === code) ?? null;
}

export async function getSettings(): Promise<CachedSettings> {
  if (!db) return { id: 1, low_stock_threshold: 10, email: null, updated_at: new Date().toISOString() };
  const s = await db.settings.get(1);
  return s ?? { id: 1, low_stock_threshold: 10, email: null, updated_at: new Date().toISOString() };
}

export async function getTodaySales(): Promise<CachedSale[]> {
  if (!db) return [];
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const all = await db.sales.toArray();
  return all.filter((s) => new Date(s.created_at) >= startOfDay);
}

export async function getSalesForDate(date: Date): Promise<CachedSale[]> {
  if (!db) return [];
  const start = new Date(date); start.setHours(0,0,0,0);
  const end = new Date(date); end.setHours(23,59,59,999);
  const all = await db.sales.toArray();
  return all.filter((s) => {
    const t = new Date(s.created_at);
    return t >= start && t <= end;
  });
}

// ---------- Writes ----------
export async function addProduct(input: {
  code: string;
  product_name: string;
  quantity: number;
  units_per_quantity: number;
  total_purchase_cost: number;
  selling_price_per_unit: number;
}) {
  const code = input.code.toUpperCase();
  // Duplicate check (local)
  if (db) {
    const existing = await db.products.get(code);
    if (existing) throw new Error(`Code ${code} already exists`);
  }
  const total_units = input.quantity * input.units_per_quantity;
  const created_at = new Date().toISOString();
  const row: CachedProduct = { ...input, code, total_units, created_at };

  if (isOnline()) {
    const { error } = await supabase.from("products").insert({
      code,
      product_name: input.product_name,
      quantity: input.quantity,
      units_per_quantity: input.units_per_quantity,
      total_purchase_cost: input.total_purchase_cost,
      selling_price_per_unit: input.selling_price_per_unit,
    });
    if (error) throw error;
  } else if (db) {
    await db.outbox.add({
      kind: "add_product",
      payload: {
        code,
        product_name: input.product_name,
        quantity: input.quantity,
        units_per_quantity: input.units_per_quantity,
        total_purchase_cost: input.total_purchase_cost,
        selling_price_per_unit: input.selling_price_per_unit,
      },
      created_at,
    });
  }
  if (db) await db.products.put(row);
}

export async function addSale(input: { code: string; units_sold: number; type: SaleType }) {
  const product = await getProductWithStock(input.code);
  if (!product) throw new Error(`Unknown product: ${input.code}`);
  if (product.remaining_units <= 0) throw new Error(`${input.code} is out of stock`);
  if (input.units_sold > product.remaining_units)
    throw new Error(`Only ${product.remaining_units} units remaining`);

  const total_amount = input.type === "normal" ? input.units_sold * product.selling_price_per_unit : 0;
  const id = crypto.randomUUID();
  const created_at = new Date().toISOString();
  const row: CachedSale = { id, code: input.code, units_sold: input.units_sold, type: input.type, total_amount, created_at };

  if (isOnline()) {
    const { error } = await supabase.from("sales").insert({
      code: input.code,
      units_sold: input.units_sold,
      type: input.type,
    });
    if (error) throw error;
    // Re-sync sales so we get the server-generated id and exact total_amount
    await syncFromCloud();
    return;
  } else if (db) {
    await db.outbox.add({
      kind: "add_sale",
      payload: { code: input.code, units_sold: input.units_sold, type: input.type },
      created_at,
    });
  }
  if (db) await db.sales.put(row);
}

export async function saveSettings(input: { low_stock_threshold: number; email: string | null }) {
  const updated_at = new Date().toISOString();
  if (isOnline()) {
    const { error } = await supabase
      .from("settings")
      .upsert({ id: 1, low_stock_threshold: input.low_stock_threshold, email: input.email });
    if (error) throw error;
  } else if (db) {
    await db.outbox.add({ kind: "save_settings", payload: input, created_at: updated_at });
  }
  if (db) await db.settings.put({ id: 1, ...input, updated_at });
}

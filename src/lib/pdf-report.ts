import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { CachedSale } from "@/lib/offline-db";
import type { ProductWithStock } from "@/lib/data";
import { formatKsh } from "@/lib/utils-sales";

export function buildDailyReport(date: Date, sales: CachedSale[], products: ProductWithStock[]): jsPDF {
  const doc = new jsPDF();
  const productMap = new Map(products.map((p) => [p.code, p]));

  const totalSales = sales.filter((s) => s.type === "normal").reduce((sum, s) => sum + Number(s.total_amount), 0);
  const totalUnits = sales.filter((s) => s.type === "normal").reduce((sum, s) => sum + Number(s.units_sold), 0);
  const totalDonated = sales.filter((s) => s.type === "donated").reduce((sum, s) => sum + Number(s.units_sold), 0);
  const totalSpoilt = sales.filter((s) => s.type === "spoilt").reduce((sum, s) => sum + Number(s.units_sold), 0);

  doc.setFontSize(18);
  doc.text("Smart Sales Manager", 14, 18);
  doc.setFontSize(12);
  doc.setTextColor(100);
  doc.text("Daily Sales Report", 14, 26);
  doc.setFontSize(10);
  doc.text(`Date: ${date.toLocaleDateString("en-KE", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}`, 14, 33);

  doc.setFontSize(11);
  doc.setTextColor(20);
  doc.text(`Total Sales: ${formatKsh(totalSales)}`, 14, 45);
  doc.text(`Total Units Sold: ${totalUnits}`, 14, 52);
  doc.text(`Donated Units: ${totalDonated}`, 14, 59);
  doc.text(`Spoilt Units: ${totalSpoilt}`, 14, 66);

  autoTable(doc, {
    startY: 75,
    head: [["Code", "Product", "Units", "Type", "Amount"]],
    body: sales.map((s) => [
      s.code,
      productMap.get(s.code)?.product_name ?? "-",
      String(s.units_sold),
      s.type,
      formatKsh(Number(s.total_amount)),
    ]),
    headStyles: { fillColor: [60, 90, 200] },
    styles: { fontSize: 9 },
  });

  return doc;
}

export function buildMonthlyReport(year: number, month: number, sales: CachedSale[], products: ProductWithStock[]): jsPDF {
  const doc = new jsPDF();
  const productMap = new Map(products.map((p) => [p.code, p]));
  const monthName = new Date(year, month, 1).toLocaleString("en-KE", { month: "long", year: "numeric" });

  const totalSales = sales.filter((s) => s.type === "normal").reduce((sum, s) => sum + Number(s.total_amount), 0);
  const totalUnits = sales.filter((s) => s.type === "normal").reduce((sum, s) => sum + Number(s.units_sold), 0);
  const totalDonated = sales.filter((s) => s.type === "donated").reduce((sum, s) => sum + Number(s.units_sold), 0);
  const totalSpoilt = sales.filter((s) => s.type === "spoilt").reduce((sum, s) => sum + Number(s.units_sold), 0);

  doc.setFontSize(18);
  doc.text("Smart Sales Manager", 14, 18);
  doc.setFontSize(12);
  doc.setTextColor(100);
  doc.text("Monthly Sales Report", 14, 26);
  doc.setFontSize(10);
  doc.text(`Period: ${monthName}`, 14, 33);

  doc.setFontSize(11);
  doc.setTextColor(20);
  doc.text(`Total Sales: ${formatKsh(totalSales)}`, 14, 45);
  doc.text(`Total Units Sold: ${totalUnits}`, 14, 52);
  doc.text(`Donated Units: ${totalDonated}`, 14, 59);
  doc.text(`Spoilt Units: ${totalSpoilt}`, 14, 66);

  // Daily breakdown
  const daily = new Map<string, { sales: number; units: number; donated: number; spoilt: number; txns: number }>();
  for (const s of sales) {
    const d = new Date(s.created_at);
    const key = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
    const cur = daily.get(key) ?? { sales: 0, units: 0, donated: 0, spoilt: 0, txns: 0 };
    cur.txns += 1;
    if (s.type === "normal") { cur.sales += Number(s.total_amount); cur.units += Number(s.units_sold); }
    else if (s.type === "donated") cur.donated += Number(s.units_sold);
    else if (s.type === "spoilt") cur.spoilt += Number(s.units_sold);
    daily.set(key, cur);
  }
  const dailyRows = Array.from(daily.entries())
    .sort((a, b) => {
      const [da, ma, ya] = a[0].split("/").map(Number);
      const [db_, mb, yb] = b[0].split("/").map(Number);
      return new Date(ya, ma - 1, da).getTime() - new Date(yb, mb - 1, db_).getTime();
    })
    .map(([date, v]) => [date, String(v.txns), String(v.units), String(v.donated), String(v.spoilt), formatKsh(v.sales)]);

  autoTable(doc, {
    startY: 75,
    head: [["Date", "Txns", "Units", "Donated", "Spoilt", "Sales"]],
    body: dailyRows,
    headStyles: { fillColor: [60, 90, 200] },
    styles: { fontSize: 9 },
  });

  // Top products
  const byProduct = new Map<string, { units: number; sales: number }>();
  for (const s of sales) {
    if (s.type !== "normal") continue;
    const cur = byProduct.get(s.code) ?? { units: 0, sales: 0 };
    cur.units += Number(s.units_sold);
    cur.sales += Number(s.total_amount);
    byProduct.set(s.code, cur);
  }
  const topRows = Array.from(byProduct.entries())
    .sort((a, b) => b[1].sales - a[1].sales)
    .slice(0, 20)
    .map(([code, v]) => [code, productMap.get(code)?.product_name ?? "-", String(v.units), formatKsh(v.sales)]);

  if (topRows.length) {
    autoTable(doc, {
      head: [["Code", "Product", "Units Sold", "Revenue"]],
      body: topRows,
      headStyles: { fillColor: [60, 90, 200] },
      styles: { fontSize: 9 },
    });
  }

  return doc;
}

export function downloadPdf(doc: jsPDF, filename: string) {
  doc.save(filename);
}

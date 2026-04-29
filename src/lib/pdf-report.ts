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

export function downloadPdf(doc: jsPDF, filename: string) {
  doc.save(filename);
}

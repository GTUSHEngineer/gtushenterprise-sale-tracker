import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getProducts, getSalesForDate, getSettings } from "@/lib/data";
import { buildDailyReport, downloadPdf } from "@/lib/pdf-report";
import { formatKsh } from "@/lib/utils-sales";
import { Download, Mail, FileText } from "lucide-react";
import { toast } from "sonner";
import type { CachedSale } from "@/lib/offline-db";
import type { ProductWithStock } from "@/lib/data";

export const Route = createFileRoute("/reports")({
  head: () => ({
    meta: [
      { title: "Reports — Smart Sales Manager" },
      { name: "description", content: "Download daily PDF sales reports and email them automatically." },
    ],
  }),
  component: Reports,
});

function Reports() {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [sales, setSales] = useState<CachedSale[]>([]);
  const [products, setProducts] = useState<ProductWithStock[]>([]);
  const [email, setEmail] = useState("");

  useEffect(() => {
    (async () => {
      const [s, p, st] = await Promise.all([getSalesForDate(new Date(date)), getProducts(), getSettings()]);
      setSales(s);
      setProducts(p);
      setEmail(st.email || "");
    })();
  }, [date]);

  const totals = {
    sales: sales.filter((s) => s.type === "normal").reduce((a, b) => a + Number(b.total_amount), 0),
    units: sales.filter((s) => s.type === "normal").reduce((a, b) => a + Number(b.units_sold), 0),
    donated: sales.filter((s) => s.type === "donated").reduce((a, b) => a + Number(b.units_sold), 0),
    spoilt: sales.filter((s) => s.type === "spoilt").reduce((a, b) => a + Number(b.units_sold), 0),
  };

  const productMap = new Map(products.map((p) => [p.code, p]));

  const downloadReport = () => {
    const doc = buildDailyReport(new Date(date), sales, products);
    downloadPdf(doc, `sales-report-${date}.pdf`);
    toast.success("Report downloaded");
  };

  const sendReport = () => {
    if (!email) {
      toast.error("Set an email address in Settings first");
      return;
    }
    const doc = buildDailyReport(new Date(date), sales, products);
    const dataUri = doc.output("datauristring");
    const subject = encodeURIComponent(`Sales Report — ${date}`);
    const body = encodeURIComponent(
      `Sales Report for ${date}\n\nTotal Sales: ${formatKsh(totals.sales)}\nUnits Sold: ${totals.units}\nDonated: ${totals.donated}\nSpoilt: ${totals.spoilt}\n\n(PDF was downloaded — attach it to this email.)`,
    );
    downloadPdf(doc, `sales-report-${date}.pdf`);
    window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;
    void dataUri;
  };

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Reports</h1>
        <p className="text-muted-foreground text-sm">Daily sales summary, downloadable as PDF.</p>
      </div>

      <Card className="p-5 border-0 shadow-[var(--shadow-card)]">
        <div className="flex flex-col md:flex-row md:items-end gap-3 md:gap-4 mb-5">
          <div className="flex-1">
            <Label htmlFor="date">Report Date</Label>
            <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1" />
          </div>
          <Button onClick={downloadReport} className="gap-2">
            <Download className="h-4 w-4" /> Download PDF
          </Button>
          <Button onClick={sendReport} variant="outline" className="gap-2">
            <Mail className="h-4 w-4" /> Send Now
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label="Total Sales" value={formatKsh(totals.sales)} />
          <Stat label="Units Sold" value={String(totals.units)} />
          <Stat label="Donated" value={String(totals.donated)} />
          <Stat label="Spoilt" value={String(totals.spoilt)} />
        </div>
      </Card>

      <Card className="border-0 shadow-[var(--shadow-card)]">
        <div className="p-5 border-b">
          <h2 className="font-semibold flex items-center gap-2">
            <FileText className="h-4 w-4" /> Transactions ({sales.length})
          </h2>
        </div>
        {sales.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">No sales for this date.</div>
        ) : (
          <div className="divide-y">
            {sales.map((s) => (
              <div key={s.id} className="p-4 flex items-center gap-3">
                <span className="font-mono text-xs px-2 py-0.5 bg-secondary rounded">{s.code}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{productMap.get(s.code)?.product_name ?? "—"}</div>
                  <div className="text-xs text-muted-foreground">
                    {s.units_sold} units · {s.type}
                  </div>
                </div>
                <div className="text-sm font-semibold">{formatKsh(Number(s.total_amount))}</div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-secondary p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-base md:text-lg font-bold mt-0.5">{value}</div>
    </div>
  );
}

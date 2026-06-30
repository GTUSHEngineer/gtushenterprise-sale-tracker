import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { getProducts, getSalesForDate, getSalesForMonth, getSettings } from "@/lib/data";
import { buildDailyReport, buildMonthlyReport, downloadPdf } from "@/lib/pdf-report";
import { formatKsh } from "@/lib/utils-sales";
import { Download, Mail, FileText, CalendarRange } from "lucide-react";
import { toast } from "sonner";
import type { CachedSale } from "@/lib/offline-db";
import type { ProductWithStock } from "@/lib/data";

export const Route = createFileRoute("/reports")({
  head: () => ({
    meta: [
      { title: "Reports — Smart Sales Manager" },
      { name: "description", content: "Download daily and monthly PDF sales reports." },
    ],
  }),
  component: Reports,
});

function Reports() {
  const [products, setProducts] = useState<ProductWithStock[]>([]);
  const [email, setEmail] = useState("");

  useEffect(() => {
    (async () => {
      const [p, st] = await Promise.all([getProducts(), getSettings()]);
      setProducts(p);
      setEmail(st.email || "");
    })();
  }, []);

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Reports</h1>
        <p className="text-muted-foreground text-sm">Daily & monthly sales summaries, downloadable as PDF.</p>
      </div>

      <Tabs defaultValue="daily" className="space-y-4">
        <TabsList className="grid grid-cols-2 w-full max-w-sm">
          <TabsTrigger value="daily">Daily</TabsTrigger>
          <TabsTrigger value="monthly">Monthly</TabsTrigger>
        </TabsList>

        <TabsContent value="daily">
          <DailyView products={products} email={email} />
        </TabsContent>
        <TabsContent value="monthly">
          <MonthlyView products={products} email={email} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function DailyView({ products, email }: { products: ProductWithStock[]; email: string }) {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [sales, setSales] = useState<CachedSale[]>([]);

  useEffect(() => {
    getSalesForDate(new Date(date)).then(setSales);
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
    toast.success("Daily report downloaded");
  };

  const sendReport = () => {
    if (!email) { toast.error("Set an email address in Settings first"); return; }
    const doc = buildDailyReport(new Date(date), sales, products);
    const subject = encodeURIComponent(`Sales Report — ${date}`);
    const body = encodeURIComponent(`Sales Report for ${date}\n\nTotal Sales: ${formatKsh(totals.sales)}\nUnits Sold: ${totals.units}\nDonated: ${totals.donated}\nSpoilt: ${totals.spoilt}\n\n(PDF was downloaded — attach it to this email.)`);
    downloadPdf(doc, `sales-report-${date}.pdf`);
    window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;
  };

  return (
    <div className="space-y-6">
      <Card className="p-5 border-0 shadow-[var(--shadow-card)]">
        <div className="flex flex-col md:flex-row md:items-end gap-3 md:gap-4 mb-5">
          <div className="flex-1">
            <Label htmlFor="date">Report Date</Label>
            <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1" />
          </div>
          <Button onClick={downloadReport} className="gap-2"><Download className="h-4 w-4" /> Download PDF</Button>
          <Button onClick={sendReport} variant="outline" className="gap-2"><Mail className="h-4 w-4" /> Send</Button>
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
          <h2 className="font-semibold flex items-center gap-2"><FileText className="h-4 w-4" /> Transactions ({sales.length})</h2>
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
                  <div className="text-xs text-muted-foreground">{s.units_sold} units · {s.type}</div>
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

function MonthlyView({ products, email }: { products: ProductWithStock[]; email: string }) {
  const now = new Date();
  const [month, setMonth] = useState(() => `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
  const [sales, setSales] = useState<CachedSale[]>([]);

  const [yearStr, monthStr] = month.split("-");
  const year = Number(yearStr);
  const monthIdx = Number(monthStr) - 1;

  useEffect(() => {
    getSalesForMonth(year, monthIdx).then(setSales);
  }, [year, monthIdx]);

  const totals = {
    sales: sales.filter((s) => s.type === "normal").reduce((a, b) => a + Number(b.total_amount), 0),
    units: sales.filter((s) => s.type === "normal").reduce((a, b) => a + Number(b.units_sold), 0),
    donated: sales.filter((s) => s.type === "donated").reduce((a, b) => a + Number(b.units_sold), 0),
    spoilt: sales.filter((s) => s.type === "spoilt").reduce((a, b) => a + Number(b.units_sold), 0),
  };

  // Daily breakdown for in-app preview
  const dailyMap = new Map<string, { sales: number; units: number; txns: number }>();
  for (const s of sales) {
    const d = new Date(s.created_at);
    const key = d.toISOString().slice(0, 10);
    const cur = dailyMap.get(key) ?? { sales: 0, units: 0, txns: 0 };
    cur.txns += 1;
    if (s.type === "normal") { cur.sales += Number(s.total_amount); cur.units += Number(s.units_sold); }
    dailyMap.set(key, cur);
  }
  const dailyRows = Array.from(dailyMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));

  const monthName = new Date(year, monthIdx, 1).toLocaleString("en-KE", { month: "long", year: "numeric" });

  const downloadReport = () => {
    const doc = buildMonthlyReport(year, monthIdx, sales, products);
    downloadPdf(doc, `sales-report-${month}.pdf`);
    toast.success("Monthly report downloaded");
  };

  const sendReport = () => {
    if (!email) { toast.error("Set an email address in Settings first"); return; }
    const doc = buildMonthlyReport(year, monthIdx, sales, products);
    const subject = encodeURIComponent(`Monthly Sales Report — ${monthName}`);
    const body = encodeURIComponent(`Monthly Sales Report for ${monthName}\n\nTotal Sales: ${formatKsh(totals.sales)}\nUnits Sold: ${totals.units}\nDonated: ${totals.donated}\nSpoilt: ${totals.spoilt}\n\n(PDF was downloaded — attach it to this email.)`);
    downloadPdf(doc, `sales-report-${month}.pdf`);
    window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;
  };

  return (
    <div className="space-y-6">
      <Card className="p-5 border-0 shadow-[var(--shadow-card)]">
        <div className="flex flex-col md:flex-row md:items-end gap-3 md:gap-4 mb-5">
          <div className="flex-1">
            <Label htmlFor="month">Report Month</Label>
            <Input id="month" type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="mt-1" />
          </div>
          <Button onClick={downloadReport} className="gap-2"><Download className="h-4 w-4" /> Download PDF</Button>
          <Button onClick={sendReport} variant="outline" className="gap-2"><Mail className="h-4 w-4" /> Send</Button>
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
          <h2 className="font-semibold flex items-center gap-2"><CalendarRange className="h-4 w-4" /> Daily Breakdown — {monthName}</h2>
        </div>
        {dailyRows.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">No sales for this month.</div>
        ) : (
          <div className="divide-y">
            {dailyRows.map(([day, v]) => (
              <div key={day} className="p-4 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{new Date(day).toLocaleDateString("en-KE", { weekday: "short", day: "numeric", month: "short" })}</div>
                  <div className="text-xs text-muted-foreground">{v.txns} txns · {v.units} units</div>
                </div>
                <div className="text-sm font-semibold">{formatKsh(v.sales)}</div>
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

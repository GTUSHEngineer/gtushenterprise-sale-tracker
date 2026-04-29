import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { TrendingUp, ShoppingCart, AlertTriangle, PackageX } from "lucide-react";
import { getProducts, getTodaySales, getSettings, type ProductWithStock } from "@/lib/data";
import { formatKsh } from "@/lib/utils-sales";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — Smart Sales Manager" },
      { name: "description", content: "Today's sales, units sold, and low-stock alerts at a glance." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const [products, setProducts] = useState<ProductWithStock[]>([]);
  const [todaySalesTotal, setTodaySalesTotal] = useState(0);
  const [todayUnits, setTodayUnits] = useState(0);
  const [threshold, setThreshold] = useState(10);

  useEffect(() => {
    (async () => {
      const [p, sales, s] = await Promise.all([getProducts(), getTodaySales(), getSettings()]);
      setProducts(p);
      setThreshold(Number(s.low_stock_threshold));
      const normal = sales.filter((x) => x.type === "normal");
      setTodaySalesTotal(normal.reduce((a, b) => a + Number(b.total_amount), 0));
      setTodayUnits(normal.reduce((a, b) => a + Number(b.units_sold), 0));
    })();
  }, []);

  const lowStock = products.filter((p) => p.remaining_units > 0 && p.remaining_units <= threshold);
  const outOfStock = products.filter((p) => p.remaining_units <= 0);

  const stats = [
    { label: "Today's Sales", value: formatKsh(todaySalesTotal), icon: TrendingUp, color: "from-[oklch(0.55_0.18_250)] to-[oklch(0.65_0.18_220)]" },
    { label: "Units Sold Today", value: String(todayUnits), icon: ShoppingCart, color: "from-[oklch(0.72_0.18_160)] to-[oklch(0.65_0.18_180)]" },
    { label: "Low Stock", value: String(lowStock.length), icon: AlertTriangle, color: "from-[oklch(0.78_0.16_80)] to-[oklch(0.72_0.18_60)]" },
    { label: "Out of Stock", value: String(outOfStock.length), icon: PackageX, color: "from-[oklch(0.6_0.22_25)] to-[oklch(0.6_0.22_10)]" },
  ];

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground text-sm">Overview for {new Date().toLocaleDateString("en-KE", { weekday: "long", month: "long", day: "numeric" })}</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        {stats.map((s) => (
          <Card key={s.label} className="p-4 shadow-[var(--shadow-card)] border-0">
            <div className={`h-10 w-10 rounded-xl bg-gradient-to-br ${s.color} flex items-center justify-center mb-3`}>
              <s.icon className="h-5 w-5 text-white" />
            </div>
            <div className="text-xs text-muted-foreground">{s.label}</div>
            <div className="text-lg md:text-2xl font-bold mt-0.5">{s.value}</div>
          </Card>
        ))}
      </div>

      {(outOfStock.length > 0 || lowStock.length > 0) && (
        <Card className="p-5 border-0 shadow-[var(--shadow-card)]">
          <h2 className="font-semibold mb-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-[oklch(0.78_0.16_80)]" /> Stock Alerts
          </h2>
          <div className="space-y-2">
            {outOfStock.map((p) => (
              <div key={p.code} className="flex items-center justify-between p-3 rounded-lg bg-destructive/10">
                <div>
                  <div className="font-medium text-sm">{p.product_name}</div>
                  <div className="text-xs text-muted-foreground">{p.code}</div>
                </div>
                <span className="text-xs font-semibold text-destructive">OUT OF STOCK</span>
              </div>
            ))}
            {lowStock.map((p) => (
              <div key={p.code} className="flex items-center justify-between p-3 rounded-lg bg-[oklch(0.78_0.16_80/0.15)]">
                <div>
                  <div className="font-medium text-sm">{p.product_name}</div>
                  <div className="text-xs text-muted-foreground">{p.code}</div>
                </div>
                <span className="text-xs font-semibold text-[oklch(0.55_0.16_80)]">{p.remaining_units} left</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Link to="/record-sale" className="block">
          <Card className="p-5 border-0 shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-elevated)] transition-shadow cursor-pointer">
            <ShoppingCart className="h-6 w-6 text-primary mb-2" />
            <div className="font-semibold">Record Sale</div>
            <div className="text-xs text-muted-foreground mt-0.5">Quick entry by code</div>
          </Card>
        </Link>
        <Link to="/add-stock" className="block">
          <Card className="p-5 border-0 shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-elevated)] transition-shadow cursor-pointer">
            <TrendingUp className="h-6 w-6 text-[oklch(0.65_0.18_150)] mb-2" />
            <div className="font-semibold">Add Stock</div>
            <div className="text-xs text-muted-foreground mt-0.5">Register a new batch</div>
          </Card>
        </Link>
      </div>
    </div>
  );
}

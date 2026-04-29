import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { getProducts, getSettings, type ProductWithStock } from "@/lib/data";
import { Search, Package } from "lucide-react";

export const Route = createFileRoute("/inventory")({
  head: () => ({
    meta: [
      { title: "Inventory — Smart Sales Manager" },
      { name: "description", content: "Browse all stock batches with remaining units and stock alerts." },
    ],
  }),
  component: Inventory,
});

function Inventory() {
  const [items, setItems] = useState<ProductWithStock[]>([]);
  const [threshold, setThreshold] = useState(10);
  const [q, setQ] = useState("");

  useEffect(() => {
    (async () => {
      setItems(await getProducts());
      setThreshold(Number((await getSettings()).low_stock_threshold));
    })();
  }, []);

  const filtered = items.filter(
    (p) => p.code.toLowerCase().includes(q.toLowerCase()) || p.product_name.toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <div className="flex items-end justify-between mb-4 gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Inventory</h1>
          <p className="text-muted-foreground text-sm">{items.length} batches</p>
        </div>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by code or name" className="pl-9" />
      </div>

      {filtered.length === 0 ? (
        <Card className="p-10 text-center border-0 shadow-[var(--shadow-card)]">
          <Package className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">No products yet. Add your first stock batch.</p>
        </Card>
      ) : (
        <div className="grid gap-2">
          {filtered.map((p) => {
            const out = p.remaining_units <= 0;
            const low = !out && p.remaining_units <= threshold;
            return (
              <Card
                key={p.code}
                className={`p-4 border-0 shadow-[var(--shadow-card)] ${
                  out ? "bg-destructive/5" : low ? "bg-[oklch(0.78_0.16_80/0.08)]" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs px-2 py-0.5 bg-secondary rounded">{p.code}</span>
                      {out && <Badge variant="destructive" className="text-[10px]">OUT</Badge>}
                      {low && <Badge className="text-[10px] bg-[oklch(0.78_0.16_80)] text-white">LOW</Badge>}
                    </div>
                    <div className="font-semibold mt-1 truncate">{p.product_name}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {p.quantity} × {p.units_per_quantity} = {p.total_units} units total
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground">Remaining</div>
                    <div className={`text-xl font-bold ${out ? "text-destructive" : low ? "text-[oklch(0.55_0.16_80)]" : ""}`}>
                      {p.remaining_units}
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

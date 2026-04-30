import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { addSale, getProducts, type ProductWithStock } from "@/lib/data";
import { formatKsh, type SaleType } from "@/lib/utils-sales";
import { toast } from "sonner";

export const Route = createFileRoute("/record-sale")({
  head: () => ({
    meta: [
      { title: "Record Sale — Smart Sales Manager" },
      { name: "description", content: "Quickly record a sale by searching for a product." },
    ],
  }),
  component: RecordSale,
});

const typeOptions: { value: SaleType; label: string; color: string }[] = [
  { value: "normal", label: "Normal Sale", color: "bg-primary text-primary-foreground" },
  { value: "donated", label: "Donated", color: "bg-[oklch(0.72_0.18_160)] text-white" },
  { value: "spoilt", label: "Spoilt", color: "bg-destructive text-destructive-foreground" },
];

function RecordSale() {
  const [products, setProducts] = useState<ProductWithStock[]>([]);
  const [query, setQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [selected, setSelected] = useState<ProductWithStock | null>(null);
  const [units, setUnits] = useState("");
  const [type, setType] = useState<SaleType>("normal");
  const [saving, setSaving] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getProducts().then(setProducts);
  }, []);

  // Close suggestions on outside click
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products.slice(0, 8);
    return products
      .filter(
        (p) =>
          p.product_name.toLowerCase().includes(q) ||
          p.code.toLowerCase().includes(q),
      )
      .slice(0, 8);
  }, [query, products]);

  const refreshSelected = async (code: string) => {
    const all = await getProducts();
    setProducts(all);
    const fresh = all.find((p) => p.code === code) ?? null;
    setSelected(fresh);
  };

  const pick = (p: ProductWithStock) => {
    setSelected(p);
    setQuery(p.product_name);
    setShowSuggestions(false);
  };

  const total = selected && type === "normal" ? Number(units || 0) * selected.selling_price_per_unit : 0;
  const outOfStock = selected ? selected.remaining_units <= 0 : false;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return toast.error("Please select a product");
    const u = Number(units);
    if (!u || u <= 0) return toast.error("Units must be > 0");
    if (u > selected.remaining_units) return toast.error(`Only ${selected.remaining_units} units remaining`);
    setSaving(true);
    try {
      await addSale({ code: selected.code, units_sold: u, type });
      toast.success(`${type === "normal" ? "Sale" : type} recorded — ${u} units of ${selected.product_name}`);
      setQuery("");
      setUnits("");
      setSelected(null);
      setType("normal");
      await refreshSelected("");
      getProducts().then(setProducts);
    } catch (err: any) {
      toast.error(err.message || "Failed to record sale");
    } finally {
      setSaving(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      pick(suggestions[highlight]);
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl md:text-3xl font-bold mb-1">Record Sale</h1>
      <p className="text-muted-foreground text-sm mb-6">
        Search a product by name, choose the sale type, then enter units sold.
      </p>

      <Card className="p-5 md:p-6 border-0 shadow-[var(--shadow-card)]">
        <form onSubmit={submit} className="space-y-4">
          <div ref={wrapRef} className="relative">
            <Label htmlFor="product">Product</Label>
            <Input
              id="product"
              autoFocus
              autoComplete="off"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSelected(null);
                setShowSuggestions(true);
                setHighlight(0);
              }}
              onFocus={() => setShowSuggestions(true)}
              onKeyDown={onKeyDown}
              placeholder="Start typing a product name…"
              className="mt-1 text-lg"
            />
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute z-20 mt-1 w-full rounded-md border bg-popover shadow-lg max-h-72 overflow-y-auto">
                {suggestions.map((p, i) => (
                  <button
                    type="button"
                    key={p.code}
                    onMouseEnter={() => setHighlight(i)}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      pick(p);
                    }}
                    className={`w-full text-left px-3 py-2 flex items-center justify-between gap-3 ${
                      i === highlight ? "bg-accent text-accent-foreground" : ""
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="font-medium truncate">{p.product_name}</div>
                      <div className="text-xs text-muted-foreground font-mono">{p.code}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xs text-muted-foreground">{formatKsh(p.selling_price_per_unit)}/u</div>
                      <div className={`text-xs ${p.remaining_units <= 0 ? "text-destructive" : "text-muted-foreground"}`}>
                        {p.remaining_units} left
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
            {showSuggestions && query && suggestions.length === 0 && (
              <div className="absolute z-20 mt-1 w-full rounded-md border bg-popover shadow-lg p-3 text-sm text-muted-foreground">
                No matching products
              </div>
            )}
          </div>

          {selected && (
            <div className="rounded-lg border p-4 bg-secondary/40 space-y-2">
              <div className="flex items-center justify-between">
                <div className="font-semibold">{selected.product_name}</div>
                <Badge variant="outline" className="font-mono">{selected.code}</Badge>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <div className="text-xs text-muted-foreground">Price / unit</div>
                  <div className="font-medium">{formatKsh(selected.selling_price_per_unit)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Remaining</div>
                  <div className={`font-medium ${outOfStock ? "text-destructive" : ""}`}>
                    {selected.remaining_units} units
                  </div>
                </div>
              </div>
            </div>
          )}

          <div>
            <Label>Sale Type</Label>
            <div className="grid grid-cols-3 gap-2 mt-1">
              {typeOptions.map((opt) => (
                <button
                  type="button"
                  key={opt.value}
                  onClick={() => setType(opt.value)}
                  className={`rounded-md border px-3 py-2 text-sm font-medium transition ${
                    type === opt.value
                      ? `${opt.color} border-transparent`
                      : "bg-background hover:bg-accent"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label htmlFor="units">Units Sold</Label>
            <Input
              id="units"
              type="number"
              inputMode="numeric"
              value={units}
              onChange={(e) => setUnits(e.target.value)}
              placeholder="1"
              className="mt-1 text-lg"
              disabled={!selected || outOfStock}
            />
          </div>

          {type === "normal" && total > 0 && (
            <div className="rounded-lg bg-[var(--gradient-primary)] p-4 text-primary-foreground">
              <div className="text-xs opacity-80">Total Amount</div>
              <div className="text-2xl font-bold">{formatKsh(total)}</div>
            </div>
          )}

          <Button type="submit" className="w-full" size="lg" disabled={saving || !selected || outOfStock || !units}>
            {saving ? "Recording…" : outOfStock ? "Out of Stock" : "Record Sale"}
          </Button>
        </form>
      </Card>
    </div>
  );
}

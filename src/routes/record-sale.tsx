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
import { Trash2, Plus } from "lucide-react";

export const Route = createFileRoute("/record-sale")({
  head: () => ({
    meta: [
      { title: "Record Sale — Smart Sales Manager" },
      { name: "description", content: "Add multiple items and record the sale at once." },
    ],
  }),
  component: RecordSale,
});

interface CartItem {
  id: string;
  code: string;
  product_name: string;
  units: number;
  type: SaleType;
  price_per_unit: number;
  line_total: number;
}

const typeOptions: { value: SaleType; label: string; color: string }[] = [
  { value: "normal", label: "Normal", color: "bg-primary text-primary-foreground" },
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
  const [cart, setCart] = useState<CartItem[]>([]);
  const [saving, setSaving] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getProducts().then(setProducts);
  }, []);

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

  // Compute remaining stock factoring in cart entries already queued
  const remainingFor = (code: string, base: number) => {
    const queued = cart
      .filter((c) => c.code === code)
      .reduce((s, c) => s + c.units, 0);
    return base - queued;
  };

  const pick = (p: ProductWithStock) => {
    setSelected(p);
    setQuery(p.product_name);
    setShowSuggestions(false);
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

  const addToCart = () => {
    if (!selected) return toast.error("Please select a product");
    const u = Number(units);
    if (!u || u <= 0) return toast.error("Units must be > 0");
    const remaining = remainingFor(selected.code, selected.remaining_units);
    if (u > remaining) return toast.error(`Only ${remaining} units remaining`);
    const line_total = type === "normal" ? u * selected.selling_price_per_unit : 0;
    setCart((c) => [
      ...c,
      {
        id: crypto.randomUUID(),
        code: selected.code,
        product_name: selected.product_name,
        units: u,
        type,
        price_per_unit: selected.selling_price_per_unit,
        line_total,
      },
    ]);
    // reset entry row
    setQuery("");
    setUnits("");
    setSelected(null);
    setType("normal");
  };

  const removeItem = (id: string) => setCart((c) => c.filter((x) => x.id !== id));

  const grandTotal = cart.reduce((s, c) => s + c.line_total, 0);
  const totalUnits = cart.reduce((s, c) => s + c.units, 0);

  const recordAll = async () => {
    if (cart.length === 0) return toast.error("Cart is empty");
    setSaving(true);
    let ok = 0;
    let failed: string[] = [];
    for (const item of cart) {
      try {
        await addSale({ code: item.code, units_sold: item.units, type: item.type });
        ok++;
      } catch (err: any) {
        failed.push(`${item.code}: ${err.message}`);
      }
    }
    setSaving(false);
    if (ok > 0) toast.success(`Recorded ${ok} item${ok > 1 ? "s" : ""} — ${formatKsh(grandTotal)}`);
    if (failed.length) toast.error(failed.join(" • "));
    setCart((c) => c.filter((x) => failed.some((f) => f.startsWith(x.code))));
    const fresh = await getProducts();
    setProducts(fresh);
  };

  const previewLineTotal =
    selected && type === "normal" && Number(units || 0) > 0
      ? Number(units) * selected.selling_price_per_unit
      : 0;

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl md:text-3xl font-bold mb-1">Record Sale</h1>
      <p className="text-muted-foreground text-sm mb-6">
        Add multiple items to the cart, review the total, then record all at once.
      </p>

      <Card className="p-5 md:p-6 border-0 shadow-[var(--shadow-card)] space-y-4">
        <div ref={wrapRef} className="relative">
          <Label htmlFor="product">Product</Label>
          <Input
            id="product"
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
              {suggestions.map((p, i) => {
                const rem = remainingFor(p.code, p.remaining_units);
                return (
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
                      <div className={`text-xs ${rem <= 0 ? "text-destructive" : "text-muted-foreground"}`}>
                        {rem} left
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
          {showSuggestions && query && suggestions.length === 0 && (
            <div className="absolute z-20 mt-1 w-full rounded-md border bg-popover shadow-lg p-3 text-sm text-muted-foreground">
              No matching products
            </div>
          )}
        </div>

        {selected && (
          <div className="rounded-lg border p-3 bg-secondary/40 flex items-center justify-between text-sm">
            <div className="font-medium truncate">{selected.product_name}</div>
            <div className="text-muted-foreground">
              {formatKsh(selected.selling_price_per_unit)}/u • {remainingFor(selected.code, selected.remaining_units)} left
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
                  type === opt.value ? `${opt.color} border-transparent` : "bg-background hover:bg-accent"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-[1fr_auto] gap-2 items-end">
          <div>
            <Label htmlFor="units">Units</Label>
            <Input
              id="units"
              type="number"
              inputMode="numeric"
              value={units}
              onChange={(e) => setUnits(e.target.value)}
              placeholder="1"
              className="mt-1 text-lg"
              disabled={!selected}
            />
          </div>
          <Button type="button" onClick={addToCart} disabled={!selected || !units} size="lg">
            <Plus className="h-4 w-4 mr-1" /> Add
          </Button>
        </div>

        {previewLineTotal > 0 && (
          <div className="text-sm text-muted-foreground">
            Line total: <span className="font-semibold text-foreground">{formatKsh(previewLineTotal)}</span>
          </div>
        )}
      </Card>

      <Card className="mt-4 p-5 md:p-6 border-0 shadow-[var(--shadow-card)]">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">Cart</h2>
          <span className="text-xs text-muted-foreground">
            {cart.length} item{cart.length === 1 ? "" : "s"} • {totalUnits} units
          </span>
        </div>

        {cart.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">No items yet. Add a product above.</p>
        ) : (
          <ul className="divide-y">
            {cart.map((item) => {
              const typeMeta = typeOptions.find((t) => t.value === item.type)!;
              return (
                <li key={item.id} className="py-3 flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{item.product_name}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-2">
                      <Badge variant="outline" className="font-mono text-[10px]">{item.code}</Badge>
                      <Badge className={`${typeMeta.color} text-[10px]`}>{typeMeta.label}</Badge>
                      <span>{item.units} × {formatKsh(item.price_per_unit)}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">{formatKsh(item.line_total)}</div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeItem(item.id)}
                    aria-label="Remove"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </li>
              );
            })}
          </ul>
        )}

        <div className="mt-4 rounded-lg bg-[var(--gradient-primary)] p-4 text-primary-foreground">
          <div className="text-xs opacity-80">Total Payable</div>
          <div className="text-3xl font-bold">{formatKsh(grandTotal)}</div>
        </div>

        <Button
          type="button"
          className="w-full mt-4"
          size="lg"
          disabled={saving || cart.length === 0}
          onClick={recordAll}
        >
          {saving ? "Recording…" : `Record ${cart.length || ""} Sale${cart.length === 1 ? "" : "s"}`}
        </Button>
      </Card>
    </div>
  );
}

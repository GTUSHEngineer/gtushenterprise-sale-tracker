import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { addSale, getProductWithStock, type ProductWithStock } from "@/lib/data";
import { parseSaleCode, formatKsh, type SaleType } from "@/lib/utils-sales";
import { toast } from "sonner";

export const Route = createFileRoute("/record-sale")({
  head: () => ({
    meta: [
      { title: "Record Sale — Smart Sales Manager" },
      { name: "description", content: "Quickly record a sale by entering the product code." },
    ],
  }),
  component: RecordSale,
});

const typeLabel = {
  normal: { label: "Normal Sale", color: "bg-primary text-primary-foreground" },
  donated: { label: "Donated", color: "bg-[oklch(0.72_0.18_160)] text-white" },
  spoilt: { label: "Spoilt", color: "bg-destructive text-destructive-foreground" },
} satisfies Record<SaleType, { label: string; color: string }>;

function RecordSale() {
  const [input, setInput] = useState("");
  const [units, setUnits] = useState("");
  const [parsed, setParsed] = useState<{ code: string; type: SaleType } | null>(null);
  const [product, setProduct] = useState<ProductWithStock | null>(null);
  const [lookingUp, setLookingUp] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const p = parseSaleCode(input);
    setParsed(p);
    if (!p) {
      setProduct(null);
      return;
    }
    setLookingUp(true);
    getProductWithStock(p.code)
      .then(setProduct)
      .finally(() => setLookingUp(false));
  }, [input]);

  const total = parsed && product && parsed.type === "normal" ? Number(units || 0) * product.selling_price_per_unit : 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!parsed) return toast.error("Invalid code format");
    if (!product) return toast.error("Product not found");
    const u = Number(units);
    if (!u || u <= 0) return toast.error("Units must be > 0");
    setSaving(true);
    try {
      await addSale({ code: parsed.code, units_sold: u, type: parsed.type });
      toast.success(`${parsed.type === "normal" ? "Sale" : parsed.type} recorded — ${u} units`);
      setInput("");
      setUnits("");
      setProduct(null);
      setParsed(null);
    } catch (err: any) {
      toast.error(err.message || "Failed to record sale");
    } finally {
      setSaving(false);
    }
  };

  const outOfStock = product && product.remaining_units <= 0;

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl md:text-3xl font-bold mb-1">Record Sale</h1>
      <p className="text-muted-foreground text-sm mb-6">
        Enter <code className="px-1.5 py-0.5 bg-secondary rounded text-xs">CODE</code> for normal,{" "}
        <code className="px-1.5 py-0.5 bg-secondary rounded text-xs">CODE.d</code> for donated,{" "}
        <code className="px-1.5 py-0.5 bg-secondary rounded text-xs">CODE.s</code> for spoilt.
      </p>

      <Card className="p-5 md:p-6 border-0 shadow-[var(--shadow-card)]">
        <form onSubmit={submit} className="space-y-4">
          <div>
            <Label htmlFor="code">Stock Code</Label>
            <Input
              id="code"
              autoFocus
              value={input}
              onChange={(e) => setInput(e.target.value.toUpperCase())}
              placeholder="SUGAR1 or SUGAR1.d"
              className="mt-1 font-mono uppercase text-lg"
            />
            {input && !parsed && <p className="text-xs text-destructive mt-1">Invalid code format</p>}
          </div>

          {parsed && (
            <div className="rounded-lg border p-4 bg-secondary/40 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Detected Type</span>
                <Badge className={typeLabel[parsed.type].color}>{typeLabel[parsed.type].label}</Badge>
              </div>
              {lookingUp ? (
                <p className="text-sm text-muted-foreground">Looking up…</p>
              ) : product ? (
                <>
                  <div className="font-semibold">{product.product_name}</div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <div className="text-xs text-muted-foreground">Price / unit</div>
                      <div className="font-medium">{formatKsh(product.selling_price_per_unit)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Remaining</div>
                      <div className={`font-medium ${outOfStock ? "text-destructive" : ""}`}>
                        {product.remaining_units} units
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-sm text-destructive">Product {parsed.code} not found</p>
              )}
            </div>
          )}

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
              disabled={!product || !!outOfStock}
            />
          </div>

          {parsed?.type === "normal" && total > 0 && (
            <div className="rounded-lg bg-[var(--gradient-primary)] p-4 text-primary-foreground">
              <div className="text-xs opacity-80">Total Amount</div>
              <div className="text-2xl font-bold">{formatKsh(total)}</div>
            </div>
          )}

          <Button type="submit" className="w-full" size="lg" disabled={saving || !product || !!outOfStock || !units}>
            {saving ? "Recording…" : outOfStock ? "Out of Stock" : "Record Sale"}
          </Button>
        </form>
      </Card>
    </div>
  );
}

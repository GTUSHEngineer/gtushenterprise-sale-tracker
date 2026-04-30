import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { addProduct, getNextProductCode, syncFromCloud } from "@/lib/data";
import { CODE_REGEX, formatKsh } from "@/lib/utils-sales";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/add-stock")({
  head: () => ({
    meta: [
      { title: "Add Stock — Smart Sales Manager" },
      { name: "description", content: "Register a new product batch with code, quantity, and pricing." },
    ],
  }),
  component: AddStock,
});

function AddStock() {
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unitsPer, setUnitsPer] = useState("");
  const [cost, setCost] = useState("");
  const [price, setPrice] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await syncFromCloud();
      } catch {}
      const next = await getNextProductCode();
      if (!cancelled) setCode(next);
    })();
    return () => { cancelled = true; };
  }, []);

  const totalUnits = (Number(quantity) || 0) * (Number(unitsPer) || 0);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const upper = code.trim().toUpperCase();
    if (!CODE_REGEX.test(upper)) return toast.error("Code must be 4+ uppercase letters/numbers");
    if (!name.trim()) return toast.error("Product name required");
    if (Number(quantity) <= 0 || Number(unitsPer) <= 0) return toast.error("Quantity and units must be > 0");
    if (Number(cost) < 0 || Number(price) < 0) return toast.error("Cost and price must be ≥ 0");

    setSaving(true);
    try {
      await addProduct({
        code: upper,
        product_name: name.trim(),
        quantity: Number(quantity),
        units_per_quantity: Number(unitsPer),
        total_purchase_cost: Number(cost),
        selling_price_per_unit: Number(price),
      });
      toast.success(`${upper} added to inventory`);
      navigate({ to: "/inventory" });
    } catch (err: any) {
      toast.error(err.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl md:text-3xl font-bold mb-1">Add Stock</h1>
      <p className="text-muted-foreground text-sm mb-6">Register a new product batch. Each code is unique and permanent.</p>

      <Card className="p-5 md:p-6 border-0 shadow-[var(--shadow-card)]">
        <form onSubmit={submit} className="space-y-4">
          <div>
            <Label htmlFor="code">Product Code *</Label>
            <Input
              id="code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="e.g. SUGAR1"
              className="mt-1 uppercase font-mono"
              autoFocus
            />
            <p className="text-xs text-muted-foreground mt-1">4+ uppercase letters/numbers. Cannot be reused.</p>
          </div>
          <div>
            <Label htmlFor="name">Product Name *</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Brown Sugar 1kg" className="mt-1" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="qty">Quantity *</Label>
              <Input id="qty" type="number" inputMode="decimal" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="10" className="mt-1" />
            </div>
            <div>
              <Label htmlFor="upq">Units per Quantity *</Label>
              <Input id="upq" type="number" inputMode="decimal" value={unitsPer} onChange={(e) => setUnitsPer(e.target.value)} placeholder="12" className="mt-1" />
            </div>
          </div>
          <div className="rounded-lg bg-secondary p-3 text-sm">
            <span className="text-muted-foreground">Total units: </span>
            <span className="font-semibold">{totalUnits || 0}</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="cost">Total Purchase Cost (Ksh) *</Label>
              <Input id="cost" type="number" inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="5000" className="mt-1" />
            </div>
            <div>
              <Label htmlFor="price">Selling Price / Unit (Ksh) *</Label>
              <Input id="price" type="number" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="60" className="mt-1" />
            </div>
          </div>
          {Number(price) > 0 && totalUnits > 0 && (
            <div className="rounded-lg bg-[oklch(0.72_0.18_160/0.1)] p-3 text-sm">
              <span className="text-muted-foreground">Potential revenue: </span>
              <span className="font-semibold">{formatKsh(totalUnits * Number(price))}</span>
            </div>
          )}
          <Button type="submit" className="w-full" disabled={saving} size="lg">
            {saving ? "Saving…" : "Save to Inventory"}
          </Button>
        </form>
      </Card>
    </div>
  );
}

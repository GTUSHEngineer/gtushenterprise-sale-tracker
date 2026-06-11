import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus } from "lucide-react";
import { addProduct, getNextProductCode, syncFromCloud } from "@/lib/data";
import { formatKsh } from "@/lib/utils-sales";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/add-stock")({
  head: () => ({
    meta: [
      { title: "Add Stock — Smart Sales Manager" },
      { name: "description", content: "Register one or more product batches with auto codes." },
    ],
  }),
  component: AddStock,
});

interface DraftItem {
  tempId: string;
  code: string;
  product_name: string;
  quantity: number;
  units_per_quantity: number;
  total_purchase_cost: number;
  selling_price_per_unit: number;
}

function AddStock() {
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unitsPer, setUnitsPer] = useState("");
  const [cost, setCost] = useState("");
  const [price, setPrice] = useState("");
  const [drafts, setDrafts] = useState<DraftItem[]>([]);
  const [saving, setSaving] = useState(false);

  const refreshNextCode = async (reserved: string[] = []) => {
    const next = await getNextProductCode(reserved);
    setCode(next);
  };

  useEffect(() => {
    (async () => {
      try { await syncFromCloud(); } catch {}
      await refreshNextCode();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalUnits = (Number(quantity) || 0) * (Number(unitsPer) || 0);

  const resetForm = () => {
    setName(""); setQuantity(""); setUnitsPer(""); setCost(""); setPrice("");
  };

  const addToList = () => {
    if (!name.trim()) return toast.error("Product name required");
    if (Number(quantity) <= 0 || Number(unitsPer) <= 0) return toast.error("Quantity and units must be > 0");
    if (Number(cost) < 0 || Number(price) < 0) return toast.error("Cost and price must be ≥ 0");
    if (drafts.some((d) => d.code === code)) return toast.error("Code already in list");

    const item: DraftItem = {
      tempId: crypto.randomUUID(),
      code,
      product_name: name.trim(),
      quantity: Number(quantity),
      units_per_quantity: Number(unitsPer),
      total_purchase_cost: Number(cost),
      selling_price_per_unit: Number(price),
    };
    const nextDrafts = [...drafts, item];
    setDrafts(nextDrafts);
    resetForm();
    refreshNextCode(nextDrafts.map((d) => d.code));
  };

  const removeDraft = (tempId: string) => {
    const next = drafts.filter((d) => d.tempId !== tempId);
    setDrafts(next);
    refreshNextCode(next.map((d) => d.code));
  };

  const saveAll = async () => {
    if (drafts.length === 0) return toast.error("Add at least one product");
    setSaving(true);
    let ok = 0; let fail = 0;
    for (const d of drafts) {
      try {
        await addProduct({
          code: d.code,
          product_name: d.product_name,
          quantity: d.quantity,
          units_per_quantity: d.units_per_quantity,
          total_purchase_cost: d.total_purchase_cost,
          selling_price_per_unit: d.selling_price_per_unit,
        });
        ok++;
      } catch (err: any) {
        fail++;
        toast.error(`${d.code}: ${err.message || "Failed"}`);
      }
    }
    setSaving(false);
    if (ok > 0) toast.success(`${ok} product${ok === 1 ? "" : "s"} added`);
    if (fail === 0) navigate({ to: "/inventory" });
    else {
      setDrafts([]);
      await refreshNextCode();
    }
  };

  const totalCost = drafts.reduce((s, d) => s + d.total_purchase_cost, 0);
  const totalPotential = drafts.reduce((s, d) => s + d.quantity * d.units_per_quantity * d.selling_price_per_unit, 0);

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto pb-32">
      <h1 className="text-2xl md:text-3xl font-bold mb-1">Add Stock</h1>
      <p className="text-muted-foreground text-sm mb-6">Add multiple product batches, then save them all at once.</p>

      <Card className="p-5 md:p-6 border-0 shadow-[var(--shadow-card)]">
        <div className="space-y-4">
          <div>
            <Label htmlFor="code">Product Code</Label>
            <Input
              id="code"
              value={code}
              readOnly
              placeholder="Generating…"
              className="mt-1 uppercase font-mono bg-muted cursor-not-allowed"
            />
            <p className="text-xs text-muted-foreground mt-1">Auto-generated using today's date (DDMM/YY). Permanent.</p>
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
          <Button type="button" onClick={addToList} variant="outline" className="w-full" size="lg">
            <Plus className="h-4 w-4" /> Add to List
          </Button>
        </div>
      </Card>

      {drafts.length > 0 && (
        <Card className="mt-4 p-5 border-0 shadow-[var(--shadow-card)]">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">Pending Batches</h2>
            <Badge variant="secondary">{drafts.length}</Badge>
          </div>
          <div className="space-y-2">
            {drafts.map((d) => {
              const units = d.quantity * d.units_per_quantity;
              return (
                <div key={d.tempId} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">{d.code}</span>
                      <span className="font-medium truncate">{d.product_name}</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {d.quantity} × {d.units_per_quantity} = {units} units · {formatKsh(d.selling_price_per_unit)}/unit
                    </div>
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => removeDraft(d.tempId)} aria-label="Remove">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg bg-secondary p-3">
              <div className="text-muted-foreground text-xs">Total cost</div>
              <div className="font-semibold">{formatKsh(totalCost)}</div>
            </div>
            <div className="rounded-lg bg-[oklch(0.72_0.18_160/0.1)] p-3">
              <div className="text-muted-foreground text-xs">Potential revenue</div>
              <div className="font-semibold">{formatKsh(totalPotential)}</div>
            </div>
          </div>
          <Button onClick={saveAll} disabled={saving} size="lg" className="w-full mt-4">
            {saving ? "Saving…" : `Save All (${drafts.length})`}
          </Button>
        </Card>
      )}
    </div>
  );
}

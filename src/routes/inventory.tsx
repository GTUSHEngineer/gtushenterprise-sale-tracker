import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  getProducts,
  getSettings,
  updateProduct,
  deleteProduct,
  type ProductWithStock,
} from "@/lib/data";
import { Search, Package, Pencil, Trash2 } from "lucide-react";
import { useRole } from "@/lib/role";

export const Route = createFileRoute("/inventory")({
  head: () => ({
    meta: [
      { title: "Inventory — Smart Sales Manager" },
      { name: "description", content: "Browse, edit and remove stock batches with stock alerts." },
    ],
  }),
  component: Inventory,
});

function Inventory() {
  const role = useRole();
  const isAdmin = role === "admin";
  const [items, setItems] = useState<ProductWithStock[]>([]);
  const [threshold, setThreshold] = useState(10);
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<ProductWithStock | null>(null);
  const [deleting, setDeleting] = useState<ProductWithStock | null>(null);
  const [form, setForm] = useState({
    product_name: "",
    quantity: 0,
    units_per_quantity: 0,
    total_purchase_cost: 0,
    selling_price_per_unit: 0,
  });
  const [saving, setSaving] = useState(false);

  const refresh = async () => {
    setItems(await getProducts());
    setThreshold(Number((await getSettings()).low_stock_threshold));
  };

  useEffect(() => {
    refresh();
  }, []);

  const filtered = items.filter(
    (p) =>
      p.code.toLowerCase().includes(q.toLowerCase()) ||
      p.product_name.toLowerCase().includes(q.toLowerCase()),
  );

  const openEdit = (p: ProductWithStock) => {
    setEditing(p);
    setForm({
      product_name: p.product_name,
      quantity: Number(p.quantity),
      units_per_quantity: Number(p.units_per_quantity),
      total_purchase_cost: Number(p.total_purchase_cost),
      selling_price_per_unit: Number(p.selling_price_per_unit),
    });
  };

  const saveEdit = async () => {
    if (!editing) return;
    if (!form.product_name.trim()) {
      toast.error("Product name required");
      return;
    }
    if (form.quantity <= 0 || form.units_per_quantity <= 0) {
      toast.error("Quantity and units must be greater than 0");
      return;
    }
    setSaving(true);
    try {
      await updateProduct(editing.code, form);
      toast.success(`${editing.code} updated`);
      setEditing(null);
      await refresh();
    } catch (e: any) {
      toast.error(e.message ?? "Update failed");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    if (!isAdmin) {
      toast.error("Only admins can delete products");
      setDeleting(null);
      return;
    }
    setSaving(true);
    try {
      await deleteProduct(deleting.code);
      toast.success(`${deleting.code} deleted`);
      setDeleting(null);
      await refresh();
    } catch (e: any) {
      toast.error(e.message ?? "Delete failed");
    } finally {
      setSaving(false);
    }
  };

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
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Cost: {Number(p.total_purchase_cost).toLocaleString()} · Sell/unit: {Number(p.selling_price_per_unit).toLocaleString()}
                    </div>
                  </div>
                  <div className="text-right flex flex-col items-end gap-2">
                    <div>
                      <div className="text-xs text-muted-foreground">Remaining</div>
                      <div className={`text-xl font-bold ${out ? "text-destructive" : low ? "text-[oklch(0.55_0.16_80)]" : ""}`}>
                        {p.remaining_units}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => openEdit(p)} aria-label={`Edit ${p.code}`}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      {isAdmin && (
                        <Button size="icon" variant="outline" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => setDeleting(p)} aria-label={`Delete ${p.code}`}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit {editing?.code}</DialogTitle>
            <DialogDescription>Update batch details. Total units cannot drop below units already sold.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-1.5">
              <Label htmlFor="ed-name">Product name</Label>
              <Input id="ed-name" value={form.product_name} onChange={(e) => setForm({ ...form, product_name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="ed-qty">Quantity</Label>
                <Input id="ed-qty" type="number" min={1} value={form.quantity} onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="ed-upq">Units / qty</Label>
                <Input id="ed-upq" type="number" min={1} value={form.units_per_quantity} onChange={(e) => setForm({ ...form, units_per_quantity: Number(e.target.value) })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="ed-cost">Total cost</Label>
                <Input id="ed-cost" type="number" min={0} value={form.total_purchase_cost} onChange={(e) => setForm({ ...form, total_purchase_cost: Number(e.target.value) })} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="ed-sell">Sell / unit</Label>
                <Input id="ed-sell" type="number" min={0} value={form.selling_price_per_unit} onChange={(e) => setForm({ ...form, selling_price_per_unit: Number(e.target.value) })} />
              </div>
            </div>
            <div className="text-xs text-muted-foreground">
              New total units: <span className="font-semibold">{form.quantity * form.units_per_quantity}</span>
              {editing && ` · Already sold: ${editing.units_sold_total}`}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)} disabled={saving}>Cancel</Button>
            <Button onClick={saveEdit} disabled={saving}>{saving ? "Saving..." : "Save changes"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleting?.code}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes <span className="font-semibold">{deleting?.product_name}</span> and all of its sales records. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={saving} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {saving ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

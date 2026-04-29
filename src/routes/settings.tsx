import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { getSettings, saveSettings, syncFromCloud } from "@/lib/data";
import { toast } from "sonner";
import { LogOut, RefreshCw } from "lucide-react";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Smart Sales Manager" },
      { name: "description", content: "Configure low-stock threshold and report email address." },
    ],
  }),
  component: Settings,
});

function Settings() {
  const [threshold, setThreshold] = useState("10");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getSettings().then((s) => {
      setThreshold(String(s.low_stock_threshold));
      setEmail(s.email || "");
    });
  }, []);

  const save = async () => {
    const t = Number(threshold);
    if (!Number.isFinite(t) || t < 0) return toast.error("Threshold must be ≥ 0");
    if (email && !/^\S+@\S+\.\S+$/.test(email)) return toast.error("Invalid email");
    setSaving(true);
    try {
      await saveSettings({ low_stock_threshold: t, email: email || null });
      toast.success("Settings saved");
    } catch (e: any) {
      toast.error(e.message || "Failed");
    } finally {
      setSaving(false);
    }
  };

  const lockApp = () => {
    sessionStorage.removeItem("ssm_unlocked");
    location.reload();
  };

  const resync = async () => {
    await syncFromCloud();
    toast.success("Synced from cloud");
  };

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground text-sm">Personal configuration.</p>
      </div>

      <Card className="p-5 md:p-6 border-0 shadow-[var(--shadow-card)] space-y-4">
        <div>
          <Label htmlFor="threshold">Low Stock Threshold</Label>
          <Input
            id="threshold"
            type="number"
            inputMode="numeric"
            value={threshold}
            onChange={(e) => setThreshold(e.target.value)}
            className="mt-1"
          />
          <p className="text-xs text-muted-foreground mt-1">Show low-stock alert when remaining units ≤ this number.</p>
        </div>
        <div>
          <Label htmlFor="email">Report Email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="mt-1"
          />
          <p className="text-xs text-muted-foreground mt-1">Where to send daily reports from the Reports page.</p>
        </div>
        <Button onClick={save} disabled={saving} className="w-full">
          {saving ? "Saving…" : "Save Settings"}
        </Button>
      </Card>

      <Card className="p-5 border-0 shadow-[var(--shadow-card)] space-y-3">
        <h2 className="font-semibold">Data</h2>
        <Button variant="outline" onClick={resync} className="w-full gap-2">
          <RefreshCw className="h-4 w-4" /> Re-sync from cloud
        </Button>
      </Card>

      <Card className="p-5 border-0 shadow-[var(--shadow-card)]">
        <Button variant="outline" onClick={lockApp} className="w-full gap-2">
          <LogOut className="h-4 w-4" /> Lock App
        </Button>
      </Card>
    </div>
  );
}

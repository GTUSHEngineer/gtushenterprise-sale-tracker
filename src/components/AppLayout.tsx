import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, PackagePlus, ShoppingCart, Boxes, FileText, Settings as SettingsIcon, ShoppingBag, WifiOff } from "lucide-react";
import { useEffect, useState } from "react";
import { flushOutbox, syncFromCloud } from "@/lib/data";

const nav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/add-stock", label: "Add Stock", icon: PackagePlus },
  { to: "/record-sale", label: "Record Sale", icon: ShoppingCart },
  { to: "/inventory", label: "Inventory", icon: Boxes },
  { to: "/reports", label: "Reports", icon: FileText },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
];

export function AppLayout({ children }: { children: React.ReactNode }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  useEffect(() => {
    syncFromCloud().catch(() => {});
    const handler = () => flushOutbox().catch(() => {});
    window.addEventListener("online", handler);
    return () => window.removeEventListener("online", handler);
  }, []);

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-background">
      {/* Sidebar (desktop) */}
      <aside className="hidden md:flex md:w-60 md:flex-col border-r bg-card">
        <div className="p-5 border-b">
          <Link to="/" className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-xl bg-[var(--gradient-primary)] flex items-center justify-center">
              <ShoppingBag className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <div className="font-bold leading-tight">Smart Sales</div>
              <div className="text-xs text-muted-foreground">Manager</div>
            </div>
          </Link>
        </div>
        <nav className="flex-1 p-2 space-y-1">
          {nav.map((n) => {
            const active = path === n.to;
            return (
              <Link
                key={n.to}
                to={n.to}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  active ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-secondary"
                }`}
              >
                <n.icon className="h-4 w-4" />
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t text-xs text-muted-foreground flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${online ? "bg-[oklch(var(--success))]" : "bg-destructive"}`} style={{ background: online ? "oklch(0.65 0.18 150)" : undefined }} />
          {online ? "Online — synced" : "Offline mode"}
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="md:hidden flex items-center justify-between px-4 h-14 border-b bg-card sticky top-0 z-10">
        <Link to="/" className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-[var(--gradient-primary)] flex items-center justify-center">
            <ShoppingBag className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="font-semibold text-sm">Smart Sales</span>
        </Link>
        {!online && (
          <span className="flex items-center gap-1 text-xs text-destructive">
            <WifiOff className="h-3.5 w-3.5" /> Offline
          </span>
        )}
      </header>

      {/* Main */}
      <main className="flex-1 pb-20 md:pb-6">{children}</main>

      {/* Bottom nav (mobile) */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-card border-t flex justify-around z-20">
        {nav.map((n) => {
          const active = path === n.to;
          return (
            <Link
              key={n.to}
              to={n.to}
              className={`flex flex-col items-center justify-center flex-1 py-2 text-[10px] transition-colors ${
                active ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <n.icon className="h-5 w-5 mb-0.5" />
              {n.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

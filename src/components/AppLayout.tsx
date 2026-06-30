import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, PackagePlus, ShoppingCart, Boxes, FileText, Settings as SettingsIcon, ShoppingBag, WifiOff, Shield, User } from "lucide-react";
import { useEffect, useState } from "react";
import { flushOutbox, syncFromCloud } from "@/lib/data";
import { useRole, type Role } from "@/lib/role";

const allNav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, roles: ["admin", "employee"] as Role[] },
  { to: "/add-stock", label: "Add Stock", icon: PackagePlus, roles: ["admin", "employee"] as Role[] },
  { to: "/record-sale", label: "Record Sale", icon: ShoppingCart, roles: ["admin", "employee"] as Role[] },
  { to: "/inventory", label: "Inventory", icon: Boxes, roles: ["admin", "employee"] as Role[] },
  { to: "/reports", label: "Reports", icon: FileText, roles: ["admin", "employee"] as Role[] },
  { to: "/settings", label: "Settings", icon: SettingsIcon, roles: ["admin"] as Role[] },
];

export function AppLayout({ children }: { children: React.ReactNode }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const role = useRole();
  const nav = allNav.filter((n) => (role ? n.roles.includes(role) : true));
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
        <div className="p-3 border-t text-xs text-muted-foreground space-y-2">
          {role && (
            <div className="flex items-center gap-2">
              {role === "admin" ? <Shield className="h-3.5 w-3.5 text-primary" /> : <User className="h-3.5 w-3.5" />}
              <span className="font-medium capitalize text-foreground">{role}</span>
              <button
                onClick={() => { sessionStorage.removeItem("ssm_unlocked"); sessionStorage.removeItem("ssm_role"); location.reload(); }}
                className="ml-auto underline hover:text-foreground"
              >
                Switch
              </button>
            </div>
          )}
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full" style={{ background: online ? "oklch(0.65 0.18 150)" : "oklch(0.6 0.2 25)" }} />
            {online ? "Online — synced" : "Offline mode"}
          </div>
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
        <div className="flex items-center gap-2">
          {!online && (
            <span className="flex items-center gap-1 text-xs text-destructive">
              <WifiOff className="h-3.5 w-3.5" /> Offline
            </span>
          )}
          {role && (
            <button
              onClick={() => { sessionStorage.removeItem("ssm_unlocked"); sessionStorage.removeItem("ssm_role"); location.reload(); }}
              className="flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-secondary text-foreground"
              aria-label="Switch user"
            >
              {role === "admin" ? <Shield className="h-3.5 w-3.5" /> : <User className="h-3.5 w-3.5" />}
              <span className="capitalize">{role}</span>
            </button>
          )}
        </div>
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

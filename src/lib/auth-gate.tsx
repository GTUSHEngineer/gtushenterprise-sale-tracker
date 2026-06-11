// PIN gate with Admin + Employee roles, stored in localStorage.
// Also signs into Supabase using a fixed local-only account so RLS works.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Lock, ShoppingBag, Shield, User } from "lucide-react";
import { toast } from "sonner";
import { setRole as setSessionRole } from "./role";

const ADMIN_PIN_KEY = "ssm_admin_pin";
const EMP_PIN_KEY = "ssm_emp_pin";
const LEGACY_PIN_KEY = "ssm_pin_hash";
const SESSION_KEY = "ssm_unlocked";
const ACCOUNT_KEY = "ssm_account";

async function hash(value: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function ensureSupabaseSession() {
  const { data } = await supabase.auth.getSession();
  if (data.session) return;

  let account = localStorage.getItem(ACCOUNT_KEY);
  if (!account) {
    const id = crypto.randomUUID();
    account = JSON.stringify({
      email: `owner-${id.slice(0, 8)}@smartsales.local`,
      password: id,
    });
    localStorage.setItem(ACCOUNT_KEY, account);
  }
  const { email, password } = JSON.parse(account);

  const signIn = await supabase.auth.signInWithPassword({ email, password });
  if (signIn.error) {
    const signUp = await supabase.auth.signUp({ email, password });
    if (signUp.error) throw signUp.error;
    if (!signUp.data.session) {
      await supabase.auth.signInWithPassword({ email, password });
    }
  }
}

type Stage = "loading" | "setup" | "need-employee" | "unlock";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const [stage, setStage] = useState<Stage>("loading");
  const [unlocked, setUnlocked] = useState(false);
  const [adminPin, setAdminPin] = useState("");
  const [empPin, setEmpPin] = useState("");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const hasAdmin = !!localStorage.getItem(ADMIN_PIN_KEY);
    const hasEmp = !!localStorage.getItem(EMP_PIN_KEY);
    const legacy = localStorage.getItem(LEGACY_PIN_KEY);

    // Migrate: legacy single PIN becomes admin PIN; employee PIN still needs setup.
    if (!hasAdmin && legacy) {
      localStorage.setItem(ADMIN_PIN_KEY, legacy);
      localStorage.removeItem(LEGACY_PIN_KEY);
    }

    const adminNow = !!localStorage.getItem(ADMIN_PIN_KEY);
    const empNow = !!localStorage.getItem(EMP_PIN_KEY);

    if (!adminNow) setStage("setup");
    else if (!empNow) setStage("need-employee");
    else setStage("unlock");

    setUnlocked(sessionStorage.getItem(SESSION_KEY) === "1");
  }, []);

  useEffect(() => {
    if (unlocked) {
      ensureSupabaseSession().catch((e) => {
        console.error(e);
        toast.error("Sync unavailable, working offline");
      });
    }
  }, [unlocked]);

  if (stage === "loading") return null;
  if (unlocked) return <>{children}</>;

  const setupBoth = async () => {
    if (adminPin.length < 4 || empPin.length < 4)
      return toast.error("Each PIN must be at least 4 digits");
    if (adminPin === empPin) return toast.error("Admin and employee PINs must differ");
    setLoading(true);
    localStorage.setItem(ADMIN_PIN_KEY, await hash(adminPin));
    localStorage.setItem(EMP_PIN_KEY, await hash(empPin));
    sessionStorage.setItem(SESSION_KEY, "1");
    setSessionRole("admin");
    setUnlocked(true);
    setLoading(false);
  };

  const setupEmployee = async () => {
    if (empPin.length < 4) return toast.error("PIN must be at least 4 digits");
    const adminHash = localStorage.getItem(ADMIN_PIN_KEY);
    if (adminHash === (await hash(empPin)))
      return toast.error("Employee PIN must differ from admin PIN");
    setLoading(true);
    localStorage.setItem(EMP_PIN_KEY, await hash(empPin));
    setStage("unlock");
    setEmpPin("");
    setLoading(false);
    toast.success("Employee PIN set. Now sign in.");
  };

  const enterPin = async () => {
    setLoading(true);
    const h = await hash(pin);
    if (h === localStorage.getItem(ADMIN_PIN_KEY)) {
      sessionStorage.setItem(SESSION_KEY, "1");
      setSessionRole("admin");
      setUnlocked(true);
    } else if (h === localStorage.getItem(EMP_PIN_KEY)) {
      sessionStorage.setItem(SESSION_KEY, "1");
      setSessionRole("employee");
      setUnlocked(true);
    } else {
      toast.error("Incorrect PIN");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-secondary p-4">
      <Card className="w-full max-w-sm p-8 shadow-[var(--shadow-elevated)]">
        <div className="flex flex-col items-center mb-6">
          <div className="h-14 w-14 rounded-2xl bg-[var(--gradient-primary)] flex items-center justify-center mb-3">
            <ShoppingBag className="h-7 w-7 text-primary-foreground" />
          </div>
          <h1 className="text-xl font-bold">Smart Sales Manager</h1>
          <p className="text-sm text-muted-foreground mt-1 text-center">
            {stage === "setup"
              ? "Create an Admin PIN and an Employee PIN"
              : stage === "need-employee"
                ? "Set an Employee PIN to continue"
                : "Enter your PIN — Admin or Employee"}
          </p>
        </div>

        {stage === "setup" && (
          <div className="space-y-3">
            <div>
              <Label htmlFor="apin" className="flex items-center gap-2">
                <Shield className="h-3.5 w-3.5" /> Admin PIN
              </Label>
              <Input
                id="apin"
                type="password"
                inputMode="numeric"
                autoFocus
                value={adminPin}
                onChange={(e) => setAdminPin(e.target.value)}
                className="mt-1 text-lg tracking-widest"
                placeholder="••••"
              />
            </div>
            <div>
              <Label htmlFor="epin" className="flex items-center gap-2">
                <User className="h-3.5 w-3.5" /> Employee PIN
              </Label>
              <Input
                id="epin"
                type="password"
                inputMode="numeric"
                value={empPin}
                onChange={(e) => setEmpPin(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && setupBoth()}
                className="mt-1 text-lg tracking-widest"
                placeholder="••••"
              />
            </div>
            <Button
              className="w-full mt-2"
              onClick={setupBoth}
              disabled={loading || !adminPin || !empPin}
            >
              Set PINs & Continue
            </Button>
          </div>
        )}

        {stage === "need-employee" && (
          <div className="space-y-3">
            <div>
              <Label htmlFor="epin" className="flex items-center gap-2">
                <User className="h-3.5 w-3.5" /> Employee PIN
              </Label>
              <Input
                id="epin"
                type="password"
                inputMode="numeric"
                autoFocus
                value={empPin}
                onChange={(e) => setEmpPin(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && setupEmployee()}
                className="mt-1 text-lg tracking-widest"
                placeholder="••••"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Your existing PIN is now the Admin PIN.
              </p>
            </div>
            <Button className="w-full" onClick={setupEmployee} disabled={loading || !empPin}>
              Save Employee PIN
            </Button>
          </div>
        )}

        {stage === "unlock" && (
          <div className="space-y-3">
            <div>
              <Label htmlFor="pin" className="flex items-center gap-2">
                <Lock className="h-3.5 w-3.5" /> PIN
              </Label>
              <Input
                id="pin"
                type="password"
                inputMode="numeric"
                autoFocus
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && enterPin()}
                className="mt-1 text-lg tracking-widest"
                placeholder="••••"
              />
            </div>
            <Button className="w-full mt-2" onClick={enterPin} disabled={loading || !pin}>
              Unlock
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}

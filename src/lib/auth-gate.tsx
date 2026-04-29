// Simple PIN gate stored in localStorage. Wraps the entire app.
// Also signs into Supabase using a fixed local-only account so RLS works.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Lock, ShoppingBag } from "lucide-react";
import { toast } from "sonner";

const PIN_KEY = "ssm_pin_hash";
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

export function AuthGate({ children }: { children: React.ReactNode }) {
  const [hasPin, setHasPin] = useState<boolean | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setHasPin(!!localStorage.getItem(PIN_KEY));
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

  if (hasPin === null) return null;

  if (unlocked) return <>{children}</>;

  const setupPin = async () => {
    if (pin.length < 4) return toast.error("PIN must be at least 4 digits");
    if (pin !== confirmPin) return toast.error("PINs do not match");
    setLoading(true);
    localStorage.setItem(PIN_KEY, await hash(pin));
    sessionStorage.setItem(SESSION_KEY, "1");
    setUnlocked(true);
    setLoading(false);
  };

  const enterPin = async () => {
    setLoading(true);
    const stored = localStorage.getItem(PIN_KEY);
    if (stored === (await hash(pin))) {
      sessionStorage.setItem(SESSION_KEY, "1");
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
          <p className="text-sm text-muted-foreground mt-1">
            {hasPin ? "Enter your PIN to continue" : "Set a PIN to protect your data"}
          </p>
        </div>

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
              onKeyDown={(e) => e.key === "Enter" && (hasPin ? enterPin() : confirmPin && setupPin())}
              className="mt-1 text-lg tracking-widest"
              placeholder="••••"
            />
          </div>
          {!hasPin && (
            <div>
              <Label htmlFor="cpin">Confirm PIN</Label>
              <Input
                id="cpin"
                type="password"
                inputMode="numeric"
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && setupPin()}
                className="mt-1 text-lg tracking-widest"
                placeholder="••••"
              />
            </div>
          )}
          <Button
            className="w-full mt-2"
            onClick={hasPin ? enterPin : setupPin}
            disabled={loading || !pin}
          >
            {hasPin ? "Unlock" : "Set PIN & Continue"}
          </Button>
        </div>
      </Card>
    </div>
  );
}

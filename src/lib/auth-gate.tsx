// Supabase email/password auth gate with Admin + Employee roles.
// - First-ever user signs up and becomes the Admin (bootstrap).
// - Afterwards, only sign-in is available; new employees are created by the
//   admin from the Settings page.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { ShoppingBag, Shield, Mail, Lock } from "lucide-react";
import { toast } from "sonner";
import { clearRole, isBootstrapClaimedCached, loadRoleForCurrentUser, markBootstrapClaimed } from "./role";
import { claimFirstAdmin } from "./admin-users.functions";

function isOnline() {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}

type Stage = "loading" | "signin" | "bootstrap" | "no-access";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const [stage, setStage] = useState<Stage>("loading");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  const refresh = async () => {
    const { data: sess } = await supabase.auth.getSession();
    if (!sess.session) {
      clearRole();
      // Decide bootstrap vs sign-in. Cache the "admin exists" flag so this
      // still works while offline.
      if (isBootstrapClaimedCached() || !isOnline()) {
        setStage("signin");
      } else {
        const { data: bs } = await supabase
          .from("auth_bootstrap")
          .select("admin_claimed")
          .eq("id", 1)
          .maybeSingle();
        if (bs?.admin_claimed) markBootstrapClaimed();
        setStage(bs?.admin_claimed ? "signin" : "bootstrap");
      }
      setReady(false);
      return;
    }
    const role = await loadRoleForCurrentUser();
    if (!role) {
      // Offline with a session but no cached role — allow through only if
      // the browser can't reach the server; otherwise it really is no access.
      setStage("no-access");
      setReady(false);
      return;
    }
    setReady(true);
  };

  useEffect(() => {
    refresh();
    const onOnline = () => refresh();
    window.addEventListener("online", onOnline);
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        refresh();
      }
    });
    return () => {
      window.removeEventListener("online", onOnline);
      sub.subscription.unsubscribe();
    };
  }, []);

  if (stage === "loading") return null;
  if (ready) return <>{children}</>;

  const signIn = async () => {
    if (!email || !password) return toast.error("Enter email and password");
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Signed in");
  };

  const bootstrapAdmin = async () => {
    if (!email || password.length < 8) return toast.error("Password must be at least 8 characters");
    setLoading(true);
    try {
      // Create the auth user
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { emailRedirectTo: window.location.origin },
      });
      if (error) throw error;

      // Session should be immediately available since email auto-confirm is on
      const token = data.session?.access_token
        ?? (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) throw new Error("Could not establish session — try signing in");

      await claimFirstAdmin({ data: { accessToken: token } });
      toast.success("Admin account created");
    } catch (e: any) {
      toast.error(e.message || "Signup failed");
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    clearRole();
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
            {stage === "bootstrap"
              ? "Create the Admin account"
              : stage === "no-access"
                ? "This account has no access"
                : "Sign in to continue"}
          </p>
        </div>

        {stage === "no-access" ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Your account is signed in but hasn't been granted access. Ask the admin to create your account.
            </p>
            <Button className="w-full" variant="outline" onClick={signOut}>
              Sign out
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <Label htmlFor="email" className="flex items-center gap-2">
                <Mail className="h-3.5 w-3.5" /> Email
              </Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <Label htmlFor="pass" className="flex items-center gap-2">
                <Lock className="h-3.5 w-3.5" /> Password
              </Label>
              <Input
                id="pass"
                type="password"
                autoComplete={stage === "bootstrap" ? "new-password" : "current-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (stage === "bootstrap" ? bootstrapAdmin() : signIn())}
                className="mt-1"
                placeholder="••••••••"
              />
              {stage === "bootstrap" && (
                <p className="text-xs text-muted-foreground mt-1">At least 8 characters.</p>
              )}
            </div>
            <Button
              className="w-full mt-2"
              onClick={stage === "bootstrap" ? bootstrapAdmin : signIn}
              disabled={loading || !email || !password}
            >
              {stage === "bootstrap" ? (
                <>
                  <Shield className="h-4 w-4 mr-2" /> Create Admin & Continue
                </>
              ) : (
                "Sign in"
              )}
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}

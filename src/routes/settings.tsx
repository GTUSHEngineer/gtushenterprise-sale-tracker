import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { getSettings, saveSettings, syncFromCloud } from "@/lib/data";
import { toast } from "sonner";
import { LogOut, RefreshCw, UserPlus, Trash2, Users, KeyRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { clearRole, useRole } from "@/lib/role";
import { createEmployee, deleteEmployee, listEmployees } from "@/lib/admin-users.functions";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Smart Sales Manager" },
      { name: "description", content: "Configure low-stock threshold, report email, and employee accounts." },
    ],
  }),
  component: Settings,
});

type Employee = { id: string; email: string | null; created_at: string };

function Settings() {
  const role = useRole();
  const [threshold, setThreshold] = useState("10");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loadingEmps, setLoadingEmps] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [creating, setCreating] = useState(false);

  const [currentUserEmail, setCurrentUserEmail] = useState<string>("");
  const [newAccountEmail, setNewAccountEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPass, setNewPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [updatingCreds, setUpdatingCreds] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const e = data.user?.email ?? "";
      setCurrentUserEmail(e);
      setNewAccountEmail(e);
    });
  }, []);

  const updateCredentials = async () => {
    if (!newAccountEmail || !/^\S+@\S+\.\S+$/.test(newAccountEmail)) {
      return toast.error("Invalid email");
    }
    const wantsPasswordChange = newPass.length > 0 || confirmPass.length > 0;
    if (wantsPasswordChange) {
      if (newPass.length < 8) return toast.error("New password must be at least 8 characters");
      if (newPass !== confirmPass) return toast.error("Passwords do not match");
    }
    const emailChanged = newAccountEmail.trim() !== currentUserEmail;
    if (!emailChanged && !wantsPasswordChange) {
      return toast.error("Nothing to update");
    }
    if (!currentPassword) return toast.error("Enter your current password to confirm");

    setUpdatingCreds(true);
    try {
      // Re-authenticate to confirm identity
      const { error: reauthErr } = await supabase.auth.signInWithPassword({
        email: currentUserEmail,
        password: currentPassword,
      });
      if (reauthErr) throw new Error("Current password is incorrect");

      const updates: { email?: string; password?: string } = {};
      if (emailChanged) updates.email = newAccountEmail.trim();
      if (wantsPasswordChange) updates.password = newPass;

      const { error } = await supabase.auth.updateUser(updates);
      if (error) throw error;

      toast.success(
        emailChanged
          ? "Updated. Check your new email to confirm the change."
          : "Password updated",
      );
      setCurrentPassword("");
      setNewPass("");
      setConfirmPass("");
      if (emailChanged) setCurrentUserEmail(newAccountEmail.trim());
    } catch (e: any) {
      toast.error(e.message || "Failed to update credentials");
    } finally {
      setUpdatingCreds(false);
    }
  };

  useEffect(() => {
    getSettings().then((s) => {
      setThreshold(String(s.low_stock_threshold));
      setEmail(s.email || "");
    });
  }, []);

  const getToken = async () => (await supabase.auth.getSession()).data.session?.access_token ?? "";

  const loadEmps = async () => {
    setLoadingEmps(true);
    try {
      const token = await getToken();
      const list = await listEmployees({ data: { accessToken: token } });
      setEmployees(list);
    } catch (e: any) {
      toast.error(e.message || "Failed to load employees");
    } finally {
      setLoadingEmps(false);
    }
  };

  useEffect(() => {
    if (role === "admin") loadEmps();
  }, [role]);

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

  const signOut = async () => {
    await supabase.auth.signOut();
    clearRole();
  };

  const resync = async () => {
    await syncFromCloud();
    toast.success("Synced from cloud");
  };

  const addEmployee = async () => {
    if (!/^\S+@\S+\.\S+$/.test(newEmail)) return toast.error("Invalid email");
    if (newPassword.length < 8) return toast.error("Password must be at least 8 characters");
    setCreating(true);
    try {
      const token = await getToken();
      await createEmployee({ data: { accessToken: token, email: newEmail.trim(), password: newPassword } });
      toast.success("Employee created");
      setNewEmail("");
      setNewPassword("");
      loadEmps();
    } catch (e: any) {
      toast.error(e.message || "Failed to create employee");
    } finally {
      setCreating(false);
    }
  };

  const removeEmployee = async (id: string, email: string | null) => {
    if (!confirm(`Delete ${email ?? "this employee"}? This cannot be undone.`)) return;
    try {
      const token = await getToken();
      await deleteEmployee({ data: { accessToken: token, userId: id } });
      toast.success("Employee deleted");
      loadEmps();
    } catch (e: any) {
      toast.error(e.message || "Failed");
    }
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

      {role === "admin" && (
        <Card className="p-5 md:p-6 border-0 shadow-[var(--shadow-card)] space-y-4">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            <h2 className="font-semibold">Employee Accounts</h2>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ne">New employee email</Label>
            <Input id="ne" type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="employee@example.com" />
            <Label htmlFor="np">Temporary password</Label>
            <Input id="np" type="text" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="At least 8 characters" />
            <Button onClick={addEmployee} disabled={creating} className="w-full gap-2">
              <UserPlus className="h-4 w-4" /> {creating ? "Creating…" : "Create Employee"}
            </Button>
          </div>

          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">
              {loadingEmps ? "Loading…" : `${employees.length} employee${employees.length === 1 ? "" : "s"}`}
            </div>
            <div className="divide-y rounded-md border">
              {employees.length === 0 && !loadingEmps && (
                <div className="p-3 text-sm text-muted-foreground">No employees yet.</div>
              )}
              {employees.map((e) => (
                <div key={e.id} className="flex items-center justify-between p-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{e.email ?? "(no email)"}</div>
                    <div className="text-xs text-muted-foreground">Added {new Date(e.created_at).toLocaleDateString()}</div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => removeEmployee(e.id, e.email)} aria-label="Delete employee">
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      <Card className="p-5 md:p-6 border-0 shadow-[var(--shadow-card)] space-y-4">
        <div className="flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-primary" />
          <h2 className="font-semibold">Change Email & Password</h2>
        </div>
        <p className="text-xs text-muted-foreground">
          Signed in as <span className="font-medium">{currentUserEmail || "…"}</span>. Enter your
          current password to confirm any change.
        </p>

        <div className="space-y-2">
          <Label htmlFor="acc-email">Account email</Label>
          <Input
            id="acc-email"
            type="email"
            autoComplete="email"
            value={newAccountEmail}
            onChange={(e) => setNewAccountEmail(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="cur-pass">Current password</Label>
          <Input
            id="cur-pass"
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="Required to confirm"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="new-pass">New password</Label>
          <Input
            id="new-pass"
            type="password"
            autoComplete="new-password"
            value={newPass}
            onChange={(e) => setNewPass(e.target.value)}
            placeholder="Leave blank to keep current"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="conf-pass">Confirm new password</Label>
          <Input
            id="conf-pass"
            type="password"
            autoComplete="new-password"
            value={confirmPass}
            onChange={(e) => setConfirmPass(e.target.value)}
          />
        </div>

        <Button onClick={updateCredentials} disabled={updatingCreds} className="w-full gap-2">
          <KeyRound className="h-4 w-4" /> {updatingCreds ? "Updating…" : "Update credentials"}
        </Button>
      </Card>

      <Card className="p-5 border-0 shadow-[var(--shadow-card)] space-y-3">
        <h2 className="font-semibold">Data</h2>
        <Button variant="outline" onClick={resync} className="w-full gap-2">
          <RefreshCw className="h-4 w-4" /> Re-sync from cloud
        </Button>
      </Card>

      <Card className="p-5 border-0 shadow-[var(--shadow-card)]">
        <Button variant="outline" onClick={signOut} className="w-full gap-2">
          <LogOut className="h-4 w-4" /> Sign out
        </Button>
      </Card>
    </div>
  );
}

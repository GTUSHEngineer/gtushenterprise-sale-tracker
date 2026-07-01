// Server functions for admin bootstrap and employee account management.
import { createServerFn } from "@tanstack/react-start";

async function getAdminClient() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function requireAdminFromToken(accessToken: string) {
  const admin = await getAdminClient();
  const { data, error } = await admin.auth.getUser(accessToken);
  if (error || !data.user) throw new Error("Unauthorized");
  const { data: roles } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", data.user.id);
  const isAdmin = (roles ?? []).some((r: { role: string }) => r.role === "admin");
  if (!isAdmin) throw new Error("Admins only");
  return { admin, userId: data.user.id };
}

// Claim admin on first-ever signup. Verifies the caller is signed in and that
// no admin exists yet; grants them the admin role and flips the bootstrap flag.
export const claimFirstAdmin = createServerFn({ method: "POST" })
  .inputValidator((input: { accessToken: string }) => input)
  .handler(async ({ data }) => {
    const admin = await getAdminClient();
    const { data: userData, error: uErr } = await admin.auth.getUser(data.accessToken);
    if (uErr || !userData.user) throw new Error("Not signed in");
    const uid = userData.user.id;

    const { data: bs } = await admin.from("auth_bootstrap").select("admin_claimed").eq("id", 1).single();
    if (bs?.admin_claimed) throw new Error("Admin already exists");

    const { error: rErr } = await admin.from("user_roles").insert({ user_id: uid, role: "admin" });
    if (rErr) throw new Error(rErr.message);

    await admin.from("auth_bootstrap").update({ admin_claimed: true, updated_at: new Date().toISOString() }).eq("id", 1);
    return { ok: true };
  });

// Admin creates a new employee account.
export const createEmployee = createServerFn({ method: "POST" })
  .inputValidator((input: { accessToken: string; email: string; password: string }) => input)
  .handler(async ({ data }) => {
    const { admin } = await requireAdminFromToken(data.accessToken);
    if (!/^\S+@\S+\.\S+$/.test(data.email)) throw new Error("Invalid email");
    if (data.password.length < 8) throw new Error("Password must be at least 8 characters");

    const { data: created, error } = await admin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
    });
    if (error || !created.user) throw new Error(error?.message || "Could not create user");

    const { error: rErr } = await admin.from("user_roles").insert({ user_id: created.user.id, role: "employee" });
    if (rErr) {
      // Clean up if role insert failed
      await admin.auth.admin.deleteUser(created.user.id);
      throw new Error(rErr.message);
    }
    return { ok: true, id: created.user.id, email: created.user.email };
  });

export const listEmployees = createServerFn({ method: "POST" })
  .inputValidator((input: { accessToken: string }) => input)
  .handler(async ({ data }) => {
    const { admin } = await requireAdminFromToken(data.accessToken);
    const { data: roles, error } = await admin
      .from("user_roles")
      .select("user_id, role, created_at")
      .eq("role", "employee")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const ids = (roles ?? []).map((r: { user_id: string }) => r.user_id);
    const users: { id: string; email: string | null; created_at: string }[] = [];
    for (const id of ids) {
      const { data: u } = await admin.auth.admin.getUserById(id);
      if (u?.user) users.push({ id: u.user.id, email: u.user.email ?? null, created_at: u.user.created_at });
    }
    return users;
  });

export const deleteEmployee = createServerFn({ method: "POST" })
  .inputValidator((input: { accessToken: string; userId: string }) => input)
  .handler(async ({ data }) => {
    const { admin, userId } = await requireAdminFromToken(data.accessToken);
    if (data.userId === userId) throw new Error("You cannot delete yourself");
    // Ensure target is not an admin
    const { data: targetRoles } = await admin.from("user_roles").select("role").eq("user_id", data.userId);
    if ((targetRoles ?? []).some((r: { role: string }) => r.role === "admin"))
      throw new Error("Cannot delete an admin account");
    const { error } = await admin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

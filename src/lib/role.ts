// Role helpers. Role is loaded from the DB after Supabase sign-in.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type Role = "admin" | "employee";

const ROLE_KEY = "ssm_role";

export function getRole(): Role | null {
  if (typeof window === "undefined") return null;
  const v = sessionStorage.getItem(ROLE_KEY);
  return v === "admin" || v === "employee" ? v : null;
}

export function setRole(role: Role) {
  sessionStorage.setItem(ROLE_KEY, role);
  window.dispatchEvent(new Event("ssm-role-change"));
}

export function clearRole() {
  sessionStorage.removeItem(ROLE_KEY);
  window.dispatchEvent(new Event("ssm-role-change"));
}

export async function loadRoleForCurrentUser(): Promise<Role | null> {
  const { data: sess } = await supabase.auth.getSession();
  const uid = sess.session?.user?.id;
  if (!uid) return null;
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", uid);
  if (error) return null;
  const roles = (data ?? []).map((r) => r.role as Role);
  if (roles.includes("admin")) {
    setRole("admin");
    return "admin";
  }
  if (roles.includes("employee")) {
    setRole("employee");
    return "employee";
  }
  return null;
}

export function useRole(): Role | null {
  const [role, setR] = useState<Role | null>(() => getRole());
  useEffect(() => {
    const update = () => setR(getRole());
    window.addEventListener("ssm-role-change", update);
    window.addEventListener("storage", update);
    return () => {
      window.removeEventListener("ssm-role-change", update);
      window.removeEventListener("storage", update);
    };
  }, []);
  return role;
}

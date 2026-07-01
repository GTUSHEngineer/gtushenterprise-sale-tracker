// Role helpers. Role is loaded from the DB after Supabase sign-in, then
// cached in localStorage per user so the app also works offline.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type Role = "admin" | "employee";

const ROLE_KEY = "ssm_role";
const ROLE_CACHE_PREFIX = "ssm_role_cache:"; // + userId
const BOOTSTRAP_CACHE_KEY = "ssm_bootstrap_claimed"; // "1" once first admin exists

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

function cacheRole(userId: string, role: Role) {
  try {
    localStorage.setItem(ROLE_CACHE_PREFIX + userId, role);
  } catch {
    /* ignore quota */
  }
}

function readCachedRole(userId: string): Role | null {
  const v = localStorage.getItem(ROLE_CACHE_PREFIX + userId);
  return v === "admin" || v === "employee" ? v : null;
}

export function markBootstrapClaimed() {
  try {
    localStorage.setItem(BOOTSTRAP_CACHE_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function isBootstrapClaimedCached(): boolean {
  return localStorage.getItem(BOOTSTRAP_CACHE_KEY) === "1";
}

/**
 * Resolve the current user's role.
 * - Online: query DB, then cache result for offline use.
 * - Offline (or DB call fails): fall back to the cached role for this user.
 */
export async function loadRoleForCurrentUser(): Promise<Role | null> {
  const { data: sess } = await supabase.auth.getSession();
  const uid = sess.session?.user?.id;
  if (!uid) return null;

  const online = typeof navigator === "undefined" ? true : navigator.onLine;

  if (online) {
    try {
      const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", uid);
      if (!error) {
        const roles = (data ?? []).map((r) => r.role as Role);
        const role: Role | null = roles.includes("admin")
          ? "admin"
          : roles.includes("employee")
            ? "employee"
            : null;
        if (role) {
          cacheRole(uid, role);
          markBootstrapClaimed();
          setRole(role);
          return role;
        }
        // Signed in but no role assigned — clear stale cache
        localStorage.removeItem(ROLE_CACHE_PREFIX + uid);
        return null;
      }
    } catch {
      /* fall through to cache */
    }
  }

  // Offline / lookup failed → use cached role if we have one for this user
  const cached = readCachedRole(uid);
  if (cached) {
    setRole(cached);
    return cached;
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

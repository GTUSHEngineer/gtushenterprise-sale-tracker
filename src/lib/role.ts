// Role helpers. Role is set at unlock time in sessionStorage.
import { useEffect, useState } from "react";

export type Role = "admin" | "employee";

const ROLE_KEY = "ssm_role";

export function getRole(): Role | null {
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

export function useRole(): Role | null {
  const [role, setR] = useState<Role | null>(() =>
    typeof window === "undefined" ? null : getRole(),
  );
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

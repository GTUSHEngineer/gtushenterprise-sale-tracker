export type SaleType = "normal" | "donated" | "spoilt";

export const CODE_REGEX = /^[A-Z0-9\/\-]{4,}$/;

export function parseSaleCode(input: string): { code: string; type: SaleType } | null {
  const raw = input.trim().toUpperCase();
  if (!raw) return null;
  if (raw.endsWith(".D")) {
    const code = raw.slice(0, -2);
    return CODE_REGEX.test(code) ? { code, type: "donated" } : null;
  }
  if (raw.endsWith(".S")) {
    const code = raw.slice(0, -2);
    return CODE_REGEX.test(code) ? { code, type: "spoilt" } : null;
  }
  if (raw.includes(".")) return null; // invalid suffix
  return CODE_REGEX.test(raw) ? { code: raw, type: "normal" } : null;
}

export function formatKsh(n: number): string {
  return `Ksh ${Math.round(n).toLocaleString("en-KE")}`;
}

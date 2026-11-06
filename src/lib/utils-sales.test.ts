import { describe, expect, it } from "bun:test";
import { calculateSaleTotal } from "@/lib/utils-sales";

describe("calculateSaleTotal", () => {
  it("uses the manually entered unit price for a normal sale", () => {
    expect(calculateSaleTotal(3, 125, "normal")).toBe(375);
  });

  it("keeps donated and spoilt sales at zero", () => {
    expect(calculateSaleTotal(3, 125, "donated")).toBe(0);
    expect(calculateSaleTotal(3, 125, "spoilt")).toBe(0);
  });
});
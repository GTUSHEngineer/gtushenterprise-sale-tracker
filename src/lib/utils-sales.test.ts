import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { calculateSaleTotal } from "@/lib/utils-sales";

describe("calculateSaleTotal", () => {
  it("uses the manually entered unit price for a normal sale", () => {
    assert.equal(calculateSaleTotal(3, 125, "normal"), 375);
  });

  it("keeps donated and spoilt sales at zero", () => {
    assert.equal(calculateSaleTotal(3, 125, "donated"), 0);
    assert.equal(calculateSaleTotal(3, 125, "spoilt"), 0);
  });
});
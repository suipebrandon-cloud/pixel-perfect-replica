import { describe, it, expect } from "vitest";
import { accountBalance, outstandingContract, totalReceived, formatFCFA } from "./money";

describe("financial rules", () => {
  it("account balance = opening + in − out", () => {
    expect(
      accountBalance(50_000, [
        { direction: "in", amount: 1_000_000 },
        { direction: "out", amount: 855_000 },
      ]),
    ).toBe(195_000);
  });

  it("acceptance: 1,000,000 paid upfront leaves 0 outstanding", () => {
    const r = [{ amount: 1_000_000, status: "posted" as const }];
    expect(totalReceived(r)).toBe(1_000_000);
    expect(outstandingContract(1_000_000, r)).toBe(0);
  });

  it("reversed receipts do not count as received", () => {
    const r = [
      { amount: 400_000, status: "reversed" as const },
      { amount: 300_000, status: "posted" as const },
    ];
    expect(outstandingContract(1_000_000, r)).toBe(700_000);
  });

  it("formats whole FCFA", () => {
    expect(formatFCFA(1000000)).toBe("FCFA 1 000 000");
  });
});

import { spendWithdrawalMonth } from "./spendWithdrawal"

describe("spendWithdrawalMonth", () => {
  it("names the month of a spend withdrawal", () => {
    expect(
      spendWithdrawalMonth({
        callerRef: { provider: "SPEND", batch: "2026-11", callerId: "x" },
      }),
    ).toBe("2026-11")
  })

  it("is null for any other transaction", () => {
    expect(
      spendWithdrawalMonth({
        callerRef: { provider: "BC", batch: "2026-11", callerId: "x" },
      }),
    ).toBeNull()
    expect(
      spendWithdrawalMonth({
        callerRef: { provider: "SPEND", batch: "20261120", callerId: "x" },
      }),
    ).toBeNull()
    expect(spendWithdrawalMonth({ callerRef: null })).toBeNull()
  })
})

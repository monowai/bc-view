import { buildPayslipPayload } from "@lib/trns/payslipPayload"

const base = {
  portfolioId: "pf-1",
  tradeDate: "2026-06-17",
  cashAssetId: "cash-sgd",
  cashCurrency: "SGD",
}

describe("buildPayslipPayload", () => {
  describe("with CPF", () => {
    const payload = buildPayslipPayload({
      ...base,
      grossSalary: 6000,
      tax: 500,
      cpfAssetId: "cpf-asset",
      employeeContribution: 1200,
      buckets: [
        { code: "OA", amount: 1380 },
        { code: "SA", amount: 360 },
        { code: "MA", amount: 660 },
      ],
    })

    it("forwards the chosen portfolio", () => {
      expect(payload.portfolioId).toBe("pf-1")
    })

    it("emits four legs: salary, employee CPF, tax, CPF ADD", () => {
      expect(payload.data).toHaveLength(4)
      expect(payload.data.map((l) => l.trnType)).toEqual([
        "INCOME",
        "DEDUCTION",
        "DEDUCTION",
        "ADD",
      ])
    })

    it("credits gross salary as INCOME to the cash asset (cash convention: price 1, amount in quantity)", () => {
      const salary = payload.data[0]
      expect(salary.trnType).toBe("INCOME")
      expect(salary.assetId).toBe("cash-sgd")
      expect(salary.cashAssetId).toBe("cash-sgd")
      expect(salary.price).toBe(1)
      expect(salary.quantity).toBe(6000)
      expect(salary.cashAmount).toBe(6000)
      expect(salary.tradeAmount).toBe(6000)
      expect(salary.tradeCurrency).toBe("SGD")
    })

    it("debits ONLY the employee contribution from cash (employer is on-top)", () => {
      const employee = payload.data[1]
      expect(employee.trnType).toBe("DEDUCTION")
      expect(employee.cashAssetId).toBe("cash-sgd")
      expect(employee.price).toBe(1)
      expect(employee.quantity).toBe(1200)
      expect(employee.cashAmount).toBe(-1200)
    })

    it("debits tax from cash when tax > 0", () => {
      const taxLeg = payload.data[2]
      expect(taxLeg.trnType).toBe("DEDUCTION")
      expect(taxLeg.price).toBe(1)
      expect(taxLeg.quantity).toBe(500)
      expect(taxLeg.cashAmount).toBe(-500)
      expect(taxLeg.tax).toBe(500)
    })

    it("ADDs the bucket total to the CPF asset with subAccounts and no cash impact", () => {
      const cpf = payload.data[3]
      expect(cpf.trnType).toBe("ADD")
      expect(cpf.assetId).toBe("cpf-asset")
      expect(cpf.cashAmount).toBe(0)
      expect(cpf.quantity).toBe(2400) // 1380 + 360 + 660 = employee + employer total
      expect(cpf.tradeAmount).toBe(2400)
      expect(cpf.subAccounts).toEqual({ OA: 1380, SA: 360, MA: 660 })
    })

    it("honours overridden bucket values in the subAccounts and total", () => {
      const overridden = buildPayslipPayload({
        ...base,
        grossSalary: 6000,
        cpfAssetId: "cpf-asset",
        employeeContribution: 1200,
        buckets: [
          { code: "OA", amount: 1000 },
          { code: "SA", amount: 500 },
          { code: "MA", amount: 700 },
        ],
      })
      const cpf = overridden.data[overridden.data.length - 1]
      expect(cpf.subAccounts).toEqual({ OA: 1000, SA: 500, MA: 700 })
      expect(cpf.quantity).toBe(2200)
    })

    it("omits the tax leg when tax is 0", () => {
      const noTax = buildPayslipPayload({
        ...base,
        grossSalary: 6000,
        tax: 0,
        cpfAssetId: "cpf-asset",
        employeeContribution: 1200,
        buckets: [{ code: "OA", amount: 1200 }],
      })
      expect(noTax.data.map((l) => l.trnType)).toEqual([
        "INCOME",
        "DEDUCTION",
        "ADD",
      ])
    })

    it("rounds .005 amounts half-up to cents (float-safe)", () => {
      const payload = buildPayslipPayload({
        ...base,
        grossSalary: 100.005,
        cpfAssetId: "cpf-asset",
        employeeContribution: 1.005,
        buckets: [
          { code: "OA", amount: 1.005 },
          { code: "SA", amount: 2.005 },
        ],
      })
      const salary = payload.data[0]
      expect(salary.cashAmount).toBe(100.01)
      expect(salary.tradeAmount).toBe(100.01)
      expect(salary.quantity).toBe(100.01)
      expect(salary.price).toBe(1)

      const employee = payload.data[1]
      expect(employee.cashAmount).toBe(-1.01)

      const cpf = payload.data[payload.data.length - 1]
      expect(cpf.subAccounts).toEqual({ OA: 1.01, SA: 2.01 })
      // sum-then-round: 1.005 + 2.005 = 3.0099… → 3.01
      expect(cpf.quantity).toBe(3.01)
      expect(cpf.tradeAmount).toBe(3.01)
    })

    it("supports RA bucket code (post-retirement)", () => {
      const ra = buildPayslipPayload({
        ...base,
        grossSalary: 5000,
        cpfAssetId: "cpf-asset",
        employeeContribution: 1000,
        buckets: [
          { code: "RA", amount: 1500 },
          { code: "MA", amount: 500 },
        ],
      })
      const cpf = ra.data[ra.data.length - 1]
      expect(cpf.subAccounts).toEqual({ RA: 1500, MA: 500 })
    })
  })

  describe("without CPF", () => {
    it("emits only the salary leg when there is no CPF asset and no tax", () => {
      const payload = buildPayslipPayload({
        ...base,
        grossSalary: 4000,
      })
      expect(payload.data).toHaveLength(1)
      expect(payload.data[0].trnType).toBe("INCOME")
      expect(payload.data[0].cashAmount).toBe(4000)
    })

    it("emits salary + tax (no CPF legs) when tax > 0 but no CPF asset", () => {
      const payload = buildPayslipPayload({
        ...base,
        grossSalary: 4000,
        tax: 300,
      })
      expect(payload.data.map((l) => l.trnType)).toEqual([
        "INCOME",
        "DEDUCTION",
      ])
      expect(payload.data[1].cashAmount).toBe(-300)
    })

    it("does not add CPF legs when buckets are empty even with a cpfAssetId", () => {
      const payload = buildPayslipPayload({
        ...base,
        grossSalary: 4000,
        cpfAssetId: "cpf-asset",
        employeeContribution: 1000,
        buckets: [],
      })
      expect(payload.data.map((l) => l.trnType)).toEqual(["INCOME"])
    })
  })
})

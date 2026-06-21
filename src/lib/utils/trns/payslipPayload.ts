import { DefinedContributionBucket } from "@components/features/independence/useDefinedContribution"

/**
 * One transaction leg of a payslip submission, matching the loose REST shape
 * accepted by `POST /api/trns` ({ portfolioId, data: PayslipTrnLeg[] }).
 *
 * The backend `TrnDto` already supports `subAccounts` and an arbitrary
 * `trnType`, so the CPF credit leg can carry its OA/SA|RA/MA split directly.
 */
export interface PayslipTrnLeg {
  assetId: string
  trnType: string
  quantity: number
  price: number
  tradeCurrency: string
  tradeAmount: number
  cashCurrency: string
  cashAssetId?: string
  cashAmount: number
  tradeDate: string
  fees: number
  tax: number
  comments: string
  status: string
  subAccounts?: Record<string, number>
}

export interface PayslipPayload {
  portfolioId: string
  data: PayslipTrnLeg[]
}

export interface BuildPayslipPayloadInput {
  portfolioId: string
  tradeDate: string
  /** Gross salary paid into the cash asset (positive). */
  grossSalary: number
  /** Optional tax withheld (positive; 0 or undefined = no tax leg). */
  tax?: number
  /** Cash asset id the salary is paid into / deductions come out of. */
  cashAssetId: string
  /** Currency of the cash asset (also the trade currency of the cash legs). */
  cashCurrency: string
  /**
   * CPF / pension asset id to credit. When absent (no CPF asset) only the
   * salary + optional tax legs are produced.
   */
  cpfAssetId?: string
  /**
   * Employee-only contribution that comes OUT of cash (positive). The employer
   * portion is on-top and never debits cash, so it is excluded here.
   */
  employeeContribution?: number
  /**
   * Per-bucket CPF allocation (employee + employer total). Drives both the
   * `subAccounts` map and the ADD leg's quantity/amount (the sum of buckets).
   */
  buckets?: DefinedContributionBucket[]
}

/**
 * Round a monetary value to cents using decimal half-up. Plain
 * `Math.round(n * 100) / 100` (and `n.toFixed(2)`) mis-round values whose
 * IEEE-754 representation lands just below the .5 boundary — e.g. 1.005 is
 * stored as 1.00499999…, so both naive forms yield 1.00. Nudging by a relative
 * epsilon before scaling restores the intended half-up result (1.005 → 1.01).
 */
const roundMoney = (n: number): number =>
  Math.round((n + Math.sign(n) * Math.abs(n) * Number.EPSILON) * 100) / 100

const round2 = roundMoney

const sumBuckets = (buckets: DefinedContributionBucket[]): number =>
  round2(buckets.reduce((acc, b) => acc + (b.amount || 0), 0))

const bucketsToSubAccounts = (
  buckets: DefinedContributionBucket[],
): Record<string, number> =>
  buckets.reduce<Record<string, number>>((acc, b) => {
    if (b.code) acc[b.code] = round2(b.amount || 0)
    return acc
  }, {})

/**
 * Build the multi-leg `POST /api/trns` payload for an Enter-Payslip submission.
 *
 * Legs (single request, shared tradeDate):
 *  1. Salary    — INCOME crediting cash (+gross).
 *  2. Employee CPF — DEDUCTION debiting cash (−employeeContribution). Only the
 *     employee portion touches cash; the employer match is on-top.
 *  3. Tax       — DEDUCTION debiting cash (−tax). Only when tax > 0.
 *  4. CPF credit — ADD to the CPF asset (no cash impact) with `subAccounts`
 *     from the (possibly overridden) buckets; amount = sum of buckets.
 *
 * Legs 2 & 4 are omitted when there is no CPF asset / no buckets.
 */
export function buildPayslipPayload(
  input: BuildPayslipPayloadInput,
): PayslipPayload {
  const {
    portfolioId,
    tradeDate,
    grossSalary,
    tax,
    cashAssetId,
    cashCurrency,
    cpfAssetId,
    employeeContribution,
    buckets,
  } = input

  const data: PayslipTrnLeg[] = []

  // 1. Salary — INCOME credits the cash asset with the gross amount.
  // Cash legs follow the cash convention: price = 1, the amount lives in
  // quantity (matches CashInputForm / cash transfers). Putting the amount in
  // price corrupts the cash position's derived unit price.
  const gross = round2(grossSalary)
  data.push({
    assetId: cashAssetId,
    trnType: "INCOME",
    quantity: gross,
    price: 1,
    tradeCurrency: cashCurrency,
    tradeAmount: gross,
    cashCurrency,
    cashAssetId,
    cashAmount: gross,
    tradeDate,
    fees: 0,
    tax: 0,
    comments: "Salary",
    status: "SETTLED",
  })

  const hasCpf = !!cpfAssetId && !!buckets && buckets.length > 0

  // 2. Employee CPF — DEDUCTION debits cash (employee portion only).
  if (hasCpf && employeeContribution && employeeContribution > 0) {
    const employee = round2(employeeContribution)
    data.push({
      assetId: cashAssetId,
      trnType: "DEDUCTION",
      quantity: employee,
      price: 1,
      tradeCurrency: cashCurrency,
      tradeAmount: employee,
      cashCurrency,
      cashAssetId,
      cashAmount: -employee,
      tradeDate,
      fees: 0,
      tax: 0,
      comments: "Employee CPF contribution",
      status: "SETTLED",
    })
  }

  // 3. Tax — DEDUCTION debits cash. Optional.
  if (tax && tax > 0) {
    const taxAmount = round2(tax)
    data.push({
      assetId: cashAssetId,
      trnType: "DEDUCTION",
      quantity: taxAmount,
      price: 1,
      tradeCurrency: cashCurrency,
      tradeAmount: taxAmount,
      cashCurrency,
      cashAssetId,
      cashAmount: -taxAmount,
      tradeDate,
      fees: 0,
      tax: taxAmount,
      comments: "Tax",
      status: "SETTLED",
    })
  }

  // 4. CPF credit — ADD to the CPF asset (no cash impact) with sub-accounts.
  if (hasCpf) {
    const subAccounts = bucketsToSubAccounts(buckets!)
    const total = sumBuckets(buckets!)
    data.push({
      assetId: cpfAssetId!,
      trnType: "ADD",
      quantity: total,
      price: 1,
      tradeCurrency: cashCurrency,
      tradeAmount: total,
      // ADD has no cash impact — settlement currency is nominal, no cash asset.
      cashCurrency,
      cashAmount: 0,
      tradeDate,
      fees: 0,
      tax: 0,
      comments: "CPF contribution",
      status: "SETTLED",
      subAccounts,
    })
  }

  return { portfolioId, data }
}

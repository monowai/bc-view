import { buildMePatchBody } from "../buildMePatchBody"

const baseInput = {
  preferredName: "Mary",
  baseCurrency: "SGD",
  reportingCurrency: "SGD",
  independencePlanEnabled: true,
  independenceYearOfBirth: 1981,
  independenceMonthOfBirth: 1,
  independenceTargetAge: 60,
}

describe("buildMePatchBody", () => {
  it("includes targetIndependenceAge when the user filled in the independence step", () => {
    // Regression for DEMO-ISSUES #14 — Plan Profile read defaults (Target
    // 65) until the user re-saved because targetIndependenceAge never made
    // it onto the PATCH /api/me body, and svc-data UserPreferences didn't
    // hold the value either. With the field now plumbed (alongside the
    // svc-data column + svc-retire fallback in companion PRs), a freshly
    // onboarded user's Plan Profile picks up their entered values without
    // a manual save.
    const body = buildMePatchBody(baseInput)

    expect(body).toEqual({
      preferredName: "Mary",
      baseCurrencyCode: "SGD",
      reportingCurrencyCode: "SGD",
      yearOfBirth: 1981,
      monthOfBirth: 1,
      targetIndependenceAge: 60,
    })
  })

  it("omits the demographic fields when the independence step was skipped", () => {
    const body = buildMePatchBody({
      ...baseInput,
      independencePlanEnabled: false,
    })

    expect(body.yearOfBirth).toBeUndefined()
    expect(body.monthOfBirth).toBeUndefined()
    expect(body.targetIndependenceAge).toBeUndefined()
    expect(body.baseCurrencyCode).toBe("SGD")
  })

  it("saves date of birth (but not target age) when a CPF pension requires it, even if the plan was skipped", () => {
    // CPF contribution rates are age-banded; without yearOfBirth the payslip
    // DC calc never fires and no CPF deduction is recorded. So a CPF pension
    // forces the demographic fields onto the PATCH even when the independence
    // plan itself is skipped.
    const body = buildMePatchBody({
      ...baseInput,
      independencePlanEnabled: false,
      cpfRequiresDob: true,
    })

    expect(body.yearOfBirth).toBe(1981)
    expect(body.monthOfBirth).toBe(1)
    // targetIndependenceAge is plan-only — still omitted.
    expect(body.targetIndependenceAge).toBeUndefined()
  })

  it("collapses an empty preferredName to undefined so the field is omitted", () => {
    const body = buildMePatchBody({ ...baseInput, preferredName: "" })

    expect(body.preferredName).toBeUndefined()
  })
})

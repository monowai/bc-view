/**
 * Build the PATCH body for `/api/me` on onboarding completion.
 *
 * Date of birth is mirrored onto the svc-data master `UserPreferences` so
 * age-driven calculations resolve real values instead of the defaults
 * (currentYear-55 / target 65). It is saved when EITHER:
 *  - the user enabled the Independence plan (age-driven projections), or
 *  - the user set up a CPF pension (`cpfRequiresDob`) — CPF contribution
 *    rates are age-banded, so the payslip / DC calc is broken without it.
 * `targetIndependenceAge` is only relevant to the plan, so it is saved only
 * when the plan is enabled. See bc-claude/USER_PROFILE.md.
 */
export interface OnboardingMePatchInput {
  preferredName: string
  baseCurrency: string
  reportingCurrency: string
  independencePlanEnabled: boolean
  cpfRequiresDob?: boolean
  independenceYearOfBirth: number
  independenceMonthOfBirth: number
  independenceTargetAge: number
}

export interface OnboardingMePatchBody {
  preferredName?: string
  baseCurrencyCode: string
  reportingCurrencyCode: string
  yearOfBirth?: number
  monthOfBirth?: number
  targetIndependenceAge?: number
}

export function buildMePatchBody(
  input: OnboardingMePatchInput,
): OnboardingMePatchBody {
  const saveDob = input.independencePlanEnabled || !!input.cpfRequiresDob
  return {
    preferredName: input.preferredName || undefined,
    baseCurrencyCode: input.baseCurrency,
    reportingCurrencyCode: input.reportingCurrency,
    ...(saveDob && {
      yearOfBirth: input.independenceYearOfBirth,
      monthOfBirth: input.independenceMonthOfBirth,
    }),
    ...(input.independencePlanEnabled && {
      targetIndependenceAge: input.independenceTargetAge,
    }),
  }
}

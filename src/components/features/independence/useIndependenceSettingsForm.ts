import { useState } from "react"
import { useIndependenceSettings } from "@components/features/independence/useIndependenceSettings"
import { UpdateSettingsRequest } from "types/independence"

export const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
]

function calculateAge(
  yearOfBirth: number,
  monthOfBirth?: number,
): { years: number; display: string } {
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1 // 1-based
  let age = currentYear - yearOfBirth
  if (monthOfBirth && currentMonth < monthOfBirth) {
    age -= 1
  }
  const display =
    monthOfBirth && currentMonth < monthOfBirth
      ? `${age} (turning ${age + 1} in ${MONTHS[monthOfBirth - 1]})`
      : `${age}`
  return { years: age, display }
}

interface UseIndependenceSettingsFormOptions {
  /** A closed form skips re-seeding, and re-seeds again once active. */
  isActive?: boolean
  onReseed?: () => void
}

interface UseIndependenceSettingsFormResult {
  yearOfBirth: number | undefined
  setYearOfBirth: (value: number | undefined) => void
  monthOfBirth: number | undefined
  setMonthOfBirth: (value: number | undefined) => void
  targetIndependenceAge: number | undefined
  setTargetIndependenceAge: (value: number | undefined) => void
  lifeExpectancy: number | undefined
  setLifeExpectancy: (value: number | undefined) => void
  maxYearOfBirth: number
  ageDisplay: string
  validate: () => string | null
  save: () => Promise<void>
}

/** Field state, validation and save shared by the settings modal and panel. */
export function useIndependenceSettingsForm({
  isActive = true,
  onReseed,
}: UseIndependenceSettingsFormOptions = {}): UseIndependenceSettingsFormResult {
  const { settings, updateSettings } = useIndependenceSettings()

  const maxYearOfBirth = new Date().getFullYear() - 18
  // Empty when unset — never seed a plausible default the user might save
  // unchanged (it silently mis-models the whole projection).
  const [yearOfBirth, setYearOfBirth] = useState<number | undefined>(
    settings?.yearOfBirth ?? undefined,
  )
  const [monthOfBirth, setMonthOfBirth] = useState<number | undefined>(
    settings?.monthOfBirth ?? undefined,
  )
  const [targetIndependenceAge, setTargetIndependenceAge] = useState<
    number | undefined
  >(settings?.targetIndependenceAge ?? undefined)
  const [lifeExpectancy, setLifeExpectancy] = useState<number | undefined>(
    settings?.lifeExpectancy ?? undefined,
  )

  // Re-seed the form whenever it activates or the settings change.
  // Render-phase "store previous value" pattern keyed on a stable value
  // signature (not the settings object ref, which may change identity each
  // render). Mount is handled by the lazy initializers above.
  const seedSignature = `${isActive}:${settings?.yearOfBirth}:${settings?.monthOfBirth}:${settings?.targetIndependenceAge}:${settings?.lifeExpectancy}`
  const [prevSeedSignature, setPrevSeedSignature] = useState(seedSignature)
  if (seedSignature !== prevSeedSignature) {
    setPrevSeedSignature(seedSignature)
    if (isActive && settings) {
      setYearOfBirth(settings.yearOfBirth ?? undefined)
      setMonthOfBirth(settings.monthOfBirth ?? undefined)
      setTargetIndependenceAge(settings.targetIndependenceAge ?? undefined)
      setLifeExpectancy(settings.lifeExpectancy ?? undefined)
      onReseed?.()
    }
  }

  const { years: currentAge, display: ageDisplay } =
    yearOfBirth != null
      ? calculateAge(yearOfBirth, monthOfBirth)
      : { years: 0, display: "—" }

  const validate = (): string | null => {
    if (yearOfBirth == null) {
      return "Year of birth is required"
    }
    if (yearOfBirth < 1920 || yearOfBirth > maxYearOfBirth) {
      return `Year of birth must be between 1920 and ${maxYearOfBirth}`
    }
    if (monthOfBirth == null) {
      return "Month of birth is required"
    }
    if (monthOfBirth < 1 || monthOfBirth > 12) {
      return "Month must be between 1 and 12"
    }
    if (targetIndependenceAge == null) {
      return "Target independence age is required"
    }
    if (targetIndependenceAge < currentAge) {
      return "Target independence age must be at or after your current age"
    }
    if (targetIndependenceAge < 18 || targetIndependenceAge > 100) {
      return "Target independence age must be between 18 and 100"
    }
    if (lifeExpectancy == null) {
      return "Life expectancy is required"
    }
    if (lifeExpectancy <= targetIndependenceAge) {
      return "Life expectancy must be after target independence age"
    }
    if (lifeExpectancy < 50 || lifeExpectancy > 120) {
      return "Life expectancy must be between 50 and 120"
    }
    return null
  }

  const save = async (): Promise<void> => {
    const request: UpdateSettingsRequest = {
      yearOfBirth,
      monthOfBirth,
      targetIndependenceAge,
      lifeExpectancy,
    }
    await updateSettings(request)
  }

  return {
    yearOfBirth,
    setYearOfBirth,
    monthOfBirth,
    setMonthOfBirth,
    targetIndependenceAge,
    setTargetIndependenceAge,
    lifeExpectancy,
    setLifeExpectancy,
    maxYearOfBirth,
    ageDisplay,
    validate,
    save,
  }
}

import { localIsoDate } from "@lib/formatters"
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
  retired: boolean
  setRetired: (value: boolean) => void
  retiredOn: string
  setRetiredOn: (value: string) => void
  /** Today (yyyy-MM-dd): a retired-on date may not be later. */
  maxRetiredOn: string
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

  const now = new Date()
  const maxYearOfBirth = now.getFullYear() - 18
  const maxRetiredOn = localIsoDate(now)
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
  const [retired, setRetired] = useState<boolean>(!!settings?.retiredOn)
  const [retiredOn, setRetiredOn] = useState<string>(settings?.retiredOn ?? "")

  // Re-seed the form whenever it activates or the settings change.
  // Render-phase "store previous value" pattern keyed on a stable value
  // signature (not the settings object ref, which may change identity each
  // render). Mount is handled by the lazy initializers above.
  const seedSignature = `${isActive}:${settings?.yearOfBirth}:${settings?.monthOfBirth}:${settings?.targetIndependenceAge}:${settings?.lifeExpectancy}:${settings?.retiredOn}`
  const [prevSeedSignature, setPrevSeedSignature] = useState(seedSignature)
  if (seedSignature !== prevSeedSignature) {
    setPrevSeedSignature(seedSignature)
    if (isActive && settings) {
      setYearOfBirth(settings.yearOfBirth ?? undefined)
      setMonthOfBirth(settings.monthOfBirth ?? undefined)
      setTargetIndependenceAge(settings.targetIndependenceAge ?? undefined)
      setLifeExpectancy(settings.lifeExpectancy ?? undefined)
      setRetired(!!settings.retiredOn)
      setRetiredOn(settings.retiredOn ?? "")
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
    if (retired) {
      if (!retiredOn) {
        return "Retired on date is required"
      }
      // yyyy-MM-dd strings compare in date order.
      if (retiredOn > maxRetiredOn) {
        return "Retired on date cannot be in the future"
      }
    } else {
      if (targetIndependenceAge == null) {
        return "Target independence age is required"
      }
      if (targetIndependenceAge < currentAge) {
        return "Target independence age must be at or after your current age"
      }
      if (targetIndependenceAge < 18 || targetIndependenceAge > 100) {
        return "Target independence age must be between 18 and 100"
      }
    }
    if (lifeExpectancy == null) {
      return "Life expectancy is required"
    }
    if (
      !retired &&
      targetIndependenceAge != null &&
      lifeExpectancy <= targetIndependenceAge
    ) {
      return "Life expectancy must be after target independence age"
    }
    if (lifeExpectancy < 50 || lifeExpectancy > 120) {
      return "Life expectancy must be between 50 and 120"
    }
    return null
  }

  const save = async (): Promise<void> => {
    // Retired: send the date and leave the stored target age alone, so
    // unticking later restores it. Unticked after being retired: clear it.
    // Never retired: omit `retired` so the backend leaves it unchanged.
    const request: UpdateSettingsRequest = retired
      ? { yearOfBirth, monthOfBirth, lifeExpectancy, retired: true, retiredOn }
      : {
          yearOfBirth,
          monthOfBirth,
          targetIndependenceAge,
          lifeExpectancy,
          ...(settings?.retiredOn ? { retired: false } : {}),
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
    retired,
    setRetired,
    retiredOn,
    setRetiredOn,
    maxRetiredOn,
    maxYearOfBirth,
    ageDisplay,
    validate,
    save,
  }
}

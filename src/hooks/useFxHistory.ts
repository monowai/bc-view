import { useState, useMemo } from "react"
import useSwr from "swr"
import { simpleFetcher } from "@utils/api/fetchHelper"

interface FxHistoryResponse {
  from: string
  to: string
  startDate: string
  endDate: string
  data: Array<{ date: string; rate: number }>
}

interface FxHistoryStats {
  min: number
  max: number
  current: number
  change: number
  changePercent: number
}

interface UseFxHistoryResult {
  chartData: Array<{ date: string; rate: number }>
  stats: FxHistoryStats | null
  isLoading: boolean
  error: Error | undefined
  months: number
  setMonths: (months: number) => void
  isInverted: boolean
  setIsInverted: (inverted: boolean) => void
}

export function useFxHistory(
  initialFrom: string,
  initialTo: string,
): UseFxHistoryResult {
  const [months, setMonths] = useState(3)
  const [isInverted, setIsInverted] = useState(false)

  const from = isInverted ? initialTo : initialFrom
  const to = isInverted ? initialFrom : initialTo

  const { data, isLoading, error } = useSwr<FxHistoryResponse>(
    `/api/fx/history?from=${from}&to=${to}&months=${months}`,
    simpleFetcher(`/api/fx/history?from=${from}&to=${to}&months=${months}`),
  )

  const chartData = data?.data || []

  const stats = useMemo(() => {
    const rateData = data?.data || []
    if (rateData.length === 0) return null
    const rates = rateData.map((d) => d.rate)
    const min = Math.min(...rates)
    const max = Math.max(...rates)
    const current = rates[rates.length - 1]
    const first = rates[0]
    const change = current - first
    const changePercent = (change / first) * 100
    return { min, max, current, change, changePercent }
  }, [data?.data])

  return {
    chartData,
    stats,
    isLoading,
    error,
    months,
    setMonths,
    isInverted,
    setIsInverted,
  }
}

// Shared mock holdings data for GrandTotal tests
import { ValueIn } from '@components/features/holdings/GroupByOptions'

export const mockHoldings = {
  holdingGroups: {},
  currency: { code: 'USD', name: 'US Dollar', symbol: '$' },
  portfolio: {
    id: 'test-portfolio',
    code: 'TEST',
    name: 'Test Portfolio',
    currency: { code: 'USD', name: 'US Dollar', symbol: '$' },
    base: { code: 'USD', name: 'US Dollar', symbol: '$' },
    marketValue: 12643.74,
    irr: 0.15
  },
  valueIn: ValueIn.PORTFOLIO,
  viewTotals: {
    gainOnDay: 72.76,
    costValue: 8150.65,
    marketValue: 12643.74,
    dividends: 299.02,
    unrealisedGain: 3503.85,
    realisedGain: 481.44,
    irr: 0.15,
    weight: 1.0,
    totalGain: 4284.31,
    currency: { code: 'USD', name: 'US Dollar', symbol: '$' },
    fees: 0,
    tax: 0,
    cash: 0,
    purchases: 8150.65,
    sales: 0,
    costBasis: 8150.65,
    averageCost: 45.28,
    priceData: { change: 0, close: 70.25, previousClose: 70.25, changePercent: 0, priceDate: '2023-01-01' },
    valueIn: { code: 'USD', name: 'US Dollar', symbol: '$' },
    roi: 0.55,
    [ValueIn.PORTFOLIO]: {} as any
  },
  totals: {
    marketValue: 12643.74,
    purchases: 8150.65,
    sales: 0,
    cash: 0,
    income: 299.02,
    gain: 4284.31,
    irr: 0.15,
    currency: { code: 'USD', name: 'US Dollar', symbol: '$' }
  }
}

export const mockValueIn = ValueIn.PORTFOLIO

// Shared mock implementation for next-i18next
export const mockUseTranslation = (): { t: (key: string, options?: any) => string; ready: boolean } => ({
  t: (key: string, options?: any) => {
    if (key === 'holdings.valueTitle') return `Value in ${options?.valueIn || 'USD'}`
    return key
  },
  ready: true
})
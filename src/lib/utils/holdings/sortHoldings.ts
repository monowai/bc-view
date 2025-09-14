import { HoldingGroup } from "types/beancounter"

export type SortConfig = {
  key: string | null
  direction: 'asc' | 'desc'
}

function getValueForSorting(position: any, sortKey: string, valueIn: string): number | string {
  switch (sortKey) {
    case 'assetName':
      return position.asset.code.toLowerCase()
    case 'price':
      return position.moneyValues[valueIn].priceData?.close || 0
    case 'changePercent':
      return position.moneyValues[valueIn].priceData?.changePercent || 0
    case 'gainOnDay':
      return position.moneyValues[valueIn].gainOnDay || 0
    case 'quantity':
      return position.quantityValues.total || 0
    case 'costValue':
      return position.moneyValues[valueIn].costValue || 0
    case 'marketValue':
      return position.moneyValues[valueIn].marketValue || 0
    case 'dividends':
      return position.moneyValues[valueIn].dividends || 0
    case 'unrealisedGain':
      return position.moneyValues[valueIn].unrealisedGain || 0
    case 'realisedGain':
      return position.moneyValues[valueIn].realisedGain || 0
    case 'irr':
      return position.moneyValues[valueIn].irr || 0
    case 'weight':
      return position.moneyValues[valueIn].weight || 0
    case 'totalGain':
      return position.moneyValues[valueIn].totalGain || 0
    default:
      return position.asset.code.toLowerCase()
  }
}

export function sortPositions(holdingGroup: HoldingGroup, sortConfig: SortConfig, valueIn: string): HoldingGroup {
  if (!sortConfig.key) return holdingGroup

  const sortedPositions = [...holdingGroup.positions].sort((a, b) => {
    const aValue = getValueForSorting(a, sortConfig.key!, valueIn)
    const bValue = getValueForSorting(b, sortConfig.key!, valueIn)

    let result: number
    if (typeof aValue === 'string' && typeof bValue === 'string') {
      result = aValue.localeCompare(bValue)
    } else {
      result = (aValue as number) - (bValue as number)
    }

    return sortConfig.direction === 'asc' ? result : -result
  })

  return {
    ...holdingGroup,
    positions: sortedPositions
  }
}

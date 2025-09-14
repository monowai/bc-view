import React, { ReactElement } from "react"
import { GroupKey } from "types/beancounter"
import { useTranslation } from "next-i18next"

type SortConfig = {
  key: string | null
  direction: 'asc' | 'desc'
}

interface HeaderProps extends GroupKey {
  sortConfig?: SortConfig
  onSort?: (key: string) => void
}

export const headers = [
  { key: "asset.price", align: "left", mobile: true, medium: true, sortable: true, sortKey: "price" },
  { key: "asset.change", align: "right", mobile: false, medium: false, sortable: true, sortKey: "changePercent" },
  { key: "gain.onday", align: "right", mobile: false, medium: false, sortable: true, sortKey: "gainOnDay" },
  { key: "quantity", align: "right", mobile: true, medium: true, sortable: true, sortKey: "quantity" },
  { key: "cost", align: "right", mobile: false, medium: true, sortable: true, sortKey: "costValue" },
  { key: "summary.value", align: "right", mobile: true, medium: true, sortable: true, sortKey: "marketValue" },
  { key: "summary.dividends", align: "right", mobile: false, medium: false, sortable: true, sortKey: "dividends" },
  { key: "gain.unrealised", align: "right", mobile: true, medium: true, sortable: true, sortKey: "unrealisedGain" },
  { key: "gain.realised", align: "right", mobile: false, medium: false, sortable: true, sortKey: "realisedGain" },
  { key: "irr", align: "right", mobile: false, medium: false, sortable: true, sortKey: "irr" },
  { key: "weight", align: "right", mobile: false, medium: false, sortable: true, sortKey: "weight" },
  { key: "gain", align: "right", mobile: true, medium: true, sortable: true, sortKey: "totalGain" },
]

export default function Header({ groupKey, sortConfig, onSort }: HeaderProps): ReactElement {
  const { t } = useTranslation("common")
  
  const getSortIcon = (headerKey: string) => {
    if (!sortConfig || sortConfig.key !== headerKey) {
      return <span className="ml-1 text-gray-400">↕</span>
    }
    return sortConfig.direction === 'asc' 
      ? <span className="ml-1 text-blue-600">↑</span>
      : <span className="ml-1 text-blue-600">↓</span>
  }

  return (
    <thead className="bg-gray-100">
      <tr className="border-t-2 border-b-2 border-gray-400">
        <th 
          className={`px-2 py-2 sm:px-4 text-left text-xs sm:text-sm font-medium ${
            onSort ? 'cursor-pointer hover:bg-gray-200 transition-colors select-none' : ''
          }`}
          onClick={onSort ? () => onSort('assetName') : undefined}
        >
          <div className="flex items-center justify-start">
            {groupKey}
            {onSort && getSortIcon('assetName')}
          </div>
        </th>
        {headers.map((header) => {
          let visibility
          if (header.mobile) {
            visibility = ""
          } else if (header.medium) {
            visibility = "hidden md:table-cell"
          } else {
            visibility = "hidden xl:table-cell"
          }

          return (
            <th
              key={header.key}
              className={`px-1 py-2 md:px-2 xl:px-4 text-xs md:text-sm font-medium text-${header.align} ${visibility} ${
                header.sortable && onSort ? 'cursor-pointer hover:bg-gray-200 transition-colors select-none' : ''
              }`}
              onClick={header.sortable && onSort ? () => onSort(header.sortKey) : undefined}
            >
              <div className="flex items-center justify-${header.align === 'left' ? 'start' : 'end'}">
                {t(header.key)}
                {header.sortable && onSort && getSortIcon(header.sortKey)}
              </div>
            </th>
          )
        })}
      </tr>
    </thead>
  )
}

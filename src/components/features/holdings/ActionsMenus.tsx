import React, { useCallback, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import {
  Asset,
  CashTransferData,
  CostAdjustData,
  MovePositionData,
  QuickSellData,
  SetBalanceData,
  SetCashBalanceData,
  SetPriceData,
} from "types/beancounter"
import {
  getAssetCurrency,
  isAccount,
  isConstantPrice,
  stripOwnerPrefix,
} from "@lib/assets/assetUtils"

export interface CorporateActionsData {
  asset: Asset
  portfolioId: string
  fromDate: string
  closedDate?: string
}

export interface SectorWeightingsData {
  asset: Asset
}

interface UseDropdownMenuResult {
  isOpen: boolean
  buttonRef: React.RefObject<HTMLButtonElement | null>
  menuRef: React.RefObject<HTMLDivElement | null>
  menuPos: { top: number; left: number }
  toggle: (e: React.MouseEvent) => void
  close: () => void
}

// Matches Tailwind w-48 (12rem ≈ 192px) on the menu panel below.
const MENU_WIDTH = 192
const VIEWPORT_MARGIN = 8

const useDropdownMenu = (): UseDropdownMenuResult => {
  const [isOpen, setIsOpen] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 })

  const updatePosition = useCallback(() => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      const maxLeft = window.innerWidth - MENU_WIDTH - VIEWPORT_MARGIN
      const left = Math.max(VIEWPORT_MARGIN, Math.min(rect.left, maxLeft))
      setMenuPos({ top: rect.bottom + 4, left })
    }
  }, [])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent): void => {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  useEffect(() => {
    const handleScroll = (): void => setIsOpen(false)
    if (isOpen) {
      window.addEventListener("scroll", handleScroll, true)
    }
    return () => window.removeEventListener("scroll", handleScroll, true)
  }, [isOpen])

  const toggle = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      updatePosition()
      setIsOpen((open) => !open)
    },
    [updatePosition],
  )

  const close = useCallback(() => setIsOpen(false), [])

  return { isOpen, buttonRef, menuRef, menuPos, toggle, close }
}

const TRIGGER_CLASSES =
  "inline-flex items-center justify-center w-8 h-8 min-w-[44px] min-h-[44px] -m-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors duration-150"
const MENU_ITEM_CLASSES =
  "w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"

interface MenuItemProps {
  iconClass: string
  label: string
  onClick: (e: React.MouseEvent) => void
}

const MenuItem: React.FC<MenuItemProps> = ({ iconClass, label, onClick }) => (
  <button type="button" className={MENU_ITEM_CLASSES} onClick={onClick}>
    <i className={iconClass}></i>
    {label}
  </button>
)

export interface ActionsMenuProps {
  asset: Asset
  portfolioId: string
  portfolioCode: string
  fromDate?: string
  closedDate?: string
  quantity: number
  price: number
  costBasis: number
  tradeCurrency: { code: string; symbol: string; name: string }
  valueIn: string
  held?: Record<string, number>
  onQuickSell?: (data: QuickSellData) => void
  onCorporateActions?: (data: CorporateActionsData) => void
  onSetPrice?: (data: SetPriceData) => void
  onSetBalance?: (data: SetBalanceData) => void
  onSectorWeightings?: (data: SectorWeightingsData) => void
  onCostAdjust?: (data: CostAdjustData) => void
  onMovePosition?: (data: MovePositionData) => void
  onRecordIncome?: (data: QuickSellData) => void
  onRecordExpense?: (data: QuickSellData) => void
}

export const ActionsMenu: React.FC<ActionsMenuProps> = ({
  asset,
  portfolioId,
  portfolioCode,
  fromDate,
  closedDate,
  quantity,
  price,
  costBasis,
  tradeCurrency,
  held,
  onQuickSell,
  onCorporateActions,
  onSetPrice,
  onSetBalance,
  onSectorWeightings,
  onCostAdjust,
  onMovePosition,
  onRecordIncome,
  onRecordExpense,
}) => {
  const { isOpen, buttonRef, menuRef, menuPos, toggle, close } =
    useDropdownMenu()
  const assetCode = stripOwnerPrefix(asset.code)

  const handle =
    (fn: () => void): ((e: React.MouseEvent) => void) =>
    (e) => {
      e.preventDefault()
      e.stopPropagation()
      close()
      fn()
    }

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-label={`Actions ${assetCode}`}
        className={TRIGGER_CLASSES}
        onClick={toggle}
        title="Actions"
      >
        <i className="fas fa-ellipsis-vertical text-sm"></i>
      </button>
      {isOpen &&
        createPortal(
          <div
            ref={menuRef}
            className="fixed w-48 bg-white rounded-lg shadow-xl z-50 border border-slate-200"
            style={{ top: menuPos.top, left: menuPos.left }}
          >
            <div className="py-1">
              {onQuickSell && (
                <MenuItem
                  iconClass="fas fa-money-bill-transfer text-red-500 w-4"
                  label="Quick Sell"
                  onClick={handle(() =>
                    onQuickSell({
                      asset: assetCode,
                      market: asset.market.code,
                      quantity,
                      price,
                      held,
                    }),
                  )}
                />
              )}
              {onCorporateActions && (
                <MenuItem
                  iconClass="fas fa-calendar-check text-blue-500 w-4"
                  label="Corporate Actions"
                  onClick={handle(() =>
                    onCorporateActions({
                      asset,
                      portfolioId,
                      fromDate: fromDate || "",
                      closedDate,
                    }),
                  )}
                />
              )}
              {asset.market?.code === "PRIVATE" &&
                isConstantPrice(asset) &&
                onSetBalance && (
                  <MenuItem
                    iconClass="fas fa-piggy-bank text-amber-500 w-4"
                    label="Set Balance"
                    onClick={handle(() => onSetBalance({ asset }))}
                  />
                )}
              {onSetPrice &&
                asset.market?.code === "PRIVATE" &&
                !isConstantPrice(asset) && (
                  <MenuItem
                    iconClass="fas fa-tag text-green-500 w-4"
                    label="Set Price"
                    onClick={handle(() => onSetPrice({ asset }))}
                  />
                )}
              {onSectorWeightings && asset.assetCategory?.id === "ETF" && (
                <MenuItem
                  iconClass="fas fa-chart-pie text-purple-500 w-4"
                  label="View Sectors"
                  onClick={handle(() => onSectorWeightings({ asset }))}
                />
              )}
              {onCostAdjust && (
                <MenuItem
                  iconClass="fas fa-scale-balanced text-orange-500 w-4"
                  label="Adjust Cost"
                  onClick={handle(() =>
                    onCostAdjust({
                      asset,
                      portfolioId,
                      currentCostBasis: costBasis,
                      currency: tradeCurrency,
                    }),
                  )}
                />
              )}
              {onMovePosition && (
                <MenuItem
                  iconClass="fas fa-arrow-right-arrow-left text-indigo-500 w-4"
                  label="Move Position"
                  onClick={handle(() =>
                    onMovePosition({ asset, portfolioId, portfolioCode }),
                  )}
                />
              )}
              {onRecordIncome && (
                <MenuItem
                  iconClass="fas fa-arrow-down text-green-500 w-4"
                  label="Record Income"
                  onClick={handle(() =>
                    onRecordIncome({
                      asset: assetCode,
                      assetId: asset.id,
                      currency: tradeCurrency.code,
                      market: asset.market.code,
                      quantity: 0,
                      price: 0,
                      type: "INCOME",
                    }),
                  )}
                />
              )}
              {onRecordExpense && (
                <MenuItem
                  iconClass="fas fa-arrow-up text-red-500 w-4"
                  label="Record Expense"
                  onClick={handle(() =>
                    onRecordExpense({
                      asset: assetCode,
                      assetId: asset.id,
                      currency: tradeCurrency.code,
                      market: asset.market.code,
                      quantity: 0,
                      price: 0,
                      type: "EXPENSE",
                    }),
                  )}
                />
              )}
            </div>
          </div>,
          document.body,
        )}
    </div>
  )
}

export interface CashActionsMenuProps {
  asset: Asset
  portfolio: { id: string; code: string }
  marketValue: number
  onSetCashBalance?: (data: SetCashBalanceData) => void
  onCashTransfer?: (data: CashTransferData) => void
  onCashTransaction?: (assetCode: string) => void
}

export const CashActionsMenu: React.FC<CashActionsMenuProps> = ({
  asset,
  portfolio,
  marketValue,
  onSetCashBalance,
  onCashTransfer,
  onCashTransaction,
}) => {
  const { isOpen, buttonRef, menuRef, menuPos, toggle, close } =
    useDropdownMenu()
  const assetCode = stripOwnerPrefix(asset.code)

  const handle =
    (fn: () => void): ((e: React.MouseEvent) => void) =>
    (e) => {
      e.preventDefault()
      e.stopPropagation()
      close()
      fn()
    }

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-label={`Actions ${assetCode}`}
        className={TRIGGER_CLASSES}
        onClick={toggle}
        title="Actions"
      >
        <i className="fas fa-ellipsis-vertical text-sm"></i>
      </button>
      {isOpen &&
        createPortal(
          <div
            ref={menuRef}
            className="fixed w-48 bg-white rounded-lg shadow-xl z-50 border border-slate-200"
            style={{ top: menuPos.top, left: menuPos.left }}
          >
            <div className="py-1">
              {onSetCashBalance && (
                <MenuItem
                  iconClass="fas fa-balance-scale text-purple-500 w-4"
                  label="Set Balance"
                  onClick={handle(() => {
                    const isAccountAsset = isAccount(asset)
                    onSetCashBalance({
                      currency: isAccountAsset
                        ? getAssetCurrency(asset) || asset.code
                        : asset.code,
                      currentBalance: marketValue,
                      market: isAccountAsset ? "PRIVATE" : "CASH",
                      assetCode: isAccountAsset ? asset.code : undefined,
                      assetName: isAccountAsset ? asset.name : undefined,
                    })
                  })}
                />
              )}
              {onCashTransfer && (
                <MenuItem
                  iconClass="fas fa-exchange-alt text-blue-500 w-4"
                  label="Transfer Cash"
                  onClick={handle(() => {
                    const isAccountAsset = isAccount(asset)
                    onCashTransfer({
                      portfolioId: portfolio.id,
                      portfolioCode: portfolio.code,
                      assetId: asset.id,
                      assetCode: asset.code,
                      assetName: asset.name || asset.code,
                      currency: isAccountAsset
                        ? getAssetCurrency(asset) || asset.code
                        : asset.code,
                      currentBalance: marketValue,
                    })
                  })}
                />
              )}
              {onCashTransaction && (
                <MenuItem
                  iconClass="fas fa-dollar-sign text-green-500 w-4"
                  label="Cash Transaction"
                  onClick={handle(() => onCashTransaction(assetCode))}
                />
              )}
            </div>
          </div>,
          document.body,
        )}
    </div>
  )
}

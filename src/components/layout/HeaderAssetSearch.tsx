import React, { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/router"
import { useUser } from "@auth0/nextjs-auth0/client"
import { AssetOption } from "types/beancounter"
import AssetSearch from "@components/features/assets/AssetSearch"
import { getRecentAssets, pushRecentAsset } from "@lib/assets/recentAssets"

const buildQuery = (option: AssetOption): Record<string, string> => {
  const params: Record<string, string> = { symbol: option.symbol }
  if (option.assetId) params.assetId = option.assetId
  if (option.market) params.market = option.market
  if (option.name) params.name = option.name
  if (option.currency) params.currency = option.currency
  if (option.type) params.type = option.type
  return params
}

interface HeaderAssetSearchProps {
  /** Layout variant. Header renders the inline desktop variant by default. */
  variant?: "inline" | "overlay"
  /** Called when the overlay should close (mobile). */
  onClose?: () => void
}

function HeaderAssetSearchInner({
  variant = "inline",
  onClose,
}: HeaderAssetSearchProps): React.ReactElement {
  const router = useRouter()
  const [recents, setRecents] = useState<AssetOption[]>([])
  // Read recents post-mount to avoid SSR/CSR hydration mismatch
  // (localStorage is undefined on the server). Same pattern as ChatFab.
  useEffect(
    // eslint-disable-next-line react-hooks/set-state-in-effect
    () => setRecents(getRecentAssets()),
    [],
  )

  const handleSelect = useCallback(
    (option: AssetOption | null): void => {
      if (!option) return
      const next = pushRecentAsset(option)
      setRecents(next)
      router.push({ pathname: "/assets/lookup", query: buildQuery(option) })
      if (onClose) onClose()
    },
    [router, onClose],
  )

  return (
    <div
      className={
        variant === "overlay"
          ? "w-full"
          : "flex-1 max-w-md mx-3 hidden md:block"
      }
      data-testid="header-asset-search"
    >
      <AssetSearch
        onSelect={handleSelect}
        value={null}
        defaultOptions={recents.length > 0 ? recents : undefined}
        fallbackOptions={recents.length > 0 ? recents : undefined}
        placeholder="Search assets..."
        isClearable={false}
        inputId="header-asset-search-input"
      />
    </div>
  )
}

export default function HeaderAssetSearch(): React.ReactElement | null {
  const { user, isLoading } = useUser()
  const [overlayOpen, setOverlayOpen] = useState(false)
  const overlayRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!overlayOpen) return undefined
    const handler = (event: MouseEvent): void => {
      if (
        overlayRef.current &&
        !overlayRef.current.contains(event.target as Node)
      ) {
        setOverlayOpen(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [overlayOpen])

  // Suppress until auth resolves. Avoids react-select hydration mismatch
  // (instance-counter IDs differ server vs client) and hides a search the
  // user can't yet use.
  if (isLoading || !user) return null

  return (
    <>
      <HeaderAssetSearchInner variant="inline" />
      <button
        type="button"
        aria-label="Search assets"
        onClick={() => setOverlayOpen((open) => !open)}
        className="md:hidden inline-flex items-center justify-center w-9 h-9 rounded text-white hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
      >
        <i className="fas fa-search"></i>
      </button>
      {overlayOpen && (
        <div
          ref={overlayRef}
          className="md:hidden absolute left-0 right-0 top-full z-40 bg-gray-800 px-3 py-2 shadow-lg"
        >
          <HeaderAssetSearchInner
            variant="overlay"
            onClose={() => setOverlayOpen(false)}
          />
        </div>
      )}
    </>
  )
}

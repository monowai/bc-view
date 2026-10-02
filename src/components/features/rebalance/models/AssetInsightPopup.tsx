import React, { useMemo } from "react"
import AnalysisDialog from "@components/features/chat/AnalysisDialog"
import { AnalysisRequest } from "@components/features/chat/useAnalysisChat"
import { AssetWeightWithDetails } from "types/rebalance"
import { AssetInsightPromptOverride } from "types/beancounter"

interface AssetInsightPopupProps {
  asset: AssetWeightWithDetails
  modelName?: string
  onClose: () => void
  /**
   * Replaces the default "why does this asset belong in the model" prompt
   * and context entirely. Used by callers outside the model editor (e.g.
   * the rebalance execute page) that want a different question answered
   * about the same streaming endpoint/Dialog wrapper.
   */
  promptOverride?: AssetInsightPromptOverride
}

const ASSET_INSIGHT_PROMPT = `Role: You are a concise financial analyst reviewing individual assets for inclusion in a model portfolio.

For the given asset, provide a brief investment analysis (150-250 words) covering:
1. Investment thesis: Why this asset belongs in the model
2. Key characteristics: What it provides (exposure, diversification, income, etc.)
3. Key risks: Main risks to monitor
4. Fit for model: How this weight/allocation makes sense in context

Style: Clear, direct, evidence-based. No buy/sell recommendations. No filler.`

const CACHE_TTL_MS = 30 * 60 * 1000

function buildRequest(
  asset: AssetWeightWithDetails,
  displayCode: string,
  modelName: string | undefined,
  promptOverride: AssetInsightPromptOverride | undefined,
): AnalysisRequest {
  return {
    cacheKey: `asset-insight|${displayCode}|${modelName ?? ""}|${promptOverride?.query ?? ""}`,
    query: promptOverride?.query ?? ASSET_INSIGHT_PROMPT,
    label: `Asset insight — ${displayCode}`,
    context: promptOverride?.context ?? {
      page: "Model Asset Insight",
      description:
        "AI analysis of a single asset for a rebalance model portfolio",
      assetCode: displayCode,
      assetName: asset.assetName,
      targetWeight: `${asset.weight}%`,
      modelName,
    },
    ttlMs: CACHE_TTL_MS,
  }
}

export default function AssetInsightPopup({
  asset,
  modelName,
  onClose,
  promptOverride,
}: AssetInsightPopupProps): React.ReactElement {
  const displayCode = asset.assetCode || asset.assetId
  const request = useMemo(
    () => buildRequest(asset, displayCode, modelName, promptOverride),
    [asset, displayCode, modelName, promptOverride],
  )

  return (
    <AnalysisDialog
      title={
        <span className="flex items-center">
          <i className="fas fa-robot text-blue-500 mr-2"></i>
          {displayCode}
          {asset.assetName && (
            <span className="text-sm font-normal text-gray-500 ml-2">
              — {asset.assetName}
            </span>
          )}
        </span>
      }
      request={request}
      loadingLabel="Generating insight..."
      onClose={onClose}
    />
  )
}

import React from "react"
import { Portfolio } from "types/beancounter"
import { inviteAdviser } from "@utils/api/client/shares"
import ShareInviteFormDialog from "@components/features/shares/ShareInviteFormDialog"

interface ShareInviteDialogProps {
  portfolios: Portfolio[]
  preSelectedPortfolioId?: string
  onClose: () => void
  onSuccess: () => void
}

export default function ShareInviteDialog({
  portfolios,
  preSelectedPortfolioId,
  onClose,
  onSuccess,
}: ShareInviteDialogProps): React.ReactElement {
  return (
    <ShareInviteFormDialog
      title={"Share Portfolios"}
      selectLabel={"Select portfolios to share"}
      noSelectionError={"Please select at least one portfolio"}
      items={portfolios.map((p) => ({
        id: p.id,
        label: (
          <>
            <span className="font-medium text-wealth-600">{p.code}</span>
            <span className="text-gray-600 text-sm">{p.name}</span>
          </>
        ),
      }))}
      preSelectedId={preSelectedPortfolioId}
      invite={({ adviserEmail, ids, accessLevel }) =>
        inviteAdviser({ adviserEmail, portfolioIds: ids, accessLevel })
      }
      onClose={onClose}
      onSuccess={onSuccess}
    />
  )
}

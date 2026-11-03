import React from "react"
import { ShareResourceType } from "types/beancounter"
import { inviteResourceShare } from "@utils/api/client/shares"
import ShareInviteFormDialog from "@components/features/shares/ShareInviteFormDialog"

interface ShareableResource {
  id: string
  name: string
}

interface ResourceShareInviteDialogProps {
  resourceType: ShareResourceType
  resources: ShareableResource[]
  preSelectedId?: string
  onClose: () => void
  onSuccess: () => void
}

export default function ResourceShareInviteDialog({
  resourceType,
  resources,
  preSelectedId,
  onClose,
  onSuccess,
}: ResourceShareInviteDialogProps): React.ReactElement {
  const typeLabel = resourceType === "INDEPENDENCE_PLAN" ? "Plans" : "Models"
  const typeLabelSingular =
    resourceType === "INDEPENDENCE_PLAN" ? "plan" : "model"

  return (
    <ShareInviteFormDialog
      title={`Share ${typeLabel}`}
      selectLabel={`Select ${typeLabel} to share`}
      noSelectionError={`Please select at least one ${typeLabelSingular}`}
      items={resources.map((r) => ({
        id: r.id,
        label: <span className="font-medium text-wealth-600">{r.name}</span>,
      }))}
      preSelectedId={preSelectedId}
      invite={({ adviserEmail, ids, accessLevel }) =>
        inviteResourceShare({
          resourceType,
          resourceIds: ids,
          adviserEmail,
          accessLevel,
        })
      }
      onClose={onClose}
      onSuccess={onSuccess}
    />
  )
}

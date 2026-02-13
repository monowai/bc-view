import React from "react"

interface StepHeaderProps {
  title: string
  description: string
}

export default function StepHeader({
  title,
  description,
}: StepHeaderProps): React.ReactElement {
  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900 mb-1">{title}</h2>
      <p className="text-sm text-gray-600">{description}</p>
    </div>
  )
}

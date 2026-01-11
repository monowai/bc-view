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
      <h2 className="text-xl font-semibold text-gray-900 mb-2">{title}</h2>
      <p className="text-gray-600">{description}</p>
    </div>
  )
}

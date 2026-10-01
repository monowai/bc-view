import React, { useMemo } from "react"
import { ResponsiveContainer, Sankey, Tooltip } from "recharts"
import Dialog from "@components/ui/Dialog"
import { usePrivacyMode } from "@hooks/usePrivacyMode"
import {
  buildYearFlows,
  type FlowNode,
  type FlowNodeKind,
  type FlowRow,
} from "@lib/independence/yearFlows"

const HIDDEN_VALUE = "****"

/**
 * Validated with the dataviz palette checker against light and dark surfaces
 * (income / portfolio / spending). The shortfall is a status colour and always
 * ships with its label and icon. The hub is structure, not a category.
 */
const KIND_COLOUR: Record<FlowNodeKind | "hub", string> = {
  income: "#059669",
  portfolio: "#2563eb",
  spending: "#ea580c",
  shortfall: "#dc2626",
  hub: "#9ca3af",
}

const HUB_LABEL = "This year"

interface ChartNode {
  name: string
  kind: FlowNodeKind | "hub"
  residual: boolean
  side: "source" | "hub" | "use"
}

interface YearFlowDialogProps {
  age?: number
  /** Stage (phase plan) the year belongs to, when the view has stages. */
  stage?: string
  currency: string
  row: FlowRow
  onClose: () => void
}

/**
 * Single-year drill-down: where one projected year's money came from and
 * where it went, as a Sankey through a "this year" hub plus the same figures
 * as two lists (the table view, and what screen readers get).
 */
export default function YearFlowDialog({
  age,
  stage,
  currency,
  row,
  onClose,
}: YearFlowDialogProps): React.ReactElement {
  const { hideValues } = usePrivacyMode()
  const flows = useMemo(() => buildYearFlows(row), [row])
  const format = (value: number): string =>
    hideValues
      ? HIDDEN_VALUE
      : `${currency} ${Math.round(value).toLocaleString()}`

  const title = [age !== undefined ? `Age ${age}` : null, stage]
    .filter(Boolean)
    .join(" · ")
  const hasResidual = [...flows.sources, ...flows.uses].some((n) => n.residual)

  return (
    <Dialog
      title={title || "Year"}
      onClose={onClose}
      maxWidth="3xl"
      scrollable
      footer={
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
        >
          Close
        </button>
      }
    >
      {flows.total === 0 ? (
        <p className="text-sm text-gray-600">
          No cash moved in or out this year.
        </p>
      ) : (
        <>
          <p className="text-sm text-gray-600">
            Where this year&rsquo;s money came from and where it went &mdash;{" "}
            <span className="font-medium text-gray-900">
              {format(flows.total)} in total
            </span>
            . Investment growth stays inside the portfolio, so it is not shown.
          </p>
          <FlowChart
            sources={flows.sources}
            uses={flows.uses}
            format={format}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <FlowList
              title="Where it came from"
              nodes={flows.sources}
              format={format}
            />
            <FlowList
              title="Where it went"
              nodes={flows.uses}
              format={format}
            />
          </div>
          {hasResidual && (
            <p className="text-xs text-gray-500">
              * Balancing figure: the gap between this year&rsquo;s income and
              its spending, drawn from or added to the portfolio.
            </p>
          )}
        </>
      )}
    </Dialog>
  )
}

function FlowChart({
  sources,
  uses,
  format,
}: {
  sources: FlowNode[]
  uses: FlowNode[]
  format: (value: number) => string
}): React.ReactElement {
  const data = useMemo(() => {
    const toChart = (n: FlowNode, side: ChartNode["side"]): ChartNode => ({
      name: n.label,
      kind: n.kind,
      residual: n.residual,
      side,
    })
    const hub = sources.length
    const nodes: ChartNode[] = [
      ...sources.map((n) => toChart(n, "source")),
      { name: HUB_LABEL, kind: "hub", residual: false, side: "hub" },
      ...uses.map((n) => toChart(n, "use")),
    ]
    const links = [
      ...sources.map((n, i) => ({ source: i, target: hub, value: n.value })),
      ...uses.map((n, i) => ({
        source: hub,
        target: hub + 1 + i,
        value: n.value,
      })),
    ]
    return { nodes, links }
  }, [sources, uses])

  const height = Math.max(sources.length, uses.length, 2) * 56 + 40

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <Sankey
          data={data}
          sort={false}
          nodeWidth={12}
          nodePadding={24}
          margin={{ top: 16, right: 170, bottom: 16, left: 150 }}
          node={(props) => <FlowNodeShape {...props} format={format} />}
          link={(props) => {
            const { source, target } = props.payload
            const end = ((source as unknown as ChartNode).side === "hub"
              ? target
              : source) as unknown as ChartNode
            return (
              <path
                d={`M${props.sourceX},${props.sourceY} C${props.sourceControlX},${props.sourceY} ${props.targetControlX},${props.targetY} ${props.targetX},${props.targetY}`}
                fill="none"
                stroke={KIND_COLOUR[end.kind]}
                strokeOpacity={0.3}
                strokeWidth={Math.max(props.linkWidth, 1)}
              />
            )
          }}
        >
          <Tooltip
            formatter={(value) => format(Number(value))}
            isAnimationActive={false}
          />
        </Sankey>
      </ResponsiveContainer>
    </div>
  )
}

function FlowNodeShape({
  x,
  y,
  width,
  height,
  payload,
  format,
}: {
  x: number
  y: number
  width: number
  height: number
  payload: unknown
  format: (value: number) => string
}): React.ReactElement {
  const node = payload as ChartNode & { value: number }
  const isUse = node.side === "use"
  const isHub = node.side === "hub"
  const labelX = isUse ? x + width + 8 : x - 8
  const anchor = isUse ? "start" : "end"
  const midY = y + height / 2
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={Math.max(height, 2)}
        rx={2}
        fill={KIND_COLOUR[node.kind]}
      />
      {isHub ? (
        <text
          x={x + width / 2}
          y={y - 6}
          textAnchor="middle"
          fontSize={12}
          fill="#374151"
        >
          {node.name}
        </text>
      ) : (
        <>
          <text
            x={labelX}
            y={midY - 2}
            textAnchor={anchor}
            fontSize={12}
            fill="#111827"
          >
            {node.name}
            {node.residual ? " *" : ""}
          </text>
          <text
            x={labelX}
            y={midY + 13}
            textAnchor={anchor}
            fontSize={11}
            fill="#4b5563"
          >
            {format(node.value)}
          </text>
        </>
      )}
    </g>
  )
}

function FlowList({
  title,
  nodes,
  format,
}: {
  title: string
  nodes: FlowNode[]
  format: (value: number) => string
}): React.ReactElement {
  const id = `flow-list-${title.replace(/\W+/g, "-").toLowerCase()}`
  return (
    <div>
      <h3
        id={id}
        className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500"
      >
        {title}
      </h3>
      <ul aria-labelledby={id} className="space-y-1 text-sm">
        {nodes.map((n) => (
          <li key={n.key} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-gray-800">
              <span
                aria-hidden="true"
                className="inline-block h-2.5 w-2.5 rounded-sm"
                style={{ backgroundColor: KIND_COLOUR[n.kind] }}
              />
              {n.kind === "shortfall" && (
                <i
                  aria-hidden="true"
                  className="fas fa-exclamation-triangle text-red-600"
                />
              )}
              <span>{n.label}</span>
              {n.residual && <span aria-label="balancing figure">*</span>}
            </span>
            <span className="tabular-nums text-gray-900">
              {format(n.value)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

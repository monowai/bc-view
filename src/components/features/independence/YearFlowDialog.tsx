import React, { useMemo } from "react"
import { ResponsiveContainer, Sankey, Tooltip } from "recharts"
import Dialog from "@components/ui/Dialog"
import { usePrivacyMode } from "@hooks/usePrivacyMode"
import {
  buildYearFlows,
  type ExpenseShare,
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

interface ChartNode {
  name: string
  kind: FlowNodeKind | "hub"
  residual: boolean
  side: "source" | "hub" | "use"
}

interface YearFlowDialogProps {
  title: string
  currency: string
  row: FlowRow
  /** The stage's expense categories; living expenses split across them. */
  expenseMix?: ExpenseShare[]
  /** The row is a stage's average year rather than one projected year. */
  average?: boolean
  onClose: () => void
}

/**
 * Single-year drill-down: where one projected year's money came from and
 * where it went, as a Sankey through a "this year" hub plus the same figures
 * as two lists (the table view, and what screen readers get).
 */
export default function YearFlowDialog({
  title,
  currency,
  row,
  expenseMix,
  average = false,
  onClose,
}: YearFlowDialogProps): React.ReactElement {
  const { hideValues } = usePrivacyMode()
  const flows = useMemo(
    () => buildYearFlows(row, expenseMix),
    [row, expenseMix],
  )
  const format = (value: number): string =>
    hideValues
      ? HIDDEN_VALUE
      : `${currency} ${Math.round(value).toLocaleString()}`

  const period = average ? "a typical year" : "this year"
  const hasCategories = flows.uses.some((n) => n.group)
  const hasResidual = [...flows.sources, ...flows.uses].some((n) => n.residual)

  return (
    <Dialog
      title={title}
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
          No cash moved in or out in {period}.
        </p>
      ) : (
        <>
          <p className="text-sm text-gray-600">
            Where the money in {period} came from and where it went &mdash;{" "}
            <span className="font-medium text-gray-900">
              {format(flows.total)} in total
            </span>
            . Investment growth stays inside the portfolio, so it is not shown.
          </p>
          <FlowChart
            sources={flows.sources}
            uses={flows.uses}
            hubLabel={average ? "Each year" : "This year"}
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
          {(hasResidual || hasCategories || average) && (
            <div className="space-y-1 text-xs text-gray-500">
              {average && (
                <p>
                  Each flow is the stage&rsquo;s yearly average, so one-off
                  events are spread across its years.
                </p>
              )}
              {hasCategories && (
                <p>
                  Living expenses are split in the proportions of the
                  stage&rsquo;s spending categories.
                </p>
              )}
              {hasResidual && (
                <p>
                  * Balancing figure: the gap between income and spending, drawn
                  from or added to the portfolio.
                </p>
              )}
            </div>
          )}
        </>
      )}
    </Dialog>
  )
}

function FlowChart({
  sources,
  uses,
  hubLabel,
  format,
}: {
  sources: FlowNode[]
  uses: FlowNode[]
  hubLabel: string
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
      { name: hubLabel, kind: "hub", residual: false, side: "hub" },
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
  }, [sources, uses, hubLabel])

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
        {nodes.map((n, i) => (
          <React.Fragment key={n.key}>
            {n.group && nodes[i - 1]?.group !== n.group && (
              <li className="flex items-center justify-between gap-3 font-medium text-gray-900">
                <span>{n.group}</span>
                <span className="tabular-nums">
                  {format(
                    nodes
                      .filter((g) => g.group === n.group)
                      .reduce((total, g) => total + g.value, 0),
                  )}
                </span>
              </li>
            )}
            <FlowItem node={n} format={format} />
          </React.Fragment>
        ))}
      </ul>
    </div>
  )
}

function FlowItem({
  node: n,
  format,
}: {
  node: FlowNode
  format: (value: number) => string
}): React.ReactElement {
  return (
    <li
      className={`flex items-center justify-between gap-3 ${n.group ? "pl-4" : ""}`}
    >
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
      <span className="tabular-nums text-gray-900">{format(n.value)}</span>
    </li>
  )
}

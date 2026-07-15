/**
 * Squarified treemap layout (Bruls, Huizing, van Wijk).
 *
 * Given items with a `value` (e.g. market value) and arbitrary `data`
 * payload, lays them out inside a `width` x `height` container so each
 * rect's AREA is proportional to its value, while keeping aspect ratios
 * as close to square as possible.
 *
 * Callers are expected to sort items descending by value before calling —
 * the squarify algorithm assumes a pre-sorted input (this keeps the
 * "worst ratio" comparisons cheap and matches the reference algorithm).
 */
export interface TreemapRect {
  x: number
  y: number
  width: number
  height: number
}

interface AreaItem<T> {
  area: number
  data: T
}

/**
 * Worst aspect ratio achievable for a row of `areas` laid out along a strip
 * of length `side` (the shorter side of the remaining rect). Lower is
 * squarer/better. See Bruls et al. for the derivation.
 */
function rowWorst(areas: number[], side: number): number {
  if (side <= 0 || areas.length === 0) return Infinity
  const sum = areas.reduce((a, b) => a + b, 0)
  if (sum <= 0) return Infinity
  const maxArea = Math.max(...areas)
  const minArea = Math.min(...areas)
  return Math.max(
    (side * side * maxArea) / (sum * sum),
    (sum * sum) / (side * side * minArea),
  )
}

/**
 * Lays out one row of items as a strip against the given rect, pushing the
 * resulting rects into `out`, and returns the shrunken remaining rect.
 */
function layoutRow<T>(
  row: AreaItem<T>[],
  rect: TreemapRect,
  horizontal: boolean,
  out: (TreemapRect & { data: T })[],
): TreemapRect {
  const rowSum = row.reduce((sum, item) => sum + item.area, 0)

  if (horizontal) {
    // Strip spans the full width, stacked at the top; thickness = area/width.
    const thickness = rect.width > 0 ? rowSum / rect.width : 0
    let cursorX = rect.x
    for (const item of row) {
      const itemWidth = rowSum > 0 ? (item.area / rowSum) * rect.width : 0
      out.push({
        x: cursorX,
        y: rect.y,
        width: itemWidth,
        height: thickness,
        data: item.data,
      })
      cursorX += itemWidth
    }
    return {
      x: rect.x,
      y: rect.y + thickness,
      width: rect.width,
      height: Math.max(rect.height - thickness, 0),
    }
  }

  // Strip spans the full height, stacked on the left; thickness = area/height.
  const thickness = rect.height > 0 ? rowSum / rect.height : 0
  let cursorY = rect.y
  for (const item of row) {
    const itemHeight = rowSum > 0 ? (item.area / rowSum) * rect.height : 0
    out.push({
      x: rect.x,
      y: cursorY,
      width: thickness,
      height: itemHeight,
      data: item.data,
    })
    cursorY += itemHeight
  }
  return {
    x: rect.x + thickness,
    y: rect.y,
    width: Math.max(rect.width - thickness, 0),
    height: rect.height,
  }
}

export function squarify<T>(
  items: { value: number; data: T }[],
  width: number,
  height: number,
): (TreemapRect & { data: T })[] {
  const positive = items.filter((item) => item.value > 0)
  if (positive.length === 0) return []

  if (width <= 0 || height <= 0) {
    return positive.map((item) => ({
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      data: item.data,
    }))
  }

  const totalValue = positive.reduce((sum, item) => sum + item.value, 0)
  const scale = (width * height) / totalValue

  let remaining: AreaItem<T>[] = positive.map((item) => ({
    area: item.value * scale,
    data: item.data,
  }))

  const result: (TreemapRect & { data: T })[] = []
  let rect: TreemapRect = { x: 0, y: 0, width, height }

  while (remaining.length > 0) {
    const horizontal = rect.width <= rect.height
    const shorterSide = horizontal ? rect.width : rect.height

    const row: AreaItem<T>[] = [remaining[0]]
    let rowAreas = [remaining[0].area]
    let consumed = 1

    while (consumed < remaining.length) {
      const candidateAreas = [...rowAreas, remaining[consumed].area]
      if (
        rowWorst(candidateAreas, shorterSide) <= rowWorst(rowAreas, shorterSide)
      ) {
        row.push(remaining[consumed])
        rowAreas = candidateAreas
        consumed++
      } else {
        break
      }
    }

    rect = layoutRow(row, rect, horizontal, result)
    remaining = remaining.slice(consumed)
  }

  return result
}

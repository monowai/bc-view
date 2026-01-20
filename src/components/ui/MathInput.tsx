import React, { useState, useEffect } from "react"
import { parseShorthandAmount } from "@utils/formatting/amountParser"

/**
 * Expand shorthand notation in an expression.
 * Supports: h=100, k=1000, m=1000000
 * Examples: "4k" -> "4000", "4k*2" -> "4000*2", "1.5m+500k" -> "1500000+500000"
 */
function expandShorthand(expr: string): string {
  // Replace patterns like "4k", "1.5m", "2h" with expanded numbers
  return expr.replace(/(\d*\.?\d+)([hkm])/gi, (match) => {
    const expanded = parseShorthandAmount(match)
    return String(expanded)
  })
}

/**
 * Safely calculate a simple math expression using a recursive descent parser.
 * Supports: +, -, *, /, parentheses, numbers (including decimals), and shorthand (h/k/m).
 */
export function evaluateMathExpression(expr: string): number | null {
  // Remove whitespace
  const cleaned = expr.replace(/\s/g, "")

  // Only allow safe characters: digits, operators, parentheses, decimal points, and shorthand (h/k/m)
  if (!/^[\d+\-*/().hkm]+$/i.test(cleaned)) {
    return null
  }

  // Expand shorthand notation (4k -> 4000, 1m -> 1000000, 2h -> 200)
  const expanded = expandShorthand(cleaned)

  // Check for empty or invalid expressions
  if (!expanded || expanded === "") {
    return null
  }

  try {
    // Tokenize the expanded expression
    const tokens = tokenize(expanded)
    if (tokens.length === 0) return null

    // Parse and evaluate
    const result = parseExpression(tokens)
    if (isNaN(result) || !isFinite(result)) {
      return null
    }
    return result
  } catch {
    return null
  }
}

type Token = { type: "number"; value: number } | { type: "op"; value: string }

function tokenize(expr: string): Token[] {
  const tokens: Token[] = []
  let i = 0

  while (i < expr.length) {
    const char = expr[i]

    if ((char >= "0" && char <= "9") || char === ".") {
      // Parse number
      let numStr = ""
      while (
        i < expr.length &&
        ((expr[i] >= "0" && expr[i] <= "9") || expr[i] === ".")
      ) {
        numStr += expr[i]
        i++
      }
      tokens.push({ type: "number", value: parseFloat(numStr) })
    } else if ("+-*/()".includes(char)) {
      // Handle negative numbers (minus at start or after operator/open paren)
      if (
        char === "-" &&
        (tokens.length === 0 ||
          (tokens[tokens.length - 1].type === "op" &&
            tokens[tokens.length - 1].value !== ")"))
      ) {
        // This is a negative sign, not subtraction
        i++
        let numStr = "-"
        while (
          i < expr.length &&
          ((expr[i] >= "0" && expr[i] <= "9") || expr[i] === ".")
        ) {
          numStr += expr[i]
          i++
        }
        if (numStr === "-") {
          // Just a minus with no number following - treat as operator
          tokens.push({ type: "op", value: char })
        } else {
          tokens.push({ type: "number", value: parseFloat(numStr) })
        }
      } else {
        tokens.push({ type: "op", value: char })
        i++
      }
    } else {
      i++
    }
  }

  return tokens
}

// Simple recursive descent parser for math expressions
function parseExpression(tokens: Token[]): number {
  let pos = 0

  function parseAddSub(): number {
    let left = parseMulDiv()

    while (
      pos < tokens.length &&
      tokens[pos].type === "op" &&
      (tokens[pos].value === "+" || tokens[pos].value === "-")
    ) {
      const op = tokens[pos].value
      pos++
      const right = parseMulDiv()
      left = op === "+" ? left + right : left - right
    }

    return left
  }

  function parseMulDiv(): number {
    let left = parsePrimary()

    while (
      pos < tokens.length &&
      tokens[pos].type === "op" &&
      (tokens[pos].value === "*" || tokens[pos].value === "/")
    ) {
      const op = tokens[pos].value
      pos++
      const right = parsePrimary()
      left = op === "*" ? left * right : left / right
    }

    return left
  }

  function parsePrimary(): number {
    const token = tokens[pos]

    if (token.type === "number") {
      pos++
      return token.value
    }

    if (token.type === "op" && token.value === "(") {
      pos++ // skip (
      const result = parseAddSub()
      if (tokens[pos]?.type === "op" && tokens[pos].value === ")") {
        pos++ // skip )
      }
      return result
    }

    return 0
  }

  return parseAddSub()
}

interface MathInputProps {
  value: number | string | undefined
  onChange: (value: number) => void
  className?: string
  placeholder?: string
  min?: number
  max?: number
  step?: number | string
  disabled?: boolean
  id?: string
}

/**
 * Number input that supports basic math expressions.
 * Enter expressions like "400*2", "1000/4", "100+50" and they'll be evaluated on blur or Enter.
 */
export default function MathInput({
  value,
  onChange,
  className = "",
  placeholder,
  min,
  max,
  step,
  disabled,
  id,
}: MathInputProps): React.ReactElement {
  const [displayValue, setDisplayValue] = useState<string>(String(value || ""))
  const [isExpression, setIsExpression] = useState(false)

  // Sync display value when external value changes
  useEffect(() => {
    // Only update if not currently editing an expression
    if (!isExpression) {
      // Show empty string for zero values (better UX - cleaner form appearance)
      setDisplayValue(value === 0 || value === undefined ? "" : String(value))
    }
  }, [value, isExpression])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const newValue = e.target.value
    setDisplayValue(newValue)

    // Check if it's an expression (contains operators or shorthand h/k/m)
    const hasOperators = /[+\-*/]/.test(newValue.replace(/^-/, "")) // ignore leading minus
    const hasShorthand = /[hkm]/i.test(newValue)
    setIsExpression(hasOperators || hasShorthand)

    // If it's a plain number (no operators, no shorthand), update immediately
    if (!hasOperators && !hasShorthand) {
      const num = parseFloat(newValue)
      if (!isNaN(num)) {
        onChange(num)
      }
    }
  }

  const evaluateAndUpdate = (): void => {
    if (isExpression) {
      const result = evaluateMathExpression(displayValue)
      if (result !== null) {
        setDisplayValue(String(result))
        onChange(result)
      }
      setIsExpression(false)
    }
  }

  const handleBlur = (): void => {
    evaluateAndUpdate()
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === "Enter") {
      evaluateAndUpdate()
    }
  }

  return (
    <input
      id={id}
      type="text"
      inputMode="decimal"
      value={displayValue}
      onChange={handleChange}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      className={`${className} ${isExpression ? "bg-yellow-50" : ""}`}
      placeholder={placeholder}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
    />
  )
}

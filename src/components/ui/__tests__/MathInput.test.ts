import { evaluateMathExpression } from "../MathInput"

describe("evaluateMathExpression", () => {
  describe("basic operations", () => {
    it("evaluates addition", () => {
      expect(evaluateMathExpression("2+3")).toBe(5)
      expect(evaluateMathExpression("100+200")).toBe(300)
    })

    it("evaluates subtraction", () => {
      expect(evaluateMathExpression("10-3")).toBe(7)
      expect(evaluateMathExpression("100-200")).toBe(-100)
    })

    it("evaluates multiplication", () => {
      expect(evaluateMathExpression("4*5")).toBe(20)
      expect(evaluateMathExpression("400*2")).toBe(800)
    })

    it("evaluates division", () => {
      expect(evaluateMathExpression("20/4")).toBe(5)
      expect(evaluateMathExpression("400/10")).toBe(40)
    })
  })

  describe("operator precedence", () => {
    it("handles multiplication before addition", () => {
      expect(evaluateMathExpression("2+3*4")).toBe(14)
      expect(evaluateMathExpression("3*4+2")).toBe(14)
    })

    it("handles division before subtraction", () => {
      expect(evaluateMathExpression("10-6/2")).toBe(7)
      expect(evaluateMathExpression("6/2-1")).toBe(2)
    })

    it("handles mixed precedence", () => {
      expect(evaluateMathExpression("2+3*4-5")).toBe(9)
      expect(evaluateMathExpression("10/2+3*4")).toBe(17)
    })
  })

  describe("parentheses", () => {
    it("handles parentheses", () => {
      expect(evaluateMathExpression("(2+3)*4")).toBe(20)
      expect(evaluateMathExpression("2*(3+4)")).toBe(14)
    })

    it("handles nested parentheses", () => {
      expect(evaluateMathExpression("((2+3)*4)")).toBe(20)
      expect(evaluateMathExpression("2*((3+4)+1)")).toBe(16)
    })
  })

  describe("decimal numbers", () => {
    it("handles decimal inputs", () => {
      expect(evaluateMathExpression("2.5*4")).toBe(10)
      expect(evaluateMathExpression("10/4")).toBe(2.5)
    })

    it("handles multiple decimals", () => {
      expect(evaluateMathExpression("1.5+2.5")).toBe(4)
      expect(evaluateMathExpression("3.14*2")).toBeCloseTo(6.28)
    })
  })

  describe("negative numbers", () => {
    it("handles negative numbers at start", () => {
      expect(evaluateMathExpression("-5+10")).toBe(5)
      expect(evaluateMathExpression("-10*2")).toBe(-20)
    })

    it("handles subtraction resulting in negative", () => {
      expect(evaluateMathExpression("5-10")).toBe(-5)
    })
  })

  describe("whitespace handling", () => {
    it("ignores whitespace", () => {
      expect(evaluateMathExpression("2 + 3")).toBe(5)
      expect(evaluateMathExpression(" 4 * 5 ")).toBe(20)
      expect(evaluateMathExpression("100 / 10")).toBe(10)
    })
  })

  describe("plain numbers", () => {
    it("returns plain numbers as-is", () => {
      expect(evaluateMathExpression("42")).toBe(42)
      expect(evaluateMathExpression("3.14")).toBe(3.14)
      expect(evaluateMathExpression("-5")).toBe(-5)
    })
  })

  describe("invalid inputs", () => {
    it("returns null for empty string", () => {
      expect(evaluateMathExpression("")).toBe(null)
    })

    it("returns null for invalid characters", () => {
      expect(evaluateMathExpression("2+a")).toBe(null)
      expect(evaluateMathExpression("eval(1)")).toBe(null)
      expect(evaluateMathExpression("alert(1)")).toBe(null)
    })

    it("returns null for division by zero", () => {
      expect(evaluateMathExpression("1/0")).toBe(null)
    })
  })

  describe("real-world trade scenarios", () => {
    it("calculates share purchase", () => {
      // Buy $10,000 worth at $250/share = 40 shares
      expect(evaluateMathExpression("10000/250")).toBe(40)
    })

    it("calculates total cost with fees", () => {
      // 100 shares * $50 + $9.99 fee
      expect(evaluateMathExpression("100*50+9.99")).toBeCloseTo(5009.99)
    })

    it("calculates position after partial sell", () => {
      // Had 500 shares, selling 20%
      expect(evaluateMathExpression("500*0.2")).toBe(100)
    })

    it("doubles a position", () => {
      expect(evaluateMathExpression("250*2")).toBe(500)
    })

    it("calculates average price", () => {
      // (100*$50 + 50*$60) / 150
      expect(evaluateMathExpression("(100*50+50*60)/150")).toBeCloseTo(53.33, 1)
    })
  })
})

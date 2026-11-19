import {
  applyMapping,
  BC_COLUMNS,
  isBeancounterHeader,
  missingRequired,
  parseMappingReply,
  type CsvMapping,
} from "../csvMapping"

const headers = [
  "Trade Date",
  "Action",
  "Symbol",
  "Shares",
  "Price",
  "Commission",
  "Notes",
]

const mapping: CsvMapping = {
  columns: ["Date", "Type", "Code", "Quantity", "Price", "Fees", null],
  typeValues: { Bought: "BUY", Sold: "SELL", "Transfer in": "ADD" },
  dateFormat: "DD/MM/YYYY",
  market: "US",
}

const context = { batch: "B1", brokerId: "b-ibkr", today: "2026-11-19" }

describe("isBeancounterHeader", () => {
  it("recognises a header row in Beancounter's own order, case and spacing aside", () => {
    expect(isBeancounterHeader([...BC_COLUMNS])).toBe(true)
    expect(
      isBeancounterHeader(
        BC_COLUMNS.slice(0, 18).map((c) => ` ${c.toLowerCase()} `),
      ),
    ).toBe(true)
  })

  it("does not recognise another layout", () => {
    expect(isBeancounterHeader(headers)).toBe(false)
  })
})

describe("applyMapping", () => {
  it("writes each row in Beancounter's column order", () => {
    const [row] = applyMapping(
      [["03/02/2024", "Bought", "AAPL", "10", "150.25", "1.5", "first"]],
      mapping,
      context,
    )
    expect(row.problems).toEqual([])
    const at = (column: (typeof BC_COLUMNS)[number]): string =>
      row.values[BC_COLUMNS.indexOf(column)]
    expect(row.values).toHaveLength(BC_COLUMNS.length)
    expect(at("Batch")).toBe("B1")
    expect(at("CallerId")).toBe("B1-1")
    expect(at("Type")).toBe("BUY")
    expect(at("Market")).toBe("US")
    expect(at("Code")).toBe("AAPL")
    expect(at("Date")).toBe("2024-02-03")
    expect(at("Quantity")).toBe("10")
    expect(at("Price")).toBe("150.25")
    expect(at("Fees")).toBe("1.5")
    expect(at("Broker")).toBe("b-ibkr")
  })

  it("strips thousands separators and currency signs from numbers", () => {
    const [row] = applyMapping(
      [["03/02/2024", "Sold", "MSFT", "1,200", "$1,050.10", "", ""]],
      mapping,
      context,
    )
    expect(row.values[BC_COLUMNS.indexOf("Quantity")]).toBe("1200")
    expect(row.values[BC_COLUMNS.indexOf("Price")]).toBe("1050.10")
  })

  it("says what is wrong with a row it cannot record", () => {
    const [unknownType, badDate, future] = applyMapping(
      [
        ["03/02/2024", "Gifted", "AAPL", "1", "1", "", ""],
        ["31/02/2024", "Bought", "AAPL", "1", "1", "", ""],
        ["01/01/2027", "Bought", "AAPL", "1", "1", "", ""],
      ],
      mapping,
      context,
    )
    expect(unknownType.problems).toEqual(['No type for "Gifted"'])
    expect(badDate.problems).toEqual(['"31/02/2024" is not a DD/MM/YYYY date'])
    expect(future.problems).toEqual(["2027-01-01 is after today"])
  })

  it("takes the market from a mapped column over the default", () => {
    const withMarket: CsvMapping = {
      ...mapping,
      columns: ["Date", "Type", "Code", "Quantity", "Price", "Fees", "Market"],
    }
    const [row] = applyMapping(
      [["03/02/2024", "Bought", "BHP", "1", "1", "", "ASX"]],
      withMarket,
      context,
    )
    expect(row.values[BC_COLUMNS.indexOf("Market")]).toBe("ASX")
  })

  it("reads ISO, US and day-first dates", () => {
    const read = (
      dateFormat: CsvMapping["dateFormat"],
      value: string,
    ): string =>
      applyMapping(
        [[value, "Bought", "A", "1", "1", "", ""]],
        { ...mapping, dateFormat },
        context,
      )[0].values[BC_COLUMNS.indexOf("Date")]
    expect(read("YYYY-MM-DD", "2024-02-03")).toBe("2024-02-03")
    expect(read("MM/DD/YYYY", "2/3/2024")).toBe("2024-02-03")
    expect(read("DD/MM/YYYY", "3/2/2024")).toBe("2024-02-03")
  })
})

describe("missingRequired", () => {
  it("names the fields a mapping still needs, with a default market standing in for a column", () => {
    expect(missingRequired(mapping)).toEqual([])
    expect(
      missingRequired({
        ...mapping,
        columns: ["Date", null, "Code", null, null, null, null],
        market: "",
      }),
    ).toEqual(["Type", "Market", "Quantity"])
  })
})

describe("parseMappingReply", () => {
  it("accepts a well-formed reply and drops unknown fields and types", () => {
    const parsed = parseMappingReply(
      {
        columns: ["Date", "Type", "Bogus", "Quantity"],
        typeValues: { Bought: "BUY", Odd: "NOPE" },
        dateFormat: "DD/MM/YYYY",
        market: "US",
      },
      4,
    )
    expect(parsed).toEqual({
      columns: ["Date", "Type", null, "Quantity"],
      typeValues: { Bought: "BUY" },
      dateFormat: "DD/MM/YYYY",
      market: "US",
    })
  })

  it("pads or trims the columns to the header count and maps a field once", () => {
    const parsed = parseMappingReply(
      { columns: ["Code", "Code"], typeValues: {}, dateFormat: "YYYY-MM-DD" },
      3,
    )
    expect(parsed?.columns).toEqual(["Code", null, null])
  })

  it("rejects a reply that is not a mapping", () => {
    expect(parseMappingReply(null, 2)).toBeNull()
    expect(parseMappingReply({ columns: "nope" }, 2)).toBeNull()
    expect(
      parseMappingReply(
        { columns: [], typeValues: {}, dateFormat: "whenever" },
        2,
      ),
    ).toBeNull()
  })
})

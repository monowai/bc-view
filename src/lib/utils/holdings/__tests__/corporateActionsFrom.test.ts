import { corporateActionsFrom } from "../corporateActionsFrom"

describe("corporateActionsFrom", () => {
  it("a holding opened on its cost date looks for events from its first trade", () => {
    expect(
      corporateActionsFrom({
        opened: "2016-03-01",
        firstTransaction: "2026-11-18",
      }),
    ).toBe("2026-11-18")
  })

  it("a holding re-bought after selling out looks for events from when it re-opened", () => {
    expect(
      corporateActionsFrom({
        opened: "2022-05-10",
        firstTransaction: "2018-01-02",
      }),
    ).toBe("2022-05-10")
  })

  it("uses whichever date is known", () => {
    expect(
      corporateActionsFrom({ opened: "2020-01-01", firstTransaction: null }),
    ).toBe("2020-01-01")
    expect(
      corporateActionsFrom({ opened: null, firstTransaction: "2020-01-01" }),
    ).toBe("2020-01-01")
  })

  it("is undefined when neither date is known", () => {
    expect(corporateActionsFrom(undefined)).toBeUndefined()
    expect(
      corporateActionsFrom({ opened: null, firstTransaction: null }),
    ).toBeUndefined()
  })
})

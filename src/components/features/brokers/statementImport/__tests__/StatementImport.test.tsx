import React from "react"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent, { UserEvent } from "@testing-library/user-event"
import { enableFetchMocks, MockResponseInit } from "jest-fetch-mock"
import { SWRConfig } from "swr"
import StatementImport from "../StatementImport"
import { todayIso } from "@utils/formatters"
import type {
  ConfirmedHoldings,
  ReconcilePreview,
  ReconcilePreviewRow,
  ScreenshotProposal,
  ShownHolding,
  ShownHoldings,
} from "types/beancounter"

enableFetchMocks()

const routerState: { query: Record<string, string> } = { query: {} }
jest.mock("next/router", () => ({ useRouter: () => routerState }))

// The read endpoint is a paid vision-model call: it is only ever mocked here.
const READ_URL = "/api/agent/screenshot"
const PREVIEW_URL = "/api/brokers/reconcile"
const COMMIT_URL = "/api/brokers/reconcile/commit"

const growth = { id: "pf-1", code: "GROWTH", name: "Growth" }
const income = { id: "pf-2", code: "INCOME", name: "Income" }

const ibkrFirm = {
  id: "gb-ibkr",
  code: "IBKR",
  name: "Interactive Brokers",
  config: { market: "US" },
}
const schwabFirm = {
  id: "gb-schwab",
  code: "SCHWAB",
  name: "Charles Schwab",
  config: { market: "US" },
}
const ibkr = {
  id: "b-ibkr",
  name: "IBKR Main",
  accountNumber: "U1234482",
  globalBrokerId: "gb-ibkr",
}
/** Not linked to a brokerage firm. */
const schwab = { id: "b-schwab", name: "Schwab Joint", accountNumber: "9911" }

const holdingsProposal: ScreenshotProposal = {
  documentType: "HOLDINGS",
  brokerName: "Interactive Brokers",
  accountNumber: "482",
  asOf: "13 Nov 2026",
  totalShown: 25000.5,
  rows: [
    {
      code: "AAPL",
      name: "Apple",
      quantity: 10,
      price: 150,
      marketValue: 1500,
      costBasis: 1200,
    },
    { code: "MSFT", quantity: 5, price: 400, marketValue: 2000 },
    { code: "VOO", quantity: 3 },
    { code: "TSLA", quantity: 5 },
    // Nothing legible to look up: never sent for preview.
    { name: "Mystery Fund", quantity: 1 },
  ],
}

/** What the fake brokerage account already holds, by code. */
const HELD: Record<string, number> = { VOO: 3, TSLA: 8, NVDA: 7 }

function previewRow(row: ShownHolding): ReconcilePreviewRow {
  const market = row.market ?? "US"
  const held = HELD[row.code] ?? 0
  const base = {
    code: row.code,
    market,
    assetId: `a-${row.code}`,
    assetName: row.code,
    shown: row.quantity ?? null,
    held,
    trnType: null,
    quantity: null,
    cost: null,
    warnings: [],
  }
  if (row.quantity === undefined)
    return { ...base, status: "NEEDS_QUANTITY" as const }
  if (row.code === "ZZZ")
    return { ...base, assetId: null, assetName: null, status: "UNRESOLVED" }
  const difference = row.quantity - held
  if (difference === 0) return { ...base, status: "UNCHANGED" }
  if (difference < 0)
    return {
      ...base,
      trnType: "REDUCE",
      quantity: -difference,
      status: "READY",
    }
  const cost =
    row.costBasis === undefined
      ? null
      : (row.costBasis * difference) / row.quantity
  return {
    ...base,
    trnType: "ADD",
    quantity: difference,
    cost,
    status: cost === null ? "NEEDS_COST" : "READY",
    warnings: row.code === "AAPL" ? ["MARKET_VALUE_MISMATCH"] : [],
  }
}

interface Backend {
  portfolios: unknown[]
  /** What the read endpoint answers. */
  read: MockResponseInit
  brokers: unknown[]
  /** What linking an account to a firm answers. */
  linked: MockResponseInit
  /** What the commit endpoint answers, one per call; the last one repeats. */
  commits: MockResponseInit[]
}

let backend: Backend

function json(body: unknown, status = 200): MockResponseInit {
  return { status, body: JSON.stringify(body) }
}

function preview(shown: ShownHoldings): ReconcilePreview {
  const broker = [ibkr, schwab].find((b) => b.id === shown.brokerId) ?? null
  return {
    globalBroker: null,
    broker,
    rows: shown.rows.map(previewRow),
    notShown: broker
      ? [{ assetId: "a-NVDA", code: "NVDA", market: "US", quantity: 7 }]
      : [],
  }
}

async function respond(req: Request): Promise<MockResponseInit> {
  const url = req.url
  if (url.includes(COMMIT_URL)) {
    const next =
      backend.commits.length > 1 ? backend.commits.shift() : backend.commits[0]
    return next as MockResponseInit
  }
  if (url.includes(PREVIEW_URL)) {
    return json({ data: preview((await req.json()) as ShownHoldings) })
  }
  if (url.includes(READ_URL)) return backend.read
  if (url.includes("/api/portfolios")) return json({ data: backend.portfolios })
  if (url.includes("/api/global-brokers"))
    return json({ data: [ibkrFirm, schwabFirm] })
  if (url.includes("/api/brokers"))
    return req.method === "PATCH"
      ? backend.linked
      : json({ data: backend.brokers })
  if (url.includes("/api/markets"))
    return json({ data: [{ code: "US" }, { code: "NASDAQ" }, { code: "SGX" }] })
  return json({ data: [] })
}

function bodiesSentTo<T>(url: string): T[] {
  return fetchMock.mock.calls
    .filter(([called]) => called === url)
    .map(([, init]) => JSON.parse(init?.body as string) as T)
}

function callsTo(url: string): number {
  return fetchMock.mock.calls.filter(([called]) => called === url).length
}

function renderImport(): void {
  render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <StatementImport />
    </SWRConfig>,
  )
}

const screenshot = (): File =>
  new File(["png-bytes"], "holdings.png", { type: "image/png" })

const ACCOUNT_NAMES: Record<string, RegExp> = {
  "b-ibkr": /IBKR Main/,
  "b-schwab": /Schwab Joint/,
}

/** Choose the brokerage firm, then the account at it. */
async function chooseAccount(
  user: UserEvent,
  firmId: string,
  brokerId: string,
): Promise<void> {
  await screen.findByRole("option", { name: "Charles Schwab" })
  await user.selectOptions(screen.getByLabelText("Brokerage"), firmId)
  await screen.findByRole("option", { name: ACCOUNT_NAMES[brokerId] })
  await user.selectOptions(screen.getByLabelText("Brokerage account"), brokerId)
}

/** Choose the IBKR account and a file, then press Read screenshot. */
async function upload(user: UserEvent): Promise<void> {
  const read = screen.getByRole("button", { name: "Read screenshot" })
  await chooseAccount(user, "gb-ibkr", "b-ibkr")
  await user.upload(screen.getByLabelText("Screenshot"), screenshot())
  await waitFor(() => expect(read).toBeEnabled())
  await user.click(read)
}

/** Upload a holdings screenshot and wait for the confirmation screen. */
async function readHoldings(user: UserEvent): Promise<void> {
  renderImport()
  await upload(user)
  await screen.findByRole("heading", { name: "Confirm what was read" })
}

const recordButton = (): HTMLElement =>
  screen.getByRole("button", { name: /^Record \d+ changes?$/ })

const rowFor = (code: string): HTMLElement =>
  screen.getByRole("row", { name: new RegExp(`\\b${code}\\b`) })

beforeEach(() => {
  fetchMock.resetMocks()
  routerState.query = {}
  backend = {
    portfolios: [growth],
    read: json(holdingsProposal),
    brokers: [ibkr, schwab],
    linked: json({ data: { ...schwab, globalBrokerId: "gb-schwab" } }),
    commits: [json({ data: { trns: [{ id: "t-1" }, { id: "t-2" }] } })],
  }
  fetchMock.mockResponse(respond)
})

describe("<StatementImport /> upload", () => {
  test("reads a screenshot and shows the proposed changes", async () => {
    const user = userEvent.setup()
    await readHoldings(user)

    // The image itself is what was sent to the reader.
    const [, readInit] = fetchMock.mock.calls.find(
      ([called]) => called === READ_URL,
    )!
    expect(readInit?.method).toBe("POST")
    const sentFile = (readInit?.body as FormData).get("file") as File
    expect(sentFile.name).toBe("holdings.png")

    const [shown] = bodiesSentTo<ShownHoldings>(PREVIEW_URL)
    expect(shown).toEqual({
      portfolioId: "pf-1",
      brokerId: "b-ibkr",
      brokerName: "Interactive Brokers",
      accountNumber: "482",
      rows: [
        {
          code: "AAPL",
          quantity: 10,
          price: 150,
          marketValue: 1500,
          costBasis: 1200,
        },
        { code: "MSFT", quantity: 5, price: 400, marketValue: 2000 },
        { code: "VOO", quantity: 3 },
        { code: "TSLA", quantity: 5 },
      ],
    })

    const read = screen.getByRole("region", { name: "Read from screenshot" })
    expect(within(read).getByText("Interactive Brokers")).toBeInTheDocument()
    expect(within(read).getByText("482")).toBeInTheDocument()
    expect(within(read).getByText("13 Nov 2026")).toBeInTheDocument()
    expect(within(read).getByText("25,000.50")).toBeInTheDocument()

    expect(screen.getByText(/IBKR Main/)).toBeInTheDocument()

    const aapl = within(rowFor("AAPL"))
    expect(aapl.getByText("Add 10")).toBeInTheDocument()
    expect(aapl.getByText("Ready to record")).toBeInTheDocument()
    expect(
      aapl.getByText(/does not match the market value shown/),
    ).toBeInTheDocument()
    expect(within(rowFor("TSLA")).getByText("Reduce 3")).toBeInTheDocument()
    const voo = within(rowFor("VOO"))
    expect(voo.getByText("No change")).toBeInTheDocument()
    expect(voo.getByText("Matches what is held")).toBeInTheDocument()
    expect(within(rowFor("MSFT")).getByText("Enter the cost")).toBeVisible()

    expect(screen.getByLabelText("Trade date")).toHaveValue(todayIso())
    expect(screen.getByLabelText("Trade date")).toHaveAttribute(
      "max",
      todayIso(),
    )
    expect(recordButton()).toHaveTextContent("Record 2 changes")
    expect(recordButton()).toBeEnabled()
  })

  test("the portfolio must be chosen when there is more than one", async () => {
    backend.portfolios = [growth, income]
    const user = userEvent.setup()
    renderImport()

    await screen.findByRole("option", { name: /Income/ })
    await user.upload(screen.getByLabelText("Screenshot"), screenshot())
    const read = screen.getByRole("button", { name: "Read screenshot" })
    expect(read).toBeDisabled()

    await chooseAccount(user, "gb-ibkr", "b-ibkr")
    await user.selectOptions(screen.getByLabelText("Portfolio"), "pf-2")
    await user.click(read)
    await screen.findByRole("heading", { name: "Confirm what was read" })

    expect(bodiesSentTo<ShownHoldings>(PREVIEW_URL)[0].portfolioId).toBe("pf-2")
  })

  test("a transactions screenshot records nothing and says why", async () => {
    backend.read = json({
      documentType: "TRANSACTIONS",
      rows: [{ code: "AAPL", type: "Bought", quantity: 1 }],
    })
    const user = userEvent.setup()
    renderImport()
    await upload(user)

    expect(
      await screen.findByText(/Transaction screenshots are not supported yet/),
    ).toBeInTheDocument()
    expect(screen.getByText(/holdings screenshot/)).toBeInTheDocument()
    expect(callsTo(PREVIEW_URL)).toBe(0)
    expect(callsTo(COMMIT_URL)).toBe(0)

    await user.click(
      screen.getByRole("button", { name: "Choose another file" }),
    )
    expect(
      screen.queryByText(/Transaction screenshots are not supported yet/),
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Read screenshot" }),
    ).toBeDisabled()
  })

  test.each([
    [413, "The image is larger than 8 MB", /larger than 8 MB/],
    [415, "Upload a PNG, JPEG, WebP or GIF image", /PNG, JPEG, WebP or GIF/],
    [
      422,
      "The image shows no brokerage holdings",
      /could not read that screenshot: The image shows no brokerage holdings/,
    ],
    [
      502,
      "The screenshot reader is unavailable",
      /screenshot reader is unavailable right now/,
    ],
    [400, "The file is empty", /file is empty/],
    [
      429,
      "You have used this week's AI questions. Each one frees up seven days after it was asked.",
      /You have used this week's AI questions/,
    ],
  ])(
    "a %i refusal from the reader is shown in plain words",
    async (status, message, shown) => {
      backend.read = json({ error: message, message, code: "X" }, status)
      const user = userEvent.setup()
      renderImport()
      await upload(user)

      expect(await screen.findByRole("alert")).toHaveTextContent(shown)
      expect(
        screen.queryByRole("heading", { name: "Confirm what was read" }),
      ).not.toBeInTheDocument()
      expect(callsTo(PREVIEW_URL)).toBe(0)
    },
  )

  test("an image over 8 MB is refused without being sent", async () => {
    const user = userEvent.setup()
    renderImport()
    const big = screenshot()
    Object.defineProperty(big, "size", { value: 8 * 1024 * 1024 + 1 })

    await user.upload(screen.getByLabelText("Screenshot"), big)

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /larger than 8 MB/,
    )
    expect(
      screen.getByRole("button", { name: "Read screenshot" }),
    ).toBeDisabled()
    expect(callsTo(READ_URL)).toBe(0)
    // The input is emptied, so it does not show the refused file.
    expect(
      (screen.getByLabelText("Screenshot") as HTMLInputElement).files,
    ).toHaveLength(0)
  })

  test("the brokerage account chosen is the one checked and recorded against", async () => {
    const user = userEvent.setup()
    renderImport()

    await user.upload(screen.getByLabelText("Screenshot"), screenshot())
    const read = screen.getByRole("button", { name: "Read screenshot" })
    expect(screen.getByLabelText("Brokerage")).toBeRequired()
    expect(screen.getByLabelText("Brokerage account")).toBeRequired()
    expect(
      screen.getByRole("link", { name: /Add a brokerage account/ }),
    ).toHaveAttribute("href", "/brokers")

    await chooseAccount(user, "gb-ibkr", "b-ibkr")
    await user.click(read)
    await screen.findByRole("heading", { name: "Confirm what was read" })

    expect(screen.getByText("IBKR Main (U1234482)")).toBeInTheDocument()
    expect(screen.queryByLabelText("Brokerage account")).not.toBeInTheDocument()
    expect(bodiesSentTo<ShownHoldings>(PREVIEW_URL)[0].brokerId).toBe("b-ibkr")
    expect(callsTo("/api/brokers/b-ibkr")).toBe(0)
    await user.click(recordButton())
    await screen.findByRole("heading", { name: "Recorded" })
    expect(bodiesSentTo<ConfirmedHoldings>(COMMIT_URL)[0].brokerId).toBe(
      "b-ibkr",
    )
  })

  test("a brokerage offers its own accounts and those not linked to any", async () => {
    const user = userEvent.setup()
    renderImport()

    await screen.findByRole("option", { name: "Charles Schwab" })
    expect(screen.getByLabelText("Brokerage account")).toBeDisabled()
    await user.selectOptions(screen.getByLabelText("Brokerage"), "gb-schwab")

    const account = screen.getByLabelText("Brokerage account")
    expect(
      within(account).getByRole("option", { name: /Schwab Joint/ }),
    ).toBeInTheDocument()
    expect(
      within(account).queryByRole("option", { name: /IBKR Main/ }),
    ).not.toBeInTheDocument()
    expect(
      screen.getByText(/Holdings are looked up on the US market/),
    ).toBeInTheDocument()
  })

  test("reading links an account to the brokerage chosen for it", async () => {
    const user = userEvent.setup()
    renderImport()

    await chooseAccount(user, "gb-schwab", "b-schwab")
    expect(
      screen.getByText(/Schwab Joint will be linked to Charles Schwab/),
    ).toBeInTheDocument()
    await user.upload(screen.getByLabelText("Screenshot"), screenshot())
    await user.click(screen.getByRole("button", { name: "Read screenshot" }))
    await screen.findByRole("heading", { name: "Confirm what was read" })

    expect(bodiesSentTo<unknown>("/api/brokers/b-schwab")).toEqual([
      { name: "Schwab Joint", globalBrokerId: "gb-schwab" },
    ])
    expect(bodiesSentTo<ShownHoldings>(PREVIEW_URL)[0].brokerId).toBe(
      "b-schwab",
    )
  })

  test("an account that cannot be linked is not read", async () => {
    backend.linked = json({ message: "Brokerage firm not found" }, 400)
    const user = userEvent.setup()
    renderImport()

    await chooseAccount(user, "gb-schwab", "b-schwab")
    await user.upload(screen.getByLabelText("Screenshot"), screenshot())
    await user.click(screen.getByRole("button", { name: "Read screenshot" }))

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Brokerage firm not found",
    )
    expect(callsTo(READ_URL)).toBe(0)
  })

  test("another brokerage offers only accounts not linked to a firm, and links nothing", async () => {
    const user = userEvent.setup()
    renderImport()

    await screen.findByRole("option", { name: "Charles Schwab" })
    await user.selectOptions(screen.getByLabelText("Brokerage"), "__OTHER__")
    const account = screen.getByLabelText("Brokerage account")
    expect(
      within(account).queryByRole("option", { name: /IBKR Main/ }),
    ).not.toBeInTheDocument()
    await user.selectOptions(account, "b-schwab")
    await user.upload(screen.getByLabelText("Screenshot"), screenshot())
    await user.click(screen.getByRole("button", { name: "Read screenshot" }))
    await screen.findByRole("heading", { name: "Confirm what was read" })

    expect(callsTo("/api/brokers/b-schwab")).toBe(0)
    expect(bodiesSentTo<ShownHoldings>(PREVIEW_URL)[0].brokerId).toBe(
      "b-schwab",
    )
  })

  test("with one brokerage account it and its brokerage are already chosen", async () => {
    backend.brokers = [ibkr]
    const user = userEvent.setup()
    renderImport()

    await screen.findByRole("option", { name: /IBKR Main/ })
    expect(screen.getByLabelText("Brokerage")).toHaveValue("gb-ibkr")
    expect(screen.getByLabelText("Brokerage account")).toHaveValue("b-ibkr")
    await user.upload(screen.getByLabelText("Screenshot"), screenshot())
    await user.click(screen.getByRole("button", { name: "Read screenshot" }))
    await screen.findByRole("heading", { name: "Confirm what was read" })

    expect(bodiesSentTo<ShownHoldings>(PREVIEW_URL)[0].brokerId).toBe("b-ibkr")
  })

  test("says when the brokerage accounts could not be loaded", async () => {
    fetchMock.mockResponse((req) =>
      req.url.includes("/api/brokers") && !req.url.includes(PREVIEW_URL)
        ? Promise.resolve(json({ message: "down" }, 500))
        : respond(req),
    )
    renderImport()

    expect(
      await screen.findByText(/brokerage accounts could not be loaded/),
    ).toBeInTheDocument()
  })

  test("a new portfolio is made on the portfolio page, which comes back here", async () => {
    const user = userEvent.setup()
    renderImport()

    await chooseAccount(user, "gb-schwab", "b-schwab")

    expect(screen.getByRole("link", { name: "New portfolio" })).toHaveAttribute(
      "href",
      "/portfolios/__NEW__?returnTo=%2Fbrokers%2Fimport%3Fbroker%3Db-schwab",
    )
  })

  test("the portfolio and account named in the address are already chosen", async () => {
    backend.portfolios = [growth, income]
    routerState.query = { portfolio: "pf-2", broker: "b-ibkr" }
    const user = userEvent.setup()
    renderImport()

    await screen.findByRole("option", { name: /IBKR Main/ })
    await screen.findByRole("option", { name: /Income/ })
    expect(screen.getByLabelText("Brokerage")).toHaveValue("gb-ibkr")
    expect(screen.getByLabelText("Brokerage account")).toHaveValue("b-ibkr")
    expect(screen.getByLabelText("Portfolio")).toHaveValue("pf-2")
    await user.upload(screen.getByLabelText("Screenshot"), screenshot())
    await user.click(screen.getByRole("button", { name: "Read screenshot" }))
    await screen.findByRole("heading", { name: "Confirm what was read" })

    const [shown] = bodiesSentTo<ShownHoldings>(PREVIEW_URL)
    expect(shown.portfolioId).toBe("pf-2")
    expect(shown.brokerId).toBe("b-ibkr")
  })
})

describe("<StatementImport /> confirm", () => {
  test("rows that were never checked say so, not that they changed", async () => {
    fetchMock.mockResponse((req) =>
      req.url.includes(PREVIEW_URL)
        ? Promise.resolve(
            json({ message: "The rows could not be checked" }, 500),
          )
        : respond(req),
    )
    const user = userEvent.setup()
    await readHoldings(user)

    expect(
      screen.getByText("The rows could not be checked"),
    ).toBeInTheDocument()
    expect(
      within(rowFor("AAPL")).getByText("Not checked yet. Press Re-check."),
    ).toBeInTheDocument()
    expect(
      screen.queryByText(/Changed since the last check/),
    ).not.toBeInTheDocument()
  })

  test("editing marks the preview stale until it is re-checked", async () => {
    const user = userEvent.setup()
    await readHoldings(user)

    const quantity = screen.getByLabelText("Quantity for AAPL")
    await user.clear(quantity)
    await user.type(quantity, "25")
    const cost = screen.getByLabelText("Cost for AAPL")
    await user.clear(cost)
    await user.type(cost, "3000.50")

    expect(recordButton()).toBeDisabled()
    expect(within(rowFor("AAPL")).queryByText("Add 10")).not.toBeInTheDocument()
    // Typing asked the server nothing.
    expect(callsTo(PREVIEW_URL)).toBe(1)

    await user.click(screen.getByRole("button", { name: "Re-check" }))

    expect(
      await within(rowFor("AAPL")).findByText("Add 25"),
    ).toBeInTheDocument()
    expect(recordButton()).toBeEnabled()
    const rechecked = bodiesSentTo<ShownHoldings>(PREVIEW_URL)[1]
    expect(rechecked.rows[0]).toEqual({
      code: "AAPL",
      market: "US",
      quantity: 25,
      costBasis: 3000.5,
      price: 150,
      marketValue: 1500,
    })
  })

  test("a row that needs a cost is ready once the cost is entered and re-checked", async () => {
    const user = userEvent.setup()
    await readHoldings(user)

    const blocked = screen.getByRole("region", {
      name: "Will not be recorded",
    })
    expect(within(blocked).getByText(/MSFT/)).toHaveTextContent(
      "Enter the cost",
    )

    await user.type(screen.getByLabelText("Cost for MSFT"), "1,750")
    await user.click(screen.getByRole("button", { name: "Re-check" }))

    expect(
      await within(rowFor("MSFT")).findByText("Ready to record"),
    ).toBeInTheDocument()
    expect(bodiesSentTo<ShownHoldings>(PREVIEW_URL)[1].rows[1]).toMatchObject({
      code: "MSFT",
      costBasis: 1750,
    })
    expect(recordButton()).toHaveTextContent("Record 3 changes")
  })

  test("says what is missing on rows that cannot be recorded", async () => {
    backend.read = json({
      ...holdingsProposal,
      rows: [{ code: "ZZZ", quantity: 4 }, { code: "QQQ" }],
    })
    const user = userEvent.setup()
    await readHoldings(user)

    expect(
      within(rowFor("ZZZ")).getByText(
        "Beancounter does not know this asset on that market",
      ),
    ).toBeInTheDocument()
    expect(
      within(rowFor("QQQ")).getByText("Enter the quantity"),
    ).toBeInTheDocument()
    expect(recordButton()).toBeDisabled()
  })

  test("a removed row is not sent", async () => {
    const user = userEvent.setup()
    await readHoldings(user)

    await user.click(screen.getByRole("button", { name: "Remove TSLA" }))
    expect(screen.queryByLabelText("Quantity for TSLA")).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Re-check" }))
    await waitFor(() => expect(callsTo(PREVIEW_URL)).toBe(2))
    expect(
      bodiesSentTo<ShownHoldings>(PREVIEW_URL)[1].rows.map((row) => row.code),
    ).toEqual(["AAPL", "MSFT", "VOO"])

    await waitFor(() => expect(recordButton()).toBeEnabled())
    await user.click(recordButton())
    await screen.findByRole("heading", { name: "Recorded" })
    const [confirmed] = bodiesSentTo<ConfirmedHoldings>(COMMIT_URL)
    expect(confirmed.rows.map((row) => row.assetId)).toEqual(["a-AAPL"])
  })

  test("holdings not on the screenshot are listed and never sent", async () => {
    const user = userEvent.setup()
    await readHoldings(user)

    const notShown = screen.getByRole("region", {
      name: "Held at this account but not on the screenshot",
    })
    expect(within(notShown).getByText(/NVDA/)).toBeInTheDocument()

    await user.click(recordButton())
    await screen.findByRole("heading", { name: "Recorded" })
    const [confirmed] = bodiesSentTo<ConfirmedHoldings>(COMMIT_URL)
    expect(JSON.stringify(confirmed)).not.toContain("NVDA")
    for (const sent of bodiesSentTo<ShownHoldings>(PREVIEW_URL)) {
      expect(sent.rows.map((row) => row.code)).not.toContain("NVDA")
    }
  })
})

describe("<StatementImport /> record", () => {
  test("Record sends only the ready rows, once", async () => {
    const user = userEvent.setup()
    await readHoldings(user)

    await user.dblClick(recordButton())
    await screen.findByRole("heading", { name: "Recorded" })

    const commits = bodiesSentTo<ConfirmedHoldings>(COMMIT_URL)
    expect(commits).toHaveLength(1)
    expect(commits[0]).toEqual({
      portfolioId: "pf-1",
      brokerId: "b-ibkr",
      uploadId: expect.stringMatching(/^[0-9a-f-]{36}$/),
      tradeDate: todayIso(),
      rows: [
        { assetId: "a-AAPL", trnType: "ADD", quantity: 10, cost: 1200 },
        { assetId: "a-TSLA", trnType: "REDUCE", quantity: 3 },
      ],
    })
  })

  test("the trade date chosen is the one sent", async () => {
    const user = userEvent.setup()
    await readHoldings(user)

    const tradeDate = screen.getByLabelText("Trade date")
    await user.clear(tradeDate)
    await user.type(tradeDate, "2020-02-03")
    await user.click(recordButton())
    await screen.findByRole("heading", { name: "Recorded" })

    expect(bodiesSentTo<ConfirmedHoldings>(COMMIT_URL)[0].tradeDate).toBe(
      "2020-02-03",
    )
  })

  test("a refusal shows the server's message, keeps the edits, and a retry reuses the upload id", async () => {
    backend.commits = [
      json(
        {
          error: "Bad Request",
          message: "TSLA: cannot reduce 3, the portfolio holds 1",
        },
        400,
      ),
      json({ data: { trns: [{ id: "t-1" }] } }),
    ]
    const user = userEvent.setup()
    await readHoldings(user)

    const cost = screen.getByLabelText("Cost for AAPL")
    await user.clear(cost)
    await user.type(cost, "1300")
    await user.click(screen.getByRole("button", { name: "Re-check" }))
    await waitFor(() => expect(recordButton()).toBeEnabled())
    await user.click(recordButton())

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "TSLA: cannot reduce 3, the portfolio holds 1",
    )
    expect(
      screen.getByRole("heading", { name: "Confirm what was read" }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText("Cost for AAPL")).toHaveValue("1300")

    await user.click(screen.getByRole("button", { name: "Remove TSLA" }))
    await user.click(recordButton())
    await screen.findByRole("heading", { name: "Recorded" })

    const commits = bodiesSentTo<ConfirmedHoldings>(COMMIT_URL)
    expect(commits).toHaveLength(2)
    expect(commits[1].uploadId).toBe(commits[0].uploadId)
    expect(commits[1].rows).toEqual([
      { assetId: "a-AAPL", trnType: "ADD", quantity: 10, cost: 1300 },
    ])
  })

  test("the done screen shows the count, the warnings and where to go next", async () => {
    backend.commits = [
      json({
        data: { trns: [{ id: "t-1" }, { id: "t-2" }] },
        warnings: ["Cash was not settled for AAPL"],
      }),
    ]
    const user = userEvent.setup()
    await readHoldings(user)
    await user.click(recordButton())

    await screen.findByRole("heading", { name: "Recorded" })
    expect(screen.getByText("2 transactions recorded.")).toBeInTheDocument()
    expect(
      screen.getByText("Cash was not settled for AAPL"),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("link", { name: /holdings at this brokerage account/i }),
    ).toHaveAttribute("href", "/brokers/b-ibkr/holdings")

    await user.click(
      screen.getByRole("button", { name: "Import another screenshot" }),
    )
    expect(
      screen.getByRole("button", { name: "Read screenshot" }),
    ).toBeDisabled()
    expect(callsTo(READ_URL)).toBe(1)
  })

  test("a second screenshot gets its own upload id", async () => {
    const user = userEvent.setup()
    await readHoldings(user)
    await user.click(recordButton())
    await screen.findByRole("heading", { name: "Recorded" })
    await user.click(
      screen.getByRole("button", { name: "Import another screenshot" }),
    )

    await upload(user)
    await screen.findByRole("heading", { name: "Confirm what was read" })
    await user.click(recordButton())
    await waitFor(() => expect(callsTo(COMMIT_URL)).toBe(2))

    const [first, second] = bodiesSentTo<ConfirmedHoldings>(COMMIT_URL)
    expect(second.uploadId).not.toBe(first.uploadId)
  })
})

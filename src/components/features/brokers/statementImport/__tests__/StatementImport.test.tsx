import React from "react"
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
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

// The read endpoint is a paid vision-model call: it is only ever mocked here.
const READ_URL = "/api/agent/screenshot"
const PREVIEW_URL = "/api/brokers/reconcile"
const COMMIT_URL = "/api/brokers/reconcile/commit"
const HELD_SINCE_URL = "/api/brokers/reconcile/held-since"

const growth = { id: "pf-1", code: "GROWTH", name: "Growth" }
const income = { id: "pf-2", code: "INCOME", name: "Income" }

const ibkrFirm = {
  id: "gb-ibkr",
  code: "IBKR",
  name: "Interactive Brokers",
  config: { market: "US", currency: "USD" },
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
  if (row.code === "DUAL" && !row.market)
    return {
      code: row.code,
      market: null,
      assetId: null,
      assetName: null,
      shown: row.quantity ?? null,
      held: 0,
      trnType: null,
      quantity: null,
      cost: null,
      status: "NEEDS_MARKET",
      warnings: [],
      marketSource: null,
      listedOn: ["ASX", "US"],
    }
  const market = row.market ?? "US"
  const held = HELD[row.code] ?? 0
  const base = {
    code: row.code,
    market,
    marketSource: row.market
      ? ("SHOWN" as const)
      : row.code in HELD
        ? ("HELD" as const)
        : ("BROKERAGE" as const),
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
  if (row.code === "NOK")
    return {
      ...base,
      assetId: null,
      assetCode: "NOK",
      assetName: "Nokia Corp ADR",
      trnType: "ADD",
      quantity: row.quantity,
      cost: row.costBasis ?? null,
      status: row.costBasis === undefined ? "NEEDS_COST" : "READY",
    }
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
  /** What creating a portfolio answers. */
  created: MockResponseInit
  /** What creating a brokerage account answers. */
  createdAccount: MockResponseInit
  /** What the held-since suggestion answers. */
  heldSince: MockResponseInit
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
  if (url.includes(HELD_SINCE_URL)) return backend.heldSince
  if (url.includes(COMMIT_URL)) {
    const next =
      backend.commits.length > 1 ? backend.commits.shift() : backend.commits[0]
    return next as MockResponseInit
  }
  if (url.includes(PREVIEW_URL)) {
    return json({ data: preview((await req.json()) as ShownHoldings) })
  }
  if (url.includes(READ_URL)) return backend.read
  if (url.includes("/api/assets/search"))
    return json({
      data: [
        {
          symbol: "ZZZB",
          name: "Zed Corp",
          type: "Equity",
          region: "US",
          currency: "USD",
          market: "NYSE",
        },
      ],
    })
  if (url.includes("/api/portfolios"))
    return req.method === "POST"
      ? backend.created
      : json({ data: backend.portfolios })
  if (url.includes("/api/currencies"))
    return json({
      data: [
        { code: "NZD", name: "New Zealand Dollar", symbol: "$" },
        { code: "USD", name: "US Dollar", symbol: "$" },
      ],
    })
  if (url.includes("/api/global-brokers"))
    return json({ data: [ibkrFirm, schwabFirm] })
  if (url.includes("/api/brokers"))
    return req.method === "POST"
      ? backend.createdAccount
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

/** Choose the IBKR account, the Growth portfolio and a file, then press Continue. */
async function upload(user: UserEvent): Promise<void> {
  const read = screen.getByRole("button", { name: "Continue" })
  await chooseAccount(user, "gb-ibkr", "b-ibkr")
  await screen.findByRole("option", { name: /Growth/ })
  await user.selectOptions(screen.getByLabelText("Portfolio"), "pf-1")
  await user.upload(screen.getByLabelText("Image"), screenshot())
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
  backend = {
    portfolios: [growth],
    read: json(holdingsProposal),
    brokers: [ibkr, schwab],
    created: json({
      data: [{ id: "pf-new", code: "IBKR-MAIN", name: "IBKR" }],
    }),
    heldSince: json({
      data: [{ assetId: "a-AAPL", heldSince: "2017-06-30", before: null }],
    }),
    createdAccount: json({
      data: {
        id: "b-new",
        name: "Interactive Brokers",
        accountNumber: "U999",
        globalBrokerId: "gb-ibkr",
        settlementAccounts: [],
      },
    }),
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

    expect(screen.getByText("IBKR Main (U1234482)")).toBeInTheDocument()

    const aapl = within(rowFor("AAPL"))
    expect(aapl.getByText("+10")).toHaveClass("text-emerald-700")
    expect(aapl.getByText("Ready to record")).toBeInTheDocument()
    // A good row shows a tick; its words are the tooltip.
    expect(aapl.getByTitle("Ready to record")).toContainElement(
      aapl.getByText("Ready to record"),
    )
    expect(
      aapl.getByText(/does not match the market value shown/),
    ).toBeInTheDocument()
    expect(within(rowFor("TSLA")).getByText("-3")).toHaveClass("text-red-700")
    const voo = within(rowFor("VOO"))
    expect(voo.getByText("No change")).toBeInTheDocument()
    expect(voo.getByText("Matches what is held")).toBeInTheDocument()
    expect(within(rowFor("MSFT")).getByText("Enter the cost")).toBeVisible()

    expect(screen.getByLabelText("Record date")).toHaveValue(todayIso())
    expect(screen.getByLabelText("Record date")).toHaveAttribute(
      "max",
      todayIso(),
    )
    expect(recordButton()).toHaveTextContent("Record 2 changes")
    expect(recordButton()).toBeEnabled()
  })

  test("reading shows in a popover, and Cancel stops waiting and keeps the choices", async () => {
    fetchMock.mockResponse((req) =>
      req.url.includes(READ_URL)
        ? new Promise((_resolve, reject) =>
            req.signal.addEventListener("abort", () =>
              reject(new DOMException("Aborted", "AbortError")),
            ),
          )
        : respond(req),
    )
    const user = userEvent.setup()
    renderImport()
    await upload(user)

    expect(
      await screen.findByRole("heading", { name: "Reading the image" }),
    ).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Cancel" }))

    await waitFor(() =>
      expect(
        screen.queryByRole("heading", { name: "Reading the image" }),
      ).not.toBeInTheDocument(),
    )
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Continue" })).toBeEnabled()
    expect(screen.getByLabelText("Brokerage account")).toHaveValue("b-ibkr")
    expect(callsTo(PREVIEW_URL)).toBe(0)
  })

  test("Cancel while the rows are checked stops the check too", async () => {
    fetchMock.mockResponse((req) =>
      req.url.includes(PREVIEW_URL)
        ? new Promise((_resolve, reject) =>
            req.signal.addEventListener("abort", () =>
              reject(new DOMException("Aborted", "AbortError")),
            ),
          )
        : respond(req),
    )
    const user = userEvent.setup()
    renderImport()
    await upload(user)

    await waitFor(() => expect(callsTo(PREVIEW_URL)).toBe(1))
    await user.click(screen.getByRole("button", { name: "Cancel" }))

    await waitFor(() =>
      expect(
        screen.queryByRole("heading", { name: "Reading the image" }),
      ).not.toBeInTheDocument(),
    )
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
    expect(
      screen.queryByRole("heading", { name: "Confirm what was read" }),
    ).not.toBeInTheDocument()
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
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled()
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

  test("an image pasted from the clipboard is read like a chosen file", async () => {
    const user = userEvent.setup()
    renderImport()
    await chooseAccount(user, "gb-ibkr", "b-ibkr")
    const pasted = new File(["png-bytes"], "image.png", { type: "image/png" })

    fireEvent.paste(document, { clipboardData: { files: [pasted] } })

    expect(await screen.findByText(/Pasted image chosen/)).toBeInTheDocument()
    const read = screen.getByRole("button", { name: "Continue" })
    await waitFor(() => expect(read).toBeEnabled())
    await user.click(read)
    await screen.findByRole("heading", { name: "Confirm what was read" })

    const [, readInit] = fetchMock.mock.calls.find(
      ([called]) => called === READ_URL,
    )!
    expect(((readInit?.body as FormData).get("file") as File).name).toBe(
      "image.png",
    )
  })

  test("a screenshot on the clipboard as an item, not a file, is pasted too", async () => {
    const user = userEvent.setup()
    renderImport()
    await chooseAccount(user, "gb-ibkr", "b-ibkr")
    const pasted = new File(["png-bytes"], "image.png", { type: "image/png" })

    fireEvent.paste(document, {
      clipboardData: {
        files: [],
        items: [{ kind: "file", type: "image/png", getAsFile: () => pasted }],
      },
    })

    expect(await screen.findByText(/Pasted image chosen/)).toBeInTheDocument()
  })

  test("an image dropped on the drop zone is chosen", async () => {
    const user = userEvent.setup()
    renderImport()
    await chooseAccount(user, "gb-ibkr", "b-ibkr")
    const dropped = new File(["png-bytes"], "dropped.png", {
      type: "image/png",
    })

    fireEvent.drop(screen.getByTestId("image-drop-zone"), {
      dataTransfer: {
        files: [dropped],
        items: [{ kind: "file", type: "image/png", getAsFile: () => dropped }],
        types: ["Files"],
      },
    })

    expect(await screen.findByText(/dropped\.png/)).toBeInTheDocument()
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Continue" })).toBeEnabled(),
    )
  })

  test("an attached image can be removed", async () => {
    const user = userEvent.setup()
    renderImport()
    await chooseAccount(user, "gb-ibkr", "b-ibkr")
    await user.upload(screen.getByLabelText("Image"), screenshot())
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Continue" })).toBeEnabled(),
    )

    await user.click(screen.getByRole("button", { name: "Remove image" }))

    expect(screen.queryByText(/holdings\.png/)).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled()
  })

  test("pasting text is left alone", async () => {
    renderImport()
    await screen.findByRole("option", { name: "Charles Schwab" })

    fireEvent.paste(document, { clipboardData: { files: [] } })

    expect(screen.queryByText(/Pasted image chosen/)).not.toBeInTheDocument()
  })

  test("while Continue is off, it says which step it waits on", async () => {
    const user = userEvent.setup()
    renderImport()
    await screen.findByRole("option", { name: "Charles Schwab" })
    const read = screen.getByRole("button", { name: "Continue" })

    expect(read).toBeDisabled()
    expect(read).toHaveAccessibleDescription("Finish step 1 first.")
    await chooseAccount(user, "gb-ibkr", "b-ibkr")
    expect(read).toHaveAccessibleDescription("Finish step 4 first.")
    await user.upload(screen.getByLabelText("Image"), screenshot())

    await waitFor(() => expect(read).toBeEnabled())
    expect(screen.queryByText(/Finish step/)).not.toBeInTheDocument()
  })

  test("an image over 8 MB is refused without being sent", async () => {
    const user = userEvent.setup()
    renderImport()
    const big = screenshot()
    Object.defineProperty(big, "size", { value: 8 * 1024 * 1024 + 1 })

    await user.upload(screen.getByLabelText("Image"), big)

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /larger than 8 MB/,
    )
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled()
    expect(callsTo(READ_URL)).toBe(0)
    // The input is emptied, so it does not show the refused file.
    expect(
      (screen.getByLabelText("Image") as HTMLInputElement).files,
    ).toHaveLength(0)
  })

  test("the brokerage account chosen is the one checked and recorded against", async () => {
    const user = userEvent.setup()
    renderImport()

    await user.upload(screen.getByLabelText("Image"), screenshot())
    const read = screen.getByRole("button", { name: "Continue" })
    expect(screen.getByLabelText("Brokerage")).toBeRequired()
    expect(screen.getByLabelText("Brokerage account")).toBeRequired()
    expect(
      screen.queryByRole("link", { name: /Add a brokerage account/ }),
    ).not.toBeInTheDocument()

    await chooseAccount(user, "gb-ibkr", "b-ibkr")
    await user.click(read)
    await screen.findByRole("heading", { name: "Confirm what was read" })

    expect(screen.getByText("IBKR Main (U1234482)")).toBeInTheDocument()
    expect(screen.queryByLabelText("Brokerage account")).not.toBeInTheDocument()
    expect(bodiesSentTo<ShownHoldings>(PREVIEW_URL)[0].brokerId).toBe("b-ibkr")
    await user.click(recordButton())
    await screen.findByRole("heading", { name: "Recorded" })
    expect(bodiesSentTo<ConfirmedHoldings>(COMMIT_URL)[0].brokerId).toBe(
      "b-ibkr",
    )
  })

  test("a brokerage offers only the accounts at that firm", async () => {
    const user = userEvent.setup()
    renderImport()

    await screen.findByRole("option", { name: "Charles Schwab" })
    expect(screen.getByLabelText("Brokerage account")).toBeDisabled()
    await user.selectOptions(screen.getByLabelText("Brokerage"), "gb-ibkr")

    const account = screen.getByLabelText("Brokerage account")
    expect(
      within(account).getByRole("option", { name: /IBKR Main/ }),
    ).toBeInTheDocument()
    expect(
      within(account).queryByRole("option", { name: /Schwab Joint/ }),
    ).not.toBeInTheDocument()
    expect(
      screen.getByText(/Holdings are looked up on the US market/),
    ).toBeInTheDocument()
  })

  test("another brokerage offers only the accounts at no listed firm", async () => {
    const user = userEvent.setup()
    renderImport()

    await screen.findByRole("option", { name: "Charles Schwab" })
    await user.selectOptions(screen.getByLabelText("Brokerage"), "__OTHER__")
    const account = screen.getByLabelText("Brokerage account")
    expect(
      within(account).queryByRole("option", { name: /IBKR Main/ }),
    ).not.toBeInTheDocument()
    await user.selectOptions(account, "b-schwab")
    await user.upload(screen.getByLabelText("Image"), screenshot())
    await user.click(screen.getByRole("button", { name: "Continue" }))
    await screen.findByRole("heading", { name: "Confirm what was read" })

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
    await user.upload(screen.getByLabelText("Image"), screenshot())
    await user.click(screen.getByRole("button", { name: "Continue" }))
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
})

describe("<StatementImport /> new portfolio", () => {
  async function readIntoNewPortfolio(user: UserEvent): Promise<void> {
    renderImport()
    await chooseAccount(user, "gb-ibkr", "b-ibkr")
    await user.upload(screen.getByLabelText("Image"), screenshot())
    await user.click(screen.getByRole("button", { name: "Continue" }))
    await screen.findByRole("heading", { name: "Confirm what was read" })
  }

  test("Create Portfolio is the default, in the brokerage firm's currency", async () => {
    const user = userEvent.setup()
    renderImport()
    await chooseAccount(user, "gb-ibkr", "b-ibkr")

    expect(screen.getByLabelText("Portfolio")).toHaveValue("__NEW__")
    expect(
      screen.getByRole("option", { name: "Create Portfolio" }),
    ).toBeInTheDocument()
    await screen.findByRole("option", { name: "USD" })
    expect(screen.getByLabelText("Currency")).toHaveValue("USD")
  })

  test("the portfolio is created on Record, named for the account, and the holdings go into it", async () => {
    const user = userEvent.setup()
    await readIntoNewPortfolio(user)

    expect(
      bodiesSentTo<ShownHoldings>(PREVIEW_URL)[0].portfolioId,
    ).toBeUndefined()
    expect(bodiesSentTo<unknown>("/api/portfolios")).toEqual([])
    await user.click(recordButton())
    await screen.findByRole("heading", { name: "Recorded" })

    expect(bodiesSentTo<unknown>("/api/portfolios")).toEqual([
      {
        data: [
          {
            code: "IBKR-MAIN",
            name: "IBKR Main (U1234482)",
            currency: "USD",
            base: "USD",
          },
        ],
      },
    ])
    expect(bodiesSentTo<ConfirmedHoldings>(COMMIT_URL)[0].portfolioId).toBe(
      "pf-new",
    )
  })

  test("the currency chosen and a code not already in use name the new portfolio", async () => {
    backend.portfolios = [
      growth,
      { id: "pf-9", code: "IBKR-MAIN", name: "Old" },
    ]
    const user = userEvent.setup()
    renderImport()
    await chooseAccount(user, "gb-ibkr", "b-ibkr")
    await screen.findByRole("option", { name: "NZD" })
    await user.selectOptions(screen.getByLabelText("Currency"), "NZD")
    await user.upload(screen.getByLabelText("Image"), screenshot())
    await user.click(screen.getByRole("button", { name: "Continue" }))
    await screen.findByRole("heading", { name: "Confirm what was read" })
    await user.click(recordButton())
    await screen.findByRole("heading", { name: "Recorded" })

    expect(bodiesSentTo<unknown>("/api/portfolios")).toEqual([
      {
        data: [
          {
            code: "IBKR-MAIN-2",
            name: "IBKR Main (U1234482)",
            currency: "NZD",
            base: "NZD",
          },
        ],
      },
    ])
  })

  test("a portfolio that cannot be created records nothing and says why", async () => {
    backend.created = json(
      { message: "Portfolio code IBKR-MAIN is in use" },
      409,
    )
    const user = userEvent.setup()
    await readIntoNewPortfolio(user)
    await user.click(recordButton())

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Portfolio code IBKR-MAIN is in use",
    )
    expect(callsTo(COMMIT_URL)).toBe(0)
  })

  test("the next import starts again in the firm's currency", async () => {
    const user = userEvent.setup()
    renderImport()
    await chooseAccount(user, "gb-ibkr", "b-ibkr")
    await screen.findByRole("option", { name: "NZD" })
    await user.selectOptions(screen.getByLabelText("Currency"), "NZD")
    await user.upload(screen.getByLabelText("Image"), screenshot())
    await user.click(screen.getByRole("button", { name: "Continue" }))
    await screen.findByRole("heading", { name: "Confirm what was read" })
    await user.click(recordButton())
    await screen.findByRole("heading", { name: "Recorded" })
    await user.click(
      screen.getByRole("button", { name: "Import another screenshot" }),
    )

    expect(await screen.findByLabelText("Currency")).toHaveValue("USD")
  })

  test("a creation that returns no portfolio records nothing and says why", async () => {
    backend.created = json({ data: [] })
    const user = userEvent.setup()
    await readIntoNewPortfolio(user)
    await user.click(recordButton())

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "did not return the portfolio",
    )
    expect(callsTo(COMMIT_URL)).toBe(0)
  })

  test("currencies that cannot be loaded say so", async () => {
    fetchMock.mockResponse((req) =>
      req.url.includes("/api/currencies")
        ? Promise.resolve(json({ message: "down" }, 500))
        : respond(req),
    )
    const user = userEvent.setup()
    renderImport()
    await chooseAccount(user, "gb-ibkr", "b-ibkr")

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The currencies could not be loaded, so only USD can be chosen",
    )
  })
})

describe("<StatementImport /> new brokerage account", () => {
  async function chooseCreateAccount(user: UserEvent): Promise<void> {
    await screen.findByRole("option", { name: "Charles Schwab" })
    await user.selectOptions(screen.getByLabelText("Brokerage"), "gb-ibkr")
    await user.selectOptions(
      screen.getByLabelText("Brokerage account"),
      "__NEW_ACCOUNT__",
    )
  }

  test("an account is created at the chosen firm on Record, before its portfolio", async () => {
    const user = userEvent.setup()
    renderImport()
    await chooseCreateAccount(user)

    expect(screen.getByLabelText("Account name")).toHaveValue(
      "Interactive Brokers",
    )
    await user.type(screen.getByLabelText("Account number"), "U999")
    await user.upload(screen.getByLabelText("Image"), screenshot())
    await user.click(screen.getByRole("button", { name: "Continue" }))
    await screen.findByRole("heading", { name: "Confirm what was read" })

    const [shown] = bodiesSentTo<ShownHoldings>(PREVIEW_URL)
    expect(shown.brokerId).toBeUndefined()
    expect(shown.globalBrokerId).toBe("gb-ibkr")
    expect(bodiesSentTo<unknown>("/api/brokers")).toEqual([])

    await user.click(recordButton())
    await screen.findByRole("heading", { name: "Recorded" })

    expect(bodiesSentTo<unknown>("/api/brokers")).toEqual([
      {
        name: "Interactive Brokers",
        accountNumber: "U999",
        globalBrokerId: "gb-ibkr",
      },
    ])
    expect(bodiesSentTo<unknown>("/api/portfolios")).toEqual([
      {
        data: [
          {
            code: "INTERACTIVE-BROKERS",
            name: "Interactive Brokers (U999)",
            currency: "USD",
            base: "USD",
          },
        ],
      },
    ])
    const [confirmed] = bodiesSentTo<ConfirmedHoldings>(COMMIT_URL)
    expect(confirmed.brokerId).toBe("b-new")
    expect(confirmed.portfolioId).toBe("pf-new")
    expect(
      screen.getByRole("link", { name: /holdings at this brokerage account/i }),
    ).toHaveAttribute("href", "/brokers/b-new/holdings")
  })

  test("a cleared account name stays cleared and holds Continue back", async () => {
    const user = userEvent.setup()
    renderImport()
    await chooseCreateAccount(user)
    await user.upload(screen.getByLabelText("Image"), screenshot())

    await user.clear(screen.getByLabelText("Account name"))

    expect(screen.getByLabelText("Account name")).toHaveValue("")
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled()
  })

  test("a firm with no accounts yet offers to create one", async () => {
    backend.brokers = [schwab]
    const user = userEvent.setup()
    renderImport()
    await screen.findByRole("option", { name: "Charles Schwab" })
    await user.selectOptions(screen.getByLabelText("Brokerage"), "gb-ibkr")

    expect(screen.getByLabelText("Brokerage account")).toHaveValue(
      "__NEW_ACCOUNT__",
    )
  })

  test("an account that cannot be created records nothing and says why", async () => {
    backend.createdAccount = json(
      { message: "Broker with name 'Interactive Brokers' already exists" },
      400,
    )
    const user = userEvent.setup()
    renderImport()
    await chooseCreateAccount(user)
    await user.upload(screen.getByLabelText("Image"), screenshot())
    await user.click(screen.getByRole("button", { name: "Continue" }))
    await screen.findByRole("heading", { name: "Confirm what was read" })
    await user.click(recordButton())

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Broker with name 'Interactive Brokers' already exists",
    )
    expect(callsTo("/api/portfolios")).toBe(0)
    expect(callsTo(COMMIT_URL)).toBe(0)
  })
})

describe("<StatementImport /> confirm", () => {
  test("shows the portfolio, and choosing another checks and records there", async () => {
    backend.portfolios = [growth, income]
    const user = userEvent.setup()
    renderImport()
    await chooseAccount(user, "gb-ibkr", "b-ibkr")
    await screen.findByRole("option", { name: /Income/ })
    await user.selectOptions(screen.getByLabelText("Portfolio"), "pf-1")
    await user.upload(screen.getByLabelText("Image"), screenshot())
    await user.click(screen.getByRole("button", { name: "Continue" }))
    await screen.findByRole("heading", { name: "Confirm what was read" })

    const portfolio = screen.getByLabelText("Portfolio")
    expect(portfolio).toHaveValue("pf-1")
    await user.selectOptions(portfolio, "pf-2")

    await waitFor(() => expect(callsTo(PREVIEW_URL)).toBe(2))
    expect(bodiesSentTo<ShownHoldings>(PREVIEW_URL)[1].portfolioId).toBe("pf-2")
    await waitFor(() => expect(recordButton()).toBeEnabled())
    await user.click(recordButton())
    await screen.findByRole("heading", { name: "Recorded" })
    expect(bodiesSentTo<ConfirmedHoldings>(COMMIT_URL)[0].portfolioId).toBe(
      "pf-2",
    )
  })

  test("a share class printed with a slash reads with the dot Beancounter uses", async () => {
    backend.read = json({
      ...holdingsProposal,
      rows: [{ code: "BRK/B", quantity: 2 }],
    })
    const user = userEvent.setup()
    await readHoldings(user)

    expect(screen.getByLabelText("Code for BRK.B")).toHaveValue("BRK.B")
    expect(bodiesSentTo<ShownHoldings>(PREVIEW_URL)[0].rows[0].code).toBe(
      "BRK.B",
    )
  })

  test("a share class typed with a slash is checked with the dot too", async () => {
    const user = userEvent.setup()
    await readHoldings(user)

    const code = screen.getByLabelText("Code for TSLA")
    await user.clear(code)
    await user.type(code, "BRK/B")
    await user.click(screen.getByRole("button", { name: "Recheck" }))

    await waitFor(() => expect(callsTo(PREVIEW_URL)).toBe(2))
    expect(
      bodiesSentTo<ShownHoldings>(PREVIEW_URL)[1].rows.map((row) => row.code),
    ).toContain("BRK.B")
  })

  test("rows that will be recorded come first, then rows with an issue, then rows that match", async () => {
    const user = userEvent.setup()
    await readHoldings(user)

    expect(
      screen
        .getAllByLabelText(/^Code for /)
        .map((input) => input.getAttribute("aria-label")),
    ).toEqual([
      "Code for AAPL",
      "Code for TSLA",
      "Code for MSFT",
      "Code for Mystery Fund",
      "Code for VOO",
    ])
  })

  test("issues sit folded between the portfolio and the holdings", async () => {
    const user = userEvent.setup()
    await readHoldings(user)

    const issues = screen.getByText(/^Needs a look/).closest("details")
    expect(issues).not.toBeNull()
    expect(issues).not.toHaveAttribute("open")
    expect(
      within(issues as HTMLElement).getByRole("region", {
        name: "Will not be recorded",
      }),
    ).toBeInTheDocument()
    const table = screen.getByRole("table")
    expect(
      (issues as HTMLElement).compareDocumentPosition(table) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })

  test("a market taken from what the account holds is filled in without a note", async () => {
    const user = userEvent.setup()
    await readHoldings(user)

    expect(screen.getByLabelText("Market for VOO")).toHaveValue("US")
    expect(
      within(rowFor("VOO")).queryByText("From what this account holds"),
    ).not.toBeInTheDocument()
  })

  test("a code listed on several markets names them for the user to choose", async () => {
    backend.read = json({
      ...holdingsProposal,
      rows: [{ code: "DUAL", quantity: 4 }],
    })
    const user = userEvent.setup()
    await readHoldings(user)

    expect(
      within(rowFor("DUAL")).getByText(
        "Listed on ASX and US. Choose the market.",
      ),
    ).toBeInTheDocument()
    expect(screen.getByLabelText("Market for DUAL")).toHaveValue("")
  })

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
      within(rowFor("AAPL")).getByText("Not checked yet. Press Recheck."),
    ).toBeInTheDocument()
    expect(
      screen.queryByText(/Changed since the last check/),
    ).not.toBeInTheDocument()
  })

  test("one row can be rechecked on its own, leaving the others as they were", async () => {
    const user = userEvent.setup()
    await readHoldings(user)

    const quantity = screen.getByLabelText("Quantity for AAPL")
    await user.clear(quantity)
    await user.type(quantity, "25")
    await user.click(screen.getByRole("button", { name: "Recheck AAPL" }))

    expect(await within(rowFor("AAPL")).findByText("+25")).toBeInTheDocument()
    const [, single] = bodiesSentTo<ShownHoldings>(PREVIEW_URL)
    expect(single.rows.map((row) => row.code)).toEqual(["AAPL"])
    expect(within(rowFor("TSLA")).getByText("-3")).toHaveClass("text-red-700")
    expect(
      screen.getByRole("region", {
        name: "Held at this account but not on the screenshot",
      }),
    ).toHaveTextContent("NVDA")
    expect(recordButton()).toBeEnabled()
  })

  test("what was read and where it is recorded fold away, open when the totals do not add up", async () => {
    const user = userEvent.setup()
    await readHoldings(user)
    const folded = screen
      .getByText(/IBKR Main \(U1234482\) · Growth \(GROWTH\)/)
      .closest("details")
    expect(folded).toHaveAttribute("open")
  })

  test("what was read folds away when the totals add up", async () => {
    backend.read = json({ ...holdingsProposal, totalShown: undefined })
    const user = userEvent.setup()
    await readHoldings(user)
    const folded = screen
      .getByText(/IBKR Main \(U1234482\) · Growth \(GROWTH\)/)
      .closest("details")
    expect(folded).not.toHaveAttribute("open")
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
    expect(within(rowFor("AAPL")).queryByText("+10")).not.toBeInTheDocument()
    // Typing asked the server nothing.
    expect(callsTo(PREVIEW_URL)).toBe(1)

    await user.click(screen.getByRole("button", { name: "Recheck" }))

    expect(await within(rowFor("AAPL")).findByText("+25")).toBeInTheDocument()
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
    await user.click(screen.getByRole("button", { name: "Recheck" }))

    expect(
      await within(rowFor("MSFT")).findByText("Ready to record"),
    ).toBeInTheDocument()
    expect(bodiesSentTo<ShownHoldings>(PREVIEW_URL)[1].rows[1]).toMatchObject({
      code: "MSFT",
      costBasis: 1750,
    })
    expect(recordButton()).toHaveTextContent("Record 3 changes")
  })

  test("an unresolved asset can be found with the asset search, and its row is checked again", async () => {
    backend.read = json({
      ...holdingsProposal,
      rows: [{ code: "ZZZ", quantity: 4 }],
    })
    const user = userEvent.setup()
    await readHoldings(user)

    await user.click(screen.getByRole("button", { name: "Search for ZZZ" }))
    expect(
      await screen.findByRole("heading", { name: "Find ZZZ" }),
    ).toBeInTheDocument()
    const combo = screen.getAllByRole("combobox").at(-1)!
    await user.type(combo, "zed")
    await user.click(await screen.findByText(/ZZZB - Zed Corp/))

    await waitFor(() =>
      expect(
        screen.queryByRole("heading", { name: "Find ZZZ" }),
      ).not.toBeInTheDocument(),
    )
    expect(screen.getByLabelText("Code for ZZZB")).toHaveValue("ZZZB")
    await waitFor(() => expect(callsTo(PREVIEW_URL)).toBe(2))
    expect(bodiesSentTo<ShownHoldings>(PREVIEW_URL)[1].rows).toEqual([
      { code: "ZZZB", market: "NYSE", quantity: 4 },
    ])
    expect(
      await within(rowFor("ZZZB")).findByText("Enter the cost"),
    ).toBeInTheDocument()
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

    await user.click(screen.getByRole("button", { name: "Recheck" }))
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
  test("a listing new to Beancounter is recorded by its market and code", async () => {
    backend.read = json({
      ...holdingsProposal,
      rows: [{ code: "NOK", quantity: 110, costBasis: 336 }],
    })
    const user = userEvent.setup()
    await readHoldings(user)

    await user.click(recordButton())
    await screen.findByRole("heading", { name: "Recorded" })

    expect(bodiesSentTo<ConfirmedHoldings>(COMMIT_URL)[0].rows).toEqual([
      { market: "US", code: "NOK", trnType: "ADD", quantity: 110, cost: 336 },
    ])
  })

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

  test("recording values the portfolio, so its market value is current", async () => {
    const user = userEvent.setup()
    await readHoldings(user)

    await user.click(recordButton())
    await screen.findByRole("heading", { name: "Recorded" })

    await waitFor(() =>
      expect(callsTo("/api/holdings/id/pf-1?asAt=today")).toBe(1),
    )
  })

  test("a row's held-since date dates its add; other adds and reductions take the record date", async () => {
    backend.read = json({
      ...holdingsProposal,
      rows: [
        { code: "AAPL", quantity: 10, costBasis: 1200 },
        { code: "NFLX", quantity: 4, costBasis: 400 },
        { code: "TSLA", quantity: 5 },
      ],
    })
    const user = userEvent.setup()
    await readHoldings(user)

    expect(screen.queryByLabelText("Held since")).not.toBeInTheDocument()
    await user.type(screen.getByLabelText("Held since for AAPL"), "2016-02-03")
    await user.click(recordButton())
    await screen.findByRole("heading", { name: "Recorded" })

    const [confirmed] = bodiesSentTo<ConfirmedHoldings>(COMMIT_URL)
    const byAsset = Object.fromEntries(
      confirmed.rows.map((row) => [row.assetId, row.tradeDate]),
    )
    expect(byAsset["a-AAPL"]).toBe("2016-02-03")
    expect(byAsset["a-NFLX"]).toBeUndefined()
    expect(byAsset["a-TSLA"]).toBeUndefined()
    expect(confirmed.tradeDate).toBe(todayIso())
  })

  test("Suggest dates fills empty held-since dates from each holding's cost", async () => {
    const user = userEvent.setup()
    await readHoldings(user)
    expect(callsTo(HELD_SINCE_URL)).toBe(0)

    await user.click(screen.getByRole("button", { name: "Suggest dates" }))

    await waitFor(() =>
      expect(screen.getByLabelText("Held since for AAPL")).toHaveValue(
        "2017-06-30",
      ),
    )
    expect(
      within(rowFor("AAPL")).getByText("Guessed from the cost"),
    ).toBeInTheDocument()
    expect(bodiesSentTo<unknown>(HELD_SINCE_URL)).toEqual([
      { rows: [{ assetId: "a-AAPL", costPerShare: 120 }] },
    ])
    await user.click(recordButton())
    await screen.findByRole("heading", { name: "Recorded" })
    const aapl = bodiesSentTo<ConfirmedHoldings>(COMMIT_URL)[0].rows.find(
      (row) => row.assetId === "a-AAPL",
    )
    expect(aapl?.tradeDate).toBe("2017-06-30")
  })

  test("Suggest dates says it is working, then what it found", async () => {
    let answer: (init: MockResponseInit) => void = () => undefined
    fetchMock.mockResponse((req) =>
      req.url.includes(HELD_SINCE_URL)
        ? new Promise((resolve) => {
            answer = resolve
          })
        : respond(req),
    )
    const user = userEvent.setup()
    await readHoldings(user)

    await user.click(screen.getByRole("button", { name: "Suggest dates" }))

    expect(
      await screen.findByRole("heading", { name: "Suggesting dates" }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        /Asking the stock market nicely for your price history\. It likes to play hard to get/,
      ),
    ).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument()
    answer(backend.heldSince)
    expect(
      await screen.findByText("Suggested a date for 1 holding."),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("heading", { name: "Suggesting dates" }),
    ).not.toBeInTheDocument()
  })

  test("cancelling Suggest dates leaves the dates as they were", async () => {
    let answer: (init: MockResponseInit) => void = () => undefined
    fetchMock.mockResponse((req) =>
      req.url.includes(HELD_SINCE_URL)
        ? new Promise((resolve) => {
            answer = resolve
          })
        : respond(req),
    )
    const user = userEvent.setup()
    await readHoldings(user)
    await user.click(screen.getByRole("button", { name: "Suggest dates" }))
    await screen.findByRole("heading", { name: "Suggesting dates" })

    await user.click(screen.getByRole("button", { name: "Cancel" }))
    answer(backend.heldSince)

    await waitFor(() =>
      expect(
        screen.queryByRole("heading", { name: "Suggesting dates" }),
      ).not.toBeInTheDocument(),
    )
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Suggest dates" }),
      ).toBeEnabled(),
    )
    expect(screen.getByLabelText("Held since for AAPL")).toHaveValue("")
    expect(
      screen.queryByText("Suggested a date for 1 holding."),
    ).not.toBeInTheDocument()
  })

  test("Suggest dates names a holding new to Beancounter, which has no price history yet", async () => {
    backend.read = json({
      ...holdingsProposal,
      rows: [
        ...holdingsProposal.rows,
        { code: "NOK", quantity: 100, costBasis: 400 },
      ],
    })
    const user = userEvent.setup()
    await readHoldings(user)

    await user.click(screen.getByRole("button", { name: "Suggest dates" }))

    expect(
      await screen.findByText(
        "Suggested a date for 1 holding. No price history yet for NOK: enter its date.",
      ),
    ).toBeInTheDocument()
  })

  test("Suggest dates says so when there is nothing to suggest", async () => {
    backend.heldSince = json({
      data: [{ assetId: "a-AAPL", heldSince: null, before: null }],
    })
    const user = userEvent.setup()
    await readHoldings(user)

    await user.click(screen.getByRole("button", { name: "Suggest dates" }))

    expect(
      await screen.findByText("No date could be suggested for AAPL."),
    ).toBeInTheDocument()
    await user.type(screen.getByLabelText("Held since for AAPL"), "2016-02-03")
    await user.click(screen.getByRole("button", { name: "Suggest dates" }))
    expect(
      await screen.findByText(
        "Every holding being added already has a date. 1 holding already matches what is held, so takes no date.",
      ),
    ).toBeInTheDocument()
  })

  test("a date read from the image is used, and Suggest dates leaves it alone", async () => {
    backend.read = json({
      ...holdingsProposal,
      rows: holdingsProposal.rows.map((row) =>
        row.code === "AAPL" ? { ...row, tradeDate: "2015-03-02" } : row,
      ),
    })
    const user = userEvent.setup()
    await readHoldings(user)

    expect(screen.getByLabelText("Held since for AAPL")).toHaveValue(
      "2015-03-02",
    )
    expect(
      within(rowFor("AAPL")).getByText("Read from the image"),
    ).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Suggest dates" }))
    expect(callsTo(HELD_SINCE_URL)).toBe(0)
    expect(screen.getByLabelText("Held since for AAPL")).toHaveValue(
      "2015-03-02",
    )
  })

  test("a cost below every known price suggests the earliest price's date", async () => {
    backend.heldSince = json({
      data: [{ assetId: "a-AAPL", heldSince: null, before: "2016-11-18" }],
    })
    const user = userEvent.setup()
    await readHoldings(user)

    await user.click(screen.getByRole("button", { name: "Suggest dates" }))

    await waitFor(() =>
      expect(screen.getByLabelText("Held since for AAPL")).toHaveValue(
        "2016-11-18",
      ),
    )
    expect(
      within(rowFor("AAPL")).getByText(
        "Guessed: bought before the earliest price",
      ),
    ).toBeInTheDocument()
  })

  test("dates suggested for a discarded upload do not fill the next one", async () => {
    let answer: (init: MockResponseInit) => void = () => undefined
    fetchMock.mockResponse((req) =>
      req.url.includes(HELD_SINCE_URL)
        ? new Promise((resolve) => {
            answer = resolve
          })
        : respond(req),
    )
    const user = userEvent.setup()
    await readHoldings(user)
    await user.click(screen.getByRole("button", { name: "Suggest dates" }))
    await waitFor(() => expect(callsTo(HELD_SINCE_URL)).toBe(1))

    await user.click(
      screen.getByRole("button", { name: "Discard and start again" }),
    )
    await upload(user)
    await screen.findByRole("heading", { name: "Confirm what was read" })
    answer(backend.heldSince)

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Suggest dates" }),
      ).toBeEnabled(),
    )
    expect(screen.getByLabelText("Held since for AAPL")).toHaveValue("")
  })

  test("the trade date chosen is the one sent", async () => {
    const user = userEvent.setup()
    await readHoldings(user)

    const tradeDate = screen.getByLabelText("Record date")
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
    await user.click(screen.getByRole("button", { name: "Recheck" }))
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
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled()
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

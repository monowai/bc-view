import React from "react"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { SWRConfig } from "swr"
import { enableFetchMocks } from "jest-fetch-mock"

enableFetchMocks()

jest.mock("../../../src/contexts/UserPreferencesContext", () => ({
  useUserPreferences: () => ({
    preferences: {
      baseCurrencyCode: "USD",
      reportingCurrencyCode: "USD",
      preferredName: "Test User",
    },
    isLoading: false,
    error: null,
  }),
  UserPreferencesProvider: ({ children }: { children: React.ReactNode }) =>
    children,
}))

jest.mock("next/router", () => ({
  useRouter: () => ({ push: jest.fn(), query: {} }),
}))

interface Backend {
  settings?: Record<string, unknown>
  scenarios?: Array<Record<string, unknown>>
  phasesOk?: boolean
  phasesBody?: string
  /** A refusal for the settings PATCH — `{status, body}`. */
  settingsWriteFails?: { status: number; body: string }
  /** A refusal for the work-scenario write. */
  workWriteFails?: { status: number; body: string }
}

/** Answers every call the setup wizard makes, tuned per test. */
const mockBackend = ({
  settings = {},
  scenarios = [],
  phasesOk = true,
  phasesBody,
  settingsWriteFails,
  workWriteFails,
}: Backend = {}): void => {
  fetchMock.mockResponse((req) => {
    const url = req.url
    if (url.endsWith("/phases")) {
      return Promise.resolve({
        status: phasesOk ? 200 : 400,
        body: phasesBody ?? JSON.stringify({ data: {} }),
      })
    }
    if (url.includes("/api/independence/settings")) {
      if (settingsWriteFails && req.method === "PATCH") {
        return Promise.resolve(settingsWriteFails)
      }
      return Promise.resolve(JSON.stringify(settings))
    }
    if (url.includes("/api/independence/work-scenarios")) {
      if (workWriteFails && req.method !== "GET") {
        return Promise.resolve(workWriteFails)
      }
      return Promise.resolve(JSON.stringify({ data: scenarios }))
    }
    if (url.endsWith("/api/independence/plans") && req.method === "POST") {
      return Promise.resolve(JSON.stringify({ data: { id: "stage-1" } }))
    }
    if (url.includes("/lifestyle-catalog")) {
      return Promise.resolve(JSON.stringify({ categories: [] }))
    }
    // The payoff step's projection + the expense rows it describes.
    if (url.includes("/api/independence/projection/")) {
      return Promise.resolve(
        JSON.stringify({ data: { sustainableMonthlyExpense: 3200 } }),
      )
    }
    if (url.includes("/expenses") && req.method === "GET") {
      return Promise.resolve(
        JSON.stringify({
          data: [
            {
              id: "e1",
              categoryLabelId: "custom-other",
              categoryName: "Other",
              monthlyAmount: 3000,
              currency: "USD",
            },
          ],
        }),
      )
    }
    return Promise.resolve(JSON.stringify({ data: [] }))
  })
}

const renderSetup = async (): Promise<void> => {
  const { default: Setup } =
    await import("../../../src/pages/independence/setup")
  render(
    // A fresh SWR cache per test — otherwise settings fetched by one test
    // prefill the next one's form.
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <Setup />
    </SWRConfig>,
  )
}

const clickButton = (name: RegExp): void => {
  fireEvent.click(screen.getByRole("button", { name }))
}

/** Steps 1 → 2 → 3, leaving the Create button on screen. */
const walkToTarget = async (): Promise<void> => {
  clickButton(/continue/i)
  await screen.findByRole("spinbutton", { name: /monthly income/i })
  clickButton(/continue/i)
  await screen.findByRole("spinbutton", { name: /target independence age/i })
}

const callsTo = (fragment: string): Array<[string, RequestInit]> =>
  fetchMock.mock.calls.filter(([url]) =>
    String(url).includes(fragment),
  ) as unknown as Array<[string, RequestInit]>

describe("/independence/setup — guided plan wizard", () => {
  beforeEach(() => {
    fetchMock.resetMocks()
    mockBackend()
  })

  test("walks Spending → Work → Target with a step rail", async () => {
    await renderSetup()

    expect(
      screen.getByText(/create your independence plan/i),
    ).toBeInTheDocument()
    for (const label of ["Spending", "Work", "Target", "Done"]) {
      expect(screen.getByText(label)).toBeInTheDocument()
    }

    expect(
      screen.getByRole("spinbutton", { name: /monthly retirement expenses/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("spinbutton", { name: /monthly medical expenses/i }),
    ).toBeInTheDocument()

    clickButton(/continue/i)
    expect(
      await screen.findByRole("spinbutton", { name: /monthly income/i }),
    ).toBeInTheDocument()

    clickButton(/continue/i)
    expect(
      await screen.findByRole("spinbutton", {
        name: /target independence age/i,
      }),
    ).toBeInTheDocument()
    expect(screen.getByRole("textbox", { name: /plan name/i })).toHaveValue(
      "My Independence Plan",
    )
  })

  test("never asks for a date of birth", async () => {
    await renderSetup()
    await walkToTarget()

    expect(
      screen.queryByRole("spinbutton", { name: /year of birth/i }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("combobox", { name: /month of birth/i }),
    ).not.toBeInTheDocument()
    // No control of any kind collects it here.
    expect(screen.queryByLabelText(/date of birth/i)).not.toBeInTheDocument()
    // It is read from the profile, and says so — without blocking.
    expect(
      screen.getByText(/we read your date of birth from your profile/i),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("link", { name: /add it under about you/i }),
    ).toHaveAttribute("href", "/independence?view=profile")
  })

  test("prefills the target age from settings and drops the DOB note", async () => {
    mockBackend({ settings: { targetIndependenceAge: 55, yearOfBirth: 1980 } })
    await renderSetup()
    await waitFor(() =>
      expect(callsTo("/api/independence/settings").length).toBeGreaterThan(0),
    )
    await walkToTarget()

    await waitFor(() =>
      expect(
        screen.getByRole("spinbutton", { name: /target independence age/i }),
      ).toHaveValue(55),
    )
    expect(
      screen.queryByText(/we read your date of birth from your profile/i),
    ).not.toBeInTheDocument()
  })

  test("prefills the work step from the current scenario and PATCHes it", async () => {
    mockBackend({
      scenarios: [
        {
          id: "ws-1",
          isCurrent: true,
          workingIncomeMonthly: 8000,
          workingExpensesMonthly: 4000,
          taxesMonthly: 1500,
          bonusMonthly: 500,
          investmentAllocationPercent: 0.6,
        },
      ],
    })
    await renderSetup()

    clickButton(/continue/i)
    await waitFor(() =>
      expect(
        screen.getByRole("spinbutton", { name: /monthly income/i }),
      ).toHaveValue(8000),
    )
    expect(
      screen.getByRole("slider", { name: /investment allocation percent/i }),
    ).toHaveValue("60")

    clickButton(/continue/i)
    await screen.findByRole("spinbutton", { name: /target independence age/i })
    clickButton(/create my plan/i)

    await waitFor(() => expect(callsTo("/work-scenarios/ws-1")).toHaveLength(1))
    const [, init] = callsTo("/work-scenarios/ws-1")[0]
    expect(init.method).toBe("PATCH")
    expect(JSON.parse(String(init.body))).toMatchObject({
      workingIncomeMonthly: 8000,
      investmentAllocationPercent: 0.6,
    })
  })

  test("records no work scenario when the user is not working", async () => {
    await renderSetup()

    clickButton(/continue/i)
    await screen.findByRole("spinbutton", { name: /monthly income/i })
    clickButton(/i'm not working/i)
    await screen.findByText(/no working situation will be recorded/i)

    clickButton(/continue/i)
    await screen.findByRole("spinbutton", { name: /target independence age/i })
    clickButton(/create my plan/i)

    await waitFor(() => expect(callsTo("/phases")).toHaveLength(1))
    const writes = callsTo("/api/independence/work-scenarios").filter(
      ([, init]) => init?.method === "POST" || init?.method === "PATCH",
    )
    expect(writes).toHaveLength(0)
  })

  test("creates the plan in order, phases it with force:false, and shows the payoff", async () => {
    await renderSetup()

    fireEvent.change(
      screen.getByRole("spinbutton", { name: /monthly retirement expenses/i }),
      { target: { value: "3000" } },
    )
    await walkToTarget()
    fireEvent.change(
      screen.getByRole("spinbutton", { name: /target independence age/i }),
      { target: { value: "60" } },
    )
    clickButton(/create my plan/i)

    await waitFor(() => expect(callsTo("/phases")).toHaveLength(1))

    // Settings before the plan, plan before phasing — a stage created before
    // its target age is stored cannot be phased.
    const order = fetchMock.mock.calls
      .map(([url, init]) => `${(init as RequestInit)?.method ?? "GET"} ${url}`)
      // Reads only; the projection POST belongs to the payoff step that
      // follows, not to the create sequence.
      .filter(
        (call) => !call.startsWith("GET") && !call.includes("/projection/"),
      )
    expect(order).toEqual([
      "PATCH /api/independence/settings",
      "POST /api/independence/work-scenarios",
      "POST /api/independence/plans",
      "POST /api/independence/plans/stage-1/expenses",
      "POST /api/independence/plans/stage-1/phases",
    ])

    const [, phases] = callsTo("/phases")[0]
    expect(JSON.parse(String(phases.body))).toEqual({ force: false })
    expect(
      JSON.parse(String(callsTo("/api/independence/settings")[1][1].body)),
    ).toEqual({ targetIndependenceAge: 60 })

    expect(await screen.findByText(/your plan is ready/i)).toBeInTheDocument()
    expect(
      screen.getByText(/Created: My Independence Plan/),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("link", { name: /see your plan/i }),
    ).toHaveAttribute("href", "/independence")
    // The payoff is the lifestyle board, the same one onboarding ends on.
    await waitFor(() => expect(screen.getByRole("region")).toBeInTheDocument())
  })

  test("blocks Continue on an empty target age, and lets 60 through", async () => {
    // Number("") is 0, which sails past the input's `min` (browsers do not
    // validate a value React put there) and became a 90-year horizon.
    await renderSetup()
    await walkToTarget()

    fireEvent.change(
      screen.getByRole("spinbutton", { name: /target independence age/i }),
      { target: { value: "" } },
    )
    clickButton(/create my plan/i)

    expect(
      await screen.findByText(/enter a target age between 18 and 100/i),
    ).toBeInTheDocument()
    expect(callsTo("/api/independence/plans")).toHaveLength(0)

    fireEvent.change(
      screen.getByRole("spinbutton", { name: /target independence age/i }),
      { target: { value: "60" } },
    )
    clickButton(/create my plan/i)

    await waitFor(() => expect(callsTo("/phases")).toHaveLength(1))
    expect(
      screen.queryByText(/enter a target age between 18 and 100/i),
    ).not.toBeInTheDocument()
  })

  test("refuses an out-of-range target age", async () => {
    await renderSetup()
    await walkToTarget()

    fireEvent.change(
      screen.getByRole("spinbutton", { name: /target independence age/i }),
      { target: { value: "7" } },
    )
    clickButton(/create my plan/i)

    expect(
      await screen.findByText(/enter a target age between 18 and 100/i),
    ).toBeInTheDocument()
    expect(callsTo("/api/independence/plans")).toHaveLength(0)
  })

  test("stops before the plan POST when the settings PATCH is refused", async () => {
    mockBackend({
      settingsWriteFails: {
        status: 400,
        body: JSON.stringify({ message: "Target age must be under 100" }),
      },
    })
    await renderSetup()
    await walkToTarget()
    clickButton(/create my plan/i)

    expect(
      await screen.findByText(/target age must be under 100/i),
    ).toBeInTheDocument()
    const planWrites = callsTo("/api/independence/plans").filter(
      ([, init]) => init?.method === "POST",
    )
    expect(planWrites).toHaveLength(0)
  })

  test("stops on the Work step when the work-scenario write is refused", async () => {
    mockBackend({
      workWriteFails: {
        status: 409,
        body: JSON.stringify({ message: "A current scenario already exists" }),
      },
    })
    await renderSetup()
    await walkToTarget()
    clickButton(/create my plan/i)

    expect(
      await screen.findByText(/a current scenario already exists/i),
    ).toBeInTheDocument()
    // Back where the refused figures are, not stranded on Target.
    expect(
      screen.getByRole("spinbutton", { name: /monthly income/i }),
    ).toBeInTheDocument()
    const planWrites = callsTo("/api/independence/plans").filter(
      ([, init]) => init?.method === "POST",
    )
    expect(planWrites).toHaveLength(0)
  })

  test("quotes the backend when the plan POST itself is refused", async () => {
    fetchMock.mockResponse((req) => {
      if (
        req.url.endsWith("/api/independence/plans") &&
        req.method === "POST"
      ) {
        return Promise.resolve({
          status: 400,
          body: JSON.stringify({ message: "Expenses currency is required" }),
        })
      }
      return Promise.resolve(JSON.stringify({ data: [] }))
    })
    await renderSetup()
    await walkToTarget()
    clickButton(/create my plan/i)

    expect(
      await screen.findByText(/expenses currency is required/i),
    ).toBeInTheDocument()
    expect(callsTo("/phases")).toHaveLength(0)
  })

  test("quotes the backend inline when phasing fails, and still offers the plan", async () => {
    mockBackend({
      phasesOk: false,
      phasesBody: JSON.stringify({
        message:
          "Set a target independence age or year of birth before generating phases",
      }),
    })
    await renderSetup()
    await walkToTarget()
    clickButton(/create my plan/i)

    expect(
      await screen.findByText(
        /your stage is saved, but it could not be phased/i,
      ),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        /Set a target independence age or year of birth before generating phases/,
      ),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("link", { name: /see your plan/i }),
    ).toHaveAttribute("href", "/independence")
  })
})

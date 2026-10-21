import React, { useEffect } from "react"
import { render, screen } from "@testing-library/react"
import "@testing-library/jest-dom"
import { MilestonesProvider, useMilestones } from "../MilestonesContext"
import { LOCAL_MIDNIGHT_EDGES, pinDate } from "@test-fixtures/clock"

jest.mock("@auth0/nextjs-auth0/client", () => ({
  useUser: () => ({ user: undefined, isLoading: false }),
}))
jest.mock("../RegistrationContext", () => ({
  useRegistration: () => ({ isRegistered: false, isChecking: false }),
}))

// Earns a milestone, then evaluates again so the earned date shows.
function Probe(): React.ReactElement {
  const { evaluate, milestones } = useMilestones()
  useEffect(() => {
    evaluate({ portfolioCount: 1 })
  }, [evaluate])
  useEffect(() => {
    if (milestones.length > 0) evaluate({ portfolioCount: 1 })
    // Re-run once the first evaluation has landed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [milestones.length])
  const earned = milestones.find((m) => m.definition.id === "portfolio-builder")
  return <div data-testid="earned-at">{earned?.earnedAt ?? ""}</div>
}

describe("MilestonesProvider earned date", () => {
  beforeEach(() => {
    global.fetch = jest
      .fn()
      .mockResolvedValue({ ok: true, json: () => Promise.resolve({}) }) as never
  })
  afterEach(() => jest.useRealTimers())

  it.each(LOCAL_MIDNIGHT_EDGES)(
    "stamps a newly earned milestone with the local today at %i:%i",
    async (hour, minute) => {
      pinDate(new Date(2026, 9, 21, hour, minute))
      render(
        <MilestonesProvider>
          <Probe />
        </MilestonesProvider>,
      )

      expect(await screen.findByText("2026-10-21")).toBeInTheDocument()
    },
  )
})

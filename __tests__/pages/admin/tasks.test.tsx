import React from "react"
import { render, screen } from "@testing-library/react"
import "@testing-library/jest-dom"
import ScheduledTasksPage from "@pages/admin/tasks"
import { LOCAL_MIDNIGHT_EDGES, pinDate } from "@test-fixtures/clock"

jest.mock("@hooks/usePermissions", () => ({
  usePermissions: () => ({ admin: true, isLoading: false }),
}))

const Page = ScheduledTasksPage as React.ComponentType

describe("admin scheduled tasks default date range", () => {
  afterEach(() => jest.useRealTimers())

  it.each(LOCAL_MIDNIGHT_EDGES)(
    "spans the 30 local days up to today at %i:%i",
    (hour, minute) => {
      pinDate(new Date(2026, 9, 21, hour, minute))
      render(<Page />)

      const from = screen.getAllByLabelText("From:") as HTMLInputElement[]
      const to = screen.getAllByLabelText("To:") as HTMLInputElement[]
      expect(from[0].value).toBe("2026-09-21")
      expect(to[0].value).toBe("2026-10-21")
    },
  )
})

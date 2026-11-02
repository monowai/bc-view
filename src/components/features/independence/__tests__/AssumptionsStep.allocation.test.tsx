import React from "react"
import { act, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import "@testing-library/jest-dom"
import { useForm } from "react-hook-form"
import AssumptionsStep from "../steps/AssumptionsStep"
import { WizardFormData } from "types/independence"
import { defaultWizardValues } from "@lib/independence/schema"
import { usePrivateAssetConfigs } from "@utils/assets/usePrivateAssetConfigs"

jest.mock("@utils/assets/usePrivateAssetConfigs", () => ({
  usePrivateAssetConfigs: jest.fn(),
}))

const setValue = jest.fn()

function Harness({
  portfolioIds,
  defaults,
}: {
  portfolioIds: string[]
  defaults: Partial<WizardFormData>
}): React.ReactElement {
  const { control, formState } = useForm<WizardFormData>({
    defaultValues: { ...defaultWizardValues, ...defaults },
  })
  return (
    <AssumptionsStep
      control={control}
      errors={formState.errors}
      setValue={setValue}
      portfolioIds={portfolioIds}
    />
  )
}

const noAllocation = {
  cashAllocation: 0,
  equityAllocation: 0,
  housingAllocation: 0,
}
const savedAllocation = {
  cashAllocation: 10,
  equityAllocation: 80,
  housingAllocation: 10,
}

function mockAllocation(body: unknown): jest.Mock {
  const fetchMock = jest.fn().mockResolvedValue({
    json: () => Promise.resolve(body),
  })
  global.fetch = fetchMock
  return fetchMock
}

const held = {
  data: { cashAllocation: 20, equityAllocation: 50, housingAllocation: 30 },
}

describe("AssumptionsStep — allocation from holdings", () => {
  beforeEach(() => {
    setValue.mockClear()
    ;(usePrivateAssetConfigs as jest.Mock).mockReturnValue({
      configs: [],
      assetNames: {},
      isLoading: false,
    })
  })

  it("seeds an unset allocation from holdings once", async () => {
    const fetchMock = mockAllocation(held)
    const { rerender } = render(
      <Harness portfolioIds={["p1", "p2"]} defaults={noAllocation} />,
    )

    await waitFor(() => expect(setValue).toHaveBeenCalledTimes(3))
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(String(fetchMock.mock.calls[0][0])).toContain("ids=p1%2Cp2")
    expect(setValue).toHaveBeenCalledWith("cashAllocation", 20)
    expect(setValue).toHaveBeenCalledWith("equityAllocation", 50)
    expect(setValue).toHaveBeenCalledWith("housingAllocation", 30)

    // A new portfolio selection must not re-seed once one has applied.
    rerender(<Harness portfolioIds={["p3"]} defaults={noAllocation} />)
    await act(async () => {})
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("keeps trying to seed while holdings come back empty", async () => {
    const fetchMock = mockAllocation({
      data: { cashAllocation: 0, equityAllocation: 0, housingAllocation: 0 },
    })
    const { rerender } = render(
      <Harness portfolioIds={["p1"]} defaults={noAllocation} />,
    )
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    await act(async () => {})

    rerender(<Harness portfolioIds={["p2"]} defaults={noAllocation} />)
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    await act(async () => {})
    expect(setValue).not.toHaveBeenCalled()
  })

  it("does not seed over a saved allocation or without portfolios", async () => {
    const fetchMock = mockAllocation(held)
    render(<Harness portfolioIds={["p1"]} defaults={savedAllocation} />)
    render(<Harness portfolioIds={[]} defaults={noAllocation} />)
    await act(async () => {})
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("re-reads holdings each time Use Actual is pressed", async () => {
    const fetchMock = mockAllocation(held)
    render(<Harness portfolioIds={["p1"]} defaults={savedAllocation} />)
    await userEvent.click(
      screen.getByRole("button", { name: /asset allocation/i }),
    )

    const useActual = screen.getByRole("button", { name: /use actual/i })
    await userEvent.click(useActual)
    await waitFor(() => expect(setValue).toHaveBeenCalledTimes(3))
    expect(setValue).toHaveBeenCalledWith("equityAllocation", 50)

    await userEvent.click(
      await screen.findByRole("button", { name: /use actual/i }),
    )
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(setValue).toHaveBeenCalledTimes(6))
  })

  it("clears the loading state after a failed read", async () => {
    const error = jest.spyOn(console, "error").mockImplementation(() => {})
    global.fetch = jest.fn().mockRejectedValue(new Error("boom"))
    render(<Harness portfolioIds={["p1"]} defaults={savedAllocation} />)
    await userEvent.click(
      screen.getByRole("button", { name: /asset allocation/i }),
    )
    await userEvent.click(screen.getByRole("button", { name: /use actual/i }))

    expect(
      await screen.findByRole("button", { name: /use actual/i }),
    ).toBeEnabled()
    expect(setValue).not.toHaveBeenCalled()
    expect(error).toHaveBeenCalled()
    error.mockRestore()
  })
})

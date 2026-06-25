import React from "react"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import "@testing-library/jest-dom"
import SubAccountTrnEditModal from "../SubAccountTrnEditModal"
import { Transaction } from "types/beancounter"

jest.mock("swr", () => ({
  __esModule: true,
  useSWRConfig: () => ({ mutate: jest.fn() }),
}))

const makeTrn = (overrides: Partial<Transaction> = {}): Transaction =>
  ({
    id: "trn-1",
    trnType: "BALANCE",
    status: "SETTLED",
    portfolio: { id: "pf-1", code: "MAIN", name: "Main" },
    asset: {
      id: "cpf-1",
      code: "CPF",
      name: "CPF Policy",
      priceSymbol: "SGD",
      market: { code: "SG", currency: { code: "SGD" } },
    },
    tradeDate: "2026-06-01",
    quantity: 100000,
    price: 1,
    tradeCurrency: { code: "SGD" },
    tradeAmount: 100000,
    cashCurrency: "SGD",
    cashAmount: 0,
    fees: 0,
    tax: 0,
    comments: "",
    subAccounts: { OA: 60000, SA: 20000, MA: 20000 },
    ...overrides,
  }) as unknown as Transaction

const mockFetch = (): void => {
  global.fetch = jest.fn((url: RequestInfo | URL) => {
    if (String(url).includes("/api/assets/config/")) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            data: {
              subAccounts: [
                { code: "OA", displayName: "Ordinary" },
                { code: "SA", displayName: "Special" },
                { code: "MA", displayName: "Medisave" },
              ],
            },
          }),
      })
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
  }) as unknown as typeof fetch
}

describe("SubAccountTrnEditModal", () => {
  beforeEach(mockFetch)

  it("prefills the bucket inputs from the transaction sub-accounts", async () => {
    render(<SubAccountTrnEditModal trn={makeTrn()} onClose={jest.fn()} />)
    // Rows resolve from the asset config (display names) once it loads.
    const oa = (await screen.findByLabelText("Ordinary")) as HTMLInputElement
    expect(oa.value).toBe("60000")
    expect((screen.getByLabelText("Special") as HTMLInputElement).value).toBe(
      "20000",
    )
  })

  it("PATCHes the edited split with a recomputed total", async () => {
    render(<SubAccountTrnEditModal trn={makeTrn()} onClose={jest.fn()} />)
    const oa = (await screen.findByLabelText("Ordinary")) as HTMLInputElement
    fireEvent.change(oa, { target: { value: "70000" } })

    fireEvent.click(screen.getByRole("button", { name: "Save" }))

    await waitFor(() => {
      const patch = (global.fetch as jest.Mock).mock.calls.find(
        (c) =>
          String(c[0]).includes("/api/trns/trn-1") && c[1]?.method === "PATCH",
      )
      expect(patch).toBeDefined()
    })
    const patch = (global.fetch as jest.Mock).mock.calls.find(
      (c) =>
        String(c[0]).includes("/api/trns/trn-1") && c[1]?.method === "PATCH",
    )!
    const body = JSON.parse(patch[1].body)
    expect(body.subAccounts).toEqual({ OA: 70000, SA: 20000, MA: 20000 })
    // 70000 + 20000 + 20000
    expect(body.tradeAmount).toBe(110000)
    expect(body.quantity).toBe(110000)
    expect(body.trnType).toBe("BALANCE")
  })

  it.each(["BALANCE", "ADD"] as const)(
    "preserves the %s transaction type on save",
    async (trnType) => {
      render(
        <SubAccountTrnEditModal trn={makeTrn({ trnType })} onClose={jest.fn()} />,
      )
      await screen.findByLabelText("Ordinary")
      fireEvent.click(screen.getByRole("button", { name: "Save" }))

      await waitFor(() => {
        const patch = (global.fetch as jest.Mock).mock.calls.find(
          (c) =>
            String(c[0]).includes("/api/trns/trn-1") &&
            c[1]?.method === "PATCH",
        )
        expect(patch).toBeDefined()
      })
      const patch = (global.fetch as jest.Mock).mock.calls.find(
        (c) =>
          String(c[0]).includes("/api/trns/trn-1") && c[1]?.method === "PATCH",
      )!
      expect(JSON.parse(patch[1].body).trnType).toBe(trnType)
    },
  )
})

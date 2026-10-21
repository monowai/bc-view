import React from "react"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import "@testing-library/jest-dom"
import CsvImportDialog from "@components/ui/CsvImportDialog"
import { importPortfolios } from "@utils/api/client/portfolios"

const csvFile = (): File => {
  const file = new File(["Code,Name\nA,Alpha"], "import.csv", {
    type: "text/csv",
  })
  // jsdom's File has no text(); the dialog reads the file through it.
  Object.defineProperty(file, "text", {
    value: () => Promise.resolve("Code,Name\nA,Alpha"),
  })
  return file
}

const respond = (ok: boolean, body: unknown): void => {
  ;(global.fetch as jest.Mock).mockResolvedValueOnce({
    ok,
    json: () => Promise.resolve(body),
  })
}

const renderDialog = (): { onComplete: jest.Mock } => {
  const onComplete = jest.fn().mockResolvedValue(undefined)
  render(
    <CsvImportDialog
      title="Import Portfolios"
      description="Import portfolios from a CSV file."
      importCsv={importPortfolios}
      noun="portfolio"
      onClose={jest.fn()}
      onComplete={onComplete}
    />,
  )
  return { onComplete }
}

const chooseAndImport = (): void => {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement
  fireEvent.change(input, { target: { files: [csvFile()] } })
  fireEvent.click(screen.getByText("Import"))
}

describe("CsvImportDialog", () => {
  beforeEach(() => {
    global.fetch = jest.fn()
  })

  it("posts the CSV to the import URL and counts an array result", async () => {
    respond(true, { data: [{}, {}] })
    renderDialog()
    chooseAndImport()

    expect(
      await screen.findByText("Successfully imported 2 portfolio(s)"),
    ).toBeInTheDocument()
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/portfolios/import",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ csvContent: "Code,Name\nA,Alpha" }),
      }),
    )
  })

  it("counts a keyed-map result by its entries", async () => {
    respond(true, { data: { A: {}, B: {}, C: {} } })
    renderDialog()
    chooseAndImport()

    expect(
      await screen.findByText("Successfully imported 3 portfolio(s)"),
    ).toBeInTheDocument()
  })

  it("shows the server's error and stays open", async () => {
    respond(false, { error: "Bad header" })
    const { onComplete } = renderDialog()
    chooseAndImport()

    expect(await screen.findByText("Bad header")).toBeInTheDocument()
    expect(onComplete).not.toHaveBeenCalled()
  })

  it("calls onComplete from Done", async () => {
    respond(true, { data: [] })
    const { onComplete } = renderDialog()
    chooseAndImport()

    fireEvent.click(await screen.findByText("Done"))
    await waitFor(() => expect(onComplete).toHaveBeenCalled())
  })
})

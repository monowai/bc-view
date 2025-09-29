import Home from "@pages/index"
import React from "react"
import { render, screen, waitFor } from "@testing-library/react"
import { registrationSuccess } from "../../__fixtures__/fixtures"
import { enableFetchMocks } from "jest-fetch-mock"
import simpleGit from "../../../__mocks__/simple-git"

enableFetchMocks()

describe("<Home />", () => {
  test("renders for authorised user", async () => {
    const git = simpleGit()
    expect(git)
    fetchMock.mockResponseOnce(JSON.stringify(registrationSuccess))
    render(<Home />)
    // Use waitFor for elements that will appear due to async operations
    await waitFor(() => {
      expect(screen.getByText("home.welcome")).toBeInTheDocument()
    })

    expect(screen.getByText("home.portfolios")).toBeInTheDocument()
    expect(screen.getByText("user.logout")).toBeInTheDocument()
  })
})

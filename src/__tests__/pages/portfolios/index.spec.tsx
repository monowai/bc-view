import React from "react";
import { screen, render, waitForElementToBeRemoved } from "@testing-library/react";
import { mockUser, withUserProvider } from "../../fixtures";
import Portfolios from "@/pages/portfolios";
import fetchMock from "jest-fetch-mock";
import { enableFetchMocks } from "jest-fetch-mock";
enableFetchMocks();

afterEach(() => {
  jest.clearAllMocks();
  jest.restoreAllMocks();
  jest.resetModules();
});
jest.mock("react-i18next", () => ({
  useTranslation: () => ({ ready: true, t: (key: string) => key }),
}));

describe("<Portfolios />", () => {
  test("Portfolio List Renders", async () => {
    fetchMock.mockResponse(
      JSON.stringify({
        data: [
          {
            id: "someId",
            code: "TEST",
            name: "Test Portfolio",
            currency: {
              code: "EUR",
              name: "Euro",
              symbol: "€",
            },
            base: {
              code: "USD",
              name: "Dollar",
              symbol: "$",
            },
            owner: {
              id: "ownerId",
              email: "mike@bc.com",
              active: true,
              since: "2020-03-03",
            },
          },
        ],
      })
    );
    render(<Portfolios user={mockUser} />, {
      wrapper: withUserProvider({ user: mockUser }),
    });
    expect (await screen.findByTestId("loading")).toBeInTheDocument()
    await waitForElementToBeRemoved(() => screen.getByTestId("loading"));
    expect(await screen.getByText("portfolio.code")).toBeInTheDocument();
    expect(await screen.getByText("portfolio.name")).toBeInTheDocument();
    expect(await screen.getByText("Test Portfolio")).toBeInTheDocument();
    const codeLink = await screen.getByText("TEST");
    expect(codeLink.toString()).toBe("http://localhost/holdings/TEST");
    const createButton = await screen.getByText("portfolio.create")
    expect(createButton).toBeInTheDocument();
  });
});

import React from "react";
import { screen, render } from "@testing-library/react";
import { mockUser, portfolioResult, withUserProvider } from "../../fixtures";
import Portfolios from "@pages/portfolios";
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

jest.mock("next/router", () => ({
  useRouter() {
    return {
      route: "/",
      pathname: "",
      query: "",
      asPath: "",
      push: jest.fn(),
      events: {
        on: jest.fn(),
        off: jest.fn(),
      },
      beforePopState: jest.fn(() => null),
      prefetch: jest.fn(() => null),
    };
  },
}));

describe("<Portfolios />", () => {
  test("Portfolio List Renders", async () => {
    // const useRouter = jest.spyOn(require("next/router"), "useRouter");
    fetchMock.mockResponse(JSON.stringify(portfolioResult));
    render(<Portfolios user={mockUser} />, {
      wrapper: withUserProvider({ user: mockUser }),
    });
    expect(await screen.findByTestId("loading")).toBeInTheDocument();
    expect(await screen.getByText("portfolio.code")).toBeInTheDocument();
    expect(await screen.getByText("portfolio.name")).toBeInTheDocument();
    expect(await screen.getByText("Test Portfolio")).toBeInTheDocument();
    const codeLink = await screen.getByText("TEST");
    expect(codeLink.toString()).toBe("http://localhost/holdings/TEST");
    const createButton = await screen.getByText("portfolio.create");
    expect(createButton).toBeInTheDocument();
  });
});

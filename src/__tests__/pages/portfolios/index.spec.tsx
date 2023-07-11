import React from "react";
import { render, act, RenderResult } from "@testing-library/react";
import {
  mockUserProfile,
  portfolioResult,
  withUserProvider,
} from "../../fixtures";
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
    const { getByText, findByText } = await act(() => {
      return render(<Portfolios user={mockUserProfile} />, {
        wrapper: withUserProvider({ user: mockUserProfile }),
      }) as RenderResult;
    });
    expect(findByText("TEST")); // Load results ready
    expect(getByText("portfolio.name")).toBeInTheDocument();
    expect(getByText("Test Portfolio")).toBeInTheDocument();
    const codeLink = getByText("TEST");
    expect(codeLink.toString()).toBe("http://localhost/holdings/TEST");
    const createButton = getByText("portfolio.create");
    expect(createButton).toBeInTheDocument();
  });
});

import Home from "@pages/index";
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { registrationSuccess, withUserProvider } from "../fixtures";
import fetchMock, { enableFetchMocks } from "jest-fetch-mock";

enableFetchMocks();
afterEach(() => {
  jest.clearAllMocks();
  jest.restoreAllMocks();
  jest.resetModules();
});

describe("<Home />", () => {
  test("renders for authorised user", async () => {
    fetchMock.mockResponseOnce(JSON.stringify(registrationSuccess));
    render(<Home />, {
      wrapper: withUserProvider({
        user: { email: "test@example.com", name: "Test User" },
      }),
    });
    // Use waitFor for elements that will appear due to async operations
    await waitFor(() => {
      expect(screen.getByText("home.welcome")).toBeInTheDocument();
    });

    expect(screen.getByText("home.portfolios")).toBeInTheDocument();
    expect(screen.getByText("user.logout")).toBeInTheDocument();
  });
});

import Home from "@pages/index";
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { registrationSuccess, withUserProvider } from "__mocks__/fixtures";
import fetchMock, { enableFetchMocks } from "jest-fetch-mock";

enableFetchMocks();
jest.mock("simple-git", () => {
  return () => ({
    revparse: jest
      .fn()
      .mockResolvedValueOnce("mock-branch")
      .mockResolvedValueOnce("mock-commit"),
  });
});

afterEach(() => {
  jest.clearAllMocks();
  jest.restoreAllMocks();
  jest.resetModules();
  fetchMock.resetMocks();
});

describe("<Home />", () => {
  test("renders for authorised user with Footer", async () => {
    fetchMock.mockResponseOnce(JSON.stringify(registrationSuccess));
    fetchMock.mockResponseOnce(
      JSON.stringify({
        branch: "mock-branch",
        commit: "mock-commit",
        build: "dev",
      })
    );
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
    await waitFor(() => {
      expect(screen.getByText((content, element) => {
        return element!!.tagName.toLowerCase() === 'span' && content.includes("mock-commit");
      })).toBeInTheDocument();
    });
  });
});

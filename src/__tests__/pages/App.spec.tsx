import Home from "@pages/index";
import React from "react";
import { screen, render } from "@testing-library/react";
import { mockUser, withUserProvider } from "../fixtures";
import fetchMock, {enableFetchMocks} from "jest-fetch-mock";
enableFetchMocks();
jest.mock("react-i18next", () => ({
  useTranslation: () => ({ ready: true, t: (key: string) => key }),
}));


afterEach(() => {
  jest.clearAllMocks();
  jest.restoreAllMocks();
  jest.resetModules();
});

describe("<Home />", () => {
  test("renders for authorised user", async () => {
    fetchMock.mockResponseOnce(
      JSON.stringify({
        data:
          {
            id: "ownerId",
            email: "mike@bc.com",
            active: true,
            since: "2020-03-03",
          },
      })
    );
    render(<Home user={mockUser} />, {
      wrapper: withUserProvider({ user: mockUser }),
    });
    expect(await screen.findByTestId("loading")).toBeInTheDocument();
    const heading = screen.getByText("home.welcome");
    expect(heading).toBeInTheDocument();
    expect(screen.getByText("home.portfolios")).toBeInTheDocument();
    expect(screen.getByText("user.logout")).toBeInTheDocument();
  });
});

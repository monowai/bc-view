import Home from "@/pages/index";
import React from "react";
import { screen, render } from "@testing-library/react";
import { mockUser, withUserProvider } from "../fixtures";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ ready: true, t: (key: string) => key }),
}));

afterEach(() => {
  jest.clearAllMocks();
  jest.restoreAllMocks();
  jest.resetModules();
});

describe("<App />", () => {
  test("renders for authorised user", () => {
    const { container } = render(<Home user={mockUser} />, {
      wrapper: withUserProvider({ user: mockUser }),
    });
    const heading = screen.getByText("home.welcome");
    expect(heading).toBeInTheDocument();
    expect(screen.getByText("home.portfolios")).toBeInTheDocument();
    expect(screen.getByText("user.logout")).toBeInTheDocument();
    expect(container).toMatchSnapshot()
  });
});

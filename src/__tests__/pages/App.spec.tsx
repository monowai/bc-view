import Home from "@pages/index";
import React from "react";
import { act, render, RenderResult } from "@testing-library/react";
import {
  mockUserProfile,
  registrationSuccess,
  withUserProvider,
} from "../fixtures";
import fetchMock, { enableFetchMocks } from "jest-fetch-mock";

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
    fetchMock.mockResponseOnce(JSON.stringify(registrationSuccess));
    const {getByText, findByText} = await act(() => {
      return render(<Home/>, {
        wrapper: withUserProvider({ user: mockUserProfile }),
      }) as RenderResult;
    });
    await expect(findByText(`${mockUserProfile.email}`));
    const heading = getByText("home.welcome");
    expect(heading).toBeInTheDocument();
    expect(getByText("home.portfolios")).toBeInTheDocument();
    expect(getByText("user.logout")).toBeInTheDocument();
  });
});

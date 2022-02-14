import React from "react";
import { cleanup, render, screen, waitForElementToBeRemoved } from "@testing-library/react";
import "@testing-library/jest-dom/extend-expect";
import nock from "nock";
import { MemoryRouter } from "react-router";
import List from "../pages/portfolio/List";
//https://kentcdodds.com/blog/common-mistakes-with-react-testing-library
afterEach(cleanup);
jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key) => key }),
}));

jest.mock("@react-keycloak/ssr", () => ({
  useKeycloak: () => ({
    initialized: true,
    keycloak: { token: "abc" },
  }),
}));

nock("http://localhost", {
  reqheaders: {
    authorization: "Bearer abc",
  },
})
  .persist(true)
  .get("/bff/portfolios")
  .replyWithFile(200, __dirname + "/__contracts__/portfolios.json", {
    "Access-Control-Allow-Origin": "*",
    "Content-type": "application/json",
  });

describe("<List />", () => {
  it("should match snapshot", async () => {
    const { container } = render(
      <MemoryRouter initialEntries={["/"]} keyLength={0}>
        <List />
      </MemoryRouter>
    );
    await screen.findByTestId("loading");
    await waitForElementToBeRemoved(() => screen.getByTestId("loading"));
    expect(nock.isDone());
    await screen.findByText("TEST");
    expect(container).toMatchSnapshot();
  });
});

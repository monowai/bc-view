import * as React from "react";
import { useEffect } from "react";

function initialState(args: { error?: any; isLoading?: boolean; response?: any }) {
  return {
    response: null,
    error: null,
    isLoading: true,
    ...args,
  };
}

export const getOptions: RequestInit = {
  method: "GET",
  mode: "cors",
};

const useApiFetchHelper = (
  url: RequestInfo,
  options: RequestInit = getOptions
): {
  error: unknown;
  isLoading: boolean;
  response: any;
} => {
  console.log(`api-fetch: ${options.method} ${url}`);
  const [state, setState] = React.useState(() => initialState({}));
  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch(url, {
          ...options,
        });

        if (res.status >= 400) {
          setState(
            initialState({
              error: await res.json(),
              isLoading: false,
            })
          );
        } else {
          setState(
            initialState({
              response: await res.json(),
              isLoading: false,
            })
          );
        }
      } catch (error: any) {
        setState(
          initialState({
            error: {
              error: error.message,
            },
            isLoading: false,
          })
        );
      }
    };
    fetchData().then((r) => console.log("Fetched."));
  }, []);
  return state;
};

export function requestInit(accessToken: string | undefined): RequestInit {
  return {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  };
}

export default useApiFetchHelper;

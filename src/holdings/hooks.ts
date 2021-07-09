import { _axios, getBearerToken } from "../common/axiosUtils";
import { HoldingContract } from "../types/beancounter";
import { useEffect, useState } from "react";
import { useKeycloak } from "@react-keycloak/ssr";
import { AxiosError } from "axios";
import { BcResult } from "../types/app";

export function useHoldings(code: string): BcResult<HoldingContract> {
  const [holdingResults, setHoldings] = useState<HoldingContract>();
  const [error, setError] = useState<AxiosError>();
  const { keycloak } = useKeycloak();
  useEffect(() => {
    console.log("Loading Holdings...");
    const today = new Date().toISOString().split('T')[0]
    _axios
      .get<HoldingContract>(`/bff/positions/${code}/${today}`, {
        headers: getBearerToken(keycloak?.token)
      })
      .then((result) => {
        setHoldings(result.data);
      })
      .catch((err) => {
        setError(err);
        if (err.response) {
          console.error("axios error [%s]: [%s]", err.response.status, err.response.data.message);
        }
      });
  }, [code, keycloak?.token]);
  return { data: holdingResults, error };
}

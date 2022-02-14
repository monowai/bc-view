import { Currency } from "../../core/types/beancounter";
import { useEffect, useState } from "react";
import { _axios, getBearerToken } from "../../core/common/axiosUtils";
import { useKeycloak } from "@react-keycloak/ssr";
import { AxiosError } from "axios";
import { BcResult } from "../../core/types/app";

export function useCurrencies(): BcResult<Currency[]> {
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const { keycloak } = useKeycloak();
  const [error, setError] = useState<AxiosError>();
  useEffect(() => {
    console.debug(">>fetch getCurrencies");
    _axios
      .get<Currency[]>("/bff/currencies", {
        headers: getBearerToken(keycloak?.token),
      })
      .then((result) => {
        console.debug("<<fetched Currencies");
        setCurrencies(result.data);
      })
      .catch((err) => {
        console.error("Unable to get currencies {}", err);
        setError(err);
      });
  }, [keycloak]);
  return { data: currencies, error };
}

export function get(currencies: Currency[], value: string): Currency[] | undefined {
  return currencies.filter((currency) => currency.code === value);
}

export const USD = { code: "USD" } as Currency;

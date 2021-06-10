import { useEffect } from "react";
import { useKeycloak } from "@react-keycloak/ssr";
import { initConfig } from "../auth/kcConfig";

export function useLogin(): undefined | boolean {
  const { keycloak } = useKeycloak();
  useEffect(() => {
    if (keycloak && !keycloak.authenticated) {
      keycloak
        ?.init(initConfig)
        .then(function (authenticated) {
          console.debug(authenticated);
          return authenticated;
        })
        .catch((err) => {
          console.error(err);
          return false;
        });
    }
  }, [keycloak, keycloak?.authenticated]);
  return keycloak?.authenticated;
}

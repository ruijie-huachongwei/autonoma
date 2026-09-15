import { env } from "../../env";
import { resolveCasConfiguration } from "./resolve-cas-configuration";

const configuration = resolveCasConfiguration({
    managerBaseUrl: env.CAS_MANAGER_BASE_URL,
    loginUrl: env.CAS_LOGIN_URL,
    exchangeSecret: env.CAS_IDENTITY_EXCHANGE_SECRET,
});

const authBaseUrl = env.BETTER_AUTH_URL ?? env.APP_URL;

export const casConfiguration =
    configuration == null
        ? undefined
        : {
              managerBaseUrl: configuration.managerBaseUrl,
              providerLoginUrl: configuration.loginUrl,
              exchangeSecret: configuration.exchangeSecret,
              autonomaLoginUrl: new URL("/v1/enterprise-auth/cas/login", authBaseUrl).toString(),
              callbackUrl: new URL("/v1/enterprise-auth/cas/callback", authBaseUrl).toString(),
          };
const CAS_EXCHANGE_PATH = "v1/auth/exchange-cas-ticket";

export function resolveCasExchangeUrl(managerBaseUrl: string): URL {
    const normalizedBaseUrl = managerBaseUrl.endsWith("/") ? managerBaseUrl : `${managerBaseUrl}/`;
    return new URL(CAS_EXCHANGE_PATH, normalizedBaseUrl);
}
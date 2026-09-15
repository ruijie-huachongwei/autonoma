interface CasConfigurationInput {
    managerBaseUrl?: string;
    loginUrl?: string;
    exchangeSecret?: string;
}

export function resolveCasConfiguration(input: CasConfigurationInput):
    | { managerBaseUrl: string; loginUrl: string; exchangeSecret: string }
    | undefined {
    const { managerBaseUrl, loginUrl, exchangeSecret } = input;
    const isUnconfigured = managerBaseUrl == null && loginUrl == null && exchangeSecret == null;
    if (isUnconfigured) return undefined;

    if (managerBaseUrl == null || loginUrl == null || exchangeSecret == null) {
        throw new Error(
            "CAS authentication requires CAS_MANAGER_BASE_URL, CAS_LOGIN_URL, and CAS_IDENTITY_EXCHANGE_SECRET",
        );
    }

    return { managerBaseUrl, loginUrl, exchangeSecret };
}
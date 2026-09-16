const OPENROUTER_CHAT_COMPLETIONS_URL = "https://openrouter.ai/api/v1/chat/completions";

interface LlmProxyUpstreamEnvironment {
    stripeEnabled: boolean;
    openRouterApiKey?: string;
    aiProvider: "builtin" | "openai-compatible";
    compatibleBaseUrl?: string;
    compatibleApiKey?: string;
    compatibleModel?: string;
}

type LlmProxyUpstream =
    | {
          kind: "openrouter";
          url: string;
          apiKey: string;
          metered: true;
      }
    | {
          kind: "openai-compatible";
          url: string;
          apiKey: string;
          model: string;
          metered: false;
      };

export function resolveLlmProxyUpstream(environment: LlmProxyUpstreamEnvironment): LlmProxyUpstream | undefined {
    if (environment.stripeEnabled) {
        if (environment.openRouterApiKey == null) return undefined;
        return {
            kind: "openrouter",
            url: OPENROUTER_CHAT_COMPLETIONS_URL,
            apiKey: environment.openRouterApiKey,
            metered: true,
        };
    }

    if (environment.aiProvider !== "openai-compatible") return undefined;
    if (environment.compatibleBaseUrl == null) return undefined;
    if (environment.compatibleApiKey == null) return undefined;
    if (environment.compatibleModel == null) return undefined;

    return {
        kind: "openai-compatible",
        url: chatCompletionsUrl(environment.compatibleBaseUrl),
        apiKey: environment.compatibleApiKey,
        model: environment.compatibleModel,
        metered: false,
    };
}

function chatCompletionsUrl(baseUrl: string): string {
    const url = new URL(baseUrl);
    const basePath = url.pathname.replace(/\/+$/, "");
    url.pathname = `${basePath}/chat/completions`;
    url.search = "";
    url.hash = "";
    return url.toString();
}

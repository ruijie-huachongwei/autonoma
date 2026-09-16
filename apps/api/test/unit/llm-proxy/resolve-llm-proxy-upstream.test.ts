import { describe, expect, it } from "vitest";
import { resolveLlmProxyUpstream } from "../../../src/llm-proxy/resolve-llm-proxy-upstream";

describe("resolveLlmProxyUpstream", () => {
    it("uses metered OpenRouter when billing is enabled", () => {
        expect(
            resolveLlmProxyUpstream({
                stripeEnabled: true,
                openRouterApiKey: "openrouter-key",
                aiProvider: "openai-compatible",
                compatibleBaseUrl: "https://models.example.com/v1",
                compatibleApiKey: "compatible-key",
                compatibleModel: "compatible-model",
            }),
        ).toEqual({
            kind: "openrouter",
            url: "https://openrouter.ai/api/v1/chat/completions",
            apiKey: "openrouter-key",
            metered: true,
        });
    });

    it("uses the private compatible gateway when billing is disabled", () => {
        expect(
            resolveLlmProxyUpstream({
                stripeEnabled: false,
                aiProvider: "openai-compatible",
                compatibleBaseUrl: "https://models.example.com/v1/?region=test#fragment",
                compatibleApiKey: "compatible-key",
                compatibleModel: "compatible-model",
            }),
        ).toEqual({
            kind: "openai-compatible",
            url: "https://models.example.com/v1/chat/completions",
            apiKey: "compatible-key",
            model: "compatible-model",
            metered: false,
        });
    });

    it("does not fall back to the private gateway when billed OpenRouter is unconfigured", () => {
        expect(
            resolveLlmProxyUpstream({
                stripeEnabled: true,
                aiProvider: "openai-compatible",
                compatibleBaseUrl: "https://models.example.com/v1",
                compatibleApiKey: "compatible-key",
                compatibleModel: "compatible-model",
            }),
        ).toBeUndefined();
    });

    it("does not expose OpenRouter without billing", () => {
        expect(
            resolveLlmProxyUpstream({
                stripeEnabled: false,
                openRouterApiKey: "openrouter-key",
                aiProvider: "builtin",
            }),
        ).toBeUndefined();
    });

    it("rejects an incomplete compatible gateway configuration", () => {
        expect(
            resolveLlmProxyUpstream({
                stripeEnabled: false,
                aiProvider: "openai-compatible",
                compatibleBaseUrl: "https://models.example.com/v1",
                compatibleApiKey: "compatible-key",
            }),
        ).toBeUndefined();
    });
});

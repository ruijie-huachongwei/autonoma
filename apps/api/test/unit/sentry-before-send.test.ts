import { describe, expect, it } from "vitest";
import { apiSentryHooks } from "../../src/sentry-before-send";

describe("apiSentryHooks", () => {
    it("redacts CAS credentials from Sentry request data", () => {
        const request = {
            url: "https://api.example.com/v1/enterprise-auth/cas/callback?ticket=ST-secret&state=state-secret&source=login",
            query_string: "ticket=ST-secret&state=state-secret&source=login",
        };
        const event: Parameters<typeof apiSentryHooks.beforeSend>[0] = {
            type: undefined,
            request,
        };

        apiSentryHooks.beforeSend(event, {});

        expect(request.url).toBe(
            "https://api.example.com/v1/enterprise-auth/cas/callback?ticket=%5BREDACTED%5D&state=%5BREDACTED%5D&source=login",
        );
        expect(request.query_string).toBe("[REDACTED]");
    });

    it("redacts CAS credentials from tuple query data", () => {
        const queryString: [string, string][] = [
            ["source", "login"],
            ["ticket", "ST-secret"],
        ];
        const request = {
            query_string: queryString,
        };
        const event: Parameters<typeof apiSentryHooks.beforeSend>[0] = {
            type: undefined,
            request,
        };

        apiSentryHooks.beforeSend(event, {});

        expect(request.query_string).toBe("[REDACTED]");
    });

    it("redacts CAS credentials from Sentry trace spans", () => {
        const span = {
            data: {
                "http.target": "/v1/enterprise-auth/cas/callback?ticket=ST-secret&state=state-secret",
                "url.full": "https://api.example.com/v1/enterprise-auth/cas/callback?ticket=ST-secret",
                "url.query": "?ticket=ST-secret&state=state-secret",
            },
            description: "GET /v1/enterprise-auth/cas/callback?ticket=ST-secret",
            span_id: "0123456789abcdef",
            start_timestamp: 1,
            trace_id: "0123456789abcdef0123456789abcdef",
        };

        apiSentryHooks.beforeSendSpan(span);

        expect(span.data["http.target"]).toBe(
            "/v1/enterprise-auth/cas/callback?ticket=%5BREDACTED%5D&state=%5BREDACTED%5D",
        );
        expect(span.data["url.full"]).toBe(
            "https://api.example.com/v1/enterprise-auth/cas/callback?ticket=%5BREDACTED%5D",
        );
        expect(span.data["url.query"]).toBe("[REDACTED]");
        expect(span.description).toBe("[REDACTED]");
    });
});
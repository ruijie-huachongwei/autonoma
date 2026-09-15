import { describe, expect, it } from "vitest";
import { resolveCasExchangeUrl } from "../../../../src/enterprise-auth/cas/resolve-cas-exchange-url";

describe("resolveCasExchangeUrl", () => {
    it("appends the exchange endpoint to a service origin", () => {
        expect(resolveCasExchangeUrl("https://manager.ruijie.com.cn").toString()).toBe(
            "https://manager.ruijie.com.cn/v1/auth/exchange-cas-ticket",
        );
    });

    it("preserves a gateway path prefix", () => {
        expect(resolveCasExchangeUrl("https://web-gw.ruijie.com.cn/api/tianshu-manager-service").toString()).toBe(
            "https://web-gw.ruijie.com.cn/api/tianshu-manager-service/v1/auth/exchange-cas-ticket",
        );
    });
});
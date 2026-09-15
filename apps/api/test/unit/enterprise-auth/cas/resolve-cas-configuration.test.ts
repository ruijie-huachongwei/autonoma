import { describe, expect, it } from "vitest";
import { resolveCasConfiguration } from "../../../../src/enterprise-auth/cas/resolve-cas-configuration";

const COMPLETE_CONFIGURATION = {
    managerBaseUrl: "https://manager.example.com",
    loginUrl: "https://cas.example.com/login",
    exchangeSecret: "test-secret",
};

describe("resolveCasConfiguration", () => {
    it("disables CAS when none of its settings are present", () => {
        expect(resolveCasConfiguration({})).toBeUndefined();
    });

    it("returns a complete CAS configuration", () => {
        expect(resolveCasConfiguration(COMPLETE_CONFIGURATION)).toEqual(COMPLETE_CONFIGURATION);
    });

    it.each([
        { loginUrl: COMPLETE_CONFIGURATION.loginUrl, exchangeSecret: COMPLETE_CONFIGURATION.exchangeSecret },
        {
            managerBaseUrl: COMPLETE_CONFIGURATION.managerBaseUrl,
            exchangeSecret: COMPLETE_CONFIGURATION.exchangeSecret,
        },
        { managerBaseUrl: COMPLETE_CONFIGURATION.managerBaseUrl, loginUrl: COMPLETE_CONFIGURATION.loginUrl },
    ])("rejects partial configuration", (configuration) => {
        expect(() => resolveCasConfiguration(configuration)).toThrow("CAS authentication requires");
    });
});
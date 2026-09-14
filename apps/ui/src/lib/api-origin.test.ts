import { beforeEach, describe, expect, it, vi } from "vitest";
import { getApiOrigin } from "./api-origin";

vi.mock("env", () => ({
    env: {
        VITE_API_URL: "http://192.168.85.164:4000",
        VITE_INTERNAL_DOMAIN: "autonoma.app",
    },
}));

describe("getApiOrigin", () => {
    beforeEach(() => {
        vi.unstubAllGlobals();
    });

    it("uses the configured API URL for a LAN address", () => {
        vi.stubGlobal("window", { location: { hostname: "192.168.85.164" } });

        expect(getApiOrigin()).toBe("http://192.168.85.164:4000");
    });

    it("derives the dedicated API hostname for a managed deployment", () => {
        vi.stubGlobal("window", { location: { hostname: "beta.autonoma.app" } });

        expect(getApiOrigin()).toBe("https://api.beta.autonoma.app");
    });
});
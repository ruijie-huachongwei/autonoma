import { beforeEach, describe, expect, it, vi } from "vitest";
import { getApiOrigin } from "./api-origin";

const mockedEnv = vi.hoisted(() => ({
    VITE_API_URL: "http://192.168.85.164:4000",
    VITE_INTERNAL_DOMAIN: "autonoma.app",
}));

vi.mock("env", () => ({
    env: mockedEnv,
}));

describe("getApiOrigin", () => {
    beforeEach(() => {
        vi.unstubAllGlobals();
        mockedEnv.VITE_API_URL = "http://192.168.85.164:4000";
    });

    it("uses the configured API URL for a LAN address", () => {
        vi.stubGlobal("window", { location: { hostname: "192.168.85.164" } });

        expect(getApiOrigin()).toBe("http://192.168.85.164:4000");
    });

    it("does not invent an API subdomain for a self-hosted domain", () => {
        mockedEnv.VITE_API_URL = "https://autonoma-test.ruijie.com.cn";
        vi.stubGlobal("window", { location: { hostname: "autonoma-test.ruijie.com.cn" } });

        expect(getApiOrigin()).toBe("https://autonoma-test.ruijie.com.cn");
    });
});
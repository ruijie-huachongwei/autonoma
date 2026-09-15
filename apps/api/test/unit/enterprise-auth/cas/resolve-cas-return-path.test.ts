import { describe, expect, it } from "vitest";
import { resolveCasReturnPath } from "../../../../src/enterprise-auth/cas/resolve-cas-return-path";

const APP_URL = "https://autonoma.ruijie.com.cn";
const ORGANIZATION_DESTINATION = "/choose-organization";

describe("resolveCasReturnPath", () => {
    it.each([undefined, "", "/"])("uses the organization picker when no destination is supplied", (candidate) => {
        expect(resolveCasReturnPath(candidate, APP_URL)).toBe(ORGANIZATION_DESTINATION);
    });

    it("carries an app-relative destination through the organization picker", () => {
        const destination = "/app/acme/tests?status=failed#latest";

        expect(resolveCasReturnPath(destination, APP_URL)).toBe(
            `${ORGANIZATION_DESTINATION}?redirectTo=${encodeURIComponent(destination)}`,
        );
    });

    it.each(["https://evil.example/path", "//evil.example/path", "/\\evil.example/path", "not-a-path"])(
        "rejects a destination that could leave the app",
        (candidate) => {
            expect(resolveCasReturnPath(candidate, APP_URL)).toBe(ORGANIZATION_DESTINATION);
        },
    );
});
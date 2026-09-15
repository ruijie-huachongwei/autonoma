import { logger as rootLogger } from "@autonoma/logger";

const logger = rootLogger.child({ name: "resolveCasReturnPath" });
const ORGANIZATION_DESTINATION = "/choose-organization";

export function resolveCasReturnPath(candidate: string | undefined, appUrl: string): string {
    if (candidate == null || candidate === "" || candidate === "/") return ORGANIZATION_DESTINATION;
    if (!candidate.startsWith("/")) {
        logger.info("Ignoring a CAS redirect that is not an app-relative path");
        return ORGANIZATION_DESTINATION;
    }

    try {
        const resolved = new URL(candidate, appUrl);
        if (resolved.origin !== new URL(appUrl).origin) {
            logger.info("Ignoring a CAS redirect that resolves off-origin");
            return ORGANIZATION_DESTINATION;
        }
        const destination = `${resolved.pathname}${resolved.search}${resolved.hash}`;
        return `${ORGANIZATION_DESTINATION}?redirectTo=${encodeURIComponent(destination)}`;
    } catch (error) {
        logger.info("Ignoring a CAS redirect that is not parseable", { extra: { error } });
        return ORGANIZATION_DESTINATION;
    }
}
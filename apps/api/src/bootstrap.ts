import { analytics } from "@autonoma/analytics";
import { createSentryConfig } from "@autonoma/logger";
import * as Sentry from "@sentry/node";
import { env } from "./env";
import { apiSentryHooks } from "./sentry-before-send";

let bootstrapped = false;

export function bootstrapApiRuntime() {
    if (bootstrapped) return;

    const sentryConfig = createSentryConfig({
        contextType: "service",
        contextName: "api",
        beforeSend: apiSentryHooks.beforeSend,
    });
    sentryConfig.beforeSendSpan = apiSentryHooks.beforeSendSpan;
    Sentry.init(sentryConfig);

    if (env.POSTHOG_KEY != null) {
        analytics.init(env.POSTHOG_KEY, env.POSTHOG_HOST);
    }

    bootstrapped = true;
}

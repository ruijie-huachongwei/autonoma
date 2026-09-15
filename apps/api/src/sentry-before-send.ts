import { logger as rootLogger } from "@autonoma/logger";
import type { NodeOptions } from "@sentry/node";
import { TRPCError } from "@trpc/server";
import { getHTTPStatusCodeFromError } from "@trpc/server/http";

type BeforeSend = NonNullable<NodeOptions["beforeSend"]>;
type BeforeSendSpan = NonNullable<NodeOptions["beforeSendSpan"]>;

interface ApiSentryHooks {
    beforeSend: BeforeSend;
    beforeSendSpan: BeforeSendSpan;
}

const REDACTED_QUERY_VALUE = "[REDACTED]";
const SENSITIVE_AUTH_QUERY_PARAMETERS: ReadonlySet<string> = new Set(["ticket", "state"]);
const URL_SPAN_ATTRIBUTES = ["http.target", "http.url", "url.full"] as const;

/**
 * API-specific Sentry `beforeSend` filter. Drops expected client-error tRPC
 * responses (any `TRPCError` mapping to a 4xx HTTP status - NOT_FOUND, BAD_REQUEST,
 * UNAUTHORIZED, FORBIDDEN, CONFLICT, PRECONDITION_FAILED, ...) so they don't create
 * production issues or page on-call. Server errors (5xx, including unhandled errors
 * wrapped as INTERNAL_SERVER_ERROR) are kept.
 *
 * The capture itself is unconditional inside `@sentry/node`'s `trpcMiddleware`, which
 * has no filter knob - so the classification happens here, at send time.
 */
const dropExpectedClientErrors: BeforeSend = (event, hint) => {
    redactSensitiveAuthRequest(event);

    const error = hint.originalException;
    if (!(error instanceof TRPCError)) return event;

    const status = getHTTPStatusCodeFromError(error);
    const isClientError = status >= 400 && status < 500;
    if (!isClientError) return event;

    rootLogger
        .child({ name: "dropExpectedClientErrors" })
        .debug("Dropping expected client-error tRPC event", { extra: { code: error.code, status } });
    return null;
};

const redactSensitiveAuthSpan: BeforeSendSpan = (span) => {
    for (const attribute of URL_SPAN_ATTRIBUTES) {
        const value = span.data[attribute];
        if (typeof value === "string") span.data[attribute] = redactSensitiveUrlParameters(value);
    }

    const query = span.data["url.query"];
    if (typeof query === "string" && containsSensitiveQueryParameter(query)) {
        span.data["url.query"] = REDACTED_QUERY_VALUE;
    }
    if (span.description != null && containsSensitiveAuthQueryText(span.description)) {
        span.description = REDACTED_QUERY_VALUE;
    }
    return span;
};

export const apiSentryHooks: ApiSentryHooks = {
    beforeSend: dropExpectedClientErrors,
    beforeSendSpan: redactSensitiveAuthSpan,
};

function redactSensitiveAuthRequest(event: Parameters<BeforeSend>[0]): void {
    const request = event.request;
    if (request == null) return;

    if (request.url != null) request.url = redactSensitiveUrlParameters(request.url);
    if (request.query_string != null && containsSensitiveQueryParameter(request.query_string)) {
        request.query_string = REDACTED_QUERY_VALUE;
    }
}

function redactSensitiveUrlParameters(rawUrl: string): string {
    try {
        const isAbsoluteUrl = /^[a-z][a-z\d+.-]*:\/\//i.test(rawUrl);
        const url = new URL(rawUrl, "https://redaction.invalid");
        for (const parameter of url.searchParams.keys()) {
            if (isSensitiveAuthQueryParameter(parameter)) {
                url.searchParams.set(parameter, REDACTED_QUERY_VALUE);
            }
        }
        if (isAbsoluteUrl) return url.toString();
        return `${url.pathname}${url.search}${url.hash}`;
    } catch {
        return rawUrl;
    }
}

function containsSensitiveQueryParameter(
    query: NonNullable<NonNullable<Parameters<BeforeSend>[0]["request"]>["query_string"]>,
): boolean {
    if (typeof query === "string") {
        return [...new URLSearchParams(query).keys()].some(isSensitiveAuthQueryParameter);
    }
    if (Array.isArray(query)) {
        return query.some(
            (entry) => Array.isArray(entry) && typeof entry[0] === "string" && isSensitiveAuthQueryParameter(entry[0]),
        );
    }
    return Object.keys(query).some(isSensitiveAuthQueryParameter);
}

function isSensitiveAuthQueryParameter(parameter: string): boolean {
    return SENSITIVE_AUTH_QUERY_PARAMETERS.has(parameter.toLowerCase());
}

function containsSensitiveAuthQueryText(value: string): boolean {
    return /(?:^|[?&])(?:ticket|state)=/i.test(value);
}

import { createHash } from "node:crypto";
import { db, type Prisma } from "@autonoma/db";
import { logger as rootLogger } from "@autonoma/logger";
import { z } from "zod";
import { Hono } from "hono";
import { deleteCookie, getSignedCookie, setSignedCookie } from "hono/cookie";
import { auth, redisClient } from "../../context";
import { env } from "../../env";
import { casConfiguration } from "./cas-configuration";
import { resolveCasExchangeUrl } from "./resolve-cas-exchange-url";
import { resolveCasReturnPath } from "./resolve-cas-return-path";

const logger = rootLogger.child({ name: "CasHttpRouter" });
const CAS_ACCOUNT_PROVIDER = "ruijie-cas";
const CAS_STATE_COOKIE = "autonoma.cas_state";
const CAS_STATE_PREFIX = `${env.NAMESPACE}:cas-state:`;
const CAS_STATE_TTL_SECONDS = 10 * 60;
const optionalEmployeeNumberSchema = z.preprocess(
    (value) => (value == null || (typeof value === "string" && value.trim() === "") ? undefined : value),
    z.string().trim().min(1).optional(),
);

const casIdentitySchema = z.object({
    subject: z.string().min(1),
    employeeNo: optionalEmployeeNumberSchema,
    name: z.string().min(1),
    email: z.string().email(),
});

const casExchangeResponseSchema = z.object({
    data: casIdentitySchema,
});

interface CasState {
    returnTo: string;
}

export const casHttpRouter = new Hono();

casHttpRouter.get("/login", async (c) => {
    const config = requireCasConfig();
    const authContext = await auth.$context;
    const state = crypto.randomUUID();
    const returnTo = resolveCasReturnPath(c.req.query("redirectTo"), env.APP_URL);
    await redisClient.set(stateKey(state), JSON.stringify({ returnTo }), "EX", CAS_STATE_TTL_SECONDS);
    await setSignedCookie(c, CAS_STATE_COOKIE, state, authContext.secret, stateCookieAttributes());

    const callbackUrl = buildCallbackUrl(state);
    const loginUrl = new URL(config.providerLoginUrl);
    loginUrl.searchParams.set("service", callbackUrl);
    logger.info("Starting CAS sign-in");
    return c.redirect(loginUrl.toString());
});

casHttpRouter.get("/callback", async (c) => {
    const authContext = await auth.$context;
    const state = c.req.query("state");
    const ticket = c.req.query("ticket");
    if (state == null || ticket == null) return redirectToLogin(c, "cas_invalid_callback");

    const cookieState = await getSignedCookie(c, authContext.secret, CAS_STATE_COOKIE);
    deleteCookie(c, CAS_STATE_COOKIE, stateCookieAttributes());
    if (cookieState !== state) return redirectToLogin(c, "cas_invalid_state");

    const rawState = await redisClient.getdel(stateKey(state));
    if (rawState == null) return redirectToLogin(c, "cas_expired_state");

    try {
        const parsedState = parseState(rawState);
        const identity = await exchangeCasTicket(ticket, buildCallbackUrl(state));
        const userId = await findOrCreateCasUser(identity);
        const session = await (await auth.$context).internalAdapter.createSession(userId);
        await setSessionCookie(c, session.token, session.expiresAt);
        logger.info("CAS sign-in completed", { extra: { userId } });
        return c.redirect(`${env.APP_URL}${parsedState.returnTo}`);
    } catch (error) {
        logger.error("CAS sign-in failed", { error });
        return redirectToLogin(c, "cas_exchange_failed");
    }
});

function requireCasConfig(): NonNullable<typeof casConfiguration> {
    if (casConfiguration == null) throw new Error("CAS enterprise authentication is not configured");
    return casConfiguration;
}

function buildCallbackUrl(state: string): string {
    const callbackUrl = new URL(requireCasConfig().callbackUrl);
    callbackUrl.searchParams.set("state", state);
    return callbackUrl.toString();
}

async function exchangeCasTicket(ticket: string, service: string) {
    const config = requireCasConfig();
    const exchangeUrl = resolveCasExchangeUrl(config.managerBaseUrl);
    const response = await fetch(exchangeUrl, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${config.exchangeSecret}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ ticket, service }),
        signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`CAS identity exchange returned ${response.status}`);
    return casExchangeResponseSchema.parse(await response.json()).data;
}

async function findOrCreateCasUser(identity: z.infer<typeof casIdentitySchema>): Promise<string> {
    return db.$transaction(async (transaction: Prisma.TransactionClient) => {
        const linkedAccount = await transaction.account.findFirst({
            where: { providerId: CAS_ACCOUNT_PROVIDER, accountId: identity.subject },
            select: { userId: true },
        });
        if (linkedAccount != null) {
            await transaction.user.update({
                where: { id: linkedAccount.userId },
                data: { name: identity.name, emailVerified: true },
            });
            return linkedAccount.userId;
        }

        const user = await transaction.user.upsert({
            where: { email: identity.email },
            update: { name: identity.name, emailVerified: true },
            create: { email: identity.email, name: identity.name, emailVerified: true },
            select: { id: true },
        });
        const account = await transaction.account.upsert({
            where: { id: casAccountRecordId(identity.subject) },
            update: {},
            create: {
                id: casAccountRecordId(identity.subject),
                providerId: CAS_ACCOUNT_PROVIDER,
                accountId: identity.subject,
                userId: user.id,
            },
            select: { userId: true },
        });
        return account.userId;
    });
}

function casAccountRecordId(subject: string): string {
    return `${CAS_ACCOUNT_PROVIDER}:${createHash("sha256").update(subject).digest("hex")}`;
}

function parseState(rawState: string): CasState {
    const value: unknown = JSON.parse(rawState);
    return z.object({ returnTo: z.string() }).parse(value);
}

function stateKey(state: string): string {
    return `${CAS_STATE_PREFIX}${state}`;
}

function stateCookieAttributes() {
    return {
        httpOnly: true,
        sameSite: "Lax" as const,
        secure: new URL(requireCasConfig().callbackUrl).protocol === "https:",
        path: new URL(requireCasConfig().callbackUrl).pathname,
        maxAge: CAS_STATE_TTL_SECONDS,
    };
}

async function setSessionCookie(c: Parameters<typeof setSignedCookie>[0], token: string, expiresAt: Date): Promise<void> {
    const context = await auth.$context;
    const { name, attributes } = context.authCookies.sessionToken;
    await setSignedCookie(c, name, token, context.secret, {
        httpOnly: true,
        sameSite: "Lax",
        secure: attributes.secure,
        path: "/",
        domain: attributes.domain ?? undefined,
        expires: expiresAt,
    });
}

function redirectToLogin(c: Parameters<typeof deleteCookie>[0], error: string) {
    return c.redirect(`${env.APP_URL}/login?error=${encodeURIComponent(error)}`);
}
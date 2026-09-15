import { TRPCError } from "@trpc/server";
import { ENABLED_SOCIAL_PROVIDERS } from "../../auth";
import { casConfiguration } from "../../enterprise-auth/cas/cas-configuration";
import { protectedProcedure, publicProcedure, router } from "../../trpc";

export const authRouter = router({
    me: protectedProcedure.query(({ ctx: { user, organizationId } }) => ({
        user,
        organizationId,
    })),
    // Unauthenticated by nature - the login page calls this before anyone has a session.
    socialProviders: publicProcedure.query(() => ENABLED_SOCIAL_PROVIDERS),
    loginOptions: publicProcedure.query(() => ({
        socialProviders: ENABLED_SOCIAL_PROVIDERS,
        casLoginUrl: casConfiguration?.autonomaLoginUrl,
    })),
    orgStatus: publicProcedure.query(({ ctx }) => {
        if (ctx.user == null || ctx.session == null) {
            throw new TRPCError({ code: "UNAUTHORIZED" });
        }
        return ctx.services.auth.getOrgStatus(ctx.user.id, ctx.session.activeOrganizationId ?? undefined);
    }),
    activeOrg: publicProcedure.query(({ ctx }) => {
        if (ctx.user == null || ctx.session == null) {
            throw new TRPCError({ code: "UNAUTHORIZED" });
        }
        if (ctx.session.activeOrganizationId == null) return undefined;
        return ctx.services.auth.getActiveOrg(ctx.session.activeOrganizationId, ctx.session.token);
    }),
});

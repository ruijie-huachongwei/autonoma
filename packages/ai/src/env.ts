import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
    server: {
        AI_PROVIDER: z.enum(["builtin", "openai-compatible"]).default("builtin"),
        GROQ_KEY: z.string().min(1).optional(),
        GEMINI_API_KEY: z.string().min(1).optional(),
        OPENROUTER_API_KEY: z.string().min(1).optional(),
        AI_COMPATIBLE_BASE_URL: z.url().optional(),
        AI_COMPATIBLE_API_KEY: z.string().min(1).optional(),
        AI_COMPATIBLE_MODEL: z.string().min(1).optional(),
        AI_COMPATIBLE_FAST_VISUAL_MODEL: z.string().min(1).optional(),
        AI_COMPATIBLE_SMART_VISUAL_MODEL: z.string().min(1).optional(),
        AI_COMPATIBLE_FAST_TEXT_MODEL: z.string().min(1).optional(),
        AI_COMPATIBLE_POINTER_MODEL: z.string().min(1).optional(),
    },
    runtimeEnv: process.env,
    emptyStringAsUndefined: true,
    skipValidation: process.env["VITEST"] != null,
});

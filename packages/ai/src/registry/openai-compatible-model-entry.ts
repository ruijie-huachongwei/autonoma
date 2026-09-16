import { createOpenAI } from "@ai-sdk/openai";
import { logger as rootLogger } from "@autonoma/logger";
import { simpleCostFunction } from "./costs";
import type { ModelEntry } from "./model-entries";

const OPENAI_COMPATIBLE_PROVIDER_NAME = "autonoma-compatible";

export function createOpenAICompatibleModelEntry({
    baseUrl,
    apiKey,
    modelId,
}: {
    baseUrl: string;
    apiKey: string;
    modelId: string;
}): ModelEntry {
    const logger = rootLogger.child({ name: "createOpenAICompatibleModelEntry" });
    logger.info("Creating OpenAI-compatible model entry", { extra: { baseUrl, modelId } });

    const provider = createOpenAI({
        name: OPENAI_COMPATIBLE_PROVIDER_NAME,
        baseURL: baseUrl.replace(/\/+$/, ""),
        apiKey,
    });

    const entry = {
        createModel: () => provider.chat(modelId),
        pricing: simpleCostFunction({ inputCostPerM: 0, outputCostPerM: 0 }),
    };

    logger.info("Created OpenAI-compatible model entry", { extra: { modelId } });
    return entry;
}

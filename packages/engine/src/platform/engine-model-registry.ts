import {
    type CostCollector,
    createOpenAICompatibleModelEntry,
    MODEL_ENTRIES,
    type ModelEntry,
    ModelRegistry,
} from "@autonoma/ai";
import { env } from "@autonoma/ai/env";

// Built-in slots shared by every platform's registry. Kept as one source so web and mobile can't
// silently drift on the non-`smart-visual` models.
const SHARED_MODEL_SLOTS = {
    "fast-visual": MODEL_ENTRIES.MINISTRAL_8B,
    "fast-text": MODEL_ENTRIES.GPT_OSS_120B,
} as const;

type EngineModelSlot = "fast-visual" | "smart-visual" | "fast-text" | "pointer";

export type EngineModelConfiguration =
    | { provider: "builtin" }
    | {
          provider: "openai-compatible";
          baseUrl: string;
          apiKey: string;
          model: string;
          fastVisualModel?: string;
          smartVisualModel?: string;
          fastTextModel?: string;
          pointerModel?: string;
      };

export type EngineModelRegistry = ModelRegistry<"fast-visual" | "smart-visual" | "fast-text">;

export function createEngineModelRegistry(
    costCollector?: CostCollector,
    configuration: EngineModelConfiguration = configurationFromEnv(),
): EngineModelRegistry {
    return new ModelRegistry({
        models: {
            "fast-visual": resolveModelEntry(configuration, "fast-visual", SHARED_MODEL_SLOTS["fast-visual"]),
            "fast-text": resolveModelEntry(configuration, "fast-text", SHARED_MODEL_SLOTS["fast-text"]),
            "smart-visual": resolveModelEntry(configuration, "smart-visual", MODEL_ENTRIES.GEMINI_3_FLASH_PREVIEW),
        },
        monitoring: costCollector?.createMonitoringCallbacks(),
    });
}

/**
 * Web registry. Adds a dedicated `pointer` slot (grounding) separate from `smart-visual`
 * (agent-loop / assert / text-extraction) so the two can use different models: Gemini-3.5-flash-lite
 * drives the loop, Qwen3-VL-32B does the grounding. Web-only - mobile stays on
 * {@link createEngineModelRegistry}.
 */
export type WebEngineModelRegistry = ModelRegistry<"fast-visual" | "smart-visual" | "fast-text" | "pointer">;

export function createWebEngineModelRegistry(
    costCollector?: CostCollector,
    configuration: EngineModelConfiguration = configurationFromEnv(),
): WebEngineModelRegistry {
    return new ModelRegistry({
        models: {
            "fast-visual": resolveModelEntry(configuration, "fast-visual", SHARED_MODEL_SLOTS["fast-visual"]),
            "fast-text": resolveModelEntry(configuration, "fast-text", SHARED_MODEL_SLOTS["fast-text"]),
            "smart-visual": resolveModelEntry(configuration, "smart-visual", MODEL_ENTRIES.GEMINI_3_5_FLASH_LITE),
            pointer: resolveModelEntry(configuration, "pointer", MODEL_ENTRIES.QWEN3_VL_32B),
        },
        monitoring: costCollector?.createMonitoringCallbacks(),
    });
}

function configurationFromEnv(): EngineModelConfiguration {
    if (env.AI_PROVIDER === "builtin") return { provider: "builtin" };

    return {
        provider: "openai-compatible",
        baseUrl: requireCompatibleSetting("AI_COMPATIBLE_BASE_URL", env.AI_COMPATIBLE_BASE_URL),
        apiKey: requireCompatibleSetting("AI_COMPATIBLE_API_KEY", env.AI_COMPATIBLE_API_KEY),
        model: requireCompatibleSetting("AI_COMPATIBLE_MODEL", env.AI_COMPATIBLE_MODEL),
        fastVisualModel: env.AI_COMPATIBLE_FAST_VISUAL_MODEL,
        smartVisualModel: env.AI_COMPATIBLE_SMART_VISUAL_MODEL,
        fastTextModel: env.AI_COMPATIBLE_FAST_TEXT_MODEL,
        pointerModel: env.AI_COMPATIBLE_POINTER_MODEL,
    };
}

function requireCompatibleSetting(name: string, value: string | undefined): string {
    if (value == null) throw new Error(`${name} is required when AI_PROVIDER=openai-compatible`);
    return value;
}

function resolveModelEntry(
    configuration: EngineModelConfiguration,
    slot: EngineModelSlot,
    builtInEntry: ModelEntry,
): ModelEntry {
    if (configuration.provider === "builtin") return builtInEntry;

    return createOpenAICompatibleModelEntry({
        baseUrl: configuration.baseUrl,
        apiKey: configuration.apiKey,
        modelId: compatibleModelId(configuration, slot),
    });
}

function compatibleModelId(
    configuration: Extract<EngineModelConfiguration, { provider: "openai-compatible" }>,
    slot: EngineModelSlot,
): string {
    switch (slot) {
        case "fast-visual":
            return configuration.fastVisualModel ?? configuration.model;
        case "smart-visual":
            return configuration.smartVisualModel ?? configuration.model;
        case "fast-text":
            return configuration.fastTextModel ?? configuration.model;
        case "pointer":
            return configuration.pointerModel ?? configuration.model;
    }
}

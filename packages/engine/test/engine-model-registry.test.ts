import { describe, expect, it } from "vitest";
import {
    type EngineModelConfiguration,
    createEngineModelRegistry,
    createWebEngineModelRegistry,
} from "../src/platform/engine-model-registry";

const configuration: EngineModelConfiguration = {
    provider: "openai-compatible",
    baseUrl: "http://127.0.0.1:11434/v1",
    apiKey: "test-key",
    model: "default-model",
    smartVisualModel: "vision-model",
    pointerModel: "pointer-model",
};

describe("engine model registry", () => {
    it("uses the compatible default and overrides for every web model slot", () => {
        const registry = createWebEngineModelRegistry(undefined, configuration);

        expect(modelId(registry, "fast-visual")).toBe("default-model");
        expect(modelId(registry, "fast-text")).toBe("default-model");
        expect(modelId(registry, "smart-visual")).toBe("vision-model");
        expect(modelId(registry, "pointer")).toBe("pointer-model");
    });

    it("uses the compatible models for every mobile model slot", () => {
        const registry = createEngineModelRegistry(undefined, configuration);

        expect(modelId(registry, "fast-visual")).toBe("default-model");
        expect(modelId(registry, "fast-text")).toBe("default-model");
        expect(modelId(registry, "smart-visual")).toBe("vision-model");
    });
});

function modelId<TModel extends string>(
    registry: { getModel: (options: { model: TModel; tag: string }) => { modelId: string } },
    model: TModel,
): string {
    return registry.getModel({ model, tag: "test" }).modelId;
}

import { once } from "node:events";
import { createServer } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { createOpenAICompatibleModelEntry } from "../src/registry/openai-compatible-model-entry";

const servers: ReturnType<typeof createServer>[] = [];

afterEach(async () => {
    await Promise.all(
        servers.splice(0).map(
            (server) =>
                new Promise<void>((resolve, reject) => {
                    server.close((error) => (error != null ? reject(error) : resolve()));
                }),
        ),
    );
});

describe("createOpenAICompatibleModelEntry", () => {
    it("sends chat completion requests to the configured endpoint", async () => {
        const requests: { url?: string; authorization?: string }[] = [];
        const server = createServer((request, response) => {
            requests.push({
                url: request.url,
                authorization: request.headers.authorization,
            });
            response.writeHead(200, { "content-type": "application/json" });
            response.end(
                JSON.stringify({
                    id: "chatcmpl-test",
                    object: "chat.completion",
                    created: 1,
                    model: "custom-vision-model",
                    choices: [
                        {
                            index: 0,
                            message: { role: "assistant", content: "ok" },
                            finish_reason: "stop",
                        },
                    ],
                    usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
                }),
            );
        });
        servers.push(server);
        server.listen(0, "127.0.0.1");
        await once(server, "listening");

        const address = server.address();
        if (address == null || typeof address === "string") throw new Error("Expected a TCP server address");

        const entry = createOpenAICompatibleModelEntry({
            baseUrl: `http://127.0.0.1:${address.port}/v1/`,
            apiKey: "compatible-secret",
            modelId: "custom-vision-model",
        });
        const model = entry.createModel();

        await model.doGenerate({
            prompt: [{ role: "user", content: [{ type: "text", text: "hello" }] }],
        });

        expect(model.modelId).toBe("custom-vision-model");
        expect(requests).toEqual([
            {
                url: "/v1/chat/completions",
                authorization: "Bearer compatible-secret",
            },
        ]);
    });
});

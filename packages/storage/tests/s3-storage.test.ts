import type * as S3ClientModule from "@aws-sdk/client-s3";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const clientConfigs = vi.hoisted<S3ClientModule.S3ClientConfig[]>(() => []);

vi.mock("@aws-sdk/client-s3", async (importOriginal) => {
    const actual = await importOriginal<typeof S3ClientModule>();

    class RecordingS3Client {
        constructor(config: S3ClientModule.S3ClientConfig) {
            clientConfigs.push(config);
        }
    }

    return { ...actual, S3Client: RecordingS3Client };
});

describe("S3Storage configuration", () => {
    beforeEach(() => {
        vi.stubEnv("S3_BUCKET", "autonoma-artifacts");
        vi.stubEnv("S3_REGION", "cn-hangzhou");
    });

    afterEach(() => {
        vi.unstubAllEnvs();
        vi.resetModules();
        clientConfigs.length = 0;
    });

    it("uses an OSS endpoint with virtual-host addressing", async () => {
        vi.stubEnv("S3_ENDPOINT", "https://s3.oss-cn-hangzhou.aliyuncs.com");
        vi.stubEnv("S3_FORCE_PATH_STYLE", "false");
        vi.stubEnv("S3_ACCESS_KEY_ID", "test-access-key");
        vi.stubEnv("S3_SECRET_ACCESS_KEY", "test-secret-key");

        const { S3Storage } = await import("../src/providers/s3-storage");
        S3Storage.createFromEnv();

        expect(clientConfigs).toEqual([
            expect.objectContaining({
                region: "cn-hangzhou",
                endpoint: "https://s3.oss-cn-hangzhou.aliyuncs.com",
                forcePathStyle: false,
                credentials: {
                    accessKeyId: "test-access-key",
                    secretAccessKey: "test-secret-key",
                },
            }),
        ]);
    });

    it("preserves path-style addressing for an explicitly configured local endpoint", async () => {
        const { S3Storage } = await import("../src/providers/s3-storage");
        new S3Storage({
            bucket: "test-bucket",
            region: "us-east-1",
            endpoint: "http://localhost:4566",
        });

        expect(clientConfigs).toEqual([
            expect.objectContaining({
                endpoint: "http://localhost:4566",
                forcePathStyle: true,
            }),
        ]);
    });
});
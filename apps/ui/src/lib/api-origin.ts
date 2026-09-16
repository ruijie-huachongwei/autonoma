import { env } from "env";

/**
 * The API origin for data-plane calls. Managed deployments configure their
 * dedicated `api.*` host in VITE_API_URL, while self-hosted deployments may
 * route API traffic through the application origin. Deriving a hostname here
 * would invent an `api.*` DNS name that a custom deployment may not provide.
 */
export function getApiOrigin(): string {
    return env.VITE_API_URL;
}

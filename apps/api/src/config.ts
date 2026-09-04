import { readRuntimeConfig } from "./runtime-policy";

// Checked before the existing server can listen. This is not authentication:
// reverse proxies/tunnels must not expose the loopback-only legacy service.
export const config = readRuntimeConfig(process.env);

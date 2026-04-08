import { Garu } from '@garuhq/node';

import type { ResolvedAuth } from './auth.js';

export interface GaruClientOptions {
  auth: ResolvedAuth;
  baseUrl?: string;
}

/**
 * Construct a `Garu` SDK instance from resolved auth.
 *
 * The CLI dogfoods `@garuhq/node` — every HTTP call flows through the SDK we
 * shipped in Chunk 3. This keeps retries, idempotency, and error mapping
 * consistent between the CLI, MCP server, and any user-written integration.
 */
export function createGaruClient(opts: GaruClientOptions): Garu {
  return new Garu({
    apiKey: opts.auth.apiKey,
    baseUrl: opts.baseUrl
  });
}

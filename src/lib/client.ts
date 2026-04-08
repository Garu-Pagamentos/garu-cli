import { Garu } from '@garuhq/node';

import type { ResolvedAuth } from './auth.js';
import { CLI_VERSION } from '../version.js';

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

/** User-Agent used for CLI requests. Surfaces the CLI version in backend logs. */
export function cliUserAgent(): string {
  return `garu-cli/${CLI_VERSION}`;
}

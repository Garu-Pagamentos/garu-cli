import { Garu } from '@garuhq/node';

import { loadCredentials, saveCredentials, upsertProfile } from '../lib/credentials.js';
import { CliError } from '../lib/errors.js';
import { printStatus, printSuccess, type OutputOptions } from '../lib/output.js';

export interface LoginOptions extends OutputOptions {
  /** Profile name to create/update. Default: `default`. */
  profile?: string;
  /** Pre-supplied API key (for scripting). When set, no interactive prompt. */
  apiKey?: string;
  /** Override base URL (tests). */
  baseUrl?: string;
}

export async function loginCommand(opts: LoginOptions = {}): Promise<{ profile: string }> {
  const profile = opts.profile ?? 'default';

  // `@inquirer/prompts` is ESM-only; we lazy-load it via dynamic import so the
  // tsup-built CJS entry works on Node 18 (where require-of-ESM is forbidden).
  const apiKey =
    opts.apiKey ??
    (await import('@inquirer/prompts')
      .then(({ password }) =>
        password({
          message: 'Paste your Garu API key (sk_live_... or sk_test_...)',
          mask: '*'
        })
      )
      .catch(() => {
        throw new CliError('user_cancelled', 'Login cancelled.');
      }));

  if (!apiKey || !/^sk_(live|test)_[A-Za-z0-9_]+$/.test(apiKey)) {
    throw new CliError('invalid_input', 'API key must look like `sk_live_...` or `sk_test_...`.');
  }

  printStatus('Checking connectivity to Garu...', opts);
  const garu = new Garu({ apiKey, baseUrl: opts.baseUrl });

  // We hit the unauthenticated `/api/meta` to verify the SDK can reach the
  // backend. We do NOT yet verify the key is accepted — that requires an
  // authenticated probe endpoint (tracked as a Chunk 2b backend follow-up:
  // expose `GET /api/v1/me`). Until then, a malformed-but-valid-shape key
  // will be saved and fail on the next real command.
  await garu.meta.get();

  const file = await loadCredentials();
  const updated = upsertProfile(file, profile, { apiKey });
  await saveCredentials(updated);

  printSuccess(`Saved profile '${profile}' to ~/.config/garu/credentials.json`, opts);
  return { profile };
}

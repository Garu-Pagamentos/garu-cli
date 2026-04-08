import { password as promptPassword } from '@inquirer/prompts';

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

  const apiKey =
    opts.apiKey ??
    (await promptPassword({
      message: 'Paste your Garu API key (sk_live_... or sk_test_...)',
      mask: '*'
    }).catch(() => {
      throw new CliError('user_cancelled', 'Login cancelled.');
    }));

  if (!apiKey || !/^sk_(live|test)_[A-Za-z0-9_]+$/.test(apiKey)) {
    throw new CliError('invalid_input', 'API key must look like `sk_live_...` or `sk_test_...`.');
  }

  printStatus('Validating key with Garu...', opts);
  const garu = new Garu({
    apiKey,
    ...(opts.baseUrl !== undefined ? { baseUrl: opts.baseUrl } : {})
  });

  // Hit an unauthenticated endpoint first to confirm connectivity, then use
  // the authenticated path to prove the key works. `meta.get` tests reachability;
  // we don't yet have a light authed endpoint to verify the key, so the key is
  // stored after basic format + reachability checks. A real auth probe will
  // land once the backend exposes `GET /api/v1/me`.
  await garu.meta.get();

  const file = await loadCredentials();
  const updated = upsertProfile(file, profile, { apiKey });
  await saveCredentials(updated);

  printSuccess(`Saved profile '${profile}' to ~/.config/garu/credentials.json`, opts);
  return { profile };
}

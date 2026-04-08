import { loadCredentials, type CredentialProfile } from './credentials.js';
import { CliError } from './errors.js';

export interface ResolvedAuth {
  apiKey: string;
  /** Where the key came from, for `doctor` and debug output. */
  source: 'flag' | 'env' | 'file';
  /** Profile name if resolved from file; undefined otherwise. */
  profile?: string;
  fileProfile?: CredentialProfile;
}

export interface ResolveAuthOptions {
  /** `--api-key` flag value. Highest precedence. */
  apiKey?: string;
  /** `--profile` flag value. When set, reads that profile instead of the active one. */
  profile?: string;
  env?: NodeJS.ProcessEnv;
}

/**
 * Resolve the API key following SPEC §7 auth priority:
 *
 *   1. `--api-key` flag
 *   2. `GARU_API_KEY` environment variable
 *   3. credentials file active profile (or profile selected with `--profile`)
 *
 * Throws {@link CliError} with code `auth_error` if no key is found. Never logs.
 */
export async function resolveAuth(opts: ResolveAuthOptions = {}): Promise<ResolvedAuth> {
  const env = opts.env ?? process.env;

  if (opts.apiKey) {
    return { apiKey: opts.apiKey, source: 'flag' };
  }

  if (env.GARU_API_KEY) {
    return { apiKey: env.GARU_API_KEY, source: 'env' };
  }

  const file = await loadCredentials(env);
  const profileName = opts.profile ?? file.activeProfile;
  const profile = file.profiles[profileName];
  if (profile && profile.apiKey) {
    return {
      apiKey: profile.apiKey,
      source: 'file',
      profile: profileName,
      fileProfile: profile
    };
  }

  throw new CliError('auth_error', 'No API key found. Run `garu login` or set GARU_API_KEY.');
}

/**
 * Same as {@link resolveAuth} but returns `null` instead of throwing when no
 * credentials are available. Used by `garu doctor`.
 */
export async function resolveAuthOptional(
  opts: ResolveAuthOptions = {}
): Promise<ResolvedAuth | null> {
  try {
    return await resolveAuth(opts);
  } catch (err) {
    if (err instanceof CliError && err.code === 'auth_error') return null;
    throw err;
  }
}

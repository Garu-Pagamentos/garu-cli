import { mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { resolveAuth, resolveAuthOptional } from '../src/lib/auth.js';
import { saveCredentials } from '../src/lib/credentials.js';
import { CliError } from '../src/lib/errors.js';

let tmp: string;
let env: NodeJS.ProcessEnv;

beforeEach(async () => {
  tmp = join(tmpdir(), `garu-cli-auth-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  await mkdir(tmp, { recursive: true });
  env = {
    // Start from a clean slate — no GARU_API_KEY leakage from the dev shell.
    GARU_CREDENTIALS_PATH: join(tmp, 'credentials.json')
  };
});

afterEach(async () => {
  await rm(tmp, { recursive: true, force: true });
});

describe('resolveAuth priority', () => {
  it('prefers --api-key over env and file', async () => {
    const fileEnv = { ...env, GARU_API_KEY: 'sk_test_env' };
    await saveCredentials(
      { version: 1, activeProfile: 'default', profiles: { default: { apiKey: 'sk_test_file' } } },
      fileEnv
    );

    const resolved = await resolveAuth({ apiKey: 'sk_test_flag', env: fileEnv });
    expect(resolved).toEqual({ apiKey: 'sk_test_flag', source: 'flag' });
  });

  it('prefers env over file', async () => {
    const envWithKey = { ...env, GARU_API_KEY: 'sk_test_env' };
    await saveCredentials(
      { version: 1, activeProfile: 'default', profiles: { default: { apiKey: 'sk_test_file' } } },
      envWithKey
    );

    const resolved = await resolveAuth({ env: envWithKey });
    expect(resolved).toEqual({ apiKey: 'sk_test_env', source: 'env' });
  });

  it('falls back to the active profile in the credentials file', async () => {
    await saveCredentials(
      { version: 1, activeProfile: 'default', profiles: { default: { apiKey: 'sk_test_file' } } },
      env
    );
    const resolved = await resolveAuth({ env });
    expect(resolved.source).toBe('file');
    expect(resolved.apiKey).toBe('sk_test_file');
    expect(resolved.profile).toBe('default');
  });

  it('honors --profile over the stored active profile', async () => {
    await saveCredentials(
      {
        version: 1,
        activeProfile: 'default',
        profiles: {
          default: { apiKey: 'sk_test_default' },
          work: { apiKey: 'sk_test_work' }
        }
      },
      env
    );
    const resolved = await resolveAuth({ profile: 'work', env });
    expect(resolved.apiKey).toBe('sk_test_work');
    expect(resolved.profile).toBe('work');
  });

  it('throws CliError(auth_error) with the SPEC-mandated message when no key is present', async () => {
    try {
      await resolveAuth({ env });
      throw new Error('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(CliError);
      expect((err as CliError).code).toBe('auth_error');
      expect((err as CliError).message).toContain('garu login');
    }
  });
});

describe('resolveAuthOptional', () => {
  it('returns null instead of throwing on missing credentials', async () => {
    const resolved = await resolveAuthOptional({ env });
    expect(resolved).toBeNull();
  });

  it('returns the resolved auth when available', async () => {
    const envWithKey = { ...env, GARU_API_KEY: 'sk_test_x' };
    const resolved = await resolveAuthOptional({ env: envWithKey });
    expect(resolved?.apiKey).toBe('sk_test_x');
    expect(resolved?.source).toBe('env');
  });
});

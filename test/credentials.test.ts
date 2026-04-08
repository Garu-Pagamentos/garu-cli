import { mkdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  credentialsFileMode,
  credentialsPath,
  deleteCredentials,
  loadCredentials,
  saveCredentials,
  upsertProfile
} from '../src/lib/credentials.js';

let tmp: string;
let env: NodeJS.ProcessEnv;

beforeEach(async () => {
  tmp = join(tmpdir(), `garu-cli-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  await mkdir(tmp, { recursive: true });
  env = { ...process.env, GARU_CREDENTIALS_PATH: join(tmp, 'credentials.json') };
});

afterEach(async () => {
  await rm(tmp, { recursive: true, force: true });
});

describe('credentialsPath', () => {
  it('honors $GARU_CREDENTIALS_PATH override', () => {
    expect(credentialsPath({ GARU_CREDENTIALS_PATH: '/tmp/foo.json' })).toBe('/tmp/foo.json');
  });

  it('honors $XDG_CONFIG_HOME', () => {
    expect(credentialsPath({ XDG_CONFIG_HOME: '/home/alice/cfg' })).toBe(
      '/home/alice/cfg/garu/credentials.json'
    );
  });
});

describe('loadCredentials', () => {
  it('returns an empty file when credentials do not exist', async () => {
    const file = await loadCredentials(env);
    expect(file).toEqual({ version: 1, activeProfile: 'default', profiles: {} });
  });

  it('round-trips through saveCredentials', async () => {
    const saved = upsertProfile({ version: 1, activeProfile: 'default', profiles: {} }, 'live', {
      apiKey: 'sk_live_abc'
    });
    await saveCredentials(saved, env);

    const loaded = await loadCredentials(env);
    expect(loaded.activeProfile).toBe('live');
    expect(loaded.profiles.live?.apiKey).toBe('sk_live_abc');
  });

  it('writes the file with mode 0600', async () => {
    await saveCredentials(
      { version: 1, activeProfile: 'default', profiles: { default: { apiKey: 'sk_test_x' } } },
      env
    );
    const s = await stat(env.GARU_CREDENTIALS_PATH!);
    expect(s.mode & 0o777).toBe(0o600);
  });
});

describe('credentialsFileMode', () => {
  it('returns 0o600 after a fresh save', async () => {
    await saveCredentials(
      { version: 1, activeProfile: 'default', profiles: { default: { apiKey: 'sk_test_x' } } },
      env
    );
    expect(await credentialsFileMode(env)).toBe(0o600);
  });

  it('returns null when the file does not exist', async () => {
    expect(await credentialsFileMode(env)).toBeNull();
  });
});

describe('deleteCredentials', () => {
  it('removes the file', async () => {
    await saveCredentials(
      { version: 1, activeProfile: 'default', profiles: { default: { apiKey: 'sk_test_x' } } },
      env
    );
    await deleteCredentials(env);
    expect(await credentialsFileMode(env)).toBeNull();
  });

  it('is a no-op when the file does not exist', async () => {
    await expect(deleteCredentials(env)).resolves.toBeUndefined();
  });
});

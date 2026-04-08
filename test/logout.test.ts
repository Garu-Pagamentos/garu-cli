import { mkdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { logoutCommand } from '../src/commands/logout.js';
import { loadCredentials, saveCredentials } from '../src/lib/credentials.js';
import { CliError } from '../src/lib/errors.js';

let tmp: string;
let envPath: string;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let stderrSpy: any;

beforeEach(async () => {
  tmp = join(tmpdir(), `garu-cli-logout-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  await mkdir(tmp, { recursive: true });
  envPath = join(tmp, 'credentials.json');
  process.env.GARU_CREDENTIALS_PATH = envPath;
  stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
});

afterEach(async () => {
  delete process.env.GARU_CREDENTIALS_PATH;
  stderrSpy.mockRestore();
  await rm(tmp, { recursive: true, force: true });
});

describe('logoutCommand without --profile', () => {
  it('deletes the whole credentials file', async () => {
    await saveCredentials({
      version: 1,
      activeProfile: 'default',
      profiles: { default: { apiKey: 'sk_test_x' } }
    });

    await logoutCommand({ mode: 'json' });

    await expect(stat(envPath)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('is a no-op when no file exists', async () => {
    await expect(logoutCommand({ mode: 'json' })).resolves.toEqual({ cleared: 'all' });
  });
});

describe('logoutCommand with --profile', () => {
  it('removes one profile while keeping the rest intact', async () => {
    await saveCredentials({
      version: 1,
      activeProfile: 'default',
      profiles: {
        default: { apiKey: 'sk_test_default' },
        work: { apiKey: 'sk_test_work' }
      }
    });

    await logoutCommand({ profile: 'work', mode: 'json' });

    const file = await loadCredentials();
    expect(file.profiles.work).toBeUndefined();
    expect(file.profiles.default?.apiKey).toBe('sk_test_default');
    expect(file.activeProfile).toBe('default');
  });

  it('picks a remaining profile as active when the active one is removed', async () => {
    await saveCredentials({
      version: 1,
      activeProfile: 'work',
      profiles: {
        default: { apiKey: 'sk_test_default' },
        work: { apiKey: 'sk_test_work' }
      }
    });

    await logoutCommand({ profile: 'work', mode: 'json' });

    const file = await loadCredentials();
    expect(file.activeProfile).toBe('default');
  });

  it('deletes the whole file when removing the last profile', async () => {
    await saveCredentials({
      version: 1,
      activeProfile: 'default',
      profiles: { default: { apiKey: 'sk_test_x' } }
    });

    await logoutCommand({ profile: 'default', mode: 'json' });

    await expect(stat(envPath)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('throws CliError(not_found) when the profile does not exist', async () => {
    await saveCredentials({
      version: 1,
      activeProfile: 'default',
      profiles: { default: { apiKey: 'sk_test_x' } }
    });

    await expect(logoutCommand({ profile: 'nope', mode: 'json' })).rejects.toBeInstanceOf(CliError);
  });
});

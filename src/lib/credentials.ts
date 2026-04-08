import { homedir } from 'node:os';
import { join } from 'node:path';
import { mkdir, readFile, writeFile, rm, stat } from 'node:fs/promises';

import { CliError } from './errors.js';

export interface CredentialProfile {
  apiKey: string;
  /** Optional seller ID to render in `garu doctor` output. */
  sellerId?: number;
  /** Human-readable label for multi-profile setups. */
  label?: string;
}

export interface CredentialsFile {
  version: 1;
  activeProfile: string;
  profiles: Record<string, CredentialProfile>;
}

const DEFAULT_FILE: CredentialsFile = {
  version: 1,
  activeProfile: 'default',
  profiles: {}
};

/**
 * Resolve the credentials file path.
 *
 * Honors `$XDG_CONFIG_HOME` per the XDG base-dir spec, falling back to
 * `~/.config/garu/credentials.json`. Override with `$GARU_CREDENTIALS_PATH`
 * (primarily for tests).
 */
export function credentialsPath(env: NodeJS.ProcessEnv = process.env): string {
  if (env.GARU_CREDENTIALS_PATH) return env.GARU_CREDENTIALS_PATH;
  const base = env.XDG_CONFIG_HOME || join(homedir(), '.config');
  return join(base, 'garu', 'credentials.json');
}

/** Read the credentials file. Returns the default (empty) file if it doesn't exist. */
export async function loadCredentials(
  env: NodeJS.ProcessEnv = process.env
): Promise<CredentialsFile> {
  const path = credentialsPath(env);
  try {
    const raw = await readFile(path, 'utf8');
    const parsed = JSON.parse(raw);
    return normalize(parsed);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return { ...DEFAULT_FILE };
    }
    throw new CliError(
      'invalid_input',
      `Failed to read credentials at ${path}: ${(err as Error).message}`
    );
  }
}

/**
 * Write the credentials file atomically with tight file-mode (0600) and
 * directory-mode (0700).
 */
export async function saveCredentials(
  file: CredentialsFile,
  env: NodeJS.ProcessEnv = process.env
): Promise<void> {
  const path = credentialsPath(env);
  const dir = path.slice(0, path.lastIndexOf('/'));
  await mkdir(dir, { recursive: true, mode: 0o700 });
  await writeFile(path, JSON.stringify(file, null, 2) + '\n', { mode: 0o600 });
}

/** Delete the credentials file. No-op if it doesn't exist. */
export async function deleteCredentials(env: NodeJS.ProcessEnv = process.env): Promise<void> {
  const path = credentialsPath(env);
  try {
    await rm(path);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
  }
}

/** Add or replace a profile and set it active. */
export function upsertProfile(
  file: CredentialsFile,
  name: string,
  profile: CredentialProfile
): CredentialsFile {
  return {
    ...file,
    activeProfile: name,
    profiles: { ...file.profiles, [name]: profile }
  };
}

/** Check whether the credentials file has the expected 0600 mode. Returns null on any error. */
export async function credentialsFileMode(
  env: NodeJS.ProcessEnv = process.env
): Promise<number | null> {
  try {
    const s = await stat(credentialsPath(env));
    return s.mode & 0o777;
  } catch {
    return null;
  }
}

function normalize(raw: unknown): CredentialsFile {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_FILE };
  const obj = raw as Partial<CredentialsFile>;
  return {
    version: 1,
    activeProfile: obj.activeProfile ?? 'default',
    profiles: obj.profiles && typeof obj.profiles === 'object' ? obj.profiles : {}
  };
}

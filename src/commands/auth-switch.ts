import { loadCredentials, saveCredentials } from '../lib/credentials.js';
import { CliError } from '../lib/errors.js';
import { printSuccess, type OutputOptions } from '../lib/output.js';

export interface AuthSwitchOptions extends OutputOptions {
  profile: string;
}

export async function authSwitchCommand(
  opts: AuthSwitchOptions
): Promise<{ activeProfile: string }> {
  const file = await loadCredentials();
  if (!file.profiles[opts.profile]) {
    const available = Object.keys(file.profiles).join(', ') || '(none)';
    throw new CliError('not_found', `Profile '${opts.profile}' not found. Available: ${available}`);
  }

  await saveCredentials({ ...file, activeProfile: opts.profile });
  printSuccess(`Active profile set to '${opts.profile}'.`, opts);
  return { activeProfile: opts.profile };
}

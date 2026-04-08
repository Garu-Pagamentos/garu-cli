import { deleteCredentials, loadCredentials, saveCredentials } from '../lib/credentials.js';
import { CliError } from '../lib/errors.js';
import { printSuccess, type OutputOptions } from '../lib/output.js';

export interface LogoutOptions extends OutputOptions {
  /**
   * Profile to remove. If omitted, the entire credentials file is deleted.
   */
  profile?: string;
}

export async function logoutCommand(opts: LogoutOptions = {}): Promise<{ cleared: string }> {
  if (!opts.profile) {
    await deleteCredentials();
    printSuccess('All saved credentials deleted.', opts);
    return { cleared: 'all' };
  }

  const file = await loadCredentials();
  if (!file.profiles[opts.profile]) {
    throw new CliError('not_found', `Profile '${opts.profile}' not found.`);
  }

  const { [opts.profile]: _removed, ...rest } = file.profiles;
  void _removed;

  const nextActive =
    file.activeProfile === opts.profile ? (Object.keys(rest)[0] ?? 'default') : file.activeProfile;

  await saveCredentials({ ...file, activeProfile: nextActive, profiles: rest });
  printSuccess(`Profile '${opts.profile}' removed.`, opts);
  return { cleared: opts.profile };
}

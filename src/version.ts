/**
 * CLI version.
 *
 * Kept as a plain string so `bun build --compile` can inline it at compile time
 * and the resulting binary has no runtime dependency on `package.json`.
 * The release workflow bumps this in lockstep with `package.json` on `v*` tags.
 */
export const CLI_VERSION = '0.1.2';

#!/usr/bin/env node

/**
 * Fail the release if `src/version.ts:CLI_VERSION` does not match
 * `package.json:version`. Catches the v0.4.1 incident where the package
 * was published but `garu --version` reported the previous string.
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
const versionTs = readFileSync(resolve(root, 'src/version.ts'), 'utf8');

const match = versionTs.match(/CLI_VERSION\s*=\s*['"]([^'"]+)['"]/);
if (!match) {
  console.error('check-version-sync: could not find CLI_VERSION in src/version.ts');
  process.exit(1);
}

if (match[1] !== pkg.version) {
  console.error(
    `check-version-sync: src/version.ts CLI_VERSION='${match[1]}' does not match package.json version='${pkg.version}'`
  );
  process.exit(1);
}

console.log(`check-version-sync: ok (${pkg.version})`);

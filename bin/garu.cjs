#!/usr/bin/env node
// Thin shim for `npm i -g @garuhq/cli` installs.
// The real CLI lives in `../dist/index.cjs`, produced by `npm run build`.
require('../dist/index.cjs');

# Changelog

All notable changes to `@garuhq/cli` are documented in this file. Format:
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versioning: [SemVer](https://semver.org/).

## [0.1.2] — 2026-04-08

Post-review batch — addresses all findings from an internal code review.

### Security

- **`install.sh` now verifies binaries against `SHA256SUMS.txt`.** The installer
  downloads the checksum file from the same release, grep's the expected hash
  for the target asset, and fails the install if the binary has been tampered
  with. Supports both `sha256sum` (Linux) and `shasum -a 256` (macOS).
- **Credentials file path now uses `node:path`'s `dirname`** instead of a
  `lastIndexOf('/')` slice, fixing `garu login` on Windows (`npm i -g @garuhq/cli`).
- Upgrade dev dependencies to clear `npm audit` findings:
  - `vitest` 1.5.0 → 4.1.3 (closes critical vitest RCE advisory)
  - `tsup` 8.0.2 → 8.5.1, `tsx` 4.7.2 → 4.21.0
  - `@inquirer/prompts` 5.0.2 → 8.4.1 (clears the `tmp` symlink chain)

### Fixed

- **`garu login` no longer claims to validate the API key.** The prompt now
  says "Checking connectivity to Garu..." instead of "Validating key with
  Garu..." — a key that passes the `sk_(live|test)_...` regex will still be
  saved even if the backend would reject it. A real authenticated probe lands
  once the backend exposes `GET /api/v1/me`.
- **`garu logout --profile <name>` now deletes the credentials file** when the
  removed profile was the last one, instead of leaving an orphaned
  `activeProfile` pointing at nothing.
- **SDK errors are now classified via `instanceof GaruError`** instead of
  `.name.startsWith('Garu')` duck-typing.

### Changed

- Removed non-null assertions on credit-card fields in `charges create`;
  replaced with a type-guard assertion so the TypeScript narrowing is
  compile-time enforced.
- Collapsed `globalsToOutput` + `globalFlagsToCommandOptions` into one
  `toCommandOptions` helper. `src/index.ts` is ~25 lines shorter.
- Removed unused `cliUserAgent()` dead code from `src/lib/client.ts`.

### Infrastructure

- **All third-party GitHub Actions are now SHA-pinned** in both `ci.yml` and
  `release.yml`: `actions/checkout`, `actions/setup-node`,
  `actions/upload-artifact`, `actions/download-artifact`, `oven-sh/setup-bun`,
  `ludeeus/action-shellcheck`. Human-readable version as trailing comment.
- **Release workflow asserts `package.json .version == $TAG_NAME`** before
  publishing to npm. Mismatched tags fail fast with a clear error instead of
  hitting `npm publish` with a stale version.

### Tests

- Added 6 new tests for `logoutCommand` covering: removing the last profile
  deletes the file, removing a non-active profile preserves the active one,
  removing the active profile elects a remaining profile, and the not-found
  error path.
- Total: 42 tests across 6 files (previously 36 across 5).

## [0.1.1] — 2026-04-08

### Fixed

- Compiled binaries (produced by `bun build --compile`) now run correctly when
  distributed under names like `garu-darwin-arm64` before being renamed by the
  installer. v0.1.0 had an entry-point guard that only matched filenames ending
  in `garu`/`garu.cjs`, so the downloaded binary was a no-op until renamed.
- The npm package `0.1.0` is not affected because the `bin/garu.cjs` wrapper
  always matched the guard. 0.1.0 remains published; 0.1.1 is the first release
  where both `curl | bash` and `npm install -g` ship a working CLI.

## [0.1.0] — 2026-04-08

### Added

- Initial public beta. Single-binary CLI for the Garu payment gateway.
- **`garu login`** — interactive paste-and-validate flow. Hits `/api/meta` to confirm reachability, stores the key at `~/.config/garu/credentials.json` with mode `0600` (directory `0700`). Honors `$XDG_CONFIG_HOME`.
- **`garu logout`** — remove one profile or the entire credentials file.
- **`garu auth switch <profile>`** — toggle the active credentials profile.
- **`garu charges create`** — PIX, credit card, or boleto. Full flag set including `--idempotency-key`.
- **`garu charges get <id>`** — fetch a single charge.
- **`garu charges refund <id>`** — full or partial (`--amount`, `--reason`).
- **`garu doctor`** — environment diagnostic: CLI version, API reachability, credentials source and file mode, installed agents (Claude Code, Cursor, Codex, Windsurf, Claude Desktop, VS Code MCP).
- **Auth priority chain** per SPEC §7: `--api-key` > `GARU_API_KEY` > credentials file active profile.
- **Output modes:** TTY-aware pretty output vs strict JSON on pipe or `--json`. Errors as `{"error":{"code","message"}}` on stdout + exit 1 in JSON mode; red `Error:` line on stderr in pretty mode.
- **Global flags:** `--api-key`, `-p/--profile`, `--json`, `-q/--quiet`.
- Dogfoods the official SDK: every HTTP call flows through `@garuhq/node@0.1.0`.
- Two install channels at launch: **npm** (`npm install -g @garuhq/cli`) and **`curl | bash`** (`install.sh` served from GitHub raw).
- Prebuilt binaries for `linux-x64`, `darwin-arm64`, `darwin-x64` via `bun build --compile` in the release workflow.
- GitHub Actions CI runs typecheck, tests, and build on Node 18 / 20 / 22, plus shellcheck on `install.sh`.

### Known limitations

- **`garu charges list`** intentionally omitted — the backend does not yet expose `GET /api/transactions`. Will land when the backend grows a seller-scoped list endpoint.
- **Windows binary** not yet shipped — `bun --target=windows-x64` is still beta. Windows users can `npm install -g @garuhq/cli` in the meantime.
- **Homebrew tap** not yet published — use `curl | bash` or `npm` in v0.1.
- **`garu.com.br/install.sh`** pretty URL not yet live — README advertises the GitHub raw URL until the marketing site (SPEC W1) ships.
- **`garu mcp install <tool>`** depends on the MCP server (SPEC W4) which has not shipped yet.
- **`customers`, `products`, `subscriptions`, `webhooks`, `keys`** command groups not included in v0.1 per SPEC Phase 1 scope.
- **Browser-based OAuth** deferred; v0.1 uses paste-and-validate like Stripe CLI.

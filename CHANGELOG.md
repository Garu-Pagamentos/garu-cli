# Changelog

All notable changes to `@garuhq/cli` are documented in this file. Format:
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versioning: [SemVer](https://semver.org/).

## [0.5.0] — 2026-05-19

### Added

- `garu webhooks events resend <id>` — audit-trail-preserving replay
  of a webhook event. Unlike `retry`, this does **not** mutate the
  original row: the gateway inserts a fresh event with its own
  numeric id that points back at the source via `manualResendOf`,
  then dispatches that clone. The original failure record (response
  status, response body, attempts, timestamps) stays intact.
  - In pretty mode the CLI prints `✓ Resent event <src> → new event
    <clone>` to stderr so the new id is impossible to miss; the
    cloned event itself is rendered on stdout with a new `resendOf:`
    line.
  - In JSON mode the cloned event is the full stdout payload —
    `.id` is the new event, `.manualResendOf` is the source.
  - Recipient handlers will see this as a distinct delivery: the
    gateway POSTs the clone with `Idempotency-Key:
    resend_<originalId>`.

### Deprecated

- `garu webhooks events retry <id>` — kept for backwards
  compatibility but now marked `[deprecated: prefer resend]` in
  `--help`. `retry` resets the original row in place, which means
  once the replay succeeds the historical record of the prior
  failure is gone. For incident response, support workflows, and
  any backfill where the audit trail matters, use `resend` instead.

### Changed

- `@garuhq/node` SDK bumped to 0.12.0 for the new
  `webhookEvents.resend()` method and the `manualResendOf` field on
  `WebhookEvent`.

## [0.4.2] — 2026-05-19

### Fixed

- **Error codes**: HTTP 403 responses (valid key, not your resource —
  e.g. retrying a webhook event that belongs to another seller) were
  previously surfaced as `auth_error`, which read like "your key is
  bad". They now surface as `permission_error`. `auth_error` is now
  reserved for HTTP 401 (bad/missing key).
- **`garu --version`** correctly reports `0.4.2`. The `0.4.1` release
  shipped with `src/version.ts:CLI_VERSION` still pinned to `'0.4.0'`
  because that file was missed during the bump. A new `scripts/
  check-version-sync.mjs` runs as part of `prepublishOnly` and fails
  the build if `package.json:version` and `src/version.ts:CLI_VERSION`
  drift apart.

### Changed

- **Error output**: `printErrorAndExit` now includes `status` and
  `body` from `GaruAPIError`-derived failures.
  - In `--json` mode, the payload gains optional `status` and `body`
    fields: `{"error":{"code","message","status","body"}}`. Allows
    self-diagnosis of 4xx responses without dropping to `curl`.
  - In pretty mode, the HTTP status is shown as a dimmed line below
    the existing `code:` line.

## [0.4.1] — 2026-05-19

### Fixed

- Bump `@garuhq/node` to `0.11.1` to pick up the empty-body POST fix.
  `garu webhooks events retry <id>` and `garu scheduled-charges resume <id>`
  were failing against production with `Body cannot be empty when content-type
  is set to 'application/json'`. The SDK now sends an explicit `{}` body on
  every otherwise-empty mutation.

## [0.4.0] — 2026-05-19

### Added

- `garu webhooks events` command tree — inspect and replay webhook
  deliveries from the CLI. The dashboard "Reenviar" button is now
  available from the API key auth path as well, which means support
  + on-call workflows can resend events from a terminal instead of
  having to log into the dashboard.
  - `garu webhooks events list [--status <s>] [--event-type <t>] [--endpoint-id <n>] [--page <n>] [--limit <n>]`
    — paginated listing with status badges (green `success`, yellow
    `pending`, red `failed`) in TTY mode.
  - `garu webhooks events get <id>` — fetch one webhook event with
    the full endpoint snapshot, response status, and (truncated)
    response body.
  - `garu webhooks events retry <id>` — re-deliver a webhook event
    (resets to `pending` and triggers an immediate attempt). Works on
    any status; use this when a customer reports a missed event.

### Changed

- `@garuhq/node` SDK bumped to 0.11.0 for the new `webhookEvents`
  resource and its response-shape normalization fix.

## [0.3.0] — 2026-04-28

Rolls up the unpublished 0.2.0 work plus a new update notifier into a single
release.

### Added

- `charges list` command — paginated listing of the authenticated seller's
  charges with status, search, and payment-method filters. (Originally
  shipped to git as 0.2.0 but never published to npm.)
- Startup version-update notifier. The CLI now checks the npm registry once
  every 24h (in a detached background process) and prints a banner at process
  exit when a newer `@garuhq/cli` is available, suggesting how to update.
  Silent on offline / network failures.

### Changed

- `@garuhq/node` SDK bumped to 0.2.0 (also from the unpublished 0.2.0 batch).

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

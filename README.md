# garu-cli

Official command-line interface for the [Garu](https://garu.com.br) payment gateway.

```
$ garu charges create --type pix --product-id prod-uuid \
    --customer-name "Maria Silva" \
    --customer-email maria@exemplo.com.br \
    --customer-document 12345678909 \
    --customer-phone 11987654321
Charge 4472
  status:  pending
  amount:  4990
  method:  pix
  date:    2026-04-08T18:30:00.000Z
```

## Install

```bash
# curl | bash (Linux, macOS)
curl -fsSL https://raw.githubusercontent.com/Garu-Pagamentos/garu-cli/main/install.sh | bash

# npm (all platforms, including Windows)
npm install -g @garuhq/cli
```

> The pretty URL `curl -fsSL https://garu.com.br/install.sh | bash` is coming —
> waiting on the marketing site rebuild (SPEC W1). Use the GitHub raw URL for now.

Verify the install:

```bash
garu doctor
```

## Authentication

The CLI resolves your API key from the first of:

1. `--api-key <key>` flag
2. `GARU_API_KEY` environment variable
3. `~/.config/garu/credentials.json` (created by `garu login`, mode `0600`)

### Interactive

```bash
$ garu login
? Paste your Garu API key (sk_live_... or sk_test_...) ****************
→ Validating key with Garu...
✓ Saved profile 'default' to ~/.config/garu/credentials.json
```

### Scripted (CI)

```bash
export GARU_API_KEY=sk_live_...
garu charges create --type pix ...
```

### Multi-profile

```bash
garu login --profile test --api-key sk_test_...
garu login --profile live --api-key sk_live_...
garu auth switch live
```

## Commands

| Command                          | Description                                 |
| -------------------------------- | ------------------------------------------- |
| `garu login`                     | Paste an API key, validate, save            |
| `garu logout [--profile <name>]` | Remove saved credentials                    |
| `garu auth switch <profile>`     | Set the active credentials profile          |
| `garu charges create`            | Create a PIX, credit-card, or boleto charge |
| `garu charges get <id>`          | Fetch a single charge                       |
| `garu charges refund <id>`       | Refund a charge (full or partial)           |
| `garu doctor`                    | Environment diagnostic                      |
| `garu --version`                 | Print the CLI version                       |
| `garu --help`                    | Top-level help                              |

See `garu <command> --help` for per-command flags.

## Output modes

The CLI auto-detects whether it's running interactively:

- **TTY (pretty):** colored output, status lines on stderr, formatted result on stdout.
- **Pipe / CI / `--json`:** strict JSON on stdout, errors as `{"error":{"code","message"}}` on stdout with exit code 1. Nothing on stderr in this mode.

```bash
# Pipe-safe
garu charges get 4472 | jq '.status'
```

Global flags:

- `--api-key <key>` — override auth chain
- `-p, --profile <name>` — use a specific credentials profile
- `--json` — force JSON output
- `-q, --quiet` — suppress status lines

## `garu doctor`

Prints a structured report of your environment:

```json
{
  "cli": { "version": "0.1.0" },
  "api": { "reachable": true, "url": "https://garu.com.br", "version": "1.3.2" },
  "credentials": { "path": "...", "source": "file", "profile": "default", "fileMode": "0600" },
  "agents": {
    "claudeCode": true,
    "cursor": true,
    "codex": false,
    "windsurf": false,
    "claudeDesktop": true,
    "vscodeMcpInCwd": false
  }
}
```

## Security

See [SECURITY.md](SECURITY.md) for our vulnerability disclosure policy.

> **Note on credit card flags:** The `--card-number`, `--card-cvv`, and `--card-expiration` flags pass data via command-line arguments, which may be visible in shell history and process listings. For production card processing, use the [`@garuhq/node`](https://www.npmjs.com/package/@garuhq/node) SDK directly or pass the API key via the `GARU_API_KEY` environment variable rather than `--api-key`.

## License

MIT.

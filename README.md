# Garu CLI

The official CLI for [Garu](https://garu.com.br), the Brazilian payment gateway.

Built for developers, AI agents, and CI/CD pipelines.

```
 ██████╗  █████╗ ██████╗ ██╗   ██╗
██╔════╝ ██╔══██╗██╔══██╗██║   ██║
██║  ███╗███████║██████╔╝██║   ██║
██║   ██║██╔══██║██╔══██╗██║   ██║
╚██████╔╝██║  ██║██║  ██║╚██████╔╝
 ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝
```

## Install

### cURL (Linux, macOS)

```sh
curl -fsSL https://raw.githubusercontent.com/Garu-Pagamentos/garu-cli/main/install.sh | bash
```

### Node.js (all platforms)

```sh
npm install -g @garuhq/cli
```

Verify the install:

```bash
garu doctor
```

## Quickstart

```bash
# Authenticate
garu login

# Create a PIX charge
garu charges create --type pix --product-id prod-uuid \
  --customer-name "Maria Silva" \
  --customer-email maria@exemplo.com.br \
  --customer-document 12345678909 \
  --customer-phone 11987654321

# List recent charges
garu charges list

# Check your environment
garu doctor
```

---

## Authentication

The CLI resolves your API key using the following priority chain:

| Priority    | Source                   | How to set                              |
| ----------- | ------------------------ | --------------------------------------- |
| 1 (highest) | `--api-key` flag         | `garu --api-key sk_live_... charges list` |
| 2           | `GARU_API_KEY` env var   | `export GARU_API_KEY=sk_live_...`       |
| 3 (lowest)  | Config file              | `garu login`                            |

If no key is found from any source, the CLI errors with code `auth_error`.

### Interactive mode (default in terminals)

```bash
$ garu login
? Paste your Garu API key (sk_live_... or sk_test_...) ****************
-> Validating key with Garu...
Saved profile 'default' to ~/.config/garu/credentials.json
```

### Non-interactive mode (CI, pipes, scripts)

```bash
export GARU_API_KEY=sk_live_...
garu charges create --type pix ...
```

### Multi-profile

Switch between test and production without logging in and out:

```bash
garu login --profile test --api-key sk_test_...
garu login --profile live --api-key sk_live_...
garu auth switch live
```

You can also use the global `--profile` (or `-p`) flag on any command:

```bash
garu charges list --profile production
```

---

## Commands

### `garu login`

Authenticate by storing your API key locally. The key is validated against the Garu API before being saved.

```bash
garu login
garu login --api-key sk_live_... --profile production
```

| Flag                   | Description                              |
| ---------------------- | ---------------------------------------- |
| `--api-key <key>`      | Pre-supply the key instead of prompting  |
| `-p, --profile <name>` | Profile name to store under (default: `default`) |

On success, credentials are saved to `~/.config/garu/credentials.json` with `0600` permissions (owner read/write only).

---

### `garu logout`

Remove saved credentials.

```bash
garu logout
garu logout --profile test
```

| Flag                   | Description                                          |
| ---------------------- | ---------------------------------------------------- |
| `-p, --profile <name>` | Only remove this profile instead of the whole file   |

---

### `garu auth switch`

Set the active credentials profile.

```bash
garu auth switch live
```

---

### `garu charges list`

List charges with pagination and filters.

```bash
garu charges list
garu charges list --status paid --limit 50
garu charges list --search "Maria" --payment-method pix
```

| Flag                        | Description                                    |
| --------------------------- | ---------------------------------------------- |
| `--page <n>`                | Page number (1-based)                          |
| `--limit <n>`               | Items per page (1-100)                         |
| `--status <status>`         | Filter by status (e.g. `paid`, `pending`)      |
| `--search <query>`          | Search by customer name, email, or document    |
| `--payment-method <method>` | Filter: `pix`, `creditcard`, `boleto`          |

---

### `garu charges create`

Create a PIX, credit card, or boleto charge.

```bash
# PIX charge
garu charges create --type pix --product-id prod-uuid \
  --customer-name "Maria Silva" \
  --customer-email maria@exemplo.com.br \
  --customer-document 12345678909 \
  --customer-phone 11987654321

# Credit card charge
garu charges create --type credit_card --product-id prod-uuid \
  --customer-name "Maria Silva" \
  --customer-email maria@exemplo.com.br \
  --customer-document 12345678909 \
  --customer-phone 11987654321 \
  --card-number 4111111111111111 \
  --card-cvv 123 \
  --card-expiration 2030-12 \
  --card-holder "MARIA SILVA" \
  --installments 3
```

| Flag                             | Required | Description                                |
| -------------------------------- | -------- | ------------------------------------------ |
| `--type <type>`                  | Yes      | Payment method: `pix`, `credit_card`, `boleto` |
| `--product-id <uuid>`           | Yes      | Product UUID                               |
| `--customer-name <name>`        | Yes      | Customer full name                         |
| `--customer-email <email>`      | Yes      | Customer email                             |
| `--customer-document <doc>`     | Yes      | CPF (11 digits) or CNPJ (14 digits)       |
| `--customer-phone <phone>`      | Yes      | Phone with area code, digits only          |
| `--card-number <number>`        | credit_card | Credit card number                      |
| `--card-cvv <cvv>`              | credit_card | Credit card CVV                         |
| `--card-expiration <yyyy-mm>`   | credit_card | Expiration date                         |
| `--card-holder <name>`          | credit_card | Cardholder name                         |
| `--installments <n>`            | No       | Number of installments, 1-12 (default: 1)  |
| `--additional-info <text>`      | No       | Free-form metadata                         |
| `--idempotency-key <key>`       | No       | Idempotency key (auto-generated if omitted) |

---

### `garu charges get`

Fetch a single charge by ID.

```bash
garu charges get 4472
garu charges get 4472 --json | jq '.status'
```

---

### `garu charges refund`

Refund a charge (full or partial).

```bash
# Full refund
garu charges refund 4472

# Partial refund (1000 centavos = R$10.00)
garu charges refund 4472 --amount 1000 --reason "customer_request"
```

| Flag                      | Description                                   |
| ------------------------- | --------------------------------------------- |
| `--amount <centavos>`     | Partial refund amount in centavos (omit for full) |
| `--reason <text>`         | Optional refund reason                        |
| `--idempotency-key <key>` | Idempotency key (auto-generated if omitted)   |

---

### `garu doctor`

Run environment diagnostics. Verifies your CLI version, API connectivity, credentials, and detects AI agent integrations.

```bash
garu doctor
```

```json
{
  "cli": { "version": "0.2.0" },
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

---

## Global options

These flags work on every command:

```bash
garu [global options] <command> [command options]
```

| Flag                   | Description                                                  |
| ---------------------- | ------------------------------------------------------------ |
| `--api-key <key>`      | Override API key for this invocation (takes highest priority) |
| `-p, --profile <name>` | Credentials profile to use                                   |
| `--json`               | Force JSON output even in interactive terminals               |
| `-q, --quiet`          | Suppress status output; only print results and errors         |
| `-v, --version`        | Print version and exit                                        |
| `--help`               | Show help text                                                |

---

## Output behavior

The CLI has two output modes:

| Mode            | When                   | Stdout         | Stderr           |
| --------------- | ---------------------- | -------------- | ---------------- |
| **Interactive** | Terminal (TTY)         | Formatted text | Status lines     |
| **Machine**     | Piped, CI, or `--json` | JSON           | Nothing          |

Switching is automatic -- pipe to another command and JSON output activates:

```bash
garu charges get 4472 | jq '.status'
garu charges list --status paid | jq '.data[].id'
```

### Error output

Errors exit with code `1` and output structured JSON to stdout:

```json
{ "error": { "code": "auth_error", "message": "No API key found" } }
```

---

## Agent & CI/CD usage

### CI/CD

Set `GARU_API_KEY` as an environment variable -- no `garu login` needed:

```yaml
# GitHub Actions
env:
  GARU_API_KEY: ${{ secrets.GARU_API_KEY }}
steps:
  - run: garu charges list --status pending --json
```

### AI agents

Agents calling the CLI as a subprocess automatically get JSON output (non-TTY detection). The contract:

- **Input:** All required flags must be provided (no interactive prompts)
- **Output:** JSON to stdout, nothing to stderr
- **Exit code:** `0` success, `1` error
- **Errors:** Always include `code` and `message` fields

---

## Configuration

| Item              | Path                              | Notes                                     |
| ----------------- | --------------------------------- | ----------------------------------------- |
| Config directory  | `~/.config/garu/`                 | Respects `$XDG_CONFIG_HOME`               |
| Credentials       | `~/.config/garu/credentials.json` | `0600` permissions (owner read/write)     |
| Override path     | `$GARU_CREDENTIALS_PATH`         | Point to a custom credentials file        |

---

## Security

See [SECURITY.md](SECURITY.md) for our vulnerability disclosure policy.

> **Note on credit card flags:** The `--card-number`, `--card-cvv`, and `--card-expiration` flags pass data via command-line arguments, which may be visible in shell history and process listings. For production card processing, use the [`@garuhq/node`](https://www.npmjs.com/package/@garuhq/node) SDK directly.

## License

MIT

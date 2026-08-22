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

| Priority    | Source                 | How to set                                |
| ----------- | ---------------------- | ----------------------------------------- |
| 1 (highest) | `--api-key` flag       | `garu --api-key sk_live_... charges list` |
| 2           | `GARU_API_KEY` env var | `export GARU_API_KEY=sk_live_...`         |
| 3 (lowest)  | Config file            | `garu login`                              |

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

| Flag                   | Description                                      |
| ---------------------- | ------------------------------------------------ |
| `--api-key <key>`      | Pre-supply the key instead of prompting          |
| `-p, --profile <name>` | Profile name to store under (default: `default`) |

On success, credentials are saved to `~/.config/garu/credentials.json` with `0600` permissions (owner read/write only).

---

### `garu logout`

Remove saved credentials.

```bash
garu logout
garu logout --profile test
```

| Flag                   | Description                                        |
| ---------------------- | -------------------------------------------------- |
| `-p, --profile <name>` | Only remove this profile instead of the whole file |

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

| Flag                        | Description                                                                                                                    |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `--page <n>`                | Page number (1-based)                                                                                                          |
| `--limit <n>`               | Items per page (1-100)                                                                                                         |
| `--status <status>`         | Filter by status: `pending`, `authorized`, `paid`, `failed`, `expired`, `canceled`, `refund_pending`, `refunded`, `chargeback` |
| `--search <query>`          | Search by customer name, email, or document                                                                                    |
| `--payment-method <method>` | Filter: `pix`, `credit_card`, `boleto`                                                                                         |

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

| Flag                          | Required    | Description                                    |
| ----------------------------- | ----------- | ---------------------------------------------- |
| `--type <type>`               | Yes         | Payment method: `pix`, `credit_card`, `boleto` |
| `--product-id <uuid>`         | Yes         | Product UUID                                   |
| `--customer-name <name>`      | Yes         | Customer full name                             |
| `--customer-email <email>`    | Yes         | Customer email                                 |
| `--customer-document <doc>`   | Yes         | CPF (11 digits) or CNPJ (14 digits)            |
| `--customer-phone <phone>`    | Yes         | Phone with area code, digits only              |
| `--card-number <number>`      | credit_card | Credit card number                             |
| `--card-cvv <cvv>`            | credit_card | Credit card CVV                                |
| `--card-expiration <yyyy-mm>` | credit_card | Expiration date                                |
| `--card-holder <name>`        | credit_card | Cardholder name                                |
| `--installments <n>`          | No          | Number of installments, 1-12 (default: 1)      |
| `--additional-info <text>`    | No          | Free-form metadata                             |
| `--idempotency-key <key>`     | No          | Idempotency key (auto-generated if omitted)    |

---

### `garu charges get`

Fetch a single charge by its uuid.

```bash
garu charges get 6f1c9b2e-4a7d-4f0b-9a3e-1d2c3b4a5e6f
garu charges get 6f1c9b2e-4a7d-4f0b-9a3e-1d2c3b4a5e6f --json | jq '.status'
```

---

### `garu charges refund`

Refund a charge by its uuid (full or partial).

```bash
# Full refund
garu charges refund 6f1c9b2e-4a7d-4f0b-9a3e-1d2c3b4a5e6f

# Partial refund, in decimal BRL / reais
garu charges refund 6f1c9b2e-4a7d-4f0b-9a3e-1d2c3b4a5e6f --amount 10.00 --reason "customer_request"
```

| Flag               | Description                                                        |
| ------------------ | ------------------------------------------------------------------ |
| `--amount <reais>` | Partial refund amount in decimal BRL, e.g. `10.00` (omit for full) |
| `--reason <text>`  | Optional refund reason                                             |

---

### `garu scheduled-charges create`

Schedule a future-dated charge — one-time or recurring (PIX, Boleto, or Card).

```bash
# One-time PIX/Boleto charge
garu scheduled-charges create \
  --customer-id 42 --amount 297.50 --type one_time \
  --due-date 2026-06-15 --methods pix,boleto \
  --description "Mensalidade Junho"

# Recurring card subscription, custom recovery window
garu scheduled-charges create \
  --customer-id 42 --amount 99.00 --type recurring \
  --due-date 2026-06-15 --methods card --product-id 5 \
  --recurrence-interval monthly --recurrence-ends-after 12 \
  --max-recovery-days 30
```

| Flag                              | Description                                                               |
| --------------------------------- | ------------------------------------------------------------------------- |
| `--customer-id <n>`               | Customer id (required)                                                    |
| `--amount <brl>`                  | Decimal BRL amount, e.g. `297.50` (required)                              |
| `--type <type>`                   | `one_time` or `recurring` (required)                                      |
| `--due-date <yyyy-mm-dd>`         | First due date in São Paulo time (required)                               |
| `--methods <list>`                | Comma-separated: `pix,boleto,card` (required; `card` is recurring-only)   |
| `--product-id <n>`                | Product id (required when `methods` includes `card`)                      |
| `--description <text>`            | Charge description                                                        |
| `--recurrence-interval <i>`       | `weekly`/`biweekly`/`monthly`/`bimonthly`/`quarterly`/`biannual`/`yearly` |
| `--recurrence-interval-count <n>` | Multiplier for the interval                                               |
| `--recurrence-ends-after <n>`     | Stop after N successful cycles                                            |
| `--recurrence-ends-on <date>`     | Stop after this calendar date                                             |
| `--trial-days <n>`                | Free-trial days (1–365, recurring-only)                                   |
| `--external-reference <ref>`      | Your own reconciliation reference                                         |
| `--metadata <json>`               | JSON object of custom metadata                                            |
| `--max-recovery-days <n>`         | Days past due the recovery sweep keeps auto-billing (1–365; default 14)   |
| `--idempotency-key <key>`         | Idempotency key (auto-generated if omitted)                               |

---

### `garu scheduled-charges charge-now`

Dispatch a scheduled charge **now** — the same charge + notification the daily
cron would send on the due date — instead of waiting for `dueDate`.

```bash
garu scheduled-charges charge-now sch_abc123

# Compose in scripts: non-zero exit on a negative outcome
if garu scheduled-charges charge-now sch_abc123 --json | jq -e '.outcome=="dispatched"'; then
  echo "sent"
fi
```

**Idempotent.** If this cycle's d-day was already dispatched, the command
reports `already_sent` and does **not** re-charge. The returned `message`
(pt-BR, ready to show) is always printed; in `--json` mode the full result —
`{ outcome, cycleNumber, reason?, message }` — is written to stdout.

The process **exits non-zero** when:

- `outcome` is `failed` (card charge failed — see `reason`, e.g. `card_expired`) or
  `not_sent` (couldn't dispatch — e.g. `no_email`, `no_saved_payment_method`), and
- the gateway rejects the request with a 4xx — `400` if the charge isn't in a
  billable status (`scheduled`/`due_today`) or a recurring series has no open
  cycle, `404` if the charge isn't yours.

`dispatched` and `already_sent` exit `0`.

---

### `garu scheduled-charges` — other subcommands

| Command                                                                      | Description                                                                       |
| ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `list [--page --limit --customer-id --status --type ...]`                    | List scheduled charges (`--status` repeatable; `--due-from/--due-to`, `--search`) |
| `get <id>`                                                                   | Fetch a charge with its event timeline and linked transactions                    |
| `postpone <id> --new-due-date <date> [--reason]`                             | Move to a new due date                                                            |
| `pause <id> [--reason]` / `resume <id>`                                      | Pause (no reminders fire) / resume                                                |
| `mark-paid <id> --payment-date <date> [--external-reference --cycle-number]` | Mark paid out-of-band (`--cycle-number` required for recurring)                   |
| `cancel-recurrence <id> [--reason]`                                          | Stop future cycles of a recurring series                                          |
| `cancel-at-period-end <id> [--disable]`                                      | Toggle Stripe-style soft cancel (omit `--disable` to enable)                      |
| `change-payment-method <id> --payment-method-id <n>`                         | Swap the saved card on a recurring series                                         |
| `clear-payment-method <id>`                                                  | Clear the saved card (future cycles fall back to email-with-link)                 |
| `attempts <id> [--page --limit --cycle-number]`                              | Per-attempt billing log                                                           |

---

### `garu installment-plans create`

Sell a product as **boleto parcelado (carnê)** — a purchase split into 2–12
monthly bank slips. This is seller-financed consumer credit: nobody guarantees
a boleto, so Garu never advances funds and carries none of the default risk.
Only the first slip is registered at creation; the rest are emitted month by
month once parcela 1 compensates.

```bash
garu installment-plans create \
  --product-id 40381e8e-6ee7-4b8e-9393-766a6e2109d2 \
  --customer-id 4821 --installments 12

# Attribute the sale to an affiliate (fixed for the whole carnê) and pick
# the first due date
garu installment-plans create \
  --product-id 40381e8e-6ee7-4b8e-9393-766a6e2109d2 \
  --customer-id 4821 --installments 6 \
  --first-due-date 2026-10-05 --affiliate-id 5
```

| Flag                      | Description                                                     |
| ------------------------- | --------------------------------------------------------------- |
| `--product-id <uuid>`     | Product uuid (must have boleto parcelado enabled) — required    |
| `--customer-id <n>`       | Customer id — required                                          |
| `--installments <n>`      | 2–12 installments — required                                    |
| `--first-due-date <date>` | First installment due date (default: today)                     |
| `--affiliate-id <n>`      | Attribute the sale to this affiliate (fixed for the whole plan) |
| `--idempotency-key <key>` | Idempotency key (auto-generated if omitted)                     |

---

### `garu installment-plans` — other subcommands

| Command                                                         | Description                                                              |
| --------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `list [--page --limit --customer-id --product-id --status ...]` | List carnês (`--status` repeatable; `--due-from/--due-to`)               |
| `get <uuid>`                                                    | Fetch a carnê with every installment: due date, status, barcode and PDF  |
| `reissue <uuid> <number>`                                       | Issue a segunda via for one installment once its slip has expired        |
| `postpone <uuid> <number> --new-due-date <date>`                | Move one installment to a later date (its siblings keep theirs)          |
| `mark-paid <uuid> <number>`                                     | Record an installment as paid when the webhook never arrived             |
| `cancel <uuid> [--note]`                                        | Cancel the carnê — stops emission/reminders, cancels open provider slips |
| `request-refund <uuid> [--amount --reason]`                     | Ask for the carnê to be refunded (see `garu refund-requests` below)      |

---

### `garu refund-requests`

Garu cannot reverse a boleto, and Celcoin exposes no Pix devolução, so a
refund on either rail is a request-and-notify flow: you transfer the money
back yourself, then tell Garu it happened. Card charges keep their automated
reversal via `garu charges refund`.

```bash
# See everything you still owe a buyer
garu refund-requests list --status pending

# After you've transferred the money back
garu refund-requests confirm a1b2c3d4-e5f6-7890-abcd-ef1234567890 \
  --note "Pix devolvido em 14/08, e2e E12345678"

# Decline instead — the carnê or charge is left untouched
garu refund-requests reject a1b2c3d4-e5f6-7890-abcd-ef1234567890 \
  --note "Produto entregue e retirado na loja"
```

| Command                                                | Description                                                  |
| ------------------------------------------------------ | ------------------------------------------------------------ |
| `list [--page --limit --status --plan-id --charge-id]` | List refund requests (`--status` repeatable)                 |
| `get <uuid>`                                           | Fetch a single refund request                                |
| `confirm <uuid> [--note]`                              | Record that you returned the money — call AFTER the transfer |
| `reject <uuid> [--note]`                               | Decline the request — the carnê or charge is untouched       |

---

### `garu customers create`

Register a customer for the current seller. Registering the same `document`
twice attaches your profile to the existing global customer instead of
erroring — safe to call once per seller per person.

```bash
garu customers create \
  --name "Maria Silva" --email maria@exemplo.com.br \
  --document 12345678909 --phone 11987654321 \
  --person-type fisica
```

| Flag                    | Description                                    |
| ----------------------- | ---------------------------------------------- |
| `--name <name>`         | Customer name (required)                       |
| `--email <email>`       | Customer email (required)                      |
| `--document <document>` | CPF (11 digits) or CNPJ (14 digits) (required) |
| `--phone <phone>`       | Phone with area code, 10-11 digits (required)  |
| `--person-type <type>`  | `fisica` or `juridica` (required)              |
| `--zip-code <cep>` etc. | Address fields (all optional)                  |

---

### `garu customers` — other subcommands

| Command                                    | Description                                                      |
| ------------------------------------------ | ---------------------------------------------------------------- |
| `list [--page --limit --search --status]`  | List customers (`--status overdue` filters to at-risk customers) |
| `get <uuid>`                               | Fetch a single customer                                          |
| `update <uuid> [...]`                      | Partial update — same flags as `create`, all optional            |
| `set-billing-email <uuid> --email <email>` | Set the sticky per-seller billing-email override                 |
| `clear-billing-email <uuid>`               | Clear the override, falling back to the last-used email          |
| `delete <uuid>`                            | Unlink the customer from the current seller                      |

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

| Flag                   | Description                                                   |
| ---------------------- | ------------------------------------------------------------- |
| `--api-key <key>`      | Override API key for this invocation (takes highest priority) |
| `-p, --profile <name>` | Credentials profile to use                                    |
| `--json`               | Force JSON output even in interactive terminals               |
| `-q, --quiet`          | Suppress status output; only print results and errors         |
| `-v, --version`        | Print version and exit                                        |
| `--help`               | Show help text                                                |

---

## Output behavior

The CLI has two output modes:

| Mode            | When                   | Stdout         | Stderr       |
| --------------- | ---------------------- | -------------- | ------------ |
| **Interactive** | Terminal (TTY)         | Formatted text | Status lines |
| **Machine**     | Piped, CI, or `--json` | JSON           | Nothing      |

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

| Item             | Path                              | Notes                                 |
| ---------------- | --------------------------------- | ------------------------------------- |
| Config directory | `~/.config/garu/`                 | Respects `$XDG_CONFIG_HOME`           |
| Credentials      | `~/.config/garu/credentials.json` | `0600` permissions (owner read/write) |
| Override path    | `$GARU_CREDENTIALS_PATH`          | Point to a custom credentials file    |

---

## Security

See [SECURITY.md](SECURITY.md) for our vulnerability disclosure policy.

> **Note on credit card flags:** The `--card-number`, `--card-cvv`, and `--card-expiration` flags pass data via command-line arguments, which may be visible in shell history and process listings. For production card processing, use the [`@garuhq/node`](https://www.npmjs.com/package/@garuhq/node) SDK directly.

## License

MIT

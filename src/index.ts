import { Command, Option } from 'commander';

import { CLI_VERSION } from './version.js';
import { authSwitchCommand } from './commands/auth-switch.js';
import {
  chargesCreateCommand,
  chargesGetCommand,
  chargesListCommand,
  chargesRefundCommand
} from './commands/charges.js';
import { doctorCommand } from './commands/doctor.js';
import { loginCommand } from './commands/login.js';
import { logoutCommand } from './commands/logout.js';
import {
  webhooksEventsGetCommand,
  webhooksEventsListCommand,
  webhooksEventsResendCommand,
  webhooksEventsRetryCommand
} from './commands/webhooks.js';
import {
  parsePaymentMethod,
  parsePositiveIntId,
  parseWebhookEventStatus
} from './lib/parse.js';
import { printErrorAndExit, type OutputMode } from './lib/output.js';

interface GlobalFlags {
  apiKey?: string;
  profile?: string;
  json?: boolean;
  quiet?: boolean;
}

interface CommandBaseOptions {
  apiKey?: string;
  profile?: string;
  mode?: OutputMode;
  quiet?: boolean;
}

/** Build the top-level command tree. Exposed so tests can exercise the router. */
export function buildCli(): Command {
  const program = new Command();

  program
    .name('garu')
    .description('Command-line interface for the Garu payment gateway.')
    .version(CLI_VERSION, '-v, --version')
    .addOption(new Option('--api-key <key>', 'Garu API key (overrides env and credentials file)'))
    .addOption(new Option('-p, --profile <name>', 'credentials profile name'))
    .addOption(new Option('--json', 'emit strict JSON on stdout (forced in pipes)'))
    .addOption(new Option('-q, --quiet', 'suppress status output; only print results and errors'))
    .showHelpAfterError();

  // login
  program
    .command('login')
    .description('Save a Garu API key to the credentials file')
    .option('--api-key <key>', 'pre-supply the key instead of prompting')
    .option('-p, --profile <name>', 'profile name to store under', 'default')
    .action(async (cmdOpts: { apiKey?: string; profile: string }) => {
      const base = toCommandOptions(program);
      await loginCommand({
        apiKey: cmdOpts.apiKey,
        profile: cmdOpts.profile,
        mode: base.mode,
        quiet: base.quiet
      }).catch((err) => printErrorAndExit(err, base));
    });

  // logout
  program
    .command('logout')
    .description('Remove saved credentials')
    .option('-p, --profile <name>', 'only remove this profile instead of the whole file')
    .action(async (cmdOpts: { profile?: string }) => {
      const base = toCommandOptions(program);
      await logoutCommand({
        profile: cmdOpts.profile,
        mode: base.mode,
        quiet: base.quiet
      }).catch((err) => printErrorAndExit(err, base));
    });

  // auth switch
  const auth = program.command('auth').description('Manage credentials profiles');
  auth
    .command('switch <profile>')
    .description('Set the active credentials profile')
    .action(async (profile: string) => {
      const base = toCommandOptions(program);
      await authSwitchCommand({ profile, mode: base.mode, quiet: base.quiet }).catch((err) =>
        printErrorAndExit(err, base)
      );
    });

  // charges
  const charges = program.command('charges').description('Create, fetch, and refund charges');

  charges
    .command('list')
    .description('List charges with pagination and filters')
    .option('--page <n>', 'page number (1-based)', (v: string) => parseInt(v, 10))
    .option('--limit <n>', 'items per page (1-100)', (v: string) => parseInt(v, 10))
    .option('--status <status>', 'filter by status (e.g. paid, pending)')
    .option('--search <query>', 'search by customer name, email, or document')
    .option('--payment-method <method>', 'filter: pix, creditcard, boleto')
    .action(async (cmdOpts: { page?: number; limit?: number; status?: string; search?: string; paymentMethod?: string }) => {
      const base = toCommandOptions(program);
      await chargesListCommand({
        ...base,
        page: cmdOpts.page,
        limit: cmdOpts.limit,
        status: cmdOpts.status,
        search: cmdOpts.search,
        paymentMethod: cmdOpts.paymentMethod
      }).catch((err) => printErrorAndExit(err, base));
    });

  charges
    .command('create')
    .description('Create a charge (PIX, credit card, or boleto)')
    .requiredOption('--type <type>', 'payment method: pix | credit_card | boleto')
    .requiredOption('--product-id <uuid>', 'product UUID')
    .requiredOption('--customer-name <name>', 'customer full name')
    .requiredOption('--customer-email <email>', 'customer email')
    .requiredOption(
      '--customer-document <document>',
      'CPF (11 digits) or CNPJ (14 digits), digits only'
    )
    .requiredOption('--customer-phone <phone>', 'customer phone with area code, digits only')
    .option('--card-number <number>', 'credit-card number (required for credit_card)')
    .option('--card-cvv <cvv>', 'credit-card CVV')
    .option('--card-expiration <yyyy-mm>', 'credit-card expiration date (YYYY-MM)')
    .option('--card-holder <name>', 'credit-card holder name')
    .option('--installments <n>', 'number of installments (1-12)', (v) => parseInt(v, 10), 1)
    .option('--additional-info <text>', 'free-form metadata attached to the charge')
    .option('--idempotency-key <key>', 'idempotency key (auto-generated if omitted)')
    .action(async (cmdOpts) => {
      const base = toCommandOptions(program);
      await chargesCreateCommand({
        ...base,
        type: parsePaymentMethod(cmdOpts.type),
        productId: cmdOpts.productId,
        customerName: cmdOpts.customerName,
        customerEmail: cmdOpts.customerEmail,
        customerDocument: cmdOpts.customerDocument,
        customerPhone: cmdOpts.customerPhone,
        cardNumber: cmdOpts.cardNumber,
        cardCvv: cmdOpts.cardCvv,
        cardExpiration: cmdOpts.cardExpiration,
        cardHolder: cmdOpts.cardHolder,
        installments: cmdOpts.installments,
        additionalInfo: cmdOpts.additionalInfo,
        idempotencyKey: cmdOpts.idempotencyKey
      }).catch((err) => printErrorAndExit(err, base));
    });

  charges
    .command('get <id>')
    .description('Fetch a single charge by ID')
    .action(async (id: string) => {
      const base = toCommandOptions(program);
      await chargesGetCommand({ ...base, id: parsePositiveIntId(id, 'Charge ID') }).catch((err) =>
        printErrorAndExit(err, base)
      );
    });

  charges
    .command('refund <id>')
    .description('Refund a charge (full or partial)')
    .option('--amount <centavos>', 'partial refund amount in centavos', (v) => parseInt(v, 10))
    .option('--reason <text>', 'optional refund reason')
    .option('--idempotency-key <key>', 'idempotency key (auto-generated if omitted)')
    .action(async (id: string, cmdOpts) => {
      const base = toCommandOptions(program);
      await chargesRefundCommand({
        ...base,
        id: parsePositiveIntId(id, 'Charge ID'),
        amount: cmdOpts.amount,
        reason: cmdOpts.reason,
        idempotencyKey: cmdOpts.idempotencyKey
      }).catch((err) => printErrorAndExit(err, base));
    });

  // webhooks
  const webhooks = program.command('webhooks').description('Inspect and replay webhook deliveries');
  const events = webhooks
    .command('events')
    .description('List, inspect, and resend webhook events');

  events
    .command('list')
    .description('List webhook events with filters')
    .option('--page <n>', 'page number (1-based)', (v: string) => parseInt(v, 10))
    .option('--limit <n>', 'items per page (1-100)', (v: string) => parseInt(v, 10))
    .option('--status <status>', 'filter: pending, success, or failed')
    .option('--event-type <type>', 'filter by Garu event type, e.g. transaction.payment.paid')
    .option('--endpoint-id <n>', 'filter by destination endpoint id', (v: string) =>
      parseInt(v, 10)
    )
    .action(
      async (cmdOpts: {
        page?: number;
        limit?: number;
        status?: string;
        eventType?: string;
        endpointId?: number;
      }) => {
        const base = toCommandOptions(program);
        await webhooksEventsListCommand({
          ...base,
          page: cmdOpts.page,
          limit: cmdOpts.limit,
          status: cmdOpts.status ? parseWebhookEventStatus(cmdOpts.status) : undefined,
          eventType: cmdOpts.eventType,
          endpointId: cmdOpts.endpointId
        }).catch((err) => printErrorAndExit(err, base));
      }
    );

  events
    .command('get <id>')
    .description('Fetch a single webhook event by ID')
    .action(async (id: string) => {
      const base = toCommandOptions(program);
      await webhooksEventsGetCommand({
        ...base,
        id: parsePositiveIntId(id, 'Webhook event ID')
      }).catch((err) => printErrorAndExit(err, base));
    });

  events
    .command('retry <id>')
    .description(
      '[deprecated: prefer `resend`] Re-deliver a webhook event in place (resets the original row to pending and triggers an immediate attempt; destroys the prior failure record)'
    )
    .action(async (id: string) => {
      const base = toCommandOptions(program);
      await webhooksEventsRetryCommand({
        ...base,
        id: parsePositiveIntId(id, 'Webhook event ID')
      }).catch((err) => printErrorAndExit(err, base));
    });

  events
    .command('resend <id>')
    .description(
      'Re-deliver a webhook event by cloning it (audit-trail preserving: original row is untouched, clone gets a new id and points back via manualResendOf)'
    )
    .action(async (id: string) => {
      const base = toCommandOptions(program);
      await webhooksEventsResendCommand({
        ...base,
        id: parsePositiveIntId(id, 'Webhook event ID')
      }).catch((err) => printErrorAndExit(err, base));
    });

  // doctor
  program
    .command('doctor')
    .description('Environment diagnostic')
    .action(async () => {
      const base = toCommandOptions(program);
      await doctorCommand(base).catch((err) => printErrorAndExit(err, base));
    });

  return program;
}

/**
 * Collapse the root-command's global flags into the shape every command takes.
 * Commander never passes `undefined` for unset flags — they're just absent — so
 * we can forward this object to command handlers via spread without polluting
 * their signatures with `undefined` props.
 */
function toCommandOptions(program: Command): CommandBaseOptions {
  const g = program.opts<GlobalFlags>();
  const out: CommandBaseOptions = {};
  if (g.apiKey) out.apiKey = g.apiKey;
  if (g.profile) out.profile = g.profile;
  if (g.json) out.mode = 'json';
  if (g.quiet) out.quiet = true;
  return out;
}

/**
 * Best-effort version-update notifier. update-notifier sets an exit handler
 * so the banner is printed at process exit, after the user's command output.
 * Fails silently — this is informational, not load-bearing.
 */
async function setupUpdateNotifier(): Promise<void> {
  try {
    const { default: updateNotifier } = await import('update-notifier');
    updateNotifier({
      pkg: { name: '@garuhq/cli', version: CLI_VERSION },
      updateCheckInterval: 1000 * 60 * 60 * 24
    }).notify();
  } catch {
    // offline / network / sandboxed env — drop silently
  }
}

/** Main entry invoked by `bin/garu.cjs` and the compiled binary. */
export async function main(argv: string[] = process.argv): Promise<void> {
  await setupUpdateNotifier();
  const program = buildCli();
  await program.parseAsync(argv);
}

// This module is only ever loaded as the CLI entry point — either through the
// `bin/garu.cjs` shim for npm installs or as the compiled binary produced by
// `bun build --compile`. No test imports `src/index.ts`, so it's safe to call
// `main()` unconditionally at module load time.
main().catch((err) => printErrorAndExit(err));

import { Command, Option } from 'commander';

import { CLI_VERSION } from './version.js';
import { authSwitchCommand } from './commands/auth-switch.js';
import {
  chargesCreateCommand,
  chargesGetCommand,
  chargesRefundCommand
} from './commands/charges.js';
import { doctorCommand } from './commands/doctor.js';
import { loginCommand } from './commands/login.js';
import { logoutCommand } from './commands/logout.js';
import type { PaymentMethod } from '@garuhq/node';
import { CliError } from './lib/errors.js';
import { printErrorAndExit, type OutputMode } from './lib/output.js';

interface GlobalFlags {
  apiKey?: string;
  profile?: string;
  json?: boolean;
  quiet?: boolean;
}

/** Build the top-level command tree. Exposed so tests can exercise the router. */
export function buildCli(): Command {
  const program = new Command();

  program
    .name('garu')
    .description('Command-line interface for the Garu payment gateway.')
    .version(getVersion(), '-v, --version')
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
      const globals = getGlobals(program);
      await loginCommand({
        ...(cmdOpts.apiKey !== undefined ? { apiKey: cmdOpts.apiKey } : {}),
        profile: cmdOpts.profile,
        ...globalsToOutput(globals)
      }).catch((err) => printErrorAndExit(err, globalsToOutput(globals)));
    });

  // logout
  program
    .command('logout')
    .description('Remove saved credentials')
    .option('-p, --profile <name>', 'only remove this profile instead of the whole file')
    .action(async (cmdOpts: { profile?: string }) => {
      const globals = getGlobals(program);
      await logoutCommand({
        ...(cmdOpts.profile !== undefined ? { profile: cmdOpts.profile } : {}),
        ...globalsToOutput(globals)
      }).catch((err) => printErrorAndExit(err, globalsToOutput(globals)));
    });

  // auth switch
  const auth = program.command('auth').description('Manage credentials profiles');
  auth
    .command('switch <profile>')
    .description('Set the active credentials profile')
    .action(async (profile: string) => {
      const globals = getGlobals(program);
      await authSwitchCommand({ profile, ...globalsToOutput(globals) }).catch((err) =>
        printErrorAndExit(err, globalsToOutput(globals))
      );
    });

  // charges
  const charges = program.command('charges').description('Create, fetch, and refund charges');

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
      const globals = getGlobals(program);
      const type = parsePaymentMethod(cmdOpts.type);
      await chargesCreateCommand({
        type,
        productId: cmdOpts.productId,
        customerName: cmdOpts.customerName,
        customerEmail: cmdOpts.customerEmail,
        customerDocument: cmdOpts.customerDocument,
        customerPhone: cmdOpts.customerPhone,
        ...(cmdOpts.cardNumber !== undefined ? { cardNumber: cmdOpts.cardNumber } : {}),
        ...(cmdOpts.cardCvv !== undefined ? { cardCvv: cmdOpts.cardCvv } : {}),
        ...(cmdOpts.cardExpiration !== undefined ? { cardExpiration: cmdOpts.cardExpiration } : {}),
        ...(cmdOpts.cardHolder !== undefined ? { cardHolder: cmdOpts.cardHolder } : {}),
        ...(cmdOpts.installments !== undefined ? { installments: cmdOpts.installments } : {}),
        ...(cmdOpts.additionalInfo !== undefined ? { additionalInfo: cmdOpts.additionalInfo } : {}),
        ...(cmdOpts.idempotencyKey !== undefined ? { idempotencyKey: cmdOpts.idempotencyKey } : {}),
        ...globalFlagsToCommandOptions(globals)
      }).catch((err) => printErrorAndExit(err, globalsToOutput(globals)));
    });

  charges
    .command('get <id>')
    .description('Fetch a single charge by ID')
    .action(async (id: string) => {
      const globals = getGlobals(program);
      await chargesGetCommand({
        id: parseId(id),
        ...globalFlagsToCommandOptions(globals)
      }).catch((err) => printErrorAndExit(err, globalsToOutput(globals)));
    });

  charges
    .command('refund <id>')
    .description('Refund a charge (full or partial)')
    .option('--amount <centavos>', 'partial refund amount in centavos', (v) => parseInt(v, 10))
    .option('--reason <text>', 'optional refund reason')
    .option('--idempotency-key <key>', 'idempotency key (auto-generated if omitted)')
    .action(async (id: string, cmdOpts) => {
      const globals = getGlobals(program);
      await chargesRefundCommand({
        id: parseId(id),
        ...(cmdOpts.amount !== undefined ? { amount: cmdOpts.amount } : {}),
        ...(cmdOpts.reason !== undefined ? { reason: cmdOpts.reason } : {}),
        ...(cmdOpts.idempotencyKey !== undefined ? { idempotencyKey: cmdOpts.idempotencyKey } : {}),
        ...globalFlagsToCommandOptions(globals)
      }).catch((err) => printErrorAndExit(err, globalsToOutput(globals)));
    });

  // doctor
  program
    .command('doctor')
    .description('Environment diagnostic')
    .action(async () => {
      const globals = getGlobals(program);
      await doctorCommand({
        ...globalFlagsToCommandOptions(globals)
      }).catch((err) => printErrorAndExit(err, globalsToOutput(globals)));
    });

  return program;
}

function getGlobals(program: Command): GlobalFlags {
  return program.opts<GlobalFlags>();
}

function globalsToOutput(globals: GlobalFlags): { mode?: OutputMode; quiet?: boolean } {
  const out: { mode?: OutputMode; quiet?: boolean } = {};
  if (globals.json) out.mode = 'json';
  if (globals.quiet) out.quiet = true;
  return out;
}

function globalFlagsToCommandOptions(globals: GlobalFlags): {
  apiKey?: string;
  profile?: string;
  mode?: OutputMode;
  quiet?: boolean;
} {
  const out: { apiKey?: string; profile?: string; mode?: OutputMode; quiet?: boolean } = {};
  if (globals.apiKey) out.apiKey = globals.apiKey;
  if (globals.profile) out.profile = globals.profile;
  if (globals.json) out.mode = 'json';
  if (globals.quiet) out.quiet = true;
  return out;
}

function parsePaymentMethod(raw: string): PaymentMethod {
  if (raw === 'pix' || raw === 'credit_card' || raw === 'boleto') return raw;
  throw new CliError(
    'invalid_input',
    `--type must be 'pix', 'credit_card', or 'boleto' (got '${raw}')`
  );
}

function parseId(raw: string): number {
  const id = Number.parseInt(raw, 10);
  if (!Number.isFinite(id) || id <= 0) {
    throw new CliError('invalid_input', `Charge ID must be a positive integer (got '${raw}')`);
  }
  return id;
}

function getVersion(): string {
  return CLI_VERSION;
}

/** Main entry invoked by `bin/garu.js` and `src/index.ts` when run directly. */
export async function main(argv: string[] = process.argv): Promise<void> {
  const program = buildCli();
  await program.parseAsync(argv);
}

// This module is only ever loaded as the CLI entry point — either through the
// `bin/garu.cjs` shim for npm installs or as the compiled binary produced by
// `bun build --compile`. No test imports `src/index.ts`, so it's safe to call
// `main()` unconditionally at module load time.
main().catch((err) => printErrorAndExit(err));

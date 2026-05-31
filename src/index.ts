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
import { productsCreateCommand, productsUpdateCommand } from './commands/products.js';
import {
  scheduledChargesAttemptsCommand,
  scheduledChargesCancelAtPeriodEndCommand,
  scheduledChargesCancelRecurrenceCommand,
  scheduledChargesChangePaymentMethodCommand,
  scheduledChargesChargeNowCommand,
  scheduledChargesClearPaymentMethodCommand,
  scheduledChargesCreateCommand,
  scheduledChargesGetCommand,
  scheduledChargesListCommand,
  scheduledChargesMarkPaidCommand,
  scheduledChargesPauseCommand,
  scheduledChargesPostponeCommand,
  scheduledChargesResumeCommand
} from './commands/scheduled-charges.js';
import {
  webhooksEventsGetCommand,
  webhooksEventsListCommand,
  webhooksEventsResendCommand,
  webhooksEventsRetryCommand
} from './commands/webhooks.js';
import {
  parseAmountBrl,
  parseCsvList,
  parseIntInRange,
  parseMetadata,
  parseNonNegativeInt,
  parsePaymentMethod,
  parsePositiveIntId,
  parseRecurrenceInterval,
  parseScheduledChargeStatus,
  parseScheduledChargeType,
  parseScheduledPaymentMethods,
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
    .showHelpAfterError()
    .addHelpText(
      'after',
      `
Recipes:
  Pix Automático recurring subscription (end-to-end):

    # 1. Create a product with Pix Automático enabled
    garu products create \\
      --name "Plano Mensal" --value 4990 \\
      --pix --credit-card --pix-automatic \\
      --subscription --subscription-type monthly

    # 2. Schedule the recurring auto-debit charge for that product.
    #    pix_automatic requires --type=recurring and --product-id.
    garu scheduled-charges create \\
      --customer-id 42 --product-id 456 \\
      --amount 49.90 --type recurring \\
      --due-date 2026-06-15 \\
      --methods pix_automatic \\
      --recurrence-interval monthly
`
    );

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
    .action(
      async (cmdOpts: {
        page?: number;
        limit?: number;
        status?: string;
        search?: string;
        paymentMethod?: string;
      }) => {
        const base = toCommandOptions(program);
        await chargesListCommand({
          ...base,
          page: cmdOpts.page,
          limit: cmdOpts.limit,
          status: cmdOpts.status,
          search: cmdOpts.search,
          paymentMethod: cmdOpts.paymentMethod
        }).catch((err) => printErrorAndExit(err, base));
      }
    );

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

  // scheduled-charges
  const scheduled = program
    .command('scheduled-charges')
    .description('Schedule, inspect, and act on future-dated charges');

  scheduled
    .command('create')
    .description('Schedule a future-dated charge (one-time or recurring)')
    .requiredOption('--customer-id <n>', 'customer id', (v: string) =>
      parsePositiveIntId(v, '--customer-id')
    )
    .requiredOption('--amount <brl>', 'decimal BRL amount, e.g. 297.50')
    .requiredOption('--type <type>', 'one_time | recurring')
    .requiredOption('--due-date <yyyy-mm-dd>', 'first due date in São Paulo time')
    .requiredOption('--methods <list>', 'comma-separated: pix,boleto,card,pix_automatic')
    .option(
      '--product-id <n>',
      'product id (required when methods includes card or pix_automatic)',
      (v: string) => parsePositiveIntId(v, '--product-id')
    )
    .option('--description <text>', 'charge description')
    .option('--recurrence-interval <interval>', 'recurring cadence: weekly|monthly|yearly|…')
    .option('--recurrence-interval-count <n>', 'multiplier for the interval', (v: string) =>
      parsePositiveIntId(v, '--recurrence-interval-count')
    )
    .option('--recurrence-ends-after <n>', 'stop after N successful cycles', (v: string) =>
      parsePositiveIntId(v, '--recurrence-ends-after')
    )
    .option('--recurrence-ends-on <yyyy-mm-dd>', 'stop after this calendar date')
    .option('--trial-days <n>', 'free-trial days (1-365, recurring-only)')
    .option('--external-reference <ref>', 'your own reconciliation reference')
    .option('--metadata <json>', 'JSON object of custom metadata')
    .option(
      '--max-recovery-days <n>',
      'days past due the recovery sweep keeps auto-billing (1-365; default 14)'
    )
    .option('--idempotency-key <key>', 'idempotency key (auto-generated if omitted)')
    .action(async (cmdOpts) => {
      const base = toCommandOptions(program);
      await scheduledChargesCreateCommand({
        ...base,
        customerId: cmdOpts.customerId,
        amount: parseAmountBrl(cmdOpts.amount),
        type: parseScheduledChargeType(cmdOpts.type),
        dueDate: cmdOpts.dueDate,
        methods: parseScheduledPaymentMethods(cmdOpts.methods),
        productId: cmdOpts.productId,
        description: cmdOpts.description,
        recurrenceInterval: cmdOpts.recurrenceInterval
          ? parseRecurrenceInterval(cmdOpts.recurrenceInterval)
          : undefined,
        recurrenceIntervalCount: cmdOpts.recurrenceIntervalCount,
        recurrenceEndsAfter: cmdOpts.recurrenceEndsAfter,
        recurrenceEndsOn: cmdOpts.recurrenceEndsOn,
        trialDays:
          cmdOpts.trialDays !== undefined
            ? parseIntInRange(cmdOpts.trialDays, '--trial-days', 1, 365)
            : undefined,
        externalReference: cmdOpts.externalReference,
        metadata: cmdOpts.metadata ? parseMetadata(cmdOpts.metadata) : undefined,
        maxRecoveryDays:
          cmdOpts.maxRecoveryDays !== undefined
            ? parseIntInRange(cmdOpts.maxRecoveryDays, '--max-recovery-days', 1, 365)
            : undefined,
        idempotencyKey: cmdOpts.idempotencyKey
      }).catch((err) => printErrorAndExit(err, base));
    });

  scheduled
    .command('list')
    .description('List scheduled charges with pagination and filters')
    .option('--page <n>', 'page number (1-based)', (v: string) => parseInt(v, 10))
    .option('--limit <n>', 'items per page (1-100)', (v: string) => parseInt(v, 10))
    .option('--customer-id <n>', 'filter by customer id', (v: string) =>
      parsePositiveIntId(v, '--customer-id')
    )
    .option(
      '--status <status>',
      'filter by status (repeatable)',
      (val: string, acc: string[]) => acc.concat(val),
      [] as string[]
    )
    .option('--type <type>', 'filter by type: one_time | recurring')
    .option('--due-from <yyyy-mm-dd>', 'lower bound for due date')
    .option('--due-to <yyyy-mm-dd>', 'upper bound for due date')
    .option('--search <query>', 'search by customer name, email, or document')
    .action(
      async (cmdOpts: {
        page?: number;
        limit?: number;
        customerId?: number;
        status: string[];
        type?: string;
        dueFrom?: string;
        dueTo?: string;
        search?: string;
      }) => {
        const base = toCommandOptions(program);
        await scheduledChargesListCommand({
          ...base,
          page: cmdOpts.page,
          limit: cmdOpts.limit,
          customerId: cmdOpts.customerId,
          status:
            cmdOpts.status.length > 0 ? cmdOpts.status.map(parseScheduledChargeStatus) : undefined,
          type: cmdOpts.type ? parseScheduledChargeType(cmdOpts.type) : undefined,
          dueFrom: cmdOpts.dueFrom,
          dueTo: cmdOpts.dueTo,
          search: cmdOpts.search
        }).catch((err) => printErrorAndExit(err, base));
      }
    );

  scheduled
    .command('get <id>')
    .description('Fetch a scheduled charge with its event timeline and linked transactions')
    .action(async (id: string) => {
      const base = toCommandOptions(program);
      await scheduledChargesGetCommand({ ...base, id }).catch((err) =>
        printErrorAndExit(err, base)
      );
    });

  scheduled
    .command('charge-now <id>')
    .description(
      'Dispatch a scheduled charge now (the charge + notification the daily cron would send on the due date), instead of waiting for dueDate. Idempotent: an already-dispatched cycle reports `already_sent` and is NOT re-charged. Prints the result message; exits non-zero on outcome failed/not_sent (and on 4xx).'
    )
    .action(async (id: string) => {
      const base = toCommandOptions(program);
      await scheduledChargesChargeNowCommand({ ...base, id }).catch((err) =>
        printErrorAndExit(err, base)
      );
    });

  scheduled
    .command('postpone <id>')
    .description('Move a scheduled charge to a new due date')
    .requiredOption('--new-due-date <yyyy-mm-dd>', 'new due date (today or future)')
    .option('--reason <text>', 'optional reason recorded in the timeline')
    .action(async (id: string, cmdOpts: { newDueDate: string; reason?: string }) => {
      const base = toCommandOptions(program);
      await scheduledChargesPostponeCommand({
        ...base,
        id,
        newDueDate: cmdOpts.newDueDate,
        reason: cmdOpts.reason
      }).catch((err) => printErrorAndExit(err, base));
    });

  scheduled
    .command('pause <id>')
    .description('Pause a scheduled charge (no reminders fire while paused)')
    .option('--reason <text>', 'optional reason recorded in the timeline')
    .action(async (id: string, cmdOpts: { reason?: string }) => {
      const base = toCommandOptions(program);
      await scheduledChargesPauseCommand({ ...base, id, reason: cmdOpts.reason }).catch((err) =>
        printErrorAndExit(err, base)
      );
    });

  scheduled
    .command('resume <id>')
    .description('Resume a paused scheduled charge')
    .action(async (id: string) => {
      const base = toCommandOptions(program);
      await scheduledChargesResumeCommand({ ...base, id }).catch((err) =>
        printErrorAndExit(err, base)
      );
    });

  scheduled
    .command('mark-paid <id>')
    .description('Mark a scheduled charge as paid out-of-band (bank transfer, cash, etc.)')
    .requiredOption('--payment-date <yyyy-mm-dd>', 'date the payment was received (today or past)')
    .option('--external-reference <ref>', 'bank reference or internal id for reconciliation')
    .option('--cycle-number <n>', 'cycle to mark paid (REQUIRED for recurring)', (v: string) =>
      parsePositiveIntId(v, '--cycle-number')
    )
    .action(
      async (
        id: string,
        cmdOpts: { paymentDate: string; externalReference?: string; cycleNumber?: number }
      ) => {
        const base = toCommandOptions(program);
        await scheduledChargesMarkPaidCommand({
          ...base,
          id,
          paymentDate: cmdOpts.paymentDate,
          externalReference: cmdOpts.externalReference,
          cycleNumber: cmdOpts.cycleNumber
        }).catch((err) => printErrorAndExit(err, base));
      }
    );

  scheduled
    .command('cancel-recurrence <id>')
    .description('Stop future cycles of a recurring series (recurring-only)')
    .option('--reason <text>', 'optional reason recorded in the timeline')
    .action(async (id: string, cmdOpts: { reason?: string }) => {
      const base = toCommandOptions(program);
      await scheduledChargesCancelRecurrenceCommand({
        ...base,
        id,
        reason: cmdOpts.reason
      }).catch((err) => printErrorAndExit(err, base));
    });

  scheduled
    .command('cancel-at-period-end <id>')
    .description('Toggle Stripe-style soft cancel on a recurring series (recurring-only)')
    .option('--disable', 'clear the flag instead of setting it')
    .action(async (id: string, cmdOpts: { disable?: boolean }) => {
      const base = toCommandOptions(program);
      await scheduledChargesCancelAtPeriodEndCommand({
        ...base,
        id,
        enabled: !cmdOpts.disable
      }).catch((err) => printErrorAndExit(err, base));
    });

  scheduled
    .command('change-payment-method <id>')
    .description('Swap the saved card on a recurring series (recurring-only)')
    .requiredOption('--payment-method-id <n>', 'PaymentMethod id (same customer)', (v: string) =>
      parsePositiveIntId(v, '--payment-method-id')
    )
    .action(async (id: string, cmdOpts: { paymentMethodId: number }) => {
      const base = toCommandOptions(program);
      await scheduledChargesChangePaymentMethodCommand({
        ...base,
        id,
        paymentMethodId: cmdOpts.paymentMethodId
      }).catch((err) => printErrorAndExit(err, base));
    });

  scheduled
    .command('clear-payment-method <id>')
    .description(
      'Clear the saved card; future cycles fall back to email-with-link (recurring-only)'
    )
    .action(async (id: string) => {
      const base = toCommandOptions(program);
      await scheduledChargesClearPaymentMethodCommand({ ...base, id }).catch((err) =>
        printErrorAndExit(err, base)
      );
    });

  scheduled
    .command('attempts <id>')
    .description('List the per-attempt billing log for a scheduled charge')
    .option('--page <n>', 'page number (1-based)', (v: string) => parseInt(v, 10))
    .option('--limit <n>', 'items per page (1-100)', (v: string) => parseInt(v, 10))
    .option('--cycle-number <n>', 'filter to a single cycle', (v: string) =>
      parsePositiveIntId(v, '--cycle-number')
    )
    .action(
      async (id: string, cmdOpts: { page?: number; limit?: number; cycleNumber?: number }) => {
        const base = toCommandOptions(program);
        await scheduledChargesAttemptsCommand({
          ...base,
          id,
          page: cmdOpts.page,
          limit: cmdOpts.limit,
          cycleNumber: cmdOpts.cycleNumber
        }).catch((err) => printErrorAndExit(err, base));
      }
    );

  // webhooks
  const webhooks = program.command('webhooks').description('Inspect and replay webhook deliveries');
  const events = webhooks.command('events').description('List, inspect, and resend webhook events');

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

  // products
  const products = program.command('products').description('Create and update products');

  products
    .command('create')
    .description('Create a product')
    .requiredOption('--name <name>', 'product name')
    .option('--value <centavos>', 'price in centavos (BRL × 100)', (v: string) =>
      parseNonNegativeInt(v, '--value')
    )
    .option('--description <text>', 'product description')
    .option('--image <url>', 'HTTPS URL of the product cover image')
    .option('--tags <list>', 'comma-separated tags', parseCsvList)
    .option('--pix', 'accept PIX')
    .option('--no-pix', 'do not accept PIX')
    .option('--boleto', 'accept boleto')
    .option('--no-boleto', 'do not accept boleto')
    .option('--credit-card', 'accept credit card')
    .option('--no-credit-card', 'do not accept credit card')
    .option('--pix-automatic', 'expose Pix Automático on the subscription checkout')
    .option('--no-pix-automatic', 'do not expose Pix Automático')
    .option('--installments <n>', 'max credit-card installments', (v: string) =>
      parsePositiveIntId(v, '--installments')
    )
    .option('--subscription', 'mark the product as a subscription')
    .option('--no-subscription', 'mark the product as one-time')
    .option('--subscription-type <type>', 'subscription cadence, e.g. monthly')
    .option('--unit-label <label>', 'unit label shown on the checkout')
    .option('--return-url <url>', 'post-purchase redirect URL')
    .option('--return-url-button-text <text>', 'label for the return-URL button')
    .action(async (cmdOpts) => {
      const base = toCommandOptions(program);
      await productsCreateCommand({
        ...base,
        name: cmdOpts.name,
        value: cmdOpts.value,
        description: cmdOpts.description,
        image: cmdOpts.image,
        tags: cmdOpts.tags,
        pix: cmdOpts.pix,
        boleto: cmdOpts.boleto,
        creditCard: cmdOpts.creditCard,
        pixAutomatic: cmdOpts.pixAutomatic,
        installments: cmdOpts.installments,
        isSubscription: cmdOpts.subscription,
        subscriptionType: cmdOpts.subscriptionType,
        unitLabel: cmdOpts.unitLabel,
        returnUrl: cmdOpts.returnUrl,
        returnUrlButtonText: cmdOpts.returnUrlButtonText
      }).catch((err) => printErrorAndExit(err, base));
    });

  products
    .command('update <id>')
    .description(
      'Update a product (partial — only the flags you pass change). <id> is the numeric id or UUID'
    )
    .option('--name <name>', 'product name')
    .option('--value <centavos>', 'price in centavos (BRL × 100)', (v: string) =>
      parseNonNegativeInt(v, '--value')
    )
    .option('--description <text>', 'product description')
    .option('--image <url>', 'HTTPS URL of the product cover image')
    .option('--tags <list>', 'comma-separated tags', parseCsvList)
    .option('--pix', 'accept PIX')
    .option('--no-pix', 'do not accept PIX')
    .option('--boleto', 'accept boleto')
    .option('--no-boleto', 'do not accept boleto')
    .option('--credit-card', 'accept credit card')
    .option('--no-credit-card', 'do not accept credit card')
    .option('--pix-automatic', 'expose Pix Automático on the subscription checkout')
    .option('--no-pix-automatic', 'do not expose Pix Automático')
    .option('--installments <n>', 'max credit-card installments', (v: string) =>
      parsePositiveIntId(v, '--installments')
    )
    .option('--subscription', 'mark the product as a subscription')
    .option('--no-subscription', 'mark the product as one-time')
    .option('--subscription-type <type>', 'subscription cadence, e.g. monthly')
    .option('--unit-label <label>', 'unit label shown on the checkout')
    .option('--return-url <url>', 'post-purchase redirect URL')
    .option('--return-url-button-text <text>', 'label for the return-URL button')
    .action(async (id: string, cmdOpts) => {
      const base = toCommandOptions(program);
      await productsUpdateCommand({
        ...base,
        id,
        name: cmdOpts.name,
        value: cmdOpts.value,
        description: cmdOpts.description,
        image: cmdOpts.image,
        tags: cmdOpts.tags,
        pix: cmdOpts.pix,
        boleto: cmdOpts.boleto,
        creditCard: cmdOpts.creditCard,
        pixAutomatic: cmdOpts.pixAutomatic,
        installments: cmdOpts.installments,
        isSubscription: cmdOpts.subscription,
        subscriptionType: cmdOpts.subscriptionType,
        unitLabel: cmdOpts.unitLabel,
        returnUrl: cmdOpts.returnUrl,
        returnUrlButtonText: cmdOpts.returnUrlButtonText
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

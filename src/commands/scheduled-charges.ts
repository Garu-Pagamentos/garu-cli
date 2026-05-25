import type {
  CancelAtPeriodEndScheduledChargeParams,
  CancelRecurrenceScheduledChargeParams,
  ChangePaymentMethodScheduledChargeParams,
  ChargeNowResult,
  CreateScheduledChargeParams,
  Garu,
  ListScheduledChargeAttemptsParams,
  ListScheduledChargesParams,
  MarkPaidScheduledChargeParams,
  PauseScheduledChargeParams,
  PostponeScheduledChargeParams,
  RecurrenceConfig,
  RecurrenceInterval,
  ScheduledChargeAttemptList,
  ScheduledChargeDetail,
  ScheduledChargeList,
  ScheduledChargeRecord,
  ScheduledChargeStatus,
  ScheduledChargeType,
  ScheduledPaymentMethod
} from '@garuhq/node';

import { resolveAuth } from '../lib/auth.js';
import { createGaruClient } from '../lib/client.js';
import { CliError } from '../lib/errors.js';
import { printResult, type OutputOptions } from '../lib/output.js';

export type ScheduledChargesGlobalOptions = OutputOptions & {
  apiKey?: string;
  profile?: string;
  baseUrl?: string;
  /** Injectable for tests — bypass auth resolution + SDK construction. */
  garu?: Garu;
};

/** Scheduled-charge IDs are opaque strings (e.g. `sch_abc123`), not integers. */
export type ScheduledChargesByIdOptions = ScheduledChargesGlobalOptions & {
  id: string;
};

export type ScheduledChargesCreateOptions = ScheduledChargesGlobalOptions & {
  customerId: number;
  amount: number;
  type: ScheduledChargeType;
  dueDate: string;
  methods: ScheduledPaymentMethod[];
  productId?: number;
  description?: string;
  recurrenceInterval?: RecurrenceInterval;
  recurrenceIntervalCount?: number;
  recurrenceEndsAfter?: number;
  recurrenceEndsOn?: string;
  trialDays?: number;
  externalReference?: string;
  metadata?: Record<string, unknown>;
  maxRecoveryDays?: number;
  idempotencyKey?: string;
};

export type ScheduledChargesListOptions = ScheduledChargesGlobalOptions & {
  page?: number;
  limit?: number;
  customerId?: number;
  status?: ScheduledChargeStatus[];
  type?: ScheduledChargeType;
  dueFrom?: string;
  dueTo?: string;
  search?: string;
};

export type ScheduledChargesPostponeOptions = ScheduledChargesByIdOptions & {
  newDueDate: string;
  reason?: string;
};

export type ScheduledChargesPauseOptions = ScheduledChargesByIdOptions & {
  reason?: string;
};

export type ScheduledChargesMarkPaidOptions = ScheduledChargesByIdOptions & {
  paymentDate: string;
  externalReference?: string;
  cycleNumber?: number;
};

export type ScheduledChargesCancelRecurrenceOptions = ScheduledChargesByIdOptions & {
  reason?: string;
};

export type ScheduledChargesCancelAtPeriodEndOptions = ScheduledChargesByIdOptions & {
  enabled: boolean;
};

export type ScheduledChargesChangePaymentMethodOptions = ScheduledChargesByIdOptions & {
  paymentMethodId: number;
};

export type ScheduledChargesAttemptsOptions = ScheduledChargesByIdOptions & {
  page?: number;
  limit?: number;
  cycleNumber?: number;
};

async function getClient(opts: ScheduledChargesGlobalOptions): Promise<Garu> {
  if (opts.garu) return opts.garu;
  const auth = await resolveAuth({
    ...(opts.apiKey !== undefined ? { apiKey: opts.apiKey } : {}),
    ...(opts.profile !== undefined ? { profile: opts.profile } : {})
  });
  return createGaruClient({
    auth,
    ...(opts.baseUrl !== undefined ? { baseUrl: opts.baseUrl } : {})
  });
}

/** Assemble a `RecurrenceConfig` from the `--recurrence-*` flags, if any. */
function buildRecurrence(opts: ScheduledChargesCreateOptions): RecurrenceConfig | undefined {
  if (opts.recurrenceInterval === undefined) return undefined;
  const recurrence: RecurrenceConfig = { interval: opts.recurrenceInterval };
  if (opts.recurrenceIntervalCount !== undefined)
    recurrence.intervalCount = opts.recurrenceIntervalCount;
  if (opts.recurrenceEndsAfter !== undefined) recurrence.endsAfter = opts.recurrenceEndsAfter;
  if (opts.recurrenceEndsOn !== undefined) recurrence.endsOn = opts.recurrenceEndsOn;
  return recurrence;
}

export async function scheduledChargesCreateCommand(
  opts: ScheduledChargesCreateOptions
): Promise<ScheduledChargeRecord> {
  const garu = await getClient(opts);
  const params: CreateScheduledChargeParams = {
    customerId: opts.customerId,
    amount: opts.amount,
    type: opts.type,
    dueDate: opts.dueDate,
    methods: opts.methods
  };
  if (opts.productId !== undefined) params.productId = opts.productId;
  if (opts.description !== undefined) params.description = opts.description;
  const recurrence = buildRecurrence(opts);
  if (recurrence !== undefined) params.recurrence = recurrence;
  if (opts.trialDays !== undefined) params.trialDays = opts.trialDays;
  if (opts.externalReference !== undefined) params.externalReference = opts.externalReference;
  if (opts.metadata !== undefined) params.metadata = opts.metadata;
  if (opts.maxRecoveryDays !== undefined) params.maxRecoveryDays = opts.maxRecoveryDays;
  if (opts.idempotencyKey !== undefined) params.idempotencyKey = opts.idempotencyKey;

  const charge = await garu.scheduledCharges.create(params);
  printResult(charge, { ...opts, prettyPrint: prettyScheduledCharge });
  return charge;
}

export async function scheduledChargesListCommand(
  opts: ScheduledChargesListOptions
): Promise<ScheduledChargeList> {
  const garu = await getClient(opts);
  const params: ListScheduledChargesParams = {};
  if (opts.page !== undefined) params.page = opts.page;
  if (opts.limit !== undefined) params.limit = opts.limit;
  if (opts.customerId !== undefined) params.customerId = opts.customerId;
  if (opts.status !== undefined && opts.status.length > 0) {
    params.status = opts.status.length === 1 ? opts.status[0]! : opts.status;
  }
  if (opts.type !== undefined) params.type = opts.type;
  if (opts.dueFrom !== undefined) params.dueFrom = opts.dueFrom;
  if (opts.dueTo !== undefined) params.dueTo = opts.dueTo;
  if (opts.search !== undefined) params.search = opts.search;
  const result = await garu.scheduledCharges.list(params);
  printResult(result, { ...opts, prettyPrint: prettyScheduledChargeList });
  return result;
}

export async function scheduledChargesGetCommand(
  opts: ScheduledChargesByIdOptions
): Promise<ScheduledChargeDetail> {
  const garu = await getClient(opts);
  const detail = await garu.scheduledCharges.get(opts.id);
  printResult(detail, { ...opts, prettyPrint: prettyScheduledChargeDetail });
  return detail;
}

export async function scheduledChargesPostponeCommand(
  opts: ScheduledChargesPostponeOptions
): Promise<ScheduledChargeRecord> {
  const garu = await getClient(opts);
  const params: PostponeScheduledChargeParams = { newDueDate: opts.newDueDate };
  if (opts.reason !== undefined) params.reason = opts.reason;
  const charge = await garu.scheduledCharges.postpone(opts.id, params);
  printResult(charge, { ...opts, prettyPrint: prettyScheduledCharge });
  return charge;
}

export async function scheduledChargesPauseCommand(
  opts: ScheduledChargesPauseOptions
): Promise<ScheduledChargeRecord> {
  const garu = await getClient(opts);
  const params: PauseScheduledChargeParams = {};
  if (opts.reason !== undefined) params.reason = opts.reason;
  const charge = await garu.scheduledCharges.pause(opts.id, params);
  printResult(charge, { ...opts, prettyPrint: prettyScheduledCharge });
  return charge;
}

export async function scheduledChargesResumeCommand(
  opts: ScheduledChargesByIdOptions
): Promise<ScheduledChargeRecord> {
  const garu = await getClient(opts);
  const charge = await garu.scheduledCharges.resume(opts.id);
  printResult(charge, { ...opts, prettyPrint: prettyScheduledCharge });
  return charge;
}

export async function scheduledChargesMarkPaidCommand(
  opts: ScheduledChargesMarkPaidOptions
): Promise<ScheduledChargeRecord> {
  const garu = await getClient(opts);
  const params: MarkPaidScheduledChargeParams = { paymentDate: opts.paymentDate };
  if (opts.externalReference !== undefined) params.externalReference = opts.externalReference;
  if (opts.cycleNumber !== undefined) params.cycleNumber = opts.cycleNumber;
  const charge = await garu.scheduledCharges.markPaid(opts.id, params);
  printResult(charge, { ...opts, prettyPrint: prettyScheduledCharge });
  return charge;
}

export async function scheduledChargesCancelRecurrenceCommand(
  opts: ScheduledChargesCancelRecurrenceOptions
): Promise<ScheduledChargeRecord> {
  const garu = await getClient(opts);
  const params: CancelRecurrenceScheduledChargeParams = {};
  if (opts.reason !== undefined) params.reason = opts.reason;
  const charge = await garu.scheduledCharges.cancelRecurrence(opts.id, params);
  printResult(charge, { ...opts, prettyPrint: prettyScheduledCharge });
  return charge;
}

export async function scheduledChargesCancelAtPeriodEndCommand(
  opts: ScheduledChargesCancelAtPeriodEndOptions
): Promise<ScheduledChargeRecord> {
  const garu = await getClient(opts);
  const params: CancelAtPeriodEndScheduledChargeParams = { enabled: opts.enabled };
  const charge = await garu.scheduledCharges.setCancelAtPeriodEnd(opts.id, params);
  printResult(charge, { ...opts, prettyPrint: prettyScheduledCharge });
  return charge;
}

export async function scheduledChargesChangePaymentMethodCommand(
  opts: ScheduledChargesChangePaymentMethodOptions
): Promise<ScheduledChargeRecord> {
  const garu = await getClient(opts);
  const params: ChangePaymentMethodScheduledChargeParams = {
    paymentMethodId: opts.paymentMethodId
  };
  const charge = await garu.scheduledCharges.changePaymentMethod(opts.id, params);
  printResult(charge, { ...opts, prettyPrint: prettyScheduledCharge });
  return charge;
}

export async function scheduledChargesClearPaymentMethodCommand(
  opts: ScheduledChargesByIdOptions
): Promise<ScheduledChargeRecord> {
  const garu = await getClient(opts);
  const charge = await garu.scheduledCharges.clearPaymentMethod(opts.id);
  printResult(charge, { ...opts, prettyPrint: prettyScheduledCharge });
  return charge;
}

export async function scheduledChargesAttemptsCommand(
  opts: ScheduledChargesAttemptsOptions
): Promise<ScheduledChargeAttemptList> {
  const garu = await getClient(opts);
  const params: ListScheduledChargeAttemptsParams = {};
  if (opts.page !== undefined) params.page = opts.page;
  if (opts.limit !== undefined) params.limit = opts.limit;
  if (opts.cycleNumber !== undefined) params.cycleNumber = opts.cycleNumber;
  const result = await garu.scheduledCharges.listAttempts(opts.id, params);
  printResult(result, { ...opts, prettyPrint: prettyAttemptList });
  return result;
}

/**
 * Dispatch a scheduled charge immediately (the same path the daily cron takes
 * on the due date), instead of waiting for `dueDate`. Idempotent: a cycle
 * whose d-day was already dispatched reports `already_sent` and is NOT
 * re-charged.
 *
 * The returned `message` is always printed. To compose in scripts, the process
 * exits non-zero when the outcome is `failed` or `not_sent` (4xx rejections
 * from the gateway already throw and exit non-zero on their own).
 */
export async function scheduledChargesChargeNowCommand(
  opts: ScheduledChargesByIdOptions
): Promise<ChargeNowResult> {
  const garu = await getClient(opts);
  const result = await garu.scheduledCharges.chargeNow(opts.id);
  printResult(result, { ...opts, prettyPrint: prettyChargeNow });
  if (result.outcome === 'failed' || result.outcome === 'not_sent') {
    process.exitCode = 1;
  }
  return result;
}

function prettyScheduledCharge(c: ScheduledChargeRecord): string {
  const lines = [
    `Scheduled charge ${c.id}`,
    `  status:   ${c.status}`,
    `  type:     ${c.type}`,
    `  amount:   ${c.amount}`,
    `  dueDate:  ${c.dueDate}`,
    `  methods:  ${c.methods.join(', ')}`
  ];
  if (c.description) lines.push(`  description:     ${c.description}`);
  if (c.maxRecoveryDays !== null) lines.push(`  maxRecoveryDays: ${c.maxRecoveryDays}`);
  if (c.externalReference) lines.push(`  externalRef:     ${c.externalReference}`);
  return lines.join('\n');
}

function prettyScheduledChargeList(list: ScheduledChargeList): string {
  if (list.data.length === 0) {
    return `No scheduled charges found (page ${list.meta.page}/${list.meta.totalPages || 1})`;
  }
  const header = `Scheduled charges (page ${list.meta.page}/${list.meta.totalPages || '?'}, ${list.meta.total} total)`;
  const rows = list.data.map(
    (c) =>
      `  ${c.id.padEnd(20)}  ${String(c.status).padEnd(18)}  ${String(c.type).padEnd(9)}  ${String(c.amount).padStart(10)}  ${c.dueDate}`
  );
  return [header, ...rows].join('\n');
}

function prettyScheduledChargeDetail(detail: ScheduledChargeDetail): string {
  const lines = [prettyScheduledCharge(detail.charge)];
  if (detail.events.length > 0) {
    lines.push('  events:');
    for (const e of detail.events) {
      lines.push(`    [${e.id}] ${e.eventType} (${e.createdAt})`);
    }
  }
  if (detail.transactions.length > 0) {
    lines.push('  transactions:');
    for (const t of detail.transactions) {
      lines.push(`    [${t.id}] ${t.paymentMethod} ${t.status} ${t.value} (${t.date})`);
    }
  }
  return lines.join('\n');
}

function prettyAttemptList(list: ScheduledChargeAttemptList): string {
  if (list.data.length === 0) {
    return `No billing attempts found (page ${list.meta.page}/${list.meta.totalPages || 1})`;
  }
  const header = `Billing attempts (page ${list.meta.page}/${list.meta.totalPages || '?'}, ${list.meta.total} total)`;
  const rows = list.data.map(
    (a) =>
      `  cycle ${String(a.cycleNumber).padStart(3)}  #${a.attemptNumber}  ${a.status.padEnd(10)}  ${a.paymentMethod.padEnd(7)}  ${a.failureCode ?? ''}  ${a.attemptedAt}`
  );
  return [header, ...rows].join('\n');
}

function prettyChargeNow(result: ChargeNowResult): string {
  const lines = [result.message, `  outcome: ${result.outcome}`];
  if (result.cycleNumber !== null) lines.push(`  cycle:   ${result.cycleNumber}`);
  if (result.reason) lines.push(`  reason:  ${result.reason}`);
  return lines.join('\n');
}

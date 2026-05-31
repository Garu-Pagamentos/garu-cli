import type {
  PaymentMethod,
  RecurrenceInterval,
  ScheduledChargeStatus,
  ScheduledChargeType,
  ScheduledPaymentMethod,
  WebhookEventStatus
} from '@garuhq/node';

import { CliError } from './errors.js';

/**
 * Parse a positive-integer ID from a CLI argument. The `label` is interpolated
 * into the error message so callers can give a domain-specific hint
 * (`Charge ID`, `Webhook event ID`, …) without duplicating the validation.
 */
export function parsePositiveIntId(raw: string, label: string): number {
  const id = Number.parseInt(raw, 10);
  if (!Number.isFinite(id) || id <= 0) {
    throw new CliError('invalid_input', `${label} must be a positive integer (got '${raw}')`);
  }
  return id;
}

export function parsePaymentMethod(raw: string): PaymentMethod {
  if (raw === 'pix' || raw === 'credit_card' || raw === 'boleto') return raw;
  throw new CliError(
    'invalid_input',
    `--type must be 'pix', 'credit_card', or 'boleto' (got '${raw}')`
  );
}

export function parseWebhookEventStatus(raw: string): WebhookEventStatus {
  if (raw === 'pending' || raw === 'success' || raw === 'failed') return raw;
  throw new CliError(
    'invalid_input',
    `--status must be 'pending', 'success', or 'failed' (got '${raw}')`
  );
}

export function parseScheduledChargeType(raw: string): ScheduledChargeType {
  if (raw === 'one_time' || raw === 'recurring') return raw;
  throw new CliError('invalid_input', `--type must be 'one_time' or 'recurring' (got '${raw}')`);
}

const SCHEDULED_PAYMENT_METHODS: ScheduledPaymentMethod[] = [
  'pix',
  'boleto',
  'card',
  'pix_automatic'
];

/** Split a comma-separated CLI value into trimmed, non-empty entries. */
export function parseCsvList(raw: string): string[] {
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Parse a comma-separated `--methods` list into validated payment methods. */
export function parseScheduledPaymentMethods(raw: string): ScheduledPaymentMethod[] {
  const parts = parseCsvList(raw);
  if (parts.length === 0) {
    throw new CliError(
      'invalid_input',
      `--methods must list at least one of: ${SCHEDULED_PAYMENT_METHODS.join(', ')}`
    );
  }
  for (const p of parts) {
    if (!(SCHEDULED_PAYMENT_METHODS as string[]).includes(p)) {
      throw new CliError(
        'invalid_input',
        `--methods entries must be one of ${SCHEDULED_PAYMENT_METHODS.join(', ')} (got '${p}')`
      );
    }
  }
  return parts as ScheduledPaymentMethod[];
}

const RECURRENCE_INTERVALS: RecurrenceInterval[] = [
  'weekly',
  'biweekly',
  'monthly',
  'bimonthly',
  'quarterly',
  'biannual',
  'yearly'
];

export function parseRecurrenceInterval(raw: string): RecurrenceInterval {
  if ((RECURRENCE_INTERVALS as string[]).includes(raw)) return raw as RecurrenceInterval;
  throw new CliError(
    'invalid_input',
    `--recurrence-interval must be one of ${RECURRENCE_INTERVALS.join(', ')} (got '${raw}')`
  );
}

const SCHEDULED_CHARGE_STATUSES: ScheduledChargeStatus[] = [
  'scheduled',
  'due_today',
  'overdue',
  'paid',
  'paused',
  'canceled',
  'trial',
  'pending_tokenization',
  'recurrence_canceled'
];

export function parseScheduledChargeStatus(raw: string): ScheduledChargeStatus {
  if ((SCHEDULED_CHARGE_STATUSES as string[]).includes(raw)) return raw as ScheduledChargeStatus;
  throw new CliError(
    'invalid_input',
    `--status must be one of ${SCHEDULED_CHARGE_STATUSES.join(', ')} (got '${raw}')`
  );
}

/** Parse a strict integer and assert it falls within `[min, max]`. Rejects floats. */
export function parseIntInRange(raw: string, label: string, min: number, max: number): number {
  const trimmed = raw.trim();
  const n = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(n) || String(n) !== trimmed || n < min || n > max) {
    throw new CliError(
      'invalid_input',
      `${label} must be an integer between ${min} and ${max} (got '${raw}')`
    );
  }
  return n;
}

/** Parse a non-negative integer (e.g. a price in centavos, where `0` is valid). Rejects floats. */
export function parseNonNegativeInt(raw: string, label: string): number {
  const trimmed = raw.trim();
  const n = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(n) || String(n) !== trimmed || n < 0) {
    throw new CliError('invalid_input', `${label} must be a non-negative integer (got '${raw}')`);
  }
  return n;
}

/** Parse a positive decimal BRL amount (e.g. `297.50`). */
export function parseAmountBrl(raw: string): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) {
    throw new CliError(
      'invalid_input',
      `--amount must be a positive decimal in BRL, e.g. 297.50 (got '${raw}')`
    );
  }
  return n;
}

/** Parse a JSON object literal for `--metadata`. Rejects non-object JSON. */
export function parseMetadata(raw: string): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new CliError('invalid_input', `--metadata must be valid JSON (got '${raw}')`);
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new CliError('invalid_input', `--metadata must be a JSON object`);
  }
  return parsed as Record<string, unknown>;
}

import type { PaymentMethod, WebhookEventStatus } from '@garuhq/node';

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

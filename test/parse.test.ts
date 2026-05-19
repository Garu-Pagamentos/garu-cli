import { describe, expect, it } from 'vitest';

import { CliError } from '../src/lib/errors.js';
import {
  parsePaymentMethod,
  parsePositiveIntId,
  parseWebhookEventStatus
} from '../src/lib/parse.js';

describe('parsePositiveIntId', () => {
  it('parses a positive integer', () => {
    expect(parsePositiveIntId('42', 'Charge ID')).toBe(42);
  });

  it('interpolates the label into the error message', () => {
    expect(() => parsePositiveIntId('abc', 'Webhook event ID')).toThrowError(
      /Webhook event ID must be a positive integer/
    );
  });

  it.each(['0', '-1', 'abc', ''])('rejects %s as a CliError', (raw) => {
    expect(() => parsePositiveIntId(raw, 'Charge ID')).toThrow(CliError);
  });
});

describe('parsePaymentMethod', () => {
  it.each(['pix', 'credit_card', 'boleto'] as const)('accepts %s', (method) => {
    expect(parsePaymentMethod(method)).toBe(method);
  });

  it('rejects an unknown payment method with a CliError', () => {
    expect(() => parsePaymentMethod('crypto')).toThrow(CliError);
  });
});

describe('parseWebhookEventStatus', () => {
  it.each(['pending', 'success', 'failed'] as const)('accepts %s', (status) => {
    expect(parseWebhookEventStatus(status)).toBe(status);
  });

  it('rejects an unknown status with a CliError', () => {
    expect(() => parseWebhookEventStatus('delivered')).toThrow(CliError);
  });
});

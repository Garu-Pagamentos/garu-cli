import { describe, expect, it } from 'vitest';

import { CliError } from '../src/lib/errors.js';
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

describe('parseScheduledChargeType', () => {
  it.each(['one_time', 'recurring'] as const)('accepts %s', (type) => {
    expect(parseScheduledChargeType(type)).toBe(type);
  });

  it('rejects an unknown type with a CliError', () => {
    expect(() => parseScheduledChargeType('subscription')).toThrow(CliError);
  });
});

describe('parseScheduledPaymentMethods', () => {
  it('parses a comma-separated list, trimming whitespace', () => {
    expect(parseScheduledPaymentMethods('pix, boleto ,card')).toEqual(['pix', 'boleto', 'card']);
  });

  it('parses a single method', () => {
    expect(parseScheduledPaymentMethods('pix')).toEqual(['pix']);
  });

  it('accepts pix_automatic', () => {
    expect(parseScheduledPaymentMethods('pix_automatic')).toEqual(['pix_automatic']);
  });

  it.each(['', 'crypto', 'pix,crypto'])('rejects %s as a CliError', (raw) => {
    expect(() => parseScheduledPaymentMethods(raw)).toThrow(CliError);
  });
});

describe('parseRecurrenceInterval', () => {
  it.each(['weekly', 'monthly', 'yearly'] as const)('accepts %s', (interval) => {
    expect(parseRecurrenceInterval(interval)).toBe(interval);
  });

  it('rejects an unknown interval with a CliError', () => {
    expect(() => parseRecurrenceInterval('daily')).toThrow(CliError);
  });
});

describe('parseScheduledChargeStatus', () => {
  it.each(['scheduled', 'due_today', 'overdue', 'recurrence_canceled'] as const)(
    'accepts %s',
    (status) => {
      expect(parseScheduledChargeStatus(status)).toBe(status);
    }
  );

  it('rejects an unknown status with a CliError', () => {
    expect(() => parseScheduledChargeStatus('refunded')).toThrow(CliError);
  });
});

describe('parseIntInRange', () => {
  it('parses an in-range integer', () => {
    expect(parseIntInRange('14', '--max-recovery-days', 1, 365)).toBe(14);
  });

  it('accepts the inclusive bounds', () => {
    expect(parseIntInRange('1', '--max-recovery-days', 1, 365)).toBe(1);
    expect(parseIntInRange('365', '--max-recovery-days', 1, 365)).toBe(365);
  });

  it('interpolates the label into the error message', () => {
    expect(() => parseIntInRange('0', '--max-recovery-days', 1, 365)).toThrowError(
      /--max-recovery-days must be an integer between 1 and 365/
    );
  });

  it.each(['0', '366', '-5', 'abc', '14.5', ''])('rejects %s as a CliError', (raw) => {
    expect(() => parseIntInRange(raw, '--max-recovery-days', 1, 365)).toThrow(CliError);
  });
});

describe('parseAmountBrl', () => {
  it.each([
    ['297.50', 297.5],
    ['10', 10],
    ['0.01', 0.01]
  ])('parses %s as %d', (raw, expected) => {
    expect(parseAmountBrl(raw)).toBe(expected);
  });

  it.each(['0', '-1', 'abc', ''])('rejects %s as a CliError', (raw) => {
    expect(() => parseAmountBrl(raw)).toThrow(CliError);
  });
});

describe('parseMetadata', () => {
  it('parses a JSON object', () => {
    expect(parseMetadata('{"plan":"pro","seats":3}')).toEqual({ plan: 'pro', seats: 3 });
  });

  it.each(['not json', '[1,2,3]', '"a string"', '42'])(
    'rejects non-object JSON %s as a CliError',
    (raw) => {
      expect(() => parseMetadata(raw)).toThrow(CliError);
    }
  );
});

describe('parseCsvList', () => {
  it('splits, trims, and drops empty entries', () => {
    expect(parseCsvList('curso, ebook ,, mentoria ')).toEqual(['curso', 'ebook', 'mentoria']);
  });

  it('returns an empty array for an empty or whitespace string', () => {
    expect(parseCsvList('  ,  ')).toEqual([]);
  });
});

describe('parseNonNegativeInt', () => {
  it('accepts zero', () => {
    expect(parseNonNegativeInt('0', '--value')).toBe(0);
  });

  it('accepts a positive integer', () => {
    expect(parseNonNegativeInt('4990', '--value')).toBe(4990);
  });

  it('interpolates the label into the error message', () => {
    expect(() => parseNonNegativeInt('-1', '--value')).toThrowError(
      /--value must be a non-negative integer/
    );
  });

  it.each(['-1', '1.5', 'abc', ''])('rejects %s as a CliError', (raw) => {
    expect(() => parseNonNegativeInt(raw, '--value')).toThrow(CliError);
  });
});

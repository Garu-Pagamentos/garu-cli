import type {
  Garu,
  ListWebhookEventsParams,
  WebhookEvent,
  WebhookEventList,
  WebhookEventStatus
} from '@garuhq/node';
import pc from 'picocolors';

import { resolveAuth } from '../lib/auth.js';
import { createGaruClient } from '../lib/client.js';
import { printResult, printSuccess, type OutputOptions } from '../lib/output.js';

export type WebhooksGlobalOptions = OutputOptions & {
  apiKey?: string;
  profile?: string;
  baseUrl?: string;
  /** Injectable for tests — bypass auth resolution + SDK construction. */
  garu?: Garu;
};

export type WebhooksEventsListOptions = WebhooksGlobalOptions & {
  page?: number;
  limit?: number;
  status?: WebhookEventStatus;
  eventType?: string;
  endpointId?: number;
};

/** Webhook event IDs are public uuids. */
export type WebhooksEventsByUuidOptions = WebhooksGlobalOptions & {
  uuid: string;
};

async function getClient(opts: WebhooksGlobalOptions): Promise<Garu> {
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

export async function webhooksEventsListCommand(
  opts: WebhooksEventsListOptions
): Promise<WebhookEventList> {
  const garu = await getClient(opts);
  const params: ListWebhookEventsParams = {};
  if (opts.page !== undefined) params.page = opts.page;
  if (opts.limit !== undefined) params.limit = opts.limit;
  if (opts.status !== undefined) params.status = opts.status;
  if (opts.eventType !== undefined) params.eventType = opts.eventType;
  if (opts.endpointId !== undefined) params.endpointId = opts.endpointId;
  const result = await garu.webhookEvents.list(params);
  printResult(result, { ...opts, prettyPrint: prettyWebhookEventList });
  return result;
}

export async function webhooksEventsGetCommand(
  opts: WebhooksEventsByUuidOptions
): Promise<WebhookEvent> {
  const garu = await getClient(opts);
  const event = await garu.webhookEvents.get(opts.uuid);
  printResult(event, { ...opts, prettyPrint: prettyWebhookEvent });
  return event;
}

export async function webhooksEventsRetryCommand(
  opts: WebhooksEventsByUuidOptions
): Promise<WebhookEvent> {
  const garu = await getClient(opts);
  const event = await garu.webhookEvents.retry(opts.uuid);
  printResult(event, { ...opts, prettyPrint: prettyWebhookEvent });
  return event;
}

export async function webhooksEventsResendCommand(
  opts: WebhooksEventsByUuidOptions
): Promise<WebhookEvent> {
  const garu = await getClient(opts);
  const clone = await garu.webhookEvents.resend(opts.uuid);
  printSuccess(`Resent event ${opts.uuid} → new event ${clone.uuid}`, opts);
  printResult(clone, { ...opts, prettyPrint: prettyWebhookEvent });
  return clone;
}

// `'pending'` and `'success'` are 7 chars; `'failed'` is 6. Pad the raw status
// to 7 BEFORE wrapping in color so the ANSI escape sequences don't throw off
// column alignment (.padEnd on a colored string measures bytes, not glyphs).
function statusBadge(status: WebhookEventStatus): string {
  const padded = status.padEnd(7);
  if (status === 'success') return pc.green(padded);
  if (status === 'failed') return pc.red(padded);
  return pc.yellow(padded);
}

function prettyWebhookEventList(list: WebhookEventList): string {
  if (list.data.length === 0) return 'No webhook events found';
  const header = `Webhook events (${list.count} of ${list.totalCount} total, ${list.totalPages} page(s))`;
  const rows = list.data.map(
    (e) =>
      `  ${e.uuid}  ${statusBadge(e.status)}  attempts=${String(e.attempts).padStart(2)}  ${e.eventType.padEnd(38)}  ${e.createdAt}`
  );
  return [header, ...rows].join('\n');
}

function prettyWebhookEvent(event: WebhookEvent): string {
  const lines = [
    `Webhook event ${event.uuid}`,
    `  status:        ${statusBadge(event.status)}`,
    `  eventType:     ${event.eventType}`,
    `  attempts:      ${event.attempts}`,
    `  endpoint:      [${event.webhookEndpoint.id}] ${event.webhookEndpoint.url}`,
    `  createdAt:     ${event.createdAt}`
  ];
  if (event.manualResendOf !== null) lines.push(`  resendOf:      ${event.manualResendOf}`);
  if (event.lastAttemptAt) lines.push(`  lastAttemptAt: ${event.lastAttemptAt}`);
  if (event.nextRetryAt) lines.push(`  nextRetryAt:   ${event.nextRetryAt}`);
  if (event.responseStatus !== null) lines.push(`  responseStatus: ${event.responseStatus}`);
  if (event.responseBody) {
    const body =
      event.responseBody.length > 200 ? `${event.responseBody.slice(0, 200)}…` : event.responseBody;
    lines.push(`  responseBody:  ${body}`);
  }
  return lines.join('\n');
}

import { DURATION_MINUTES, LOCATION } from "./constants";

export type WebhookPayload = {
  name: string;
  email: string;
  start: string;
  durationMinutes: typeof DURATION_MINUTES;
  note: string;
  sleepover: boolean;
  location: typeof LOCATION;
};

export type WebhookRecord = {
  name: string;
  email: string;
  start: string;
  note: string;
  sleepover: boolean;
};

const NOT_CONFIGURED = "Booking invite webhook was not configured";

export function webhookPayload(record: WebhookRecord): WebhookPayload {
  return {
    name: record.name,
    email: record.email,
    start: record.start,
    durationMinutes: DURATION_MINUTES,
    note: record.note,
    sleepover: record.sleepover,
    location: LOCATION,
  };
}

type SendOptions = {
  fetchImpl?: typeof fetch;
  env?: { url?: string; key?: string };
  warn?: (message: string) => void;
  error?: (message: string, detail?: unknown) => void;
};

export async function sendBookingWebhook(
  record: WebhookRecord,
  options: SendOptions = {},
): Promise<void> {
  const warn = options.warn ?? ((message) => console.warn(message));
  const error = options.error ?? ((message, detail) => console.error(message, detail));
  const url = (options.env?.url ?? process.env.BOOKING_WEBHOOK_URL)?.trim();
  const key = (options.env?.key ?? process.env.BOOKING_WEBHOOK_KEY)?.trim();

  if (!url) {
    warn(NOT_CONFIGURED);
    return;
  }

  if (!/^https?:\/\//i.test(url)) {
    error("Booking invite webhook URL is invalid");
    return;
  }

  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  if (key) headers["x-webhook-key"] = key;

  const fetchImpl = options.fetchImpl ?? fetch;
  try {
    const response = await fetchImpl(url, {
      method: "POST",
      headers,
      body: JSON.stringify(webhookPayload(record)),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      error(`Booking invite webhook failed with status ${response.status}`);
    }
  } catch (cause) {
    error("Booking invite webhook failed", cause);
  }
}

import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { LOCATION } from "../lib/constants";
import { buildEvenings, findOpenSlot } from "../lib/slots";
import { FileBookingStore, bookingPath, startUtcFromPath } from "../lib/store";
import { toOffsetIso } from "../lib/time";
import { parseBookingForm } from "../lib/validate";
import { sendBookingWebhook, webhookPayload } from "../lib/webhook";

const FIVE_PM_EDT = new Date("2026-09-29T21:00:00.000Z");

describe("overnight slots", () => {
  it("offers 6:00pm through 8:00am for 21 evenings", () => {
    const evenings = buildEvenings(FIVE_PM_EDT);
    assert.equal(evenings.length, 21);
    assert.equal(evenings[0].id, "2026-09-29");
    assert.equal(evenings[0].slots[0].label, "6:00 PM");
    assert.equal(evenings[0].slots[0].start, "2026-09-29T18:00:00-04:00");
    assert.equal(evenings[0].slots.at(-1)?.label, "8:00 AM");
    assert.equal(evenings[0].slots.at(-1)?.start, "2026-09-30T08:00:00-04:00");
    assert.equal(evenings[0].slots.length, 29);
    assert.equal(evenings[0].slots.filter((slot) => slot.period === "evening").length, 12);
    assert.equal(evenings[0].slots.filter((slot) => slot.period === "morning").length, 17);
  });

  it("hides times that have already started and keeps the current night before 8am", () => {
    const sevenFifteen = new Date("2026-09-29T23:15:00.000Z");
    const tonight = buildEvenings(sevenFifteen)[0];
    assert.equal(tonight.slots[0].label, "7:30 PM");
    assert.equal(tonight.slots.some((slot) => slot.label === "6:00 PM"), false);

    const twoAm = new Date("2026-09-30T06:00:00.000Z");
    const stillTonight = buildEvenings(twoAm)[0];
    assert.equal(stillTonight.id, "2026-09-29");
    assert.equal(stillTonight.slots[0].label, "2:30 AM");
    assert.equal(stillTonight.slots.at(-1)?.label, "8:00 AM");
  });

  it("skips the spring-forward gap and keeps both fall-back hours", () => {
    const beforeSpring = new Date("2026-03-07T16:00:00.000Z");
    const springNight = buildEvenings(beforeSpring).find((evening) => evening.id === "2026-03-07");
    assert.ok(springNight);
    const springLabels = springNight.slots.map((slot) => slot.label);
    assert.equal(springLabels.includes("2:00 AM"), false);
    assert.equal(springLabels.includes("2:30 AM"), false);
    assert.equal(springLabels.includes("1:30 AM"), true);
    assert.equal(springLabels.includes("3:00 AM"), true);
    assert.equal(springNight.slots.length, 27);

    const beforeFall = new Date("2026-10-31T16:00:00.000Z");
    const fallNight = buildEvenings(beforeFall).find((evening) => evening.id === "2026-10-31");
    assert.ok(fallNight);
    const fallLabels = fallNight.slots.map((slot) => slot.label);
    assert.equal(fallLabels.filter((label) => label === "1:00 AM EDT").length, 1);
    assert.equal(fallLabels.filter((label) => label === "1:00 AM EST").length, 1);
    assert.equal(fallLabels.filter((label) => label === "1:30 AM EDT").length, 1);
    assert.equal(fallLabels.filter((label) => label === "1:30 AM EST").length, 1);
    assert.equal(fallNight.slots.length, 31);
  });
});

describe("offset timestamps", () => {
  it("uses the America/New_York offset", () => {
    assert.equal(toOffsetIso(new Date("2026-01-15T13:00:00.000Z")), "2026-01-15T08:00:00-05:00");
    assert.equal(toOffsetIso(new Date("2026-07-15T12:00:00.000Z")), "2026-07-15T08:00:00-04:00");
  });
});

describe("validation", () => {
  it("accepts a booking and leaves sleepover unchecked by default", () => {
    const form = new FormData();
    form.set("name", " Ada ");
    form.set("email", "Ada@Example.com");
    form.set("note", "  hello ");
    form.set("startUtc", "2026-09-29T22:00:00.000Z");
    const parsed = parseBookingForm(form);
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.deepEqual(parsed.value, {
      name: "Ada",
      email: "ada@example.com",
      note: "hello",
      sleepover: false,
      startUtc: "2026-09-29T22:00:00.000Z",
    });
  });

  it("reads the sleepover checkbox and rejects a bad email", () => {
    const form = new FormData();
    form.set("name", "Ada");
    form.set("email", "not-an-email");
    form.set("sleepover", "true");
    form.set("startUtc", "2026-09-29T22:00:00.000Z");
    const parsed = parseBookingForm(form);
    assert.equal(parsed.ok, false);

    form.set("email", "ada@example.com");
    const checked = parseBookingForm(form);
    assert.equal(checked.ok, true);
    if (checked.ok) assert.equal(checked.value.sleepover, true);
  });
});

describe("webhook", () => {
  const record = {
    name: "Ada Lovelace",
    email: "ada@example.com",
    start: "2026-09-29T18:00:00-04:00",
    note: "Bring the book",
    sleepover: true,
  };

  it("includes sleepover and the apartment in the JSON body", () => {
    assert.deepEqual(webhookPayload(record), {
      name: "Ada Lovelace",
      email: "ada@example.com",
      start: "2026-09-29T18:00:00-04:00",
      durationMinutes: 30,
      note: "Bring the book",
      sleepover: true,
      location: LOCATION,
    });
    assert.equal(LOCATION, "50 Lexington Ave, Apt. 15A, New York");
  });

  it("posts the key header only when configured", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    await sendBookingWebhook(record, {
      env: { url: "https://hooks.example/book", key: "secret-key" },
      fetchImpl: async (url, init) => {
        calls.push({ url: String(url), init: init ?? {} });
        return new Response("ok", { status: 200 });
      },
    });
    assert.equal(calls.length, 1);
    const headers = new Headers(calls[0].init.headers);
    assert.equal(headers.get("x-webhook-key"), "secret-key");
    assert.equal(calls[0].init.method, "POST");
    assert.deepEqual(JSON.parse(String(calls[0].init.body)), webhookPayload(record));
  });

  it("logs and skips the call when the webhook is not configured", async () => {
    let warned = "";
    let fetched = false;
    await sendBookingWebhook(
      { ...record, sleepover: false, note: "" },
      {
        env: { url: "", key: "" },
        warn: (message) => {
          warned = message;
        },
        fetchImpl: async () => {
          fetched = true;
          return new Response("ok");
        },
      },
    );
    assert.equal(fetched, false);
    assert.equal(warned, "Booking invite webhook was not configured");
  });
});

describe("booking store", () => {
  it("round-trips slot ids and refuses a second booking", async () => {
    const startUtc = "2026-09-29T22:00:00.000Z";
    assert.equal(startUtcFromPath(bookingPath(startUtc)), startUtc);

    const dir = await mkdtemp(join(tmpdir(), "meet-bookings-"));
    const store = new FileBookingStore(dir);
    const record = {
      name: "Ada",
      email: "ada@example.com",
      note: "",
      sleepover: false,
      location: LOCATION,
      start: "2026-09-29T18:00:00-04:00",
      startUtc,
      durationMinutes: 30 as const,
      createdAt: "2026-09-29T20:00:00.000Z",
    };
    assert.equal(await store.create(record), "created");
    assert.equal(await store.create({ ...record, sleepover: true }), "taken");
    assert.deepEqual([...(await store.takenStartUtcs())], [startUtc]);
    const saved = JSON.parse(await readFile(join(dir, bookingPath(startUtc).slice("bookings/".length)), "utf8"));
    assert.equal(saved.sleepover, false);
    assert.equal(saved.location, LOCATION);
  });

  it("only accepts a slot inside the open window", () => {
    const slot = findOpenSlot("2026-09-29T22:00:00.000Z", FIVE_PM_EDT);
    assert.equal(slot?.start, "2026-09-29T18:00:00-04:00");
    assert.equal(findOpenSlot("2026-09-29T16:00:00.000Z", FIVE_PM_EDT), null);
  });
});

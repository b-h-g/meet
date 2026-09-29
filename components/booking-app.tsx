"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { bookMeeting, type BookState } from "@/app/actions";
import { LOCATION } from "@/lib/constants";
import type { Evening, Slot } from "@/lib/slots";

const initialState: BookState = { status: "idle" };

export function BookingApp({ evenings }: { evenings: Evening[] }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(bookMeeting, initialState);
  const [dismissed, setDismissed] = useState(false);
  const firstOpen = evenings.find((evening) => evening.slots.length > 0)?.id ?? evenings[0]?.id ?? "";
  const [eveningId, setEveningId] = useState(firstOpen);
  const [startUtc, setStartUtc] = useState<string | null>(null);

  const evening = evenings.find((item) => item.id === eveningId) ?? evenings[0];
  const selected = evening?.slots.find((slot) => slot.startUtc === startUtc) ?? null;
  const confirmed = state.status === "confirmed" && !dismissed ? state.confirmation : null;

  useEffect(() => {
    if (state.status === "error" && state.message.includes("just taken")) {
      router.refresh();
    }
  }, [state, router]);

  const eveningSlots = useMemo(() => evening?.slots.filter((slot) => slot.period === "evening") ?? [], [evening]);
  const morningSlots = useMemo(() => evening?.slots.filter((slot) => slot.period === "morning") ?? [], [evening]);

  if (confirmed) {
    return (
      <section aria-live="polite" data-testid="confirmation" className="rounded-3xl bg-card px-6 py-8 shadow-[0_1px_0_rgba(28,25,21,0.04)]">
        <p className="text-sm text-muted">Confirmed</p>
        <h2 className="font-display mt-2 text-4xl font-light tracking-tight">You&apos;re booked</h2>
        <dl className="mt-8 space-y-4 text-sm">
          <div>
            <dt className="text-muted">Who</dt>
            <dd className="mt-1 text-base text-ink">{confirmed.name}</dd>
            <dd className="text-muted">{confirmed.email}</dd>
          </div>
          <div>
            <dt className="text-muted">When</dt>
            <dd className="mt-1 text-base text-ink">{confirmed.whenLabel}</dd>
          </div>
          <div>
            <dt className="text-muted">Where</dt>
            <dd className="mt-1 text-base text-ink">{confirmed.location}</dd>
          </div>
          {confirmed.note ? (
            <div>
              <dt className="text-muted">Note</dt>
              <dd className="mt-1 text-base text-ink">{confirmed.note}</dd>
            </div>
          ) : null}
        </dl>
        {confirmed.sleepover ? (
          <p className="mt-8 text-base text-ink">This is a sleepover.</p>
        ) : null}
        <p className={`${confirmed.sleepover ? "mt-2" : "mt-8"} text-base text-ink`}>
          A calendar invite is on the way.
        </p>
        <button
          type="button"
          className="mt-8 text-sm text-muted underline decoration-line underline-offset-4"
          onClick={() => {
            setDismissed(true);
            setStartUtc(null);
            router.refresh();
          }}
        >
          Book another time
        </button>
      </section>
    );
  }

  return (
    <div>
      <div
        role="group"
        aria-label="Choose an evening"
        className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-2"
      >
        {evenings.map((day) => {
          const pressed = day.id === evening?.id;
          return (
            <button
              key={day.id}
              type="button"
              data-testid="day"
              aria-pressed={pressed}
              onClick={() => {
                setEveningId(day.id);
                setStartUtc(null);
              }}
              className={`flex h-[4.5rem] w-16 shrink-0 flex-col items-center justify-center rounded-2xl border text-center ${
                pressed ? "border-ink bg-ink text-card" : "border-line bg-card text-ink"
              }`}
            >
              <span className={`text-[0.7rem] tracking-wide ${pressed ? "text-card/70" : "text-muted"}`}>
                {day.weekday}
              </span>
              <span className="text-lg leading-none">{day.day}</span>
              <span className={`text-[0.7rem] ${pressed ? "text-card/70" : "text-muted"}`}>{day.month}</span>
            </button>
          );
        })}
      </div>

      {evening ? (
        <section className="mt-8" aria-label={evening.label}>
          <h2 className="font-display text-2xl font-light">{evening.label}</h2>
          <p className="mt-1 text-sm text-muted">6:00 PM through 8:00 AM</p>
          {evening.slots.length === 0 ? (
            <p className="mt-8 text-sm text-muted">Nothing open this evening.</p>
          ) : (
            <div className="mt-6 space-y-6">
              <SlotGroup title="Evening" slots={eveningSlots} selected={startUtc} onSelect={setStartUtc} />
              <SlotGroup title="After midnight" slots={morningSlots} selected={startUtc} onSelect={setStartUtc} />
            </div>
          )}
        </section>
      ) : null}

      {state.status === "error" ? (
        <p role="alert" className="mt-6 text-sm text-ink">
          {state.message}
        </p>
      ) : null}

      {selected ? (
        <form
          action={formAction}
          className="mt-8 rounded-3xl border border-line bg-card p-5"
          onSubmit={() => setDismissed(false)}
        >
          <h2 className="text-base font-medium">{selected.whenLabel}</h2>
          <p className="mt-1 text-sm text-muted">{LOCATION}</p>
          <input type="hidden" name="startUtc" value={selected.startUtc} />
          <div className="mt-5 space-y-4">
            <Field label="Name" name="name" type="text" autoComplete="name" required />
            <Field label="Email" name="email" type="email" autoComplete="email" required />
            <label className="block text-sm" htmlFor="note">
              Note <span className="text-muted">(optional)</span>
              <textarea
                id="note"
                name="note"
                rows={3}
                maxLength={400}
                className="mt-2 w-full resize-none rounded-2xl border border-line bg-paper px-3 py-3 text-base outline-none focus:border-ink"
              />
            </label>
            <label className="flex items-center gap-3 text-sm">
              <input
                type="checkbox"
                name="sleepover"
                value="true"
                data-testid="sleepover"
                className="size-4 accent-ink"
              />
              Sleepover
            </label>
          </div>
          <button
            type="submit"
            data-testid="confirm"
            disabled={pending}
            className="mt-6 h-12 w-full rounded-full bg-ink text-sm text-card disabled:opacity-60"
          >
            {pending ? "Confirming…" : "Confirm"}
          </button>
        </form>
      ) : null}
    </div>
  );
}

function SlotGroup({
  title,
  slots,
  selected,
  onSelect,
}: {
  title: string;
  slots: Slot[];
  selected: string | null;
  onSelect: (startUtc: string) => void;
}) {
  if (slots.length === 0) return null;
  return (
    <div>
      <h3 className="text-xs tracking-wide text-muted uppercase">{title}</h3>
      <div className="mt-3 flex flex-wrap gap-2">
        {slots.map((slot) => {
          const pressed = slot.startUtc === selected;
          return (
            <button
              key={slot.startUtc}
              type="button"
              data-testid="slot"
              aria-pressed={pressed}
              onClick={() => onSelect(slot.startUtc)}
              className={`h-11 rounded-full border px-4 text-sm ${
                pressed ? "border-ink bg-ink text-card" : "border-line bg-card text-ink"
              }`}
            >
              {slot.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Field({
  label,
  name,
  type,
  autoComplete,
  required,
}: {
  label: string;
  name: string;
  type: string;
  autoComplete: string;
  required?: boolean;
}) {
  return (
    <label className="block text-sm" htmlFor={name}>
      {label}
      <input
        id={name}
        name={name}
        type={type}
        autoComplete={autoComplete}
        required={required}
        maxLength={name === "name" ? 80 : 254}
        className="mt-2 h-12 w-full rounded-2xl border border-line bg-paper px-3 text-base outline-none focus:border-ink"
      />
    </label>
  );
}

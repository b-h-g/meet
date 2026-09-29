import { BookingApp } from "@/components/booking-app";
import { HOST_NAME, LOCATION } from "@/lib/constants";
import { buildEvenings } from "@/lib/slots";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [evenings, taken] = await Promise.all([
    Promise.resolve(buildEvenings(new Date())),
    getStore().takenStartUtcs(),
  ]);

  const openEvenings = evenings.map((evening) => ({
    ...evening,
    slots: evening.slots.filter((slot) => !taken.has(slot.startUtc)),
  }));

  return (
    <main className="mx-auto min-h-full w-full max-w-lg px-5 py-14 sm:py-20">
      <header className="mb-10">
        <h1 className="font-display text-[2.6rem] leading-none font-light tracking-tight text-ink">
          {HOST_NAME}
        </h1>
        <p className="mt-4 text-base text-muted">After work. Thirty minutes. Eastern Time.</p>
        <address className="mt-3 text-sm text-ink not-italic">{LOCATION}</address>
      </header>
      <BookingApp evenings={openEvenings} />
    </main>
  );
}

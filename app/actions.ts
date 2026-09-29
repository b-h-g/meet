"use server";

import { revalidatePath } from "next/cache";
import { DURATION_MINUTES, LOCATION } from "@/lib/constants";
import { findOpenSlot } from "@/lib/slots";
import { getStore, type BookingRecord } from "@/lib/store";
import { parseBookingForm } from "@/lib/validate";
import { sendBookingWebhook } from "@/lib/webhook";

export type Confirmation = {
  name: string;
  email: string;
  whenLabel: string;
  note: string;
  sleepover: boolean;
  location: string;
};

export type BookState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "confirmed"; confirmation: Confirmation };

export async function bookMeeting(
  _previous: BookState,
  formData: FormData,
): Promise<BookState> {
  const parsed = parseBookingForm(formData);
  if (!parsed.ok) return { status: "error", message: parsed.message };

  const now = new Date();
  const slot = findOpenSlot(parsed.value.startUtc, now);
  if (!slot) return { status: "error", message: "That time is not open." };

  const record: BookingRecord = {
    name: parsed.value.name,
    email: parsed.value.email,
    note: parsed.value.note,
    sleepover: parsed.value.sleepover,
    location: LOCATION,
    start: slot.start,
    startUtc: slot.startUtc,
    durationMinutes: DURATION_MINUTES,
    createdAt: new Date().toISOString(),
  };

  try {
    const saved = await getStore().create(record);
    if (saved === "taken") {
      return { status: "error", message: "That time was just taken. Choose another." };
    }
  } catch (error) {
    console.error("Failed to save booking", error);
    return { status: "error", message: "Could not save that booking. Try again." };
  }

  await sendBookingWebhook(record);
  revalidatePath("/");

  return {
    status: "confirmed",
    confirmation: {
      name: record.name,
      email: record.email,
      whenLabel: slot.whenLabel,
      note: record.note,
      sleepover: record.sleepover,
      location: record.location,
    },
  };
}

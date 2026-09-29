import { NAME_MAX, NOTE_MAX } from "./constants";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type BookingInput = {
  name: string;
  email: string;
  note: string;
  sleepover: boolean;
  startUtc: string;
};

export type ValidationResult =
  | { ok: true; value: BookingInput }
  | { ok: false; message: string };

export function parseBookingForm(formData: FormData): ValidationResult {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const note = String(formData.get("note") ?? "").trim();
  const sleepoverRaw = String(formData.get("sleepover") ?? "");
  const sleepover = sleepoverRaw === "true" || sleepoverRaw === "on";
  const startUtc = String(formData.get("startUtc") ?? "").trim();

  if (!name) return { ok: false, message: "Enter your name." };
  if (name.length > NAME_MAX) return { ok: false, message: "Name is too long." };
  if (!email || email.length > 254 || !EMAIL.test(email)) {
    return { ok: false, message: "Enter a valid email." };
  }
  if (note.length > NOTE_MAX) {
    return { ok: false, message: "Keep the note under 400 characters." };
  }
  if (!startUtc) return { ok: false, message: "Choose a time." };

  return { ok: true, value: { name, email, note, sleepover, startUtc } };
}

import { mkdir, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { head, list, put, BlobNotFoundError } from "@vercel/blob";
import { DURATION_MINUTES } from "./constants";

export type BookingRecord = {
  name: string;
  email: string;
  note: string;
  sleepover: boolean;
  location: string;
  start: string;
  startUtc: string;
  durationMinutes: typeof DURATION_MINUTES;
  createdAt: string;
};

export interface BookingStore {
  takenStartUtcs(): Promise<Set<string>>;
  create(record: BookingRecord): Promise<"created" | "taken">;
}

const START_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

export function bookingPath(startUtc: string): string {
  if (!START_UTC.test(startUtc)) throw new Error("Invalid slot id");
  return `bookings/${startUtc.replace(/:/g, "-")}.json`;
}

export function startUtcFromPath(pathname: string): string | null {
  const match = pathname.match(
    /bookings\/(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.\d{3}Z)\.json$/,
  );
  if (!match) return null;
  const [date, time] = match[1].split("T");
  const [hour, minute, rest] = time.split("-");
  return `${date}T${hour}:${minute}:${rest}`;
}

export class FileBookingStore implements BookingStore {
  constructor(private readonly dir: string) {}

  async takenStartUtcs(): Promise<Set<string>> {
    let names: string[];
    try {
      names = await readdir(this.dir);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return new Set();
      throw error;
    }
    const taken = new Set<string>();
    for (const name of names) {
      const startUtc = startUtcFromPath(`bookings/${name}`);
      if (startUtc) taken.add(startUtc);
    }
    return taken;
  }

  async create(record: BookingRecord): Promise<"created" | "taken"> {
    await mkdir(this.dir, { recursive: true });
    const filename = bookingPath(record.startUtc).slice("bookings/".length);
    try {
      await writeFile(join(this.dir, filename), JSON.stringify(record), { flag: "wx" });
      return "created";
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EEXIST") return "taken";
      throw error;
    }
  }
}

export class BlobBookingStore implements BookingStore {
  async takenStartUtcs(): Promise<Set<string>> {
    const taken = new Set<string>();
    let cursor: string | undefined;
    do {
      const page = await list({ prefix: "bookings/", cursor, limit: 1000 });
      for (const blob of page.blobs) {
        const startUtc = startUtcFromPath(blob.pathname);
        if (startUtc) taken.add(startUtc);
      }
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);
    return taken;
  }

  async create(record: BookingRecord): Promise<"created" | "taken"> {
    const pathname = bookingPath(record.startUtc);
    try {
      await put(pathname, JSON.stringify(record), {
        access: "private",
        addRandomSuffix: false,
        allowOverwrite: false,
        contentType: "application/json",
        cacheControlMaxAge: 0,
      });
      return "created";
    } catch (error) {
      if (await blobExists(pathname)) return "taken";
      throw error;
    }
  }
}

async function blobExists(pathname: string): Promise<boolean> {
  try {
    await head(pathname);
    return true;
  } catch (error) {
    if (error instanceof BlobNotFoundError) return false;
    return false;
  }
}

export function getStore(): BookingStore {
  if (process.env.BLOB_READ_WRITE_TOKEN) return new BlobBookingStore();
  if (process.env.VERCEL) {
    throw new Error("BLOB_READ_WRITE_TOKEN is not set");
  }
  const dir = process.env.BOOKINGS_DIR ?? join(process.cwd(), ".data", "bookings");
  return new FileBookingStore(dir);
}

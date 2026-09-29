import { TIME_ZONE } from "./constants";

export type WallDate = {
  year: number;
  month: number;
  day: number;
};

export type WallClock = WallDate & {
  hour: number;
  minute: number;
  second: number;
};

const NY_OFFSET_MINUTES = [-4 * 60, -5 * 60];

export function cleanSpaces(value: string): string {
  return value.replace(/[\u202f\u00a0]/g, " ");
}

export function wallClock(instant: Date, timeZone = TIME_ZONE): WallClock {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts: Record<string, string> = {};
  for (const part of formatter.formatToParts(instant)) {
    if (part.type !== "literal") parts[part.type] = part.value;
  }
  let hour = Number(parts.hour);
  if (hour === 24) hour = 0;
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour,
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

export function addCalendarDays(date: WallDate, days: number): WallDate {
  const shifted = new Date(Date.UTC(date.year, date.month - 1, date.day + days));
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

export function formatYmd(date: WallDate): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.year}-${pad(date.month)}-${pad(date.day)}`;
}

/** Instants whose America/New_York wall clock matches. Empty during a DST gap; two during overlap. */
export function instantsForWallClock(
  date: WallDate,
  hour: number,
  minute: number,
): Date[] {
  const asUtc = Date.UTC(date.year, date.month - 1, date.day, hour, minute, 0);
  const matches: Date[] = [];
  for (const offsetMinutes of NY_OFFSET_MINUTES) {
    const instant = new Date(asUtc - offsetMinutes * 60_000);
    const wall = wallClock(instant);
    if (
      wall.year === date.year &&
      wall.month === date.month &&
      wall.day === date.day &&
      wall.hour === hour &&
      wall.minute === minute &&
      wall.second === 0
    ) {
      matches.push(instant);
    }
  }
  matches.sort((a, b) => a.getTime() - b.getTime());
  return matches.filter(
    (instant, index) => index === 0 || instant.getTime() !== matches[index - 1].getTime(),
  );
}

export function offsetMinutes(instant: Date, timeZone = TIME_ZONE): number {
  const wall = wallClock(instant, timeZone);
  const asUtc = Date.UTC(
    wall.year,
    wall.month - 1,
    wall.day,
    wall.hour,
    wall.minute,
    wall.second,
  );
  return Math.round((asUtc - instant.getTime()) / 60_000);
}

export function toOffsetIso(instant: Date, timeZone = TIME_ZONE): string {
  const wall = wallClock(instant, timeZone);
  const offset = offsetMinutes(instant, timeZone);
  const sign = offset >= 0 ? "+" : "-";
  const abs = Math.abs(offset);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${wall.year}-${pad(wall.month)}-${pad(wall.day)}T${pad(wall.hour)}:${pad(wall.minute)}:${pad(wall.second)}${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}

function zonedFormat(instant: Date, options: Intl.DateTimeFormatOptions): string {
  return cleanSpaces(
    new Intl.DateTimeFormat("en-US", { timeZone: TIME_ZONE, ...options }).format(instant),
  );
}

export function shortZoneName(instant: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    timeZoneName: "short",
  }).formatToParts(instant);
  return parts.find((part) => part.type === "timeZoneName")?.value ?? "ET";
}

export function formatClock(instant: Date): string {
  return zonedFormat(instant, { hour: "numeric", minute: "2-digit" });
}

export function formatWhen(start: Date, durationMinutes: number): string {
  const end = new Date(start.getTime() + durationMinutes * 60_000);
  const dateOptions: Intl.DateTimeFormatOptions = {
    weekday: "long",
    month: "long",
    day: "numeric",
  };
  const startDate = zonedFormat(start, dateOptions);
  const endDate = zonedFormat(end, dateOptions);
  const startTime = formatClock(start);
  const endTime = formatClock(end);
  const zone = shortZoneName(start);
  if (startDate === endDate) {
    return `${startDate}, ${startTime} – ${endTime} ${zone}`;
  }
  return `${startDate}, ${startTime} – ${endDate}, ${endTime} ${zone}`;
}

/** Noon-safe anchor so a calendar date formats as that New York date. */
export function dateAnchor(date: WallDate): Date {
  return new Date(Date.UTC(date.year, date.month - 1, date.day, 16, 0, 0));
}

export function formatWeekdayShort(date: WallDate): string {
  return zonedFormat(dateAnchor(date), { weekday: "short" });
}

export function formatMonthShort(date: WallDate): string {
  return zonedFormat(dateAnchor(date), { month: "short" });
}

export function formatLongDate(date: WallDate): string {
  return zonedFormat(dateAnchor(date), {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

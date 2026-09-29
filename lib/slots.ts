import { DURATION_MINUTES, WINDOW_DAYS } from "./constants";
import {
  addCalendarDays,
  formatClock,
  formatLongDate,
  formatMonthShort,
  formatWeekdayShort,
  formatWhen,
  formatYmd,
  instantsForWallClock,
  shortZoneName,
  toOffsetIso,
  wallClock,
  type WallDate,
} from "./time";

export type SlotPeriod = "evening" | "morning";

export type Slot = {
  startUtc: string;
  start: string;
  label: string;
  period: SlotPeriod;
  whenLabel: string;
  eveningId: string;
};

export type Evening = {
  id: string;
  weekday: string;
  day: string;
  month: string;
  label: string;
  slots: Slot[];
};

type ClockPoint = {
  dayOffset: 0 | 1;
  hour: number;
  minute: number;
  period: SlotPeriod;
};

/** 6:00pm through 8:00am the next morning, every 30 minutes, inclusive. */
function clockPoints(): ClockPoint[] {
  const points: ClockPoint[] = [];
  for (let minutes = 18 * 60; minutes < 24 * 60; minutes += DURATION_MINUTES) {
    points.push({
      dayOffset: 0,
      hour: Math.floor(minutes / 60),
      minute: minutes % 60,
      period: "evening",
    });
  }
  for (let minutes = 0; minutes <= 8 * 60; minutes += DURATION_MINUTES) {
    points.push({
      dayOffset: 1,
      hour: Math.floor(minutes / 60),
      minute: minutes % 60,
      period: "morning",
    });
  }
  return points;
}

const CLOCKS = clockPoints();

export function firstEvening(now: Date): WallDate {
  const wall = wallClock(now);
  const today = { year: wall.year, month: wall.month, day: wall.day };
  if (wall.hour < 8) return addCalendarDays(today, -1);
  return today;
}

export function buildEvenings(now: Date): Evening[] {
  const start = firstEvening(now);
  const evenings: Evening[] = [];

  for (let index = 0; index < WINDOW_DAYS; index += 1) {
    const evening = addCalendarDays(start, index);
    const eveningId = formatYmd(evening);
    const slots: Slot[] = [];

    for (const clock of CLOCKS) {
      const day = addCalendarDays(evening, clock.dayOffset);
      const instants = instantsForWallClock(day, clock.hour, clock.minute);
      const ambiguous = instants.length > 1;
      for (const instant of instants) {
        if (instant.getTime() <= now.getTime()) continue;
        const zone = shortZoneName(instant);
        slots.push({
          startUtc: instant.toISOString(),
          start: toOffsetIso(instant),
          label: ambiguous ? `${formatClock(instant)} ${zone}` : formatClock(instant),
          period: clock.period,
          whenLabel: formatWhen(instant, DURATION_MINUTES),
          eveningId,
        });
      }
    }

    evenings.push({
      id: eveningId,
      weekday: formatWeekdayShort(evening),
      day: String(evening.day),
      month: formatMonthShort(evening),
      label: formatLongDate(evening),
      slots,
    });
  }

  return evenings;
}

export function findOpenSlot(startUtc: string, now: Date): Slot | null {
  for (const evening of buildEvenings(now)) {
    const slot = evening.slots.find((candidate) => candidate.startUtc === startUtc);
    if (slot) return slot;
  }
  return null;
}

export const TIME_ZONE = "Asia/Kolkata";
export const TIME_ZONE_LABEL = "IST";

export const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;
const OFFSET_MS = 330 * MINUTE_MS;

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function zonedToUtc(date: string, time = "00:00") {
  const [year, month, day] = date.split("-").map(Number);
  const [hours, minutes] = time.split(":").map(Number);
  return new Date(Date.UTC(year, month - 1, day, hours, minutes) - OFFSET_MS);
}

export function toZonedParts(value: Date | string) {
  const iso = new Date(new Date(value).getTime() + OFFSET_MS).toISOString();
  return { date: iso.slice(0, 10), time: iso.slice(11, 16) };
}

export function todayInZone(now = new Date()) {
  return toZonedParts(now).date;
}

export function addDays(date: string, days: number) {
  return toZonedParts(new Date(zonedToUtc(date).getTime() + days * DAY_MS)).date;
}

export function dayBoundsUtc(date: string) {
  const start = zonedToUtc(date);
  return { start, end: new Date(start.getTime() + DAY_MS) };
}

export function addMinutes(value: Date, minutes: number) {
  return new Date(value.getTime() + minutes * MINUTE_MS);
}

export function formatClock(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return `${hours % 12 || 12}:${String(minutes).padStart(2, "0")} ${hours < 12 ? "AM" : "PM"}`;
}

export function formatTime(value: Date | string) {
  return formatClock(toZonedParts(value).time);
}

export function formatDate(value: Date | string) {
  const [year, month, day] = toZonedParts(value).date.split("-").map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return `${WEEKDAYS[weekday]}, ${day} ${MONTHS[month - 1]}`;
}

export function formatDateTime(value: Date | string) {
  return `${formatDate(value)} · ${formatTime(value)}`;
}

export function truncate(value: string, maxLength: number): string {
  if (!value) return "";
  return value.length <= maxLength ? value : `${value.slice(0, maxLength)}…`;
}

const RELATIVE_UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ["year", 365 * 24 * 60 * 60 * 1000],
  ["month", 30 * 24 * 60 * 60 * 1000],
  ["week", 7 * 24 * 60 * 60 * 1000],
  ["day", 24 * 60 * 60 * 1000],
  ["hour", 60 * 60 * 1000],
  ["minute", 60 * 1000],
];

const relativeFormatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

/** "3 hours ago" style timestamps, via Intl so there's no date library cost. */
export function timeAgo(value: string | Date | null | undefined): string {
  if (!value) return "";

  const date = typeof value === "string" ? new Date(value) : value;
  const diff = date.getTime() - Date.now();
  const absolute = Math.abs(diff);

  if (absolute < 45_000) return "just now";

  for (const [unit, ms] of RELATIVE_UNITS) {
    if (absolute >= ms) {
      return relativeFormatter.format(Math.round(diff / ms), unit);
    }
  }

  return "just now";
}

const dayFormatter = new Intl.DateTimeFormat("en", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

const timeFormatter = new Intl.DateTimeFormat("en", {
  hour: "numeric",
  minute: "2-digit",
});

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "";
  return dayFormatter.format(typeof value === "string" ? new Date(value) : value);
}

export function formatTime(value: string | Date | null | undefined): string {
  if (!value) return "";
  return timeFormatter.format(typeof value === "string" ? new Date(value) : value);
}

/** Day separator label used between groups of chat messages. */
export function formatDayLabel(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

  if (sameDay(date, today)) return "Today";
  if (sameDay(date, yesterday)) return "Yesterday";
  return dayFormatter.format(date);
}

/** mm:ss elapsed timer for an in-progress call. */
export function formatDuration(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;

  const pad = (n: number) => String(n).padStart(2, "0");

  return hours > 0
    ? `${hours}:${pad(minutes)}:${pad(seconds)}`
    : `${minutes}:${pad(seconds)}`;
}

export function formatCount(value: number): string {
  if (value < 1000) return String(value);
  if (value < 1_000_000) return `${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)}k`;
  return `${(value / 1_000_000).toFixed(1)}m`;
}

/** Two-letter fallback shown when someone has no profile photo. */
export function initialsOf(name: string, username = ""): string {
  const source = name?.trim() || username?.trim() || "?";
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

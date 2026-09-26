import type { TimestampOptions } from "./options";

export function timestampDate(at?: string): Date | undefined {
  if (!at) return undefined;
  const date = new Date(at);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export function formatTimestamp(date: Date, options: TimestampOptions = {}, now = Date.now()): string {
  if (options.format === "relative") {
    const seconds = (date.getTime() - now) / 1000;
    const [unit, divisor]: [Intl.RelativeTimeFormatUnit, number] = Math.abs(seconds) < 60 ? ["second", 1]
      : Math.abs(seconds) < 3600 ? ["minute", 60] : Math.abs(seconds) < 86400 ? ["hour", 3600] : ["day", 86400];
    return new Intl.RelativeTimeFormat(options.locale ?? "de", { numeric: "auto" }).format(Math.round(seconds / divisor), unit);
  }
  if (options.format === "date-time") {
    return new Intl.DateTimeFormat(options.locale ?? "de", {
      dateStyle: "short", timeStyle: "short", timeZone: options.timeZone,
    }).format(date);
  }
  if (!options.locale && !options.timeZone) {
    return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  }
  return new Intl.DateTimeFormat(options.locale ?? "de", {
    hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: options.timeZone,
  }).format(date);
}

export function timestampDay(date: Date, timeZone?: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric", month: "2-digit", day: "2-digit", calendar: "gregory", numberingSystem: "latn", timeZone,
  }).format(date);
}

export function formatDay(date: Date, options?: TimestampOptions): string {
  return new Intl.DateTimeFormat(options?.locale ?? "de", {
    dateStyle: "long", timeZone: options?.timeZone,
  }).format(date);
}

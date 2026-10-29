// Dates are stored as local "YYYY-MM-DD" strings so there are no timezone surprises.

export const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const DAY_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const MONTH_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const pad = (n: number) => String(n).padStart(2, "0");

export function toStr(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parse(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export const today = () => toStr(new Date());

export function addDays(s: string, n: number): string {
  const d = parse(s);
  d.setDate(d.getDate() + n);
  return toStr(d);
}

/** Whole days from a to b (b - a). */
export function daysBetween(a: string, b: string): number {
  return Math.round((parse(b).getTime() - parse(a).getTime()) / 86_400_000);
}

export function startOfWeek(s: string, mondayFirst: boolean): string {
  const d = parse(s);
  const shift = mondayFirst ? (d.getDay() + 6) % 7 : d.getDay();
  return addDays(s, -shift);
}

/** 6 rows × 7 days covering the month containing `s`. */
export function monthGrid(s: string, mondayFirst: boolean): string[] {
  const d = parse(s);
  const first = toStr(new Date(d.getFullYear(), d.getMonth(), 1));
  const start = startOfWeek(first, mondayFirst);
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

export function fmtDay(s: string): string {
  const d = parse(s);
  return `${DAY_SHORT[d.getDay()]}, ${MONTH_SHORT[d.getMonth()]} ${d.getDate()}`;
}

export function fmtLong(s: string): string {
  const d = parse(s);
  return `${DAY_LONG[d.getDay()]}, ${MONTH_LONG[d.getMonth()]} ${d.getDate()}`;
}

export function fmtTime(t?: string): string {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const suffix = h >= 12 ? "pm" : "am";
  const hh = h % 12 || 12;
  return m === 0 ? `${hh}${suffix}` : `${hh}:${pad(m)}${suffix}`;
}

export function relative(s: string, from = today()): string {
  const n = daysBetween(from, s);
  if (n === 0) return "today";
  if (n === 1) return "tomorrow";
  if (n === -1) return "yesterday";
  if (n < 0) return `${-n} days ago`;
  if (n < 7) return `in ${n} days`;
  if (n < 14) return "next week";
  return `in ${Math.round(n / 7)} weeks`;
}

export const minutesOf = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

// ---------- natural-ish parsing for quick add ----------

const WEEKDAYS: Record<string, number> = {
  sun: 0, sunday: 0, mon: 1, monday: 1, tue: 2, tues: 2, tuesday: 2,
  wed: 3, wednesday: 3, thu: 4, thur: 4, thurs: 4, thursday: 4,
  fri: 5, friday: 5, sat: 6, saturday: 6,
};
const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, sept: 8, oct: 9, nov: 10, dec: 11,
};

export interface ParsedWhen {
  date?: string;
  time?: string;
  rest: string; // the text with date/time words removed
}

/** Pulls dates like "tomorrow", "fri", "next mon", "11/5", "nov 5", "in 3 days" and times like "3pm", "23:59" out of text. */
export function parseWhen(input: string, base = today()): ParsedWhen {
  let text = ` ${input} `;
  let date: string | undefined;
  let time: string | undefined;
  const take = (re: RegExp, fn: (m: RegExpMatchArray) => void) => {
    const m = text.match(re);
    if (m) {
      fn(m);
      text = text.replace(m[0], " ");
    }
  };

  take(/\s(\d{1,2})(?::(\d{2}))?\s?(am|pm)\s/i, (m) => {
    let h = Number(m[1]) % 12;
    if (m[3].toLowerCase() === "pm") h += 12;
    time = `${pad(h)}:${m[2] ?? "00"}`;
  });
  if (!time) take(/\s(?:at\s)?([01]?\d|2[0-3]):([0-5]\d)\s/, (m) => (time = `${pad(Number(m[1]))}:${m[2]}`));
  if (!time) take(/\s(noon)\s/i, () => (time = "12:00"));
  if (!time) take(/\s(midnight)\s/i, () => (time = "23:59"));

  take(/\s(today|tonight)\s/i, () => (date = base));
  if (!date) take(/\s(tomorrow|tmr|tmrw)\s/i, () => (date = addDays(base, 1)));
  if (!date) take(/\sin\s(\d+)\s(days?|weeks?)\s/i, (m) => {
    date = addDays(base, Number(m[1]) * (m[2].startsWith("w") ? 7 : 1));
  });
  if (!date) take(/\s(next\s)?(sun|mon|tues?|wed|thu(?:rs?)?|fri|sat)[a-z]*\s/i, (m) => {
    const target = WEEKDAYS[m[2].toLowerCase()];
    const cur = parse(base).getDay();
    if (m[1]) {
      // "next fri" = that day in the coming Mon–Sun week.
      const nextMonday = addDays(base, 7 - ((cur + 6) % 7));
      date = addDays(nextMonday, (target + 6) % 7);
    } else {
      date = addDays(base, (target - cur + 7) % 7 || 7);
    }
  });
  if (!date) take(/\s(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\s/, (m) => {
    date = resolveMonthDay(base, Number(m[1]) - 1, Number(m[2]), m[3]);
  });
  if (!date) take(/\s(jan|feb|mar|apr|may|jun|jul|aug|sept?|oct|nov|dec)[a-z]*\.?\s(\d{1,2})(?:st|nd|rd|th)?\s/i, (m) => {
    date = resolveMonthDay(base, MONTHS[m[1].toLowerCase().slice(0, 3)], Number(m[2]));
  });

  return { date, time, rest: text.replace(/\s+/g, " ").replace(/\s(due|by|on)\s*$/i, "").trim() };
}

function resolveMonthDay(base: string, month: number, day: number, year?: string): string {
  const b = parse(base);
  let y = year ? Number(year.length === 2 ? `20${year}` : year) : b.getFullYear();
  let d = new Date(y, month, day);
  // "1/15" typed in November means next January.
  if (!year && toStr(d) < base && daysBetween(toStr(d), base) > 60) d = new Date(++y, month, day);
  return toStr(d);
}

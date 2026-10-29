// Builds an .ics file you can import into Google Calendar, Outlook or Apple Calendar.
import type { AppData } from "./types";
import { addDays, parse } from "./dates";
import { KIND_LABEL } from "./colors";

const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
const compact = (date: string) => date.replace(/-/g, "");
const stamp = () => new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
const ICS_DAYS = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

function addMinutes(time: string, mins: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = Math.min(h * 60 + m + mins, 23 * 60 + 59);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}${String(total % 60).padStart(2, "0")}00`;
}

export function buildIcs(data: AppData, includeClasses: boolean): string {
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Summit//Planner//EN", "CALSCALE:GREGORIAN"];
  const courseName = (id: string | null) => {
    const c = data.courses.find((x) => x.id === id);
    return c ? c.code || c.name : "";
  };

  for (const d of data.deadlines) {
    if (d.done) continue;
    const prefix = courseName(d.courseId);
    lines.push("BEGIN:VEVENT", `UID:${d.id}@summit`, `DTSTAMP:${stamp()}`);
    if (d.time) {
      lines.push(`DTSTART:${compact(d.date)}T${d.time.replace(":", "")}00`, `DTEND:${compact(d.date)}T${addMinutes(d.time, 30)}`);
    } else {
      lines.push(`DTSTART;VALUE=DATE:${compact(d.date)}`, `DTEND;VALUE=DATE:${compact(addDays(d.date, 1))}`);
    }
    lines.push(`SUMMARY:${esc(`${prefix ? prefix + " · " : ""}${d.title}`)}`);
    lines.push(`CATEGORIES:${KIND_LABEL[d.kind]}`);
    if (d.notes) lines.push(`DESCRIPTION:${esc(d.notes)}`);
    lines.push("BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:Reminder", "TRIGGER:-P1D", "END:VALARM");
    lines.push("END:VEVENT");
  }

  if (includeClasses && data.settings.semesterStart && data.settings.semesterEnd) {
    const start = data.settings.semesterStart;
    const until = compact(data.settings.semesterEnd) + "T235959";
    for (const c of data.courses.filter((x) => !x.archived)) {
      for (const m of c.meetings) {
        // First occurrence on or after the semester start.
        const first = addDays(start, (m.day - parse(start).getDay() + 7) % 7);
        lines.push(
          "BEGIN:VEVENT",
          `UID:${c.id}-${m.id}@summit`,
          `DTSTAMP:${stamp()}`,
          `DTSTART:${compact(first)}T${m.start.replace(":", "")}00`,
          `DTEND:${compact(first)}T${m.end.replace(":", "")}00`,
          `RRULE:FREQ=WEEKLY;BYDAY=${ICS_DAYS[m.day]};UNTIL=${until}`,
          `SUMMARY:${esc(`${c.code || c.name} · ${m.kind}`)}`,
          ...(m.place ? [`LOCATION:${esc(m.place)}`] : []),
          "END:VEVENT",
        );
      }
    }
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

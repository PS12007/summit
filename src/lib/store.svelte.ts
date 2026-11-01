import type { AppData, Course, Deadline, DeadlineKind, Settings, Todo } from "./types";
import { loadRaw, notify, saveRaw } from "./platform";
import { addDays, daysBetween, fmtTime, parse, toStr, today } from "./dates";
import { SCENES } from "./scenes";

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

export const DEFAULT_SETTINGS: Settings = {
  name: "",
  scene: "lakelouise",
  dailyScene: false,
  artStyle: "paint",
  showDone: true,
  weekStartsMonday: true,
  notifications: true,
  remindDaysBefore: 2,
  focusMinutes: 25,
  breakMinutes: 5,
  glass: 0.72,
};

export function emptyData(): AppData {
  return { version: 1, courses: [], deadlines: [], todos: [], focus: [], settings: { ...DEFAULT_SETTINGS } };
}

/** Fills in any fields missing from older or hand-edited files. */
export function normalize(raw: unknown): AppData {
  const d = (raw && typeof raw === "object" ? raw : {}) as Partial<AppData>;
  const base = emptyData();
  const settings = { ...base.settings, ...(d.settings ?? {}) };
  // Older files used the drawn scenes ("mountains", "lake"…) and a time-of-day setting.
  if (!SCENES.some((s) => s.id === settings.scene)) settings.scene = base.settings.scene;
  delete (settings as { time?: unknown }).time;
  return {
    version: 1,
    settings,
    courses: (d.courses ?? []).map((c) => ({
      ...c,
      meetings: c.meetings ?? [],
      links: c.links ?? [],
      sections: c.sections ?? [],
      grades: (c.grades ?? []).map((g) => ({ ...g, scores: g.scores ?? [] })),
    })),
    deadlines: (d.deadlines ?? []).map((x) => ({ ...x, covers: x.covers ?? [], done: !!x.done })),
    todos: (d.todos ?? []).map((t) => ({ ...t, subtasks: t.subtasks ?? [], priority: t.priority ?? 0 })),
    focus: d.focus ?? [],
  };
}

// ---------------- app state ----------------

export const db: AppData = $state(emptyData());

export type View = "today" | "calendar" | "courses" | "course" | "grades" | "tasks" | "focus" | "settings";

export const ui = $state({
  ready: false,
  view: "today" as View,
  courseId: null as string | null,
  saveError: "" as string,
  // Editors open as modals. `null` = closed.
  deadlineDraft: null as Deadline | null,
  courseDraft: null as Course | null,
  quickAdd: false,
  toast: "" as string,
});

let toastTimer: ReturnType<typeof setTimeout> | undefined;
export function toast(msg: string) {
  ui.toast = msg;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (ui.toast = ""), 2600);
}

export function go(view: View, courseId: string | null = null) {
  ui.view = view;
  ui.courseId = courseId;
}

// ---------------- persistence ----------------

let saveTimer: ReturnType<typeof setTimeout> | undefined;

export async function init() {
  try {
    const raw = await loadRaw();
    Object.assign(db, raw ? normalize(JSON.parse(raw)) : emptyData());
  } catch (e) {
    ui.saveError = `Couldn't read your data file: ${e}`;
  }
  // Dev-only helpers for screenshots: ?sample loads demo data, ?view=calendar opens a page.
  if (import.meta.env.DEV) {
    const q = new URLSearchParams(location.search);
    if (q.has("sample")) Object.assign(db, (await import("./sample")).sampleData(emptyData()));
    if (q.get("scene")) db.settings.scene = q.get("scene") as AppData["settings"]["scene"];
    if (q.get("style")) db.settings.artStyle = q.get("style") as AppData["settings"]["artStyle"];
    if (q.get("view")) ui.view = q.get("view") as View;
    if (q.get("course")) (ui.view = q.get("view") === "grades" ? "grades" : "course"), (ui.courseId = db.courses[Number(q.get("course"))]?.id ?? null);
  }
  ui.ready = true;

  // Save (debounced) whenever anything in `db` changes.
  $effect.root(() => {
    $effect(() => {
      const json = JSON.stringify(db);
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        saveRaw(json).then(
          () => (ui.saveError = ""),
          (e) => (ui.saveError = `Couldn't save: ${e}`),
        );
      }, 400);
    });
  });

  checkReminders();
  setInterval(checkReminders, 30 * 60 * 1000);
}

export function replaceAll(data: AppData) {
  Object.assign(db, normalize(data));
}

// ---------------- lookups ----------------

export const courseById = (id: string | null | undefined) => db.courses.find((c) => c.id === id);
export const activeCourses = () => db.courses.filter((c) => !c.archived);

/** Upcoming, not-done deadlines sorted by date/time. */
export function upcoming(days = 365): Deadline[] {
  const t = today();
  const end = addDays(t, days);
  return db.deadlines
    .filter((d) => !d.done && d.date >= t && d.date <= end)
    .sort((a, b) => (a.date + (a.time ?? "99")).localeCompare(b.date + (b.time ?? "99")));
}

/** Class meetings on a given day (respects semester dates when set). */
export function meetingsOn(date: string) {
  const { semesterStart: s, semesterEnd: e } = db.settings;
  if ((s && date < s) || (e && date > e)) return [];
  const day = parse(date).getDay();
  return activeCourses()
    .flatMap((course) => course.meetings.filter((m) => m.day === day).map((m) => ({ course, m })))
    .sort((a, b) => a.m.start.localeCompare(b.m.start));
}

export const deadlinesOn = (date: string) =>
  db.deadlines.filter((d) => d.date === date).sort((a, b) => (a.time ?? "99").localeCompare(b.time ?? "99"));

export function overdue(): Deadline[] {
  const t = today();
  return db.deadlines.filter((d) => !d.done && d.date < t).sort((a, b) => a.date.localeCompare(b.date));
}

// ---------------- actions ----------------

export function newDeadline(partial: Partial<Deadline> = {}): Deadline {
  return {
    id: uid(),
    courseId: null,
    title: "",
    kind: "assignment" as DeadlineKind,
    date: addDays(today(), 1),
    covers: [],
    done: false,
    ...partial,
  };
}

export function saveDeadline(d: Deadline) {
  const i = db.deadlines.findIndex((x) => x.id === d.id);
  const copy = $state.snapshot(d) as Deadline;
  copy.notified = undefined;
  if (i >= 0) db.deadlines[i] = copy;
  else db.deadlines.push(copy);
}

export function deleteDeadline(id: string) {
  db.deadlines = db.deadlines.filter((d) => d.id !== id);
}

export function addTodo(text: string, extra: Partial<Todo> = {}): Todo {
  const t: Todo = { id: uid(), courseId: null, text, done: false, priority: 0, subtasks: [], createdAt: Date.now(), ...extra };
  db.todos.unshift(t);
  return t;
}

export function toggleTodo(t: Todo) {
  t.done = !t.done;
  t.doneAt = t.done ? Date.now() : undefined;
}

/** Was this task ticked off today? */
export const finishedToday = (t: Todo) => !!t.done && !!t.doneAt && toStr(new Date(t.doneAt)) === today();

export function deleteTodo(id: string) {
  db.todos = db.todos.filter((t) => t.id !== id);
}

export function deleteCourse(id: string) {
  db.courses = db.courses.filter((c) => c.id !== id);
  db.deadlines = db.deadlines.filter((d) => d.courseId !== id);
  db.todos.forEach((t) => t.courseId === id && (t.courseId = null));
  db.focus.forEach((f) => f.courseId === id && (f.courseId = null));
}

// ---------------- reminders ----------------

function checkReminders() {
  if (!db.settings.notifications) return;
  const t = today();
  for (const d of db.deadlines) {
    if (d.done || d.notified === t) continue;
    const n = daysBetween(t, d.date);
    if (n < 0 || n > db.settings.remindDaysBefore) continue;
    const course = courseById(d.courseId);
    const when = n === 0 ? `today${d.time ? ` at ${fmtTime(d.time)}` : ""}` : n === 1 ? "tomorrow" : `in ${n} days`;
    notify(`${course ? course.code || course.name : "Summit"} · ${d.title}`, `Due ${when}`);
    d.notified = t;
  }
}

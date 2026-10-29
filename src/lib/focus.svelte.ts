// Focus timer lives outside any view so it keeps running when you switch pages.
import { db, uid, toast } from "./store.svelte";
import { notify } from "./platform";

export const timer = $state({
  mode: "focus" as "focus" | "break",
  running: false,
  remaining: 25 * 60, // seconds
  courseId: null as string | null,
});

let endsAt = 0;
let tick: ReturnType<typeof setInterval> | undefined;

const lengthOf = (mode: "focus" | "break") =>
  (mode === "focus" ? db.settings.focusMinutes : db.settings.breakMinutes) * 60;

export function resetTimer(mode = timer.mode) {
  pauseTimer();
  timer.mode = mode;
  timer.remaining = lengthOf(mode);
}

export function startTimer() {
  if (timer.running) return;
  timer.running = true;
  endsAt = Date.now() + timer.remaining * 1000;
  tick = setInterval(update, 1000);
}

export function pauseTimer() {
  timer.running = false;
  clearInterval(tick);
}

function update() {
  timer.remaining = Math.max(0, Math.round((endsAt - Date.now()) / 1000));
  if (timer.remaining > 0) return;
  pauseTimer();
  if (timer.mode === "focus") {
    db.focus.push({ id: uid(), courseId: timer.courseId, minutes: db.settings.focusMinutes, at: Date.now() });
    notify("Focus session done", `Nice work. Take ${db.settings.breakMinutes} minutes.`);
    toast("Session logged — time for a break");
    resetTimer("break");
  } else {
    notify("Break's over", "Ready for another session?");
    resetTimer("focus");
  }
}

export const fmtClock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

// Example semester so you can explore the app before adding your own classes.
import type { AppData, Course, Section, SectionStatus } from "./types";
import { addDays, today } from "./dates";
import { parseLabels } from "./sections";
import { uid } from "./store.svelte";

function secs(spec: string, doneThrough: number, doing = 0): Section[] {
  return parseLabels(spec).map((label, i) => ({
    id: uid(),
    label,
    status: (i < doneThrough ? "done" : i < doneThrough + doing ? "doing" : "todo") as SectionStatus,
  }));
}

export function sampleData(base: AppData): AppData {
  const t = today();
  const calcSecs = secs("1.1-1.5, 2.1-2.6, 3.1-3.6, 4.1-4.4", 10, 1);
  calcSecs[3].status = "review";
  const calc: Course = {
    id: uid(), name: "Calculus I", code: "MATH 151", color: "sky", instructor: "Prof. Alvarez", target: 90,
    meetings: [1, 3, 5].map((day) => ({ id: uid(), day, start: "09:00", end: "09:50", kind: "Lecture", place: "Hall 204" })),
    links: [{ id: uid(), label: "WebAssign", url: "https://www.webassign.net" }],
    sections: calcSecs,
    grades: [
      { id: uid(), name: "Homework", weight: 20, scores: [
        { id: uid(), name: "HW 1", earned: 18, total: 20 }, { id: uid(), name: "HW 2", earned: 19, total: 20 },
        { id: uid(), name: "HW 3", earned: 16, total: 20 }, { id: uid(), name: "HW 4", earned: null, total: 20 }] },
      { id: uid(), name: "Quizzes", weight: 15, scores: [{ id: uid(), name: "Quiz 1", earned: 9, total: 10 }, { id: uid(), name: "Quiz 2", earned: 7, total: 10 }] },
      { id: uid(), name: "Midterms", weight: 35, scores: [{ id: uid(), name: "Midterm 1", earned: 84, total: 100 }, { id: uid(), name: "Midterm 2", earned: null, total: 100 }] },
      { id: uid(), name: "Final", weight: 30, scores: [] },
    ],
    notes: "Office hours Tue 2–3pm, Math building 3rd floor.",
  };
  const cs: Course = {
    id: uid(), name: "Intro to Programming", code: "CS 101", color: "sage", instructor: "Dr. Chen", target: 93,
    meetings: [
      { id: uid(), day: 2, start: "11:00", end: "12:15", kind: "Lecture", place: "Tech 110" },
      { id: uid(), day: 4, start: "11:00", end: "12:15", kind: "Lecture", place: "Tech 110" },
      { id: uid(), day: 3, start: "14:00", end: "15:50", kind: "Lab", place: "Lab B" },
    ],
    links: [{ id: uid(), label: "Gradescope", url: "https://www.gradescope.com" }],
    sections: [...secs("Week 1-12", 8), ...secs("Lab 1-8", 6)],
    grades: [
      { id: uid(), name: "Projects", weight: 40, scores: [{ id: uid(), name: "P1", earned: 95, total: 100 }, { id: uid(), name: "P2", earned: 88, total: 100 }] },
      { id: uid(), name: "Labs", weight: 20, scores: [{ id: uid(), name: "Labs 1–6", earned: 58, total: 60 }] },
      { id: uid(), name: "Exams", weight: 40, scores: [{ id: uid(), name: "Midterm", earned: 81, total: 100 }] },
    ],
  };
  const chem: Course = {
    id: uid(), name: "General Chemistry", code: "CHEM 110", color: "clay", instructor: "Prof. Okafor",
    meetings: [1, 3].map((day) => ({ id: uid(), day, start: "13:00", end: "14:15", kind: "Lecture", place: "Sci 2" })),
    links: [], sections: secs("4.1-4.8, 5.1-5.6", 9), grades: [],
  };
  const sec = (c: Course, from: number, to: number) => c.sections.slice(from, to).map((s) => s.id);

  return {
    ...base,
    settings: { ...base.settings, semesterStart: addDays(t, -63), semesterEnd: addDays(t, 45) },
    courses: [calc, cs, chem],
    deadlines: [
      { id: uid(), courseId: calc.id, title: "Quiz 3", kind: "quiz", date: addDays(t, 2), time: "09:00", covers: sec(calc, 9, 13), done: false },
      { id: uid(), courseId: calc.id, title: "Midterm 2", kind: "exam", date: addDays(t, 9), time: "19:00", covers: sec(calc, 5, 17), done: false, notes: "One page of notes allowed." },
      { id: uid(), courseId: calc.id, title: "HW 4", kind: "assignment", date: addDays(t, 1), time: "23:59", covers: [], done: false },
      { id: uid(), courseId: cs.id, title: "Project 3 — Text adventure", kind: "project", date: addDays(t, 6), time: "23:59", covers: [], done: false },
      { id: uid(), courseId: cs.id, title: "Lab 7 check-off", kind: "assignment", date: addDays(t, 4), covers: [], done: false },
      { id: uid(), courseId: chem.id, title: "Read 5.3–5.4", kind: "reading", date: addDays(t, 3), covers: [], done: false },
      { id: uid(), courseId: chem.id, title: "Exam 2", kind: "exam", date: addDays(t, 14), time: "13:00", covers: sec(chem, 4, 14), done: false },
    ],
    todos: [
      { id: uid(), courseId: calc.id, text: "Redo practice problems for 2.4", done: false, due: t, priority: 1, subtasks: [], createdAt: Date.now() },
      { id: uid(), courseId: cs.id, text: "Plan Project 3 rooms & commands", done: false, due: addDays(t, 2), priority: 0, createdAt: Date.now(),
        subtasks: [{ id: uid(), text: "Sketch map", done: true }, { id: uid(), text: "Write parser", done: false }, { id: uid(), text: "Test edge cases", done: false }] },
      { id: uid(), courseId: null, text: "Email advisor about spring schedule", done: false, priority: 2, subtasks: [], createdAt: Date.now() },
      { id: uid(), courseId: chem.id, text: "Make flashcards for ch 4", done: true, priority: 0, subtasks: [], createdAt: Date.now(), doneAt: Date.now() },
    ],
    focus: [
      { id: uid(), courseId: calc.id, minutes: 25, at: Date.now() - 864e5 },
      { id: uid(), courseId: cs.id, minutes: 50, at: Date.now() - 2 * 864e5 },
      { id: uid(), courseId: calc.id, minutes: 25, at: Date.now() - 3600e3 },
    ],
  };
}

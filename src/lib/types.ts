// All data lives in one JSON file on disk (see src-tauri/src/lib.rs).
import type { SceneId } from "./scenes";
import type { ArtStyle } from "./stylize";

export type SectionStatus = "todo" | "doing" | "done" | "review";

export interface Section {
  id: string;
  label: string; // "2.4", "Lab 3", "Week 6" — anything
  title?: string;
  status: SectionStatus;
  due?: string; // YYYY-MM-DD
  note?: string;
}

export interface MeetingTime {
  id: string;
  day: number; // 0 = Sunday … 6 = Saturday
  start: string; // "09:30"
  end: string; // "10:45"
  kind: string; // Lecture, Lab, Discussion, Office hours…
  place?: string;
}

export interface Link {
  id: string;
  label: string;
  url: string;
}

export interface Score {
  id: string;
  name: string;
  earned: number | null; // null = not graded yet
  total: number;
}

export interface GradeCategory {
  id: string;
  name: string; // Homework, Midterms…
  weight: number; // percent of final grade
  scores: Score[];
}

export interface Course {
  id: string;
  name: string;
  code?: string;
  color: string; // key into COURSE_COLORS
  instructor?: string;
  meetings: MeetingTime[];
  links: Link[];
  sections: Section[];
  grades: GradeCategory[];
  target?: number; // goal grade, percent
  notes?: string;
  archived?: boolean;
}

export type DeadlineKind = "exam" | "quiz" | "assignment" | "project" | "reading" | "event";

export interface Deadline {
  id: string;
  courseId: string | null;
  title: string;
  kind: DeadlineKind;
  date: string; // YYYY-MM-DD
  time?: string; // HH:MM (optional, all-day otherwise)
  covers: string[]; // section ids this exam/quiz covers
  done: boolean;
  notes?: string;
  notified?: string; // last day a reminder was shown (YYYY-MM-DD)
}

export interface Subtask {
  id: string;
  text: string;
  done: boolean;
}

export interface Todo {
  id: string;
  courseId: string | null;
  text: string;
  done: boolean;
  due?: string;
  priority: 0 | 1 | 2; // normal, high, urgent
  subtasks: Subtask[];
  createdAt: number;
  doneAt?: number;
}

export interface FocusSession {
  id: string;
  courseId: string | null;
  minutes: number;
  at: number; // epoch ms (end time)
}

export interface Settings {
  name: string;
  scene: SceneId;
  dailyScene: boolean; // pick a different photo each day
  artStyle: ArtStyle; // how the photo is drawn: painted, dots, symbols, sketch or the plain photo
  showDone: boolean; // keep finished tasks in lists, crossed out
  semesterStart?: string;
  semesterEnd?: string;
  weekStartsMonday: boolean;
  notifications: boolean;
  remindDaysBefore: number;
  focusMinutes: number;
  breakMinutes: number;
  glass: number; // panel opacity 0.4 – 0.95
}

export interface AppData {
  version: 1;
  courses: Course[];
  deadlines: Deadline[];
  todos: Todo[];
  focus: FocusSession[];
  settings: Settings;
}

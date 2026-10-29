import type { Course, Section, SectionStatus } from "./types";

/**
 * Turns what you type into a list of section labels.
 *   "3.1-3.5"        → 3.1 3.2 3.3 3.4 3.5
 *   "3.1-4"          → 3.1 3.2 3.3 3.4   (short form, same chapter)
 *   "2.4, 2.5, 3.1"  → 2.4 2.5 3.1
 *   "Lab 1-4"        → Lab 1 … Lab 4
 *   "3.1 3.2 3.3"    → 3.1 3.2 3.3
 */
export function parseLabels(input: string): string[] {
  const out: string[] = [];
  for (const raw of input.split(/[,;\n]+/)) {
    const token = raw.trim();
    if (!token) continue;

    // 3.1-3.5 / 3.1-5 / 3.1 – 3.5
    let m = token.match(/^(.*?)(\d+)\.(\d+)\s*(?:-|–|to)\s*(?:(\d+)\.)?(\d+)$/i);
    if (m) {
      const [, prefix, ch, from, endCh, to] = m;
      if (!endCh || endCh === ch) {
        const a = Number(from), b = Number(to);
        if (b >= a && b - a < 100) {
          for (let i = a; i <= b; i++) out.push(`${prefix}${ch}.${i}`.trim());
          continue;
        }
      }
      // Across chapters we can't know how many sections each chapter has, so keep the ends.
      out.push(`${prefix}${ch}.${from}`.trim(), `${prefix}${endCh ?? ch}.${to}`.trim());
      continue;
    }

    // Lab 1-4 / Week 2-6 / 1-12
    m = token.match(/^(.*?)(\d+)\s*(?:-|–|to)\s*(\d+)$/i);
    if (m) {
      const [, prefix, from, to] = m;
      const a = Number(from), b = Number(to);
      if (b >= a && b - a < 100) {
        for (let i = a; i <= b; i++) out.push(`${prefix}${i}`.trim());
        continue;
      }
    }

    // "3.1 3.2 3.3" — several numeric labels separated by spaces
    const parts = token.split(/\s+/);
    if (parts.length > 1 && parts.every((p) => /^\d+(\.\d+)*[a-z]?$/i.test(p))) {
      out.push(...parts);
      continue;
    }

    out.push(token);
  }
  return [...new Set(out)];
}

/** Natural sort: 2.10 comes after 2.9, Lab 10 after Lab 9. */
export function compareLabels(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

/** Which heading a section sits under: "2.4" → "Chapter 2", "Lab 3" → "Lab". */
export function groupOf(label: string): string {
  const num = label.match(/^(\d+)\./);
  if (num) return `Chapter ${num[1]}`;
  const prefixed = label.match(/^(?:ch(?:apter)?\.?\s*)(\d+)/i);
  if (prefixed) return `Chapter ${prefixed[1]}`;
  const word = label.match(/^([A-Za-z][A-Za-z ]*?)\s*\d/);
  if (word) return word[1].trim().replace(/^\w/, (c) => c.toUpperCase());
  return "Sections";
}

export function grouped(sections: Section[]): { group: string; items: Section[] }[] {
  const map = new Map<string, Section[]>();
  for (const s of [...sections].sort((a, b) => compareLabels(a.label, b.label))) {
    const g = groupOf(s.label);
    if (!map.has(g)) map.set(g, []);
    map.get(g)!.push(s);
  }
  return [...map.entries()]
    .sort(([a], [b]) => compareLabels(a, b))
    .map(([group, items]) => ({ group, items }));
}

export const NEXT_STATUS: Record<SectionStatus, SectionStatus> = {
  todo: "doing",
  doing: "done",
  done: "review",
  review: "todo",
};

export const STATUS_LABEL: Record<SectionStatus, string> = {
  todo: "Not started",
  doing: "In progress",
  done: "Done",
  review: "Needs review",
};

export function progress(course: Course) {
  const total = course.sections.length;
  const done = course.sections.filter((s) => s.status === "done").length;
  const review = course.sections.filter((s) => s.status === "review").length;
  return { total, done, review, pct: total ? Math.round((done / total) * 100) : 0 };
}

/** The first section (in order) that isn't done — what you're "on" in this class. */
export function nextUp(course: Course): Section | undefined {
  const sorted = [...course.sections].sort((a, b) => compareLabels(a.label, b.label));
  return sorted.find((s) => s.status === "doing") ?? sorted.find((s) => s.status === "todo");
}

/** Most recently completed section, in label order. */
export function lastDone(course: Course): Section | undefined {
  const sorted = [...course.sections].sort((a, b) => compareLabels(a.label, b.label));
  return sorted.filter((s) => s.status === "done").at(-1);
}

import type { Course, GradeCategory, GradeCutoff, Score } from "./types";

// All "weight" numbers below are in percentage points of the whole course grade.
// e.g. a 100% on a quiz worth 5% adds 5 to `earned`.

export type ItemStatus = "counted" | "dropped" | "pending" | "excused";

export interface ItemResult {
  score: Score;
  pct: number | null; // this item's own percent
  worth: number; // how much of the course grade this item is worth
  got: number | null; // how much of the course grade it earned you
  status: ItemStatus;
}

export interface CategoryResult {
  cat: GradeCategory;
  weight: number;
  avg: number | null; // category average on what counts so far, percent
  earned: number; // course-grade points locked in
  graded: number; // course-grade points that have been graded
  remaining: number; // course-grade points still to come
  slots: number; // how many items count toward the grade
  items: ItemResult[];
  missing: number; // items expected but not entered yet
  missingWorth: number; // worth of each of those
}

export interface GradeSummary {
  current: number | null; // percent on graded work only
  totalWeight: number;
  earned: number; // points locked in
  graded: number; // points graded so far
  lost: number; // points gone for good
  remaining: number; // points not graded yet
  min: number; // final percent if everything left is a zero
  max: number; // final percent if everything left is perfect
  projected: number | null; // final percent if you keep your current average
  needed: number | null; // average needed on the rest to hit the goal
  cats: CategoryResult[];
}

const num = (x: unknown) => (Number.isFinite(Number(x)) ? Number(x) : 0);

export function scorePct(s: Score): number | null {
  return s.earned === null || s.earned === undefined || !(num(s.total) > 0) ? null : (num(s.earned) / num(s.total)) * 100;
}

/**
 * Works out what each item in a category is worth and what you've earned.
 * Best-of: graded items are ranked by percent and only the top N count;
 * any open slots are filled by ungraded (or not-yet-entered) items.
 */
export function categoryResult(cat: GradeCategory): CategoryResult {
  const W = num(cat.weight);
  const live = cat.scores.filter((s) => !s.excused && num(s.total) > 0);
  const graded = live.filter((s) => scorePct(s) !== null).sort((a, b) => scorePct(b)! - scorePct(a)!);
  const ungraded = live.filter((s) => scorePct(s) === null);
  const missing = Math.max(0, Math.round(num(cat.expected)) - live.length);
  const planned = live.length + missing;
  const best = Math.round(num(cat.best));
  const N = best > 0 ? Math.min(best, planned) : planned;

  const avgTotal = live.length ? live.reduce((a, s) => a + num(s.total), 0) / live.length : 100;
  const counted = graded.slice(0, N);
  const dropped = new Set(graded.slice(N).map((s) => s.id));
  const open = N - counted.length; // slots still to be filled by future work
  const fillReal = ungraded.slice(0, open);
  const fillMissing = Math.min(missing, open - fillReal.length);

  // Each counted slot's share of the category (by points, or equal).
  const sumTotals = counted.reduce((a, s) => a + num(s.total), 0) + fillReal.reduce((a, s) => a + num(s.total), 0) + fillMissing * avgTotal;
  const share = (total: number) => (N === 0 ? 0 : cat.equal ? 1 / N : sumTotals > 0 ? total / sumTotals : 0);

  let earned = 0, gradedW = 0, remaining = 0;
  const items: ItemResult[] = cat.scores.map((s) => {
    const pct = scorePct(s);
    if (s.excused || !(num(s.total) > 0)) return { score: s, pct, worth: 0, got: null, status: "excused" };
    if (dropped.has(s.id)) return { score: s, pct, worth: 0, got: 0, status: "dropped" };
    const worth = W * share(num(s.total));
    if (pct === null) return { score: s, pct, worth, got: null, status: "pending" };
    const got = (worth * pct) / 100;
    earned += got;
    gradedW += worth;
    return { score: s, pct, worth, got, status: "counted" };
  });
  remaining = fillReal.reduce((a, s) => a + W * share(num(s.total)), 0) + fillMissing * W * share(avgTotal);
  // No items at all yet: the whole category is still to come.
  if (N === 0) remaining = W;

  return {
    cat, weight: W, items, earned, graded: gradedW, remaining, slots: N,
    avg: gradedW > 0 ? (earned / gradedW) * 100 : null,
    missing, missingWorth: missing ? W * share(avgTotal) : 0,
  };
}

export function summarize(course: Course): GradeSummary {
  const cats = course.grades.map(categoryResult);
  const totalWeight = cats.reduce((a, c) => a + c.weight, 0);
  const earned = cats.reduce((a, c) => a + c.earned, 0);
  const graded = cats.reduce((a, c) => a + c.graded, 0);
  const remaining = cats.reduce((a, c) => a + c.remaining, 0);
  const T = totalWeight || 100;
  const current = graded > 0.0001 ? (earned / graded) * 100 : null;
  const target = num(course.target);
  return {
    current, totalWeight, earned, graded, remaining, cats,
    lost: Math.max(0, graded - earned),
    min: (earned / T) * 100,
    max: ((earned + remaining) / T) * 100,
    projected: current === null ? null : ((earned + (current / 100) * remaining) / T) * 100,
    needed: target > 0 && remaining > 0.0001 ? (((target / 100) * T - earned) / remaining) * 100 : null,
  };
}

/** Percent needed on one category (usually the final) to finish at `target`,
 *  assuming you average `assume`% on everything else that's left. */
export function neededOn(g: GradeSummary, catId: string, target: number, assume: number): number | null {
  const c = g.cats.find((x) => x.cat.id === catId);
  if (!c || c.remaining < 0.0001) return null;
  const T = g.totalWeight || 100;
  const other = g.remaining - c.remaining;
  return (((target / 100) * T - g.earned - (assume / 100) * other) / c.remaining) * 100;
}

/** Final course percent if you score `pct` on that category and `assume`% on the rest. */
export function finishWith(g: GradeSummary, catId: string, pct: number, assume: number): number {
  const c = g.cats.find((x) => x.cat.id === catId);
  const T = g.totalWeight || 100;
  const mine = c?.remaining ?? 0;
  return ((g.earned + (pct / 100) * mine + (assume / 100) * (g.remaining - mine)) / T) * 100;
}

/** The category the final-exam calculator uses: one marked as final, else one named "final". */
export function finalCategory(course: Course): GradeCategory | undefined {
  return course.grades.find((c) => c.final) ?? course.grades.find((c) => /final/i.test(c.name));
}

// ---------- letter grades ----------

export const SCALES: { id: string; name: string; scale: GradeCutoff[] }[] = [
  {
    id: "us", name: "US (A = 93+)",
    scale: [[93, "A"], [90, "A-"], [87, "B+"], [83, "B"], [80, "B-"], [77, "C+"], [73, "C"], [70, "C-"], [67, "D+"], [60, "D"], [0, "F"]].map(([min, letter]) => ({ min: min as number, letter: letter as string })),
  },
  {
    id: "ca", name: "Canada (A+ = 90+)",
    scale: [[90, "A+"], [85, "A"], [80, "A-"], [77, "B+"], [73, "B"], [70, "B-"], [67, "C+"], [63, "C"], [60, "C-"], [57, "D+"], [53, "D"], [50, "D-"], [0, "F"]].map(([min, letter]) => ({ min: min as number, letter: letter as string })),
  },
  {
    id: "simple", name: "Simple (A = 90+)",
    scale: [[90, "A"], [80, "B"], [70, "C"], [60, "D"], [0, "F"]].map(([min, letter]) => ({ min: min as number, letter: letter as string })),
  },
];
export const DEFAULT_SCALE = SCALES[0].scale;

export const scaleOf = (course?: Course) =>
  [...(course?.scale?.length ? course.scale : DEFAULT_SCALE)].sort((a, b) => num(b.min) - num(a.min));

export function letter(pct: number | null, course?: Course): string {
  if (pct === null) return "—";
  return scaleOf(course).find((c) => pct >= num(c.min) - 1e-9)?.letter ?? "—";
}

/** Turns "18/20, 19/20 17" into scores. A bare number uses the last total seen. */
export function parseScores(text: string, defaultTotal: number): { earned: number | null; total: number }[] {
  let total = defaultTotal || 100;
  return text
    .split(/[,;\s]+/)
    .filter(Boolean)
    .flatMap((tok) => {
      const m = tok.match(/^(-|\?|\d*\.?\d+)(?:\/(\d*\.?\d+))?(%?)$/);
      if (!m) return [];
      if (m[2]) total = Number(m[2]);
      if (m[3]) return [{ earned: Number(m[1]), total: 100 }];
      return [{ earned: m[1] === "-" || m[1] === "?" ? null : Number(m[1]), total }];
    });
}

export const fmt = (x: number | null | undefined, d = 1) => (x === null || x === undefined || !Number.isFinite(x) ? "—" : `${x.toFixed(d).replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "")}%`);

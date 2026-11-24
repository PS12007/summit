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
  movedToFinal?: boolean; // this category's weight was moved to the final (you did better there)
  movedIn?: number; // on the final: weight moved in from other categories
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

/** Categories whose weight can move to the final, if there is a final to move it to. */
function movable(course: Course, f: GradeCategory | undefined): GradeCategory[] {
  return f ? course.grades.filter((c) => c.toFinal && c.id !== f.id && num(c.weight) > 0) : [];
}

/** Category results with "move weight to the final" applied, once the final has a grade.
 *  Never changes the course itself — the moved weights live only in the results. */
function categoryResults(course: Course): CategoryResult[] {
  const base = course.grades.map(categoryResult);
  const f = finalCategory(course);
  const finalAvg = base.find((r) => r.cat.id === f?.id)?.avg ?? null;
  if (!f || finalAvg === null) return base;
  const moved = new Set(
    movable(course, f)
      .filter((c) => {
        const avg = base.find((r) => r.cat.id === c.id)!.avg;
        return avg !== null && finalAvg > avg + 1e-9;
      })
      .map((c) => c.id),
  );
  if (!moved.size) return base;
  const extra = course.grades.filter((c) => moved.has(c.id)).reduce((a, c) => a + num(c.weight), 0);
  return course.grades.map((c) => {
    if (moved.has(c.id)) return { ...categoryResult({ ...c, weight: 0 }), cat: c, movedToFinal: true };
    if (c.id === f.id) return { ...categoryResult({ ...c, weight: num(c.weight) + extra }), cat: c, movedIn: extra };
    return base.find((r) => r.cat.id === c.id)!;
  });
}

export function summarize(course: Course): GradeSummary {
  const cats = categoryResults(course);
  const totalWeight = cats.reduce((a, c) => a + c.weight, 0);
  const earned = cats.reduce((a, c) => a + c.earned, 0);
  const graded = cats.reduce((a, c) => a + c.graded, 0);
  const remaining = cats.reduce((a, c) => a + c.remaining, 0);
  const T = totalWeight || 100;
  const current = graded > 0.0001 ? (earned / graded) * 100 : null;
  const target = num(course.target);
  const g: GradeSummary = {
    current, totalWeight, earned, graded, remaining, cats,
    lost: Math.max(0, graded - earned),
    min: (earned / T) * 100,
    max: ((earned + remaining) / T) * 100,
    projected: current === null ? null : ((earned + (current / 100) * remaining) / T) * 100,
    needed: target > 0 && remaining > 0.0001 ? (((target / 100) * T - earned) / remaining) * 100 : null,
  };
  // Best case: a perfect final can also pull weight over from other categories.
  const f = finalCategory(course);
  const fr = cats.find((r) => r.cat.id === f?.id);
  if (f && fr && fr.remaining > 0.0001 && shiftsTo(course, f.id)) g.max = Math.max(g.max, finishWith(course, g, f.id, 100, 100));
  return g;
}

/** Percent needed on one category (usually the final) to finish at `target`,
 *  assuming you average `assume`% on everything else that's left. */
export function neededOn(course: Course, g: GradeSummary, catId: string, target: number, assume: number): number | null {
  const c = g.cats.find((x) => x.cat.id === catId);
  if (!c || c.remaining < 0.0001) return null;
  if (!shiftsTo(course, catId)) {
    const T = g.totalWeight || 100;
    const other = g.remaining - c.remaining;
    return (((target / 100) * T - g.earned - (assume / 100) * other) / c.remaining) * 100;
  }
  // Weight can move onto the final, so the result isn't a straight line — search for it.
  // finishWith only goes up as the final score goes up.
  const at = (p: number) => finishWith(course, g, catId, p, assume);
  if (at(0) >= target - 1e-9) return 0;
  let lo = 0, hi = 1000;
  if (at(hi) < target - 1e-9) return Infinity;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    at(mid) >= target - 1e-9 ? (hi = mid) : (lo = mid);
  }
  return hi;
}

/** True when some category's weight could move onto this one (it's the final). */
function shiftsTo(course: Course, catId: string): boolean {
  const f = finalCategory(course);
  return f?.id === catId && movable(course, f).length > 0;
}

/** Final course percent if you score `pct` on that category and `assume`% on the rest.
 *  If that's the final, categories set to "move to the final" hand their weight over
 *  whenever the final ends up higher than their own average. */
export function finishWith(course: Course, g: GradeSummary, catId: string, pct: number, assume: number): number {
  const T = g.totalWeight || 100;
  if (!shiftsTo(course, catId)) {
    const c = g.cats.find((x) => x.cat.id === catId);
    const mine = c?.remaining ?? 0;
    return ((g.earned + (pct / 100) * mine + (assume / 100) * (g.remaining - mine)) / T) * 100;
  }
  const f = finalCategory(course)!;
  const canMove = new Set(movable(course, f).map((c) => c.id));
  const base = course.grades.map(categoryResult);
  const fr = base.find((r) => r.cat.id === f.id)!;
  const finalAvg = fr.weight > 0 ? ((fr.earned + (pct / 100) * fr.remaining) / fr.weight) * 100 : pct;
  let total = 0, extra = 0;
  for (const r of base) {
    if (r === fr) continue;
    const ends = r.earned + (assume / 100) * r.remaining; // what this category ends up giving
    if (canMove.has(r.cat.id) && r.weight > 0 && finalAvg > (ends / r.weight) * 100 + 1e-9) extra += r.weight;
    else total += ends;
  }
  return ((total + (finalAvg / 100) * (fr.weight + extra)) / T) * 100;
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

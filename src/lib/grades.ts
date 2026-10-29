import type { Course } from "./types";

export interface GradeSummary {
  current: number | null; // percent, based only on graded work
  totalWeight: number;
  remainingWeight: number; // weight of work not graded yet
  earnedPoints: number; // contribution already locked in
  needed: number | null; // average needed on remaining work to hit target
}

/**
 * Ungraded items (earned = null) count as remaining work.
 * A category with no items yet counts fully as remaining.
 */
export function summarize(course: Course): GradeSummary {
  let gradedWeight = 0, weightedPct = 0, earnedPoints = 0, remainingWeight = 0, totalWeight = 0;

  for (const cat of course.grades) {
    const w = Number(cat.weight) || 0;
    totalWeight += w;
    const all = cat.scores.reduce((s, x) => s + (x.total || 0), 0);
    const graded = cat.scores.filter((x) => x.earned !== null && x.total > 0);
    const gradedTotal = graded.reduce((s, x) => s + x.total, 0);
    const earned = graded.reduce((s, x) => s + (x.earned ?? 0), 0);

    if (gradedTotal > 0) {
      gradedWeight += w;
      weightedPct += w * (earned / gradedTotal);
      earnedPoints += w * (earned / all);
      remainingWeight += w * ((all - gradedTotal) / all);
    } else {
      remainingWeight += w;
    }
  }

  const current = gradedWeight > 0 ? (weightedPct / gradedWeight) * 100 : null;
  let needed: number | null = null;
  if (course.target && remainingWeight > 0.0001) {
    needed = ((course.target / 100) * totalWeight - earnedPoints) / remainingWeight * 100;
  }
  return { current, totalWeight, remainingWeight, earnedPoints, needed };
}

export function letter(pct: number | null): string {
  if (pct === null) return "—";
  const scale: [number, string][] = [
    [93, "A"], [90, "A-"], [87, "B+"], [83, "B"], [80, "B-"], [77, "C+"],
    [73, "C"], [70, "C-"], [67, "D+"], [60, "D"], [0, "F"],
  ];
  return scale.find(([min]) => pct >= min)![1];
}

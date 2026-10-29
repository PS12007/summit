// Muted, earthy course colours that sit well on the photo backgrounds.
export const COURSE_COLORS: Record<string, string> = {
  sage: "#6f9468",
  sky: "#5f88b4",
  clay: "#c0714f",
  sand: "#c49a4a",
  plum: "#8f6aa3",
  teal: "#3f938c",
  rose: "#c06f86",
  slate: "#69788a",
};

export const colorOf = (key: string | undefined) => COURSE_COLORS[key ?? ""] ?? COURSE_COLORS.slate;

export const KIND_LABEL = {
  exam: "Exam",
  quiz: "Quiz",
  assignment: "Assignment",
  project: "Project",
  reading: "Reading",
  event: "Event",
} as const;

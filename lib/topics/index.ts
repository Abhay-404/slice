/**
 * Every chapter, every grade. K through 5, US Common Core, in the order
 * each idea is taught.
 */
import { GRADE_1, GRADE_2, GRADE_K } from "./early";
import { GRADE4 } from "./grade4";
import { GRADE_3, GRADE_5 } from "./upper";
import type { Topic } from "./types";

export * from "./types";

export const BY_GRADE: Record<string, Topic[]> = {
  K: GRADE_K,
  "1": GRADE_1,
  "2": GRADE_2,
  "3": GRADE_3,
  "4": GRADE4,
  "5": GRADE_5,
};

export const TOPICS: Topic[] = Object.values(BY_GRADE).flat();

export function topicsFor(grade: string): Topic[] {
  return BY_GRADE[grade] ?? [];
}

export function topicById(id: string): Topic | undefined {
  return TOPICS.find((t) => t.id === id);
}

/** What the grade is mostly about, for the home screen subtitle. */
export const GRADE_THEME: Record<string, string> = {
  K: "Counting & putting together",
  "1": "Adding & tens and ones",
  "2": "Bigger numbers & equal parts",
  "3": "Groups, sharing & first fractions",
  "4": "Fractions",
  "5": "Fractions & decimals",
};

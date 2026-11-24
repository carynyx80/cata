import type { Card, Grade, PricePoint } from "./types.js";

export const GRADES: Grade[] = ["raw", "psa9", "psa10"];

/** Value of a card at a grade, falling back to the nearest known grade. */
export function valueAt(prices: Card["prices"] | PricePoint, grade: Grade): number | null {
  const order: Record<Grade, Grade[]> = { psa10: ["psa10", "psa9", "raw"], psa9: ["psa9", "raw", "psa10"], raw: ["raw", "psa9", "psa10"] };
  for (const g of order[grade]) if (prices[g] != null) return prices[g]!;
  return null;
}

/** Reference value used for ranking (top grade available). */
export function refValue(prices: Card["prices"]): number {
  return prices.psa10 ?? prices.psa9 ?? prices.raw ?? 0;
}

export function gradeFromNumber(n: number): Grade {
  if (n >= 10) return "psa10";
  if (n >= 9) return "psa9";
  return "raw";
}

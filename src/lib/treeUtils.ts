export type TreeState = "dead" | "dying" | "weak" | "healthy" | "thriving";

// 5 stopenj: 0-15 mrtvo, 16-35 umirajoče, 36-55 šibko, 56-78 zdravo, 79-100 cvetoče
export function getTreeState(score: number): TreeState {
  if (score <= 15) return "dead";
  if (score <= 35) return "dying";
  if (score <= 55) return "weak";
  if (score <= 78) return "healthy";
  return "thriving";
}

export const STATE_ORDER: TreeState[] = ["dead", "dying", "weak", "healthy", "thriving"];

export function stateIndex(s: TreeState): number {
  return STATE_ORDER.indexOf(s);
}

export const MONTHS_SI = [
  "Jan", "Feb", "Mar", "Apr", "Maj", "Jun",
  "Jul", "Avg", "Sep", "Okt", "Nov", "Dec",
];

export function dayToDate(day: number): { month: number; dayOfMonth: number; monthName: string } {
  const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  let d = day;
  for (let m = 0; m < 12; m++) {
    if (d < daysInMonth[m]) {
      return { month: m, dayOfMonth: d + 1, monthName: MONTHS_SI[m] };
    }
    d -= daysInMonth[m];
  }
  return { month: 11, dayOfMonth: 31, monthName: "Dec" };
}

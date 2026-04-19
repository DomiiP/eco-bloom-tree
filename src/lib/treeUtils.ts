export type TreeState = "dead" | "weak" | "healthy" | "thriving";

export function getTreeState(score: number): TreeState {
  if (score <= 20) return "dead";
  if (score <= 45) return "weak";
  if (score <= 75) return "healthy";
  return "thriving";
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

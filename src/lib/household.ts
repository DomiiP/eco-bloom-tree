// Realistični podatki za slovensko gospodinjstvo
// Vir: Statistični urad RS, EKO sklad
// Povprečna poraba elektrike: ~3500 kWh/leto na gospodinjstvo (2-4 osebe) ≈ 9.6 kWh/dan
// Povprečna poraba vode: ~150 L/oseba/dan

export type MemberRole = "adult" | "teen" | "child";

export interface FamilyMember {
  id: string;
  role: MemberRole;
  name: string;
}

// Dnevna poraba na osebo
export const consumptionByRole: Record<MemberRole, { water: number; electricity: number }> = {
  adult: { water: 150, electricity: 3.5 },   // L/dan, kWh/dan
  teen: { water: 180, electricity: 3.0 },    // tuširanje, naprave
  child: { water: 90, electricity: 1.5 },
};

export type DayEventType = "normal" | "weekend" | "holiday" | "vacation" | "guests";

export interface HouseholdDay {
  day: number;
  type: DayEventType;
  presentMembers: number; // koliko članov je doma
  guestCount: number;
  multiplier: number; // splošen multiplier za dan
}

const slovenianHolidays = [0, 1, 40, 116, 117, 120, 145, 176, 226, 273, 304, 358, 359, 360];
// Približno: 1.1, 1.2, 8.2 (kulturni), 27.4, 28.4 (upor), 1.5, 25.6, 15.8, 31.10, 1.11, 25.12, 26.12

export function generateYearHousehold(seed = 7, familySize = 4): HouseholdDay[] {
  const days: HouseholdDay[] = [];
  // Določi 1-2 počitniška obdobja (po 7-14 dni)
  const vacationStart1 = 195 + Math.floor((Math.sin(seed) + 1) * 15); // konec julija
  const vacationLen1 = 10;
  const vacationStart2 = 50 + Math.floor((Math.cos(seed) + 1) * 10); // februar
  const vacationLen2 = 7;

  for (let day = 0; day < 365; day++) {
    const dow = day % 7; // 0 = pon
    const isWeekend = dow === 5 || dow === 6;
    const isHoliday = slovenianHolidays.includes(day);
    const isVacation =
      (day >= vacationStart1 && day < vacationStart1 + vacationLen1) ||
      (day >= vacationStart2 && day < vacationStart2 + vacationLen2);

    // Gostje: ~3% dni, pogosteje med vikendi
    const guestRand = Math.sin(day * 13.7 + seed) * 0.5 + 0.5;
    const hasGuests = !isVacation && guestRand < (isWeekend ? 0.12 : 0.04);
    const guestCount = hasGuests ? Math.ceil(guestRand * 4) + 1 : 0;

    let type: DayEventType = "normal";
    let multiplier = 0.85; // čez teden manj doma (služba/šola)
    let presentMembers = familySize;

    if (isVacation) {
      type = "vacation";
      multiplier = 0.05; // skoraj nič – samo hladilnik, stand-by
      presentMembers = 0;
    } else if (isHoliday) {
      type = "holiday";
      multiplier = 1.25;
    } else if (hasGuests) {
      type = "guests";
      multiplier = 1.4;
    } else if (isWeekend) {
      type = "weekend";
      multiplier = 1.15;
    }

    days.push({ day, type, presentMembers, guestCount, multiplier });
  }
  return days;
}

// Izračun dnevne porabe glede na družino in dnevni multiplier
export function calcDailyConsumption(family: FamilyMember[], hd: HouseholdDay) {
  let water = 0;
  let electricity = 0;
  for (const m of family) {
    water += consumptionByRole[m.role].water;
    electricity += consumptionByRole[m.role].electricity;
  }
  // Gostje (kot odrasli)
  water += hd.guestCount * consumptionByRole.adult.water * 0.6;
  electricity += hd.guestCount * consumptionByRole.adult.electricity * 0.5;

  water *= hd.multiplier;
  electricity *= hd.multiplier;

  // Daily noise + seasonal drift so the year shows real variation, not a repeating pattern
  const seasonal = 0.92 + Math.sin((hd.day / 365) * Math.PI * 2) * 0.18;
  const fast = 0.78 + (Math.sin(hd.day * 2.7) * 0.5 + 0.5) * 0.45;
  const slow = 0.85 + (Math.sin(hd.day * 0.31 + 1.1) * 0.5 + 0.5) * 0.3;
  water *= fast * seasonal;
  electricity *= slow * (2 - seasonal); // winter heating bumps electricity up

  // Stand-by poraba pri vacation
  if (hd.type === "vacation") {
    electricity = Math.max(electricity, 1.5);
    water = Math.max(water, 2);
  }

  return { water: Math.round(water), electricity: Math.round(electricity * 10) / 10 };
}

// Trajnostni cilji – razširjen razpon za bolj dinamičen graf
export function consumptionToScore(family: FamilyMember[], water: number, electricity: number): number {
  const baseW = family.length * 130;
  const baseE = family.length * 2.8;

  const wRatio = water / baseW;
  const eRatio = electricity / baseE;

  let wScore: number;
  if (wRatio < 0.5) wScore = 100;
  else if (wRatio < 0.9) wScore = 100 - (wRatio - 0.5) * 50;
  else if (wRatio < 1.4) wScore = 80 - (wRatio - 0.9) * 80;
  else wScore = Math.max(0, 40 - (wRatio - 1.4) * 60);

  let eScore: number;
  if (eRatio < 0.5) eScore = 100;
  else if (eRatio < 0.9) eScore = 100 - (eRatio - 0.5) * 50;
  else if (eRatio < 1.4) eScore = 80 - (eRatio - 0.9) * 80;
  else eScore = Math.max(0, 40 - (eRatio - 1.4) * 60);

  return Math.round(Math.max(0, Math.min(100, wScore * 0.45 + eScore * 0.55)));
}

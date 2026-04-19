// Realistični vremenski podatki za Slovenijo (povprečja)
// Sonce: ure sonca/dan, Padavine: mm/dan
// Vir: ARSO povprečja

export interface DayWeather {
  day: number; // 0-364
  sunHours: number; // 0-15
  rainMm: number; // 0-30
  isDrought: boolean;
  isHeatwave: boolean;
  isStorm: boolean;
  temperature: number; // °C
}

// Povprečne ure sonca po mesecih (Ljubljana)
const sunByMonth = [2.5, 3.8, 4.8, 5.5, 7.0, 8.0, 9.0, 8.2, 6.0, 4.0, 2.0, 1.8];
// Povprečne padavine mm/dan po mesecih
const rainByMonth = [2.5, 2.3, 3.0, 3.8, 4.2, 5.0, 4.0, 4.5, 4.8, 4.0, 4.5, 3.5];
// Povprečna temperatura
const tempByMonth = [0, 2, 6, 11, 16, 19, 21, 20, 16, 11, 5, 1];

const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function getMonth(day: number): number {
  let d = day;
  for (let m = 0; m < 12; m++) {
    if (d < daysInMonth[m]) return m;
    d -= daysInMonth[m];
  }
  return 11;
}

// Deterministično psevdo-naključno (seed na dan)
function rand(seed: number): number {
  const x = Math.sin(seed * 9999) * 10000;
  return x - Math.floor(x);
}

export function generateYearWeather(seed = 42): DayWeather[] {
  const days: DayWeather[] = [];
  for (let day = 0; day < 365; day++) {
    const m = getMonth(day);
    const r1 = rand(day + seed);
    const r2 = rand(day + seed + 1000);
    const r3 = rand(day + seed + 2000);

    const baseSun = sunByMonth[m];
    const baseRain = rainByMonth[m];
    const baseTemp = tempByMonth[m];

    // Variacija ± 50%
    let sunHours = Math.max(0, baseSun + (r1 - 0.5) * baseSun);
    let rainMm = r2 < 0.55 ? Math.max(0, baseRain * (r2 / 0.55) * 2.2) : 0;
    let temperature = baseTemp + (r3 - 0.5) * 6;

    // Posebni dogodki
    let isDrought = false;
    let isHeatwave = false;
    let isStorm = false;

    // Suša julij-avgust
    if ((m === 6 || m === 7) && rand(day + seed + 5000) < 0.18) {
      isDrought = true;
      rainMm = 0;
      sunHours = Math.min(13, baseSun + 2);
      temperature += 4;
    }
    // Vročinski val
    if ((m >= 5 && m <= 7) && rand(day + seed + 6000) < 0.08) {
      isHeatwave = true;
      temperature += 6;
      sunHours = Math.min(14, baseSun + 3);
    }
    // Nevihte/dolg dež
    if (rand(day + seed + 7000) < 0.06) {
      isStorm = true;
      rainMm = baseRain * 4 + 10;
      sunHours = Math.max(0, baseSun - 4);
    }

    days.push({
      day,
      sunHours: Math.round(sunHours * 10) / 10,
      rainMm: Math.round(rainMm * 10) / 10,
      isDrought,
      isHeatwave,
      isStorm,
      temperature: Math.round(temperature * 10) / 10,
    });
  }
  return days;
}

import { useEffect, useMemo, useRef, useState } from "react";
import { Droplets, Zap, Sun, CloudRain, Thermometer, Plus, AlertCircle, FastForward, Pause, Play, RotateCcw } from "lucide-react";
import AmbientTree from "@/components/AmbientTree";
import SimulationControls from "@/components/SimulationControls";
import YearTimeline from "@/components/YearTimeline";
import TimelineLegend from "@/components/TimelineLegend";
import TreeStatusBanner, { StatusInfo } from "@/components/TreeStatusBanner";
import { Button } from "@/components/ui/button";
import { generateYearWeather, DayWeather } from "@/lib/weather";
import { TreeState, getTreeState, dayToDate, stateIndex } from "@/lib/treeUtils";

// === Daily needs (L water, "light hours") ===
function dailyWaterNeed(w: DayWeather): number {
  if (w.temperature > 25) return 35;
  if (w.temperature > 18) return 22;
  if (w.temperature > 10) return 12;
  if (w.temperature > 2) return 6;
  return 3;
}
function dailyLightNeed(w: DayWeather): number {
  return w.temperature < 2 ? 4 : 7;
}

interface DayLog {
  day: number;
  score: number;
  state: TreeState;
  waterNeed: number;
  lightNeed: number;
  waterReserve: number;
  lightReserve: number;
  waterRatio: number;
  lightRatio: number;
}

interface ActionLogEntry {
  id: number;
  day: number;
  week: number;
  category: "water" | "light";
  label: string;
  amount: number;
}

const stateLabels: Record<TreeState, string> = {
  dead: "Mrtvo",
  dying: "Umirajoče",
  weak: "Šibko",
  healthy: "Zdravo",
  thriving: "Cvetoče",
};

// === Status helpers (continuous, every day) ===
// Ratio thresholds:
//   < 0.6 critical low, 0.6-0.85 low, 0.85-1.25 ok, 1.25-1.6 high, > 1.6 critical high
function classifyRatio(r: number): "low" | "ok" | "high" | "critHigh" {
  if (r < 0.85) return "low";
  if (r > 1.6) return "critHigh";
  if (r > 1.25) return "high";
  return "ok";
}

function buildStatus(waterRatio: number, lightRatio: number): StatusInfo {
  const w = classifyRatio(waterRatio);
  const l = classifyRatio(lightRatio);

  // Excess (overdose)
  if (w === "critHigh" && l === "critHigh") {
    return {
      kind: "excess-both",
      title: "Drevo je preobremenjeno",
      description: "Prevelika količina vode in svetlobe škoduje koreninam in listom. Počakaj, da se zaloge porabijo.",
    };
  }
  if (w === "critHigh") {
    return {
      kind: "excess-water",
      title: "Preveč vode",
      description: "Korenine se dušijo zaradi zalivanja čez mejo. Naslednje dni ne dodajaj vode.",
    };
  }
  if (l === "critHigh") {
    return {
      kind: "excess-light",
      title: "Preveč svetlobe",
      description: "Listi so izpostavljeni preveliki količini svetlobe. Zmanjšaj dodajanje za nekaj dni.",
    };
  }

  // Deficits
  if (w === "low" && l === "low") {
    return {
      kind: "low-both",
      title: "Drevo potrebuje vodo in svetlobo",
      description: "Trenutne zaloge ne pokrivajo potreb. Dodaj oboje, da prepreciš poslabšanje.",
    };
  }
  if (w === "low") {
    return {
      kind: "low-water",
      title: "Drevo potrebuje vodo",
      description: "Naravne padavine ne zadoščajo. Dodaj vodo, da ohraniš stanje.",
    };
  }
  if (l === "low") {
    return {
      kind: "low-light",
      title: "Drevo potrebuje svetlobo",
      description: "Naravna svetloba je premajhna. Dodaj umetno svetlobo za rast.",
    };
  }

  return {
    kind: "ok",
    title: "Drevo ima ustrezne pogoje",
    description: "Zaloge vode in svetlobe so v ravnovesju. Drevo lahko mirno raste.",
  };
}

// === Reservoir model ===
// Two separate "buckets":
//   - naturalReserve: filled ONLY by nature (rain / sun). Capped at exactly the
//     "balanced" coverage so nature alone can never produce an "overdose".
//   - userReserve: filled by user additions. Decays exponentially each day so
//     a big dump gives a short stress spike + a long tail of healthy supply.
// Effective reserve = naturalReserve + userReserve.
// Acute overdose: user reserve clearly above weekly need
// Acute overdose: user reserve clearly above weekly need
const ACUTE_WATER_FACTOR = 2.0;
const ACUTE_LIGHT_FACTOR = 2.0;
const TREE_TANK_DECAY_DAYS = 45;
const TREE_TANK_CAPACITY = 100;
const ELECTRICITY_VISUAL_GAIN = 3;

const TreeMaintenanceView = () => {
  const weather = useMemo(() => generateYearWeather(), []);
  const [day, setDay] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(3);
  const [score, setScore] = useState(70);
  const [waterToAdd, setWaterToAdd] = useState(0);
  const [lightToAdd, setLightToAdd] = useState(0);
  const [history, setHistory] = useState<DayLog[]>([]);
  const [actionLog, setActionLog] = useState<ActionLogEntry[]>([]);
  const [recentChange, setRecentChange] = useState<{ direction: "up" | "down"; from: string; to: string } | null>(null);
  const [pendingWater, setPendingWater] = useState(0);
  const [pendingLight, setPendingLight] = useState(0);
  const [savedWater, setSavedWater] = useState(0);
  const [savedLight, setSavedLight] = useState(0);
  const [selectedWaterAction, setSelectedWaterAction] = useState<string | null>(null);
  const [selectedLightAction, setSelectedLightAction] = useState<string | null>(null);
  // Two-bucket model
  const [naturalWater, setNaturalWater] = useState(20); // L
  const [naturalLight, setNaturalLight] = useState(10); // h
  const [userWater, setUserWater] = useState(0); // L (decays)
  const [userLight, setUserLight] = useState(0); // h-equivalent (decays)
  const [lastChangeDay, setLastChangeDay] = useState(-7);

  const dayRef = useRef(0);
  const scoreRef = useRef(70);
  const lastChangeRef = useRef(-7);
  const naturalWaterRef = useRef(20);
  const naturalLightRef = useRef(10);
  const userWaterRef = useRef(0);
  const userLightRef = useRef(0);
  const pendingWaterRef = useRef(0);
  const pendingLightRef = useRef(0);

  dayRef.current = day;
  scoreRef.current = score;
  lastChangeRef.current = lastChangeDay;
  naturalWaterRef.current = naturalWater;
  naturalLightRef.current = naturalLight;
  userWaterRef.current = userWater;
  userLightRef.current = userLight;
  pendingWaterRef.current = pendingWater;
  pendingLightRef.current = pendingLight;

  const state = getTreeState(score);

  // Main daily tick
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      const d = dayRef.current;
      if (d >= 364) {
        setIsPlaying(false);
        return;
      }

      const today = weather[d];

      // Apply pending user additions on the first day of each weekly cycle
      const isWeekStart = d % 7 === 0;
      let newUserWater = userWaterRef.current;
      let newUserLight = userLightRef.current;
      let acuteStress = 0;

      if (isWeekStart && (pendingWaterRef.current > 0 || pendingLightRef.current > 0)) {
        const upcoming = weather.slice(d, Math.min(d + 7, 365));
        const weekWaterNeed = upcoming.reduce((s, w) => s + dailyWaterNeed(w), 0);
        const weekLightNeed = upcoming.reduce((s, w) => s + dailyLightNeed(w), 0);

        if (pendingWaterRef.current > weekWaterNeed * ACUTE_WATER_FACTOR) {
          acuteStress += 8;
        }
        if (pendingLightRef.current * 7 > weekLightNeed * ACUTE_LIGHT_FACTOR) {
          acuteStress += 6;
        }

        newUserWater += pendingWaterRef.current;
        // user "light" amount is per-day intensity -> spread as 7 days of hours
        newUserLight += pendingLightRef.current * 7;
        pendingWaterRef.current = 0;
        pendingLightRef.current = 0;
        setPendingWater(0);
        setPendingLight(0);
      }

      // Compute daily needs
      const wNeed = dailyWaterNeed(today);
      const lNeed = dailyLightNeed(today);

      // Natural reserve: capped so nature alone can never overdose.
      // Cap = a few days of need (computed against rolling avg).
      const naturalWaterCap = wNeed * 5;
      const naturalLightCap = lNeed * 4;
      let newNaturalWater = naturalWaterRef.current + today.rainMm * 1.2;
      let newNaturalLight = naturalLightRef.current + today.sunHours;
      newNaturalWater = Math.min(naturalWaterCap, newNaturalWater);
      newNaturalLight = Math.min(naturalLightCap, newNaturalLight);

      // Drain natural first, then user
      let drainW = wNeed;
      const fromNatW = Math.min(newNaturalWater, drainW);
      newNaturalWater -= fromNatW;
      drainW -= fromNatW;
      newUserWater = Math.max(0, newUserWater - drainW);

      let drainL = lNeed;
      const fromNatL = Math.min(newNaturalLight, drainL);
      newNaturalLight -= fromNatL;
      drainL -= fromNatL;
      newUserLight = Math.max(0, newUserLight - drainL);

      // Exponential decay of user reserve (so big dumps don't last forever)
      newUserWater = newUserWater * 0.88;
      newUserLight = newUserLight * 0.85;

      // Score drift based on coverage of next 3 days
      const lookahead = weather.slice(d, Math.min(d + 3, 365));
      const wNeedAhead = lookahead.reduce((s, w) => s + dailyWaterNeed(w), 0);
      const lNeedAhead = lookahead.reduce((s, w) => s + dailyLightNeed(w), 0);
      // Include pending amounts so score reflects what user has added (on non-week-start days, pending hasn't been merged yet)
      const totalW = newNaturalWater + newUserWater + (isWeekStart ? 0 : pendingWaterRef.current);
      const totalL = newNaturalLight + newUserLight + (isWeekStart ? 0 : pendingLightRef.current * 7);
      const wRatio = totalW / Math.max(1, wNeedAhead);
      const lRatio = totalL / Math.max(1, lNeedAhead);

      let dailyDrift = 0;
      // Reward balance
      if (wRatio >= 0.85 && wRatio <= 1.4 && lRatio >= 0.85 && lRatio <= 1.4) dailyDrift += 1.4;
      else if (wRatio >= 0.55 && lRatio >= 0.55 && wRatio <= 1.6 && lRatio <= 1.6) dailyDrift += 0.4;
      // Mild deficits (so without user input the tree drifts in lower half but rarely dies)
      if (wRatio < 0.55) dailyDrift -= 0.7;
      if (lRatio < 0.55) dailyDrift -= 0.6;
      // Severe deficits (only happens with bad weather like drought + cloudy)
      if (wRatio < 0.25) dailyDrift -= 0.8;
      if (lRatio < 0.25) dailyDrift -= 0.7;
      // Sustained excess (only possible from user adds)
      if (wRatio > 1.8) dailyDrift -= 0.6;
      if (lRatio > 1.8) dailyDrift -= 0.5;

      // Weather penalties (mild)
      if (today.isDrought) dailyDrift -= 0.3;
      if (today.isHeatwave) dailyDrift -= 0.2;

      let newScore = Math.max(0, Math.min(100, scoreRef.current + dailyDrift - acuteStress));

      // Stage change every 7 days, with 7-day cooldown
      const isEvalDay = (d + 1) % 7 === 0;
      let changedDirection: "up" | "down" | null = null;
      const fromState: TreeState = getTreeState(scoreRef.current);
      let toState: TreeState = getTreeState(newScore);

      if (isEvalDay && d - lastChangeRef.current >= 7) {
        const curIdx = stateIndex(fromState);
        const newIdx = stateIndex(toState);
        if (newIdx > curIdx) {
          const targetScore = thresholdForStage(curIdx + 1);
          newScore = Math.max(newScore, targetScore);
          toState = getTreeState(newScore);
          changedDirection = "up";
          lastChangeRef.current = d;
          setLastChangeDay(d);
        } else if (newIdx < curIdx) {
          const targetScore = thresholdForStage(curIdx) - 1;
          newScore = Math.min(newScore, targetScore);
          toState = getTreeState(newScore);
          changedDirection = "down";
          lastChangeRef.current = d;
          setLastChangeDay(d);
        }
      } else {
        if (toState !== fromState) {
          const curIdx = stateIndex(fromState);
          const minScore = thresholdForStage(curIdx);
          const maxScore = thresholdForStage(curIdx + 1) - 1;
          newScore = Math.max(minScore, Math.min(maxScore, newScore));
          toState = fromState;
        }
      }

      setScore(newScore);
      setNaturalWater(newNaturalWater);
      setNaturalLight(newNaturalLight);
      setUserWater(newUserWater);
      setUserLight(newUserLight);
      setSavedWater((value) => Math.max(0, value - TREE_TANK_CAPACITY / TREE_TANK_DECAY_DAYS));
      setSavedLight((value) => Math.max(0, value - TREE_TANK_CAPACITY / TREE_TANK_DECAY_DAYS));
      setHistory((h) => [
        ...h,
        {
          day: d,
          score: newScore,
          state: toState,
          waterNeed: wNeed,
          lightNeed: lNeed,
          waterReserve: totalW,
          lightReserve: totalL,
          waterRatio: wRatio,
          lightRatio: lRatio,
        },
      ]);
      setDay(d + 1);

      // Auto-pause every ~60 days (6 times in the year), but allow resuming
      if ((d + 1) > 0 && (d + 1) % 60 === 0) {
        setIsPlaying(false);
      }

      if (changedDirection) {
        setRecentChange({
          direction: changedDirection,
          from: stateLabels[fromState],
          to: stateLabels[toState],
        });
      }
    }, 1000 / speed);
    return () => clearInterval(interval);
  }, [isPlaying, speed, weather]);

  const reset = () => {
    setIsPlaying(false);
    setDay(0);
    setScore(70);
    setHistory([]);
    setActionLog([]);
    setPendingWater(0);
    setPendingLight(0);
    setSavedWater(0);
    setSavedLight(0);
    setWaterToAdd(0);
    setLightToAdd(0);
    setSelectedWaterAction(null);
    setSelectedLightAction(null);
    setRecentChange(null);
    setLastChangeDay(-7);
    setNaturalWater(20);
    setNaturalLight(10);
    setUserWater(0);
    setUserLight(0);
  };

  const handleAdd = (waterAmount: number = 0, lightAmount: number = 0, waterLabel: string | null = null, lightLabel: string | null = null) => {
    const week = Math.floor(day / 7) + 1;

    setActionLog((entries) => {
      const nextEntries = [...entries];

      if (waterAmount > 0) {
        nextEntries.unshift({
          id: Date.now(),
          day,
          week,
          category: "water",
          label: waterLabel ?? "Prihranek vode",
          amount: waterAmount,
        });
      }

      if (lightAmount > 0) {
        nextEntries.unshift({
          id: Date.now() + 1,
          day,
          week,
          category: "light",
          label: lightLabel ?? "Prihranek elektrike",
          amount: lightAmount,
        });
      }

      return nextEntries.slice(0, 12);
    });

    setSavedWater((value) => Math.min(TREE_TANK_CAPACITY, value + waterAmount));
    setSavedLight((value) => Math.min(TREE_TANK_CAPACITY, value + lightAmount * ELECTRICITY_VISUAL_GAIN));
    setPendingWater((p) => p + waterAmount);
    setPendingLight((p) => p + lightAmount);
    setWaterToAdd(0);
    setLightToAdd(0);
    setSelectedWaterAction(null);
    setSelectedLightAction(null);
  };

  const todayWeather = weather[Math.min(day, 364)];
  const date = dayToDate(Math.min(day, 364));

  // Continuous status (uses combined reserves vs upcoming 3-day need + acute pending check)
  const status: StatusInfo = useMemo(() => {
    const lookahead = weather.slice(day, Math.min(day + 3, 365));
    const wNeedAhead = lookahead.reduce((s, w) => s + dailyWaterNeed(w), 0) || 1;
    const lNeedAhead = lookahead.reduce((s, w) => s + dailyLightNeed(w), 0) || 1;
    const wRatio = (naturalWater + userWater + pendingWater) / wNeedAhead;
    const lRatio = (naturalLight + userLight + pendingLight * 7) / lNeedAhead;
    return buildStatus(wRatio, lRatio);
  }, [day, naturalWater, naturalLight, userWater, userLight, pendingWater, pendingLight, weather]);

  // Events for timeline (max 15)
  const events = useMemo(() => {
    const all = weather
      .map((w) => {
        if (w.isDrought) return { day: w.day, type: "drought" as const, label: "Suša" };
        if (w.isHeatwave) return { day: w.day, type: "heatwave" as const, label: "Vročinski val" };
        if (w.isStorm) return { day: w.day, type: "storm" as const, label: "Nevihta" };
        return null;
      })
      .filter((e): e is NonNullable<typeof e> => e !== null);
    if (all.length <= 15) return all;
    const step = all.length / 15;
    return Array.from({ length: 15 }, (_, i) => all[Math.floor(i * step)]);
  }, [weather]);

  // Friendly reserve coverage for next ~3 days
  const lookahead = weather.slice(day, Math.min(day + 3, 365));
  const wNeed3 = lookahead.reduce((s, w) => s + dailyWaterNeed(w), 0);
  const lNeed3 = lookahead.reduce((s, w) => s + dailyLightNeed(w), 0);
  const totalWaterReserve = naturalWater + userWater + pendingWater;
  const totalLightReserve = naturalLight + userLight + pendingLight * 7;
  const waterCoverPct = Math.min(200, Math.round((totalWaterReserve / Math.max(1, wNeed3)) * 100));
  const lightCoverPct = Math.min(200, Math.round((totalLightReserve / Math.max(1, lNeed3)) * 100));

  // Fixed button amounts based on tank fractions
  // 1/15, 1/10, 1/5, 1/2 of TREE_TANK_CAPACITY
  const waterChoices = [
    Math.round(TREE_TANK_CAPACITY / 15),   // ~7
    Math.round(TREE_TANK_CAPACITY / 10),   // 10
    Math.round(TREE_TANK_CAPACITY / 5),    // 20
    Math.round(TREE_TANK_CAPACITY / 2),    // 50
  ];
  // Light choices account for ELECTRICITY_VISUAL_GAIN multiplier so buttons don't disable
  const lightChoices = [
    Math.round(TREE_TANK_CAPACITY / 15 / ELECTRICITY_VISUAL_GAIN),   // ~2
    Math.round(TREE_TANK_CAPACITY / 10 / ELECTRICITY_VISUAL_GAIN),   // ~3
    Math.round(TREE_TANK_CAPACITY / 5 / ELECTRICITY_VISUAL_GAIN),    // ~7
    Math.round(TREE_TANK_CAPACITY / 2 / ELECTRICITY_VISUAL_GAIN),    // ~17
  ];
  // Check which buttons would overfill (disable if overfill)
  const isWaterButtonDisabled = (amt: number) => savedWater + amt > TREE_TANK_CAPACITY;
  const isLightButtonDisabled = (amt: number) => savedLight + amt * ELECTRICITY_VISUAL_GAIN > TREE_TANK_CAPACITY;

  const coverColor = (pct: number) => {
    if (pct < 60) return "hsl(var(--destructive))";
    if (pct < 85) return "hsl(var(--weather-heat))";
    if (pct <= 140) return "hsl(var(--tree-thriving))";
    if (pct <= 180) return "hsl(var(--weather-heat))";
    return "hsl(var(--destructive))";
  };

  const weeklySummaries = useMemo(() => {
    const byWeek = new Map<number, DayLog[]>();
    history.forEach((entry) => {
      const weekIndex = Math.floor(entry.day / 7);
      const bucket = byWeek.get(weekIndex) ?? [];
      bucket.push(entry);
      byWeek.set(weekIndex, bucket);
    });

    return Array.from(byWeek.entries())
      .sort(([a], [b]) => a - b)
      .map(([weekIndex, entries]) => {
        const waterTotal = entries.reduce((sum, entry) => sum + entry.waterNeed, 0);
        const lightTotal = entries.reduce((sum, entry) => sum + entry.lightNeed, 0);
        const avgScore = Math.round(entries.reduce((sum, entry) => sum + entry.score, 0) / entries.length);
        const avgWaterRatio = entries.reduce((sum, entry) => sum + entry.waterRatio, 0) / entries.length;
        const avgLightRatio = entries.reduce((sum, entry) => sum + entry.lightRatio, 0) / entries.length;

        return {
          weekIndex,
          startDay: entries[0].day,
          endDay: entries[entries.length - 1].day,
          waterTotal,
          lightTotal,
          avgScore,
          avgWaterRatio,
          avgLightRatio,
          state: entries[entries.length - 1].state,
        };
      });
  }, [history]);

  const currentWeekIndex = Math.floor(day / 7);
  const currentWeekEntries = history.filter((entry) => Math.floor(entry.day / 7) === currentWeekIndex);
  const currentWeekWater = currentWeekEntries.reduce((sum, entry) => sum + entry.waterNeed, 0);
  const currentWeekLight = currentWeekEntries.reduce((sum, entry) => sum + entry.lightNeed, 0);
  const previousWeekSummary = weeklySummaries.find((week) => week.weekIndex === currentWeekIndex - 1) ?? null;
  const currentWeekSummary = weeklySummaries.find((week) => week.weekIndex === currentWeekIndex) ?? null;
  const waterTarget = Math.max(...waterChoices, 1);
  const electricityTarget = Math.max(...lightChoices, 1);
  const recentWeeks = weeklySummaries.slice(-4);
  const treeWaterLevel = Math.max(0, Math.min(1, savedWater / TREE_TANK_CAPACITY));
  const treeLightLevel = Math.max(0, Math.min(1, savedLight / TREE_TANK_CAPACITY));
  const humanWaterLevel = 1 - treeWaterLevel;
  const humanLightLevel = 1 - treeLightLevel;

  const waterActionLabels = [
    "Krajši tuš",
    "Zbiraj deževnico",
    "Eno pranje manj",
    "Ne zalivaj ponoči",
  ];
  const electricityActionLabels = [
    "Ugasni luči",
    "Izklopi standby",
    "Skrajšaj uporabo naprav",
    "Uporabi naravno svetlobo",
  ];
  const recentActions = actionLog.slice(0, 6);

  const currentWeekWaterPct = Math.round((currentWeekWater / Math.max(1, waterTarget)) * 100);
  const currentWeekLightPct = Math.round((currentWeekLight / Math.max(1, electricityTarget)) * 100);

  // Display score based ONLY on tree tank fullness
  const displayScore = Math.round((savedWater + savedLight) / 2);
  const displayState = getTreeState(displayScore);

  return (
    <div className="flex flex-col gap-6">
      <div className="w-full">
        <div className="w-full p-6 rounded-2xl bg-card border border-border shadow-sm">
          <AmbientTree
            state={displayState}
            score={displayScore}
            transitionSpeed={speed}
            waterLevel={treeWaterLevel * 1.6}
            lightLevel={treeLightLevel * 1.6}
            humanWaterLevel={humanWaterLevel}
            humanLightLevel={humanLightLevel}
          />
        </div>
        {/*
        <YearTimeline history={history} events={events} currentDay={day} />
        <div className="w-full">
          <TimelineLegend variant="weather" />
        </div>
        */}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(240px,0.4fr)_minmax(0,1.6fr)]">
        <div className="rounded-2xl border border-border bg-card shadow-sm p-4 space-y-4 flex flex-col">
          <div>
            <p className="text-[11px] text-muted-foreground font-body uppercase tracking-wide mb-3">
              Predvajanje
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <Button size="sm" onClick={() => setIsPlaying((p) => !p)} className="w-full">
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              {isPlaying ? "Pavza" : "Predvajaj"}
            </Button>
            <Button size="sm" variant="outline" onClick={reset} className="w-full">
              <RotateCcw className="w-4 h-4" />
              Ponastavi
            </Button>

            <div className="rounded-xl border border-border bg-secondary/25 px-3 py-3">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <FastForward className="w-4 h-4" />
                <span className="font-body text-xs font-medium">{speed}x</span>
              </div>
              <div className="grid grid-cols-4 gap-1">
                {[1, 3, 7, 14].map((value) => (
                  <Button
                    key={value}
                    size="sm"
                    variant={speed === value ? "default" : "outline"}
                    onClick={() => setSpeed(value)}
                    className="h-7 text-xs px-1"
                  >
                    {value}x
                  </Button>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-border/50 bg-secondary/10 px-3 py-2">
              <p className="text-[10px] text-muted-foreground font-body leading-relaxed">
                Dan: <span className="font-semibold text-foreground">{day + 1}/365</span>
              </p>
              <p className="text-[10px] text-muted-foreground font-body leading-relaxed mt-1">
                {isPlaying ? "Simulacija teče..." : "Pripravljeno zastart"}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card shadow-sm p-4 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] text-muted-foreground font-body uppercase tracking-wide">
              Zmanjšaj porabo doma
            </p>
            <span className="text-[11px] text-muted-foreground font-body">
              Teden {currentWeekIndex + 1}
            </span>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Droplets className="w-4 h-4" style={{ color: "hsl(var(--weather-storm))" }} />
              <span className="font-body font-medium">Voda</span>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {waterChoices
                .filter((amt) => amt > 0)
                .map((amt, index) => {
                  const label = waterActionLabels[index] ?? "Prihranek vode";
                  const fillHeight = Math.max(18, Math.min(100, Math.round((amt / Math.max(...waterChoices)) * 100)));
                  const isDisabled = isWaterButtonDisabled(amt);

                  return (
                    <Button
                      key={`water-${amt}-${index}`}
                      size="sm"
                      variant="outline"
                      disabled={isDisabled}
                      onClick={() => !isDisabled && handleAdd(amt, 0, label, null)}
                      className="h-auto min-h-20 px-3 py-3 text-left justify-start"
                    >
                      <span className="flex w-full items-center gap-3">
                        <span className="relative flex h-14 w-8 shrink-0 items-end overflow-hidden rounded-full border border-white/40 bg-white/20">
                          {/* Dashed outline showing empty tank portion */}
                          <span className="absolute inset-0 rounded-full border-2 border-dashed border-white/90 pointer-events-none" />
                          {/* Filled portion */}
                          <span
                            className="w-full rounded-full bg-[linear-gradient(180deg,#8fd3ff_0%,#2f8fd8_100%)] transition-all duration-500"
                            style={{ height: `${fillHeight}%` }}
                          />
                        </span>
                        <span className="flex flex-col items-start gap-0.5">
                          <span className="font-body font-medium text-xs">{label}</span>
                          <span className="text-[11px] opacity-80">prihrani {amt} L</span>
                        </span>
                      </span>
                    </Button>
                  );
                })}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Zap className="w-4 h-4" style={{ color: "hsl(var(--accent))" }} />
              <span className="font-body font-medium">Elektrika</span>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {lightChoices
                .filter((amt) => amt > 0)
                .map((amt, index) => {
                  const label = electricityActionLabels[index] ?? "Prihranek elektrike";
                  const fillHeight = Math.max(18, Math.min(100, Math.round((amt / Math.max(...lightChoices)) * 100)));
                  const isDisabled = isLightButtonDisabled(amt);

                  return (
                    <Button
                      key={`light-${amt}-${index}`}
                      size="sm"
                      variant="outline"
                      disabled={isDisabled}
                      onClick={() => !isDisabled && handleAdd(0, amt, null, label)}
                      className="h-auto min-h-20 px-3 py-3 text-left justify-start"
                    >
                      <span className="flex w-full items-center gap-3">
                        <span className="relative flex h-14 w-8 shrink-0 items-end overflow-hidden rounded-full border border-white/40 bg-white/20">
                          {/* Dashed outline showing empty tank portion */}
                          <span className="absolute inset-0 rounded-full border-2 border-dashed border-white/90 pointer-events-none" />
                          {/* Filled portion */}
                          <span
                            className="w-full rounded-full bg-[linear-gradient(180deg,#ffe58f_0%,#f2b705_100%)] transition-all duration-500"
                            style={{ height: `${fillHeight}%` }}
                          />
                        </span>
                        <span className="flex flex-col items-start gap-0.5">
                          <span className="font-body font-medium text-xs">{label}</span>
                          <span className="text-[11px] opacity-80">prihrani {amt} h svetlobe</span>
                        </span>
                      </span>
                    </Button>
                  );
                })}
            </div>
          </div>

          {(pendingWater > 0 || pendingLight > 0) && (
            <p className="text-[11px] text-primary font-body text-center">
              Na voljo za naslednji teden: +{pendingWater}L vode, +{pendingLight} svetlobe
            </p>
          )}
        </div>

        {/*
        <TreeStatusBanner
          status={status}
          recentChange={recentChange}
          onDismissChange={() => setRecentChange(null)}
        />

        <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
          <div className="bg-gradient-to-br from-secondary/70 via-card to-background p-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <svg viewBox="0 0 140 140" className="h-24 w-24 shrink-0" aria-hidden="true">
                <defs>
                  <linearGradient id="person-bg" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="hsl(var(--primary) / 0.2)" />
                    <stop offset="100%" stopColor="hsl(var(--accent) / 0.2)" />
                  </linearGradient>
                </defs>
                <circle cx="70" cy="70" r="62" fill="url(#person-bg)" />
                <circle cx="70" cy="52" r="16" fill="hsl(var(--foreground) / 0.72)" />
                <path d="M46 114c4-18 16-29 24-29h0c8 0 20 11 24 29" fill="hsl(var(--foreground) / 0.65)" />
                <path d="M46 78c8 4 18 8 24 8s16-4 24-8" stroke="hsl(var(--primary))" strokeWidth="5" strokeLinecap="round" fill="none" />
                <path d="M94 46c10 5 15 14 17 22" stroke="hsl(var(--weather-storm))" strokeWidth="4" strokeLinecap="round" fill="none" />
                <path d="M94 63l8 8 10-18" fill="none" stroke="hsl(var(--weather-storm-foreground))" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M34 47c-7 11-8 22-5 32" stroke="hsl(var(--accent))" strokeWidth="4" strokeLinecap="round" fill="none" />
                <path d="M28 73c6-2 11-2 16 1" stroke="hsl(var(--accent-foreground))" strokeWidth="4" strokeLinecap="round" fill="none" />
              </svg>
              <div className="space-y-2">
                <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Glavna ideja</p>
                <h3 className="font-display text-lg text-foreground">Manj porabe doma, bolj zdravo drevo</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Krajši tuš, manj prižganih luči in manj stand-by porabe sprostijo vodo in elektriko, ki jo drevo pretvori v gostejše in bolj barvite liste.
                </p>
              </div>
            </div>
          </div>

          <div className="p-4 space-y-4">
            <div className="space-y-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="font-display text-base text-foreground">
                    {date.dayOfMonth}. {date.monthName}
                  </h3>
                  <p className="text-xs text-muted-foreground font-body">Dan {day + 1} od 365</p>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  {todayWeather.isDrought && (
                    <span className="px-2 py-0.5 rounded" style={{ backgroundColor: "hsl(var(--weather-drought) / 0.18)", color: "hsl(var(--weather-drought-foreground))" }}>Suša</span>
                  )}
                  {todayWeather.isHeatwave && (
                    <span className="px-2 py-0.5 rounded" style={{ backgroundColor: "hsl(var(--weather-heat) / 0.18)", color: "hsl(var(--weather-heat-foreground))" }}>Vročinski val</span>
                  )}
                  {todayWeather.isStorm && (
                    <span className="px-2 py-0.5 rounded" style={{ backgroundColor: "hsl(var(--weather-storm) / 0.18)", color: "hsl(var(--weather-storm-foreground))" }}>Nevihta</span>
                  )}
                  {!todayWeather.isDrought && !todayWeather.isHeatwave && !todayWeather.isStorm && (
                    <span className="px-2 py-0.5 rounded bg-secondary text-secondary-foreground">Miren dan</span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-3">
                <div className="flex items-center gap-1 rounded-lg bg-secondary/35 px-2.5 py-2 text-muted-foreground">
                  <Sun className="w-4 h-4" style={{ color: "hsl(var(--accent))" }} />
                  <span>{todayWeather.sunHours} h svetlobe</span>
                </div>
                <div className="flex items-center gap-1 rounded-lg bg-secondary/35 px-2.5 py-2 text-muted-foreground">
                  <CloudRain className="w-4 h-4" style={{ color: "hsl(var(--weather-storm))" }} />
                  <span>{todayWeather.rainMm} mm dežja</span>
                </div>
                <div className="flex items-center gap-1 rounded-lg bg-secondary/35 px-2.5 py-2 text-muted-foreground">
                  <Thermometer className="w-4 h-4" style={{ color: "hsl(var(--weather-heat))" }} />
                  <span>{todayWeather.temperature}°C</span>
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-border space-y-3">
              <p className="text-[11px] text-muted-foreground font-body uppercase tracking-wide">
                Zaloge drevesa
              </p>

              <ReserveBar
                icon={<Droplets className="w-4 h-4" style={{ color: "hsl(var(--weather-storm))" }} />}
                label="Voda"
                pct={waterCoverPct}
                color={coverColor(waterCoverPct)}
                detail={`Narava ${Math.round(naturalWater)} L${userWater > 0.5 ? ` + prihranek ${Math.round(userWater)} L` : ""}`}
              />

              <ReserveBar
                icon={<Zap className="w-4 h-4" style={{ color: "hsl(var(--accent))" }} />}
                label="Svetloba"
                pct={lightCoverPct}
                color={coverColor(lightCoverPct)}
                detail={`Narava ${Math.round(naturalLight)} h${userLight > 0.5 ? ` + prihranek ${Math.round(userLight)} h` : ""}`}
              />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card shadow-sm p-4 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] text-muted-foreground font-body uppercase tracking-wide">
              Dnevnik dejanj
            </p>
            <span className="text-[11px] text-muted-foreground font-body">
              Zadnjih {recentActions.length}
            </span>
          </div>

          {recentActions.length > 0 ? (
            <div className="space-y-2">
              {recentActions.map((entry) => (
                <div key={entry.id} className="rounded-xl border border-border/70 bg-background/70 px-3 py-2 text-xs font-body">
                  <div className="flex items-center justify-between gap-2 text-muted-foreground">
                    <span>{entry.category === "water" ? "Voda" : "Elektrika"}</span>
                    <span>Teden {entry.week} · Dan {entry.day + 1}</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-2 text-foreground">
                    <span className="font-medium">{entry.label}</span>
                    <span>+{entry.amount} {entry.category === "water" ? "L" : "h"}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground font-body">
              Ko potrdiš prihranek, se bo tukaj prikazal seznam vseh izbranih dejanj.
            </p>
          )}
        </div>
      </div>

      <div className="space-y-4 w-full self-start">
        <div className="rounded-2xl border border-border bg-card shadow-sm p-4 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] text-muted-foreground font-body uppercase tracking-wide">
              Zmanjšaj porabo doma
            </p>
            <span className="text-[11px] text-muted-foreground font-body">
              Teden {currentWeekIndex + 1}
            </span>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Droplets className="w-4 h-4" style={{ color: "hsl(var(--weather-storm))" }} />
              <span className="font-body font-medium">Voda</span>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {waterChoices
                .filter((amt) => amt > 0)
                .map((amt, index) => {
                  const label = waterActionLabels[index] ?? "Prihranek vode";
                  const fillHeight = Math.max(18, Math.min(100, Math.round((amt / Math.max(...waterChoices)) * 100)));

                  return (
                    <Button
                      key={`water-${amt}-${index}`}
                      size="sm"
                      variant={waterToAdd === amt ? "default" : "outline"}
                      onClick={() => {
                        setWaterToAdd(amt);
                        setSelectedWaterAction(label);
                      }}
                      className="h-auto min-h-20 px-3 py-3 text-left justify-start"
                    >
                      <span className="flex w-full items-center gap-3">
                        <span className="relative flex h-14 w-8 shrink-0 items-end overflow-hidden rounded-full border border-white/40 bg-white/20">
                          <span
                            className="w-full rounded-full bg-[linear-gradient(180deg,#8fd3ff_0%,#2f8fd8_100%)] transition-all duration-500"
                            style={{ height: `${fillHeight}%` }}
                          />
                        </span>
                        <span className="flex flex-col items-start gap-0.5">
                          <span className="font-body font-medium text-xs">{label}</span>
                          <span className="text-[11px] opacity-80">prihrani {amt} L</span>
                        </span>
                      </span>
                    </Button>
                  );
                })}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Zap className="w-4 h-4" style={{ color: "hsl(var(--accent))" }} />
              <span className="font-body font-medium">Elektrika</span>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {lightChoices
                .filter((amt) => amt > 0)
                .map((amt, index) => {
                  const label = electricityActionLabels[index] ?? "Prihranek elektrike";
                  const fillHeight = Math.max(18, Math.min(100, Math.round((amt / Math.max(...lightChoices)) * 100)));

                  return (
                    <Button
                      key={`light-${amt}-${index}`}
                      size="sm"
                      variant={lightToAdd === amt ? "default" : "outline"}
                      onClick={() => {
                        setLightToAdd(amt);
                        setSelectedLightAction(label);
                      }}
                      className="h-auto min-h-20 px-3 py-3 text-left justify-start"
                    >
                      <span className="flex w-full items-center gap-3">
                        <span className="relative flex h-14 w-8 shrink-0 items-end overflow-hidden rounded-full border border-white/40 bg-white/20">
                          <span
                            className="w-full rounded-full bg-[linear-gradient(180deg,#ffe58f_0%,#f2b705_100%)] transition-all duration-500"
                            style={{ height: `${fillHeight}%` }}
                          />
                        </span>
                        <span className="flex flex-col items-start gap-0.5">
                          <span className="font-body font-medium text-xs">{label}</span>
                          <span className="text-[11px] opacity-80">prihrani {amt} h svetlobe</span>
                        </span>
                      </span>
                    </Button>
                  );
                })}
            </div>
          </div>

          <Button
            onClick={handleAdd}
            disabled={waterToAdd === 0 && lightToAdd === 0}
            className="w-full"
            size="sm"
          >
            <Plus className="w-4 h-4" />
            Potrdi prihranek
          </Button>

          {(pendingWater > 0 || pendingLight > 0) && (
            <p className="text-[11px] text-primary font-body text-center">
              Na voljo za naslednji teden: +{pendingWater}L vode, +{pendingLight} svetlobe
            </p>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-card shadow-sm p-4 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] text-muted-foreground font-body uppercase tracking-wide">
              Tedenski dashboard
            </p>
            <span className="text-[11px] text-muted-foreground font-body">
              Limit prehaja iz prejšnjega tedna
            </span>
          </div>

          <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-3">
            <div className="rounded-xl bg-secondary/35 p-2 space-y-1">
              <div className="text-[11px] text-muted-foreground">Ta teden</div>
              <div className="font-body font-semibold text-foreground tabular-nums">{currentWeekWater} L / {currentWeekLight} kWh</div>
              <div className="text-[11px] text-muted-foreground">
                {currentWeekSummary
                  ? `ocena ${currentWeekSummary.avgScore}/100 · voda ${currentWeekWaterPct}% · elektrika ${currentWeekLightPct}%`
                  : `do zdaj ${currentWeekEntries.length} dni`}
              </div>
            </div>
            <div className="rounded-xl bg-secondary/35 p-2 space-y-1">
              <div className="text-[11px] text-muted-foreground">Prejšnji teden</div>
              <div className="font-body font-semibold text-foreground tabular-nums">
                {previousWeekSummary ? `${previousWeekSummary.waterTotal} L / ${previousWeekSummary.lightTotal} kWh` : "ni podatkov"}
              </div>
              <div className="text-[11px] text-muted-foreground">
                {previousWeekSummary ? `ocena ${previousWeekSummary.avgScore}/100` : "začetni okvir"}
              </div>
            </div>
            <div className="rounded-xl bg-secondary/35 p-2 space-y-1">
              <div className="text-[11px] text-muted-foreground">Cilj naslednjega</div>
              <div className="font-body font-semibold text-foreground tabular-nums">{waterTarget} L / {electricityTarget} kWh</div>
              <div className="text-[11px] text-muted-foreground">{Math.max(0, currentWeekWaterPct - 100)}% nad ciljem</div>
            </div>
          </div>

          <div className="space-y-2">
            {recentWeeks.length > 0 ? (
              recentWeeks.map((week) => {
                const waterPct = Math.round((week.waterTotal / Math.max(1, waterTarget)) * 100);
                const lightPct = Math.round((week.lightTotal / Math.max(1, electricityTarget)) * 100);

                return (
                  <div key={week.weekIndex} className="rounded-xl border border-border/70 bg-background/70 p-3 space-y-2">
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground font-body">
                      <span>Teden {week.weekIndex + 1}</span>
                      <span>{week.startDay + 1} - {week.endDay + 1}. dan · {week.avgScore}/100</span>
                    </div>
                    <ReserveBar
                      icon={<Droplets className="w-4 h-4" style={{ color: "hsl(var(--weather-storm))" }} />}
                      label="Voda"
                      pct={waterPct}
                      color={coverColor(waterPct)}
                      detail={`${week.waterTotal} L · cilj ${waterTarget} L`}
                    />
                    <ReserveBar
                      icon={<Zap className="w-4 h-4" style={{ color: "hsl(var(--accent))" }} />}
                      label="Elektrika"
                      pct={lightPct}
                      color={coverColor(lightPct)}
                      detail={`${week.lightTotal} kWh · cilj ${electricityTarget} kWh`}
                    />
                  </div>
                );
              })
            ) : (
              <p className="text-xs text-muted-foreground font-body">
                Začni predvajanje, da se tukaj pokaže tedenski pregled.
              </p>
            )}
          </div>

          <p className="text-[11px] text-muted-foreground font-body leading-relaxed flex items-start gap-1.5">
            <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />
            Naslednji teden uporabi kot nov limit: če je poraba nad prejšnjim tednom, jo poskusi zmanjšati v majhnih korakih.
          </p>
        </div>
        */}
      </div>
    </div>
  );
};

// Stage thresholds matching getTreeState: 15/35/55/78/100
function thresholdForStage(idx: number): number {
  // idx 0 dead -> [0,15], 1 dying -> [16,35], 2 weak -> [36,55], 3 healthy -> [56,78], 4 thriving -> [79,100]
  const lower = [0, 16, 36, 56, 79, 101];
  return lower[Math.max(0, Math.min(5, idx))];
}

interface ReserveBarProps {
  icon: React.ReactNode;
  label: string;
  pct: number;
  color: string;
  detail: string;
}

const ReserveBar = ({ icon, label, pct, color, detail }: ReserveBarProps) => {
  const status =
    pct < 60 ? "Premalo" : pct < 85 ? "Skoraj dovolj" : pct <= 140 ? "Ravnovesje" : pct <= 180 ? "Veliko" : "Preveč";
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          {icon}
          <span className="font-body font-medium">{label}</span>
        </div>
        <span className="text-xs font-body" style={{ color }}>{status} · {pct}%</span>
      </div>
      <div className="relative h-2 w-full bg-secondary rounded-full overflow-hidden">
        {/* Optimal band 85-140% as background hint */}
        <div
          className="absolute top-0 bottom-0 bg-primary/10"
          style={{ left: "42.5%", width: "27.5%" }}
        />
        <div
          className="absolute top-0 bottom-0 left-0 transition-all duration-500"
          style={{ width: `${Math.min(100, pct / 2)}%`, backgroundColor: color }}
        />
      </div>
      <p className="text-[11px] text-muted-foreground font-body">{detail}</p>
    </div>
  );
};

export default TreeMaintenanceView;

import { useEffect, useMemo, useRef, useState } from "react";
import { Droplets, Zap, Sun, CloudRain, Thermometer, Plus, AlertCircle } from "lucide-react";
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

const TreeMaintenanceView = () => {
  const weather = useMemo(() => generateYearWeather(), []);
  const [day, setDay] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(3);
  const [score, setScore] = useState(70);
  const [waterToAdd, setWaterToAdd] = useState(0);
  const [lightToAdd, setLightToAdd] = useState(0);
  const [history, setHistory] = useState<DayLog[]>([]);
  const [recentChange, setRecentChange] = useState<{ direction: "up" | "down"; from: string; to: string } | null>(null);
  const [pendingWater, setPendingWater] = useState(0);
  const [pendingLight, setPendingLight] = useState(0);
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
      const totalW = newNaturalWater + newUserWater;
      const totalL = newNaturalLight + newUserLight;
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
      setHistory((h) => [...h, { day: d, score: newScore, state: toState }]);
      setDay(d + 1);

      if (changedDirection) {
        setRecentChange({
          direction: changedDirection,
          from: stateLabels[fromState],
          to: stateLabels[toState],
        });
        if (changedDirection === "down") {
          setIsPlaying(false);
        }
      }
    }, 1000 / speed);
    return () => clearInterval(interval);
  }, [isPlaying, speed, weather]);

  const reset = () => {
    setIsPlaying(false);
    setDay(0);
    setScore(70);
    setHistory([]);
    setPendingWater(0);
    setPendingLight(0);
    setWaterToAdd(0);
    setLightToAdd(0);
    setRecentChange(null);
    setLastChangeDay(-7);
    setNaturalWater(20);
    setNaturalLight(10);
    setUserWater(0);
    setUserLight(0);
  };

  const handleAdd = () => {
    setPendingWater((p) => p + waterToAdd);
    setPendingLight((p) => p + lightToAdd);
    setWaterToAdd(0);
    setLightToAdd(0);
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

  const coverColor = (pct: number) => {
    if (pct < 60) return "hsl(var(--destructive))";
    if (pct < 85) return "hsl(var(--weather-heat))";
    if (pct <= 140) return "hsl(var(--tree-thriving))";
    if (pct <= 180) return "hsl(var(--weather-heat))";
    return "hsl(var(--destructive))";
  };

  return (
    <div className="grid lg:grid-cols-5 gap-6 items-start">
      {/* Tree column */}
      <div className="lg:col-span-3 flex flex-col items-center gap-4">
        <div className="w-full max-w-lg p-6 rounded-2xl bg-card border border-border shadow-sm">
          <AmbientTree state={state} score={score} transitionSpeed={speed} />
        </div>
        <YearTimeline history={history} events={events} currentDay={day} />
      </div>

      {/* Controls column */}
      <div className="lg:col-span-2 space-y-4">
        <SimulationControls
          isPlaying={isPlaying}
          speed={speed}
          onPlayPause={() => setIsPlaying((p) => !p)}
          onReset={reset}
          onSpeedChange={setSpeed}
        />

        {/* Persistent status banner */}
        <TreeStatusBanner
          status={status}
          recentChange={recentChange}
          onDismissChange={() => setRecentChange(null)}
        />

        {/* Today + needs panel */}
        <div className="p-4 rounded-xl bg-card border border-border space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-base text-foreground">
              {date.dayOfMonth}. {date.monthName}
            </h3>
            <div className="flex items-center gap-1 text-xs">
              {todayWeather.isDrought && (
                <span className="px-2 py-0.5 rounded" style={{ backgroundColor: "hsl(var(--weather-drought) / 0.18)", color: "hsl(var(--weather-drought-foreground))" }}>Suša</span>
              )}
              {todayWeather.isHeatwave && (
                <span className="px-2 py-0.5 rounded" style={{ backgroundColor: "hsl(var(--weather-heat) / 0.18)", color: "hsl(var(--weather-heat-foreground))" }}>Vročinski val</span>
              )}
              {todayWeather.isStorm && (
                <span className="px-2 py-0.5 rounded" style={{ backgroundColor: "hsl(var(--weather-storm) / 0.18)", color: "hsl(var(--weather-storm-foreground))" }}>Nevihta</span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="flex items-center gap-1 text-muted-foreground">
              <Sun className="w-4 h-4" style={{ color: "hsl(var(--accent))" }} />
              {todayWeather.sunHours} h
            </div>
            <div className="flex items-center gap-1 text-muted-foreground">
              <CloudRain className="w-4 h-4" style={{ color: "hsl(var(--weather-storm))" }} />
              {todayWeather.rainMm} mm
            </div>
            <div className="flex items-center gap-1 text-muted-foreground">
              <Thermometer className="w-4 h-4" style={{ color: "hsl(var(--weather-heat))" }} />
              {todayWeather.temperature}°C
            </div>
          </div>

          {/* Friendly reserve view */}
          <div className="pt-2 border-t border-border space-y-3">
            <p className="text-[11px] text-muted-foreground font-body uppercase tracking-wide">
              Zaloge drevesa (pokritost potreb naslednjih 3 dni)
            </p>

            {/* Water reserve */}
            <ReserveBar
              icon={<Droplets className="w-4 h-4" style={{ color: "hsl(var(--weather-storm))" }} />}
              label="Voda"
              pct={waterCoverPct}
              color={coverColor(waterCoverPct)}
              detail={`Narava ${Math.round(naturalWater)} L${userWater > 0.5 ? ` + dodano ${Math.round(userWater)} L` : ""}`}
            />

            {/* Light reserve */}
            <ReserveBar
              icon={<Zap className="w-4 h-4" style={{ color: "hsl(var(--accent))" }} />}
              label="Svetloba"
              pct={lightCoverPct}
              color={coverColor(lightCoverPct)}
              detail={`Narava ${Math.round(naturalLight)} h${userLight > 0.5 ? ` + dodano ${Math.round(userLight)} h` : ""}`}
            />
          </div>

          {/* Add controls */}
          <div className="pt-2 border-t border-border space-y-3">
            <p className="text-[11px] text-muted-foreground font-body uppercase tracking-wide">
              Dodaj za naslednji teden
            </p>

            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-sm">
                <Droplets className="w-4 h-4" style={{ color: "hsl(var(--weather-storm))" }} />
                <span className="font-body font-medium">Voda</span>
              </div>
              <div className="flex gap-1">
                {[0, 20, 50, 100, 200].map((amt) => (
                  <Button
                    key={amt}
                    size="sm"
                    variant={waterToAdd === amt ? "default" : "outline"}
                    onClick={() => setWaterToAdd(amt)}
                    className="h-8 px-2 text-xs flex-1"
                  >
                    +{amt}L
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-sm">
                <Zap className="w-4 h-4" style={{ color: "hsl(var(--accent))" }} />
                <span className="font-body font-medium">Dodatna svetloba</span>
              </div>
              <div className="flex gap-1">
                {[0, 1, 3, 6, 10].map((amt) => (
                  <Button
                    key={amt}
                    size="sm"
                    variant={lightToAdd === amt ? "default" : "outline"}
                    onClick={() => setLightToAdd(amt)}
                    className="h-8 px-2 text-xs flex-1"
                  >
                    +{amt}
                  </Button>
                ))}
              </div>
            </div>

            <Button
              onClick={handleAdd}
              disabled={waterToAdd === 0 && lightToAdd === 0}
              className="w-full"
              size="sm"
            >
              <Plus className="w-4 h-4" />
              Dodaj
            </Button>
            {(pendingWater > 0 || pendingLight > 0) && (
              <p className="text-[11px] text-primary font-body text-center">
                Pripravljeno za naslednji teden: +{pendingWater}L vode, +{pendingLight} svetlobe
              </p>
            )}
          </div>

          <p className="text-[11px] text-muted-foreground font-body pt-2 border-t border-border leading-relaxed flex items-start gap-1.5">
            <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />
            Drevo se ocenjuje vsak teden. Stopnja se lahko spremeni največ enkrat na 7 dni. Velike količine vode/svetlobe povzročijo kratkotrajni stres, a dolgo zalogo.
          </p>
        </div>

        <TimelineLegend variant="weather" />
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

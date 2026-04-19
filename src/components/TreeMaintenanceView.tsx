import { useEffect, useMemo, useRef, useState } from "react";
import { Droplets, Zap, Sun, CloudRain, Thermometer, Plus, TrendingUp, TrendingDown, AlertCircle } from "lucide-react";
import AmbientTree from "@/components/AmbientTree";
import SimulationControls from "@/components/SimulationControls";
import YearTimeline from "@/components/YearTimeline";
import { Button } from "@/components/ui/button";
import { generateYearWeather, DayWeather } from "@/lib/weather";
import { TreeState, getTreeState, dayToDate, stateIndex } from "@/lib/treeUtils";

// Tedenske potrebe (7-dnevni cikel)
function weeklyWaterNeed(weather: DayWeather[]): number {
  // Povprečna dnevna potreba * 7
  let sum = 0;
  for (const w of weather) {
    if (w.temperature > 25) sum += 35;
    else if (w.temperature > 18) sum += 22;
    else if (w.temperature > 10) sum += 12;
    else if (w.temperature > 2) sum += 6;
    else sum += 3;
  }
  return sum;
}
function weeklyLightNeed(weather: DayWeather[]): number {
  let sum = 0;
  for (const w of weather) sum += w.temperature < 2 ? 4 : 7;
  return sum;
}

interface DayLog {
  day: number;
  score: number;
  state: TreeState;
}

type FeedbackKind = "improved" | "degraded" | null;
interface Feedback {
  kind: FeedbackKind;
  reason?: "water" | "light" | "both";
  fromState: TreeState;
  toState: TreeState;
}

const stateLabels: Record<TreeState, string> = {
  dead: "Mrtvo",
  dying: "Umirajoče",
  weak: "Šibko",
  healthy: "Zdravo",
  thriving: "Cvetoče",
};

const TreeMaintenanceView = () => {
  const weather = useMemo(() => generateYearWeather(), []);
  const [day, setDay] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(3);
  const [score, setScore] = useState(70);
  const [waterToAdd, setWaterToAdd] = useState(0);
  const [lightToAdd, setLightToAdd] = useState(0);
  const [history, setHistory] = useState<DayLog[]>([]);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [pendingWater, setPendingWater] = useState<number | null>(null);
  const [pendingLight, setPendingLight] = useState<number | null>(null);
  const [lastChangeDay, setLastChangeDay] = useState(-7);

  const dayRef = useRef(0);
  const scoreRef = useRef(70);
  const lastChangeRef = useRef(-7);
  const pausedForFeedbackRef = useRef(false);

  dayRef.current = day;
  scoreRef.current = score;
  lastChangeRef.current = lastChangeDay;

  const state = getTreeState(score);

  // Glavna zanka: vsak "tick" = 1 dan
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      const d = dayRef.current;
      if (d >= 364) {
        setIsPlaying(false);
        return;
      }

      // Vsak 7. dan ocenimo teden in morda spremenimo stopnjo
      const isEvalDay = (d + 1) % 7 === 0;

      if (!isEvalDay) {
        // Dan brez evaluacije – samo posnamemo trenutno stanje in gremo naprej
        setHistory((h) => [...h, { day: d, score: scoreRef.current, state: getTreeState(scoreRef.current) }]);
        setDay(d + 1);
        return;
      }

      // Cooldown: zadnja sprememba mora biti vsaj 7 dni nazaj
      if (d - lastChangeRef.current < 7) {
        setHistory((h) => [...h, { day: d, score: scoreRef.current, state: getTreeState(scoreRef.current) }]);
        setDay(d + 1);
        return;
      }

      // Ovrednoti zadnji teden
      const weekWeather = weather.slice(Math.max(0, d - 6), d + 1);
      const wNeed = weeklyWaterNeed(weekWeather);
      const lNeed = weeklyLightNeed(weekWeather);
      const naturalW = weekWeather.reduce((s, w) => s + w.rainMm * 1.5, 0);
      const naturalL = weekWeather.reduce((s, w) => s + w.sunHours, 0);
      const addedW = pendingWater ?? 0;
      const addedL = (pendingLight ?? 0) * 0.4 * 7; // dodaj × ekv. ur svetlobe za teden

      const wRatio = (naturalW + addedW) / wNeed;
      const lRatio = (naturalL + addedL) / lNeed;

      // Določi spremembo: bolje +1, slabše -1, povprečno = +/- delna
      const wOk = wRatio >= 0.8 && wRatio <= 1.4;
      const lOk = lRatio >= 0.8 && lRatio <= 1.4;
      const wBad = wRatio < 0.6 || wRatio > 1.6;
      const lBad = lRatio < 0.6 || lRatio > 1.6;

      const curState = getTreeState(scoreRef.current);
      const curIdx = stateIndex(curState);
      let newScore = scoreRef.current;
      let fb: Feedback | null = null;

      if (wOk && lOk && curIdx < 4) {
        // Boljša stopnja
        newScore = Math.min(100, scoreRef.current + 18);
        const nextState = getTreeState(newScore);
        if (stateIndex(nextState) > curIdx) {
          fb = { kind: "improved", fromState: curState, toState: nextState };
        }
      } else if (wBad || lBad) {
        // Slabša stopnja – ustavi in vprašaj
        newScore = Math.max(0, scoreRef.current - 22);
        const nextState = getTreeState(newScore);
        if (stateIndex(nextState) < curIdx) {
          const reason: "water" | "light" | "both" =
            wBad && lBad ? "both" : wBad ? "water" : "light";
          fb = { kind: "degraded", reason, fromState: curState, toState: nextState };
        }
      } else {
        // Povprečno – majhen drift
        const drift = (wRatio + lRatio) / 2 < 0.9 ? -4 : 2;
        newScore = Math.max(0, Math.min(100, scoreRef.current + drift));
      }

      // Posebni dogodki teden
      if (weekWeather.some((w) => w.isDrought)) newScore -= 3;
      if (weekWeather.some((w) => w.isHeatwave)) newScore -= 2;
      newScore = Math.max(0, Math.min(100, newScore));

      const finalState = getTreeState(newScore);
      setScore(newScore);
      setHistory((h) => [...h, { day: d, score: newScore, state: finalState }]);
      setPendingWater(null);
      setPendingLight(null);
      setWaterToAdd(0);
      setLightToAdd(0);
      setDay(d + 1);
      setLastChangeDay(d);

      if (fb) {
        setFeedback(fb);
        if (fb.kind === "degraded") {
          // Ustavi simulacijo
          pausedForFeedbackRef.current = true;
          setIsPlaying(false);
        }
      }
    }, 1000 / speed);
    return () => clearInterval(interval);
  }, [isPlaying, speed, weather, pendingWater, pendingLight]);

  const reset = () => {
    setIsPlaying(false);
    setDay(0);
    setScore(70);
    setHistory([]);
    setPendingWater(null);
    setPendingLight(null);
    setWaterToAdd(0);
    setLightToAdd(0);
    setFeedback(null);
    setLastChangeDay(-7);
  };

  const handleAdd = () => {
    setPendingWater(waterToAdd);
    setPendingLight(lightToAdd);
    setFeedback(null);
  };

  const dismissFeedback = () => setFeedback(null);

  const todayWeather = weather[Math.min(day, 364)];
  const date = dayToDate(Math.min(day, 364));

  // Dogodki za timeline (omejimo na max 15)
  const events = useMemo(() => {
    const all = weather
      .map((w) => {
        if (w.isDrought) return { day: w.day, type: "drought" as const, label: "Suša" };
        if (w.isHeatwave) return { day: w.day, type: "heatwave" as const, label: "Vročinski val" };
        if (w.isStorm) return { day: w.day, type: "storm" as const, label: "Nevihta" };
        return null;
      })
      .filter((e): e is NonNullable<typeof e> => e !== null);
    // Vzorči največ 15 enakomerno
    if (all.length <= 15) return all;
    const step = all.length / 15;
    return Array.from({ length: 15 }, (_, i) => all[Math.floor(i * step)]);
  }, [weather]);

  // Tedenski povzetek za prikaz potreb
  const weekStart = Math.max(0, day - 6);
  const weekWeather = weather.slice(weekStart, day + 1);
  const wNeedWeek = weeklyWaterNeed(weekWeather);
  const lNeedWeek = weeklyLightNeed(weekWeather);
  const naturalWaterWeek = weekWeather.reduce((s, w) => s + w.rainMm * 1.5, 0);
  const naturalLightWeek = weekWeather.reduce((s, w) => s + w.sunHours, 0);

  return (
    <div className="grid lg:grid-cols-5 gap-6 items-start">
      {/* Drevo */}
      <div className="lg:col-span-3 flex flex-col items-center gap-4">
        <div className="w-full max-w-lg p-6 rounded-2xl bg-card border border-border shadow-sm relative">
          <AmbientTree state={state} score={score} transitionSpeed={speed} />

          {/* Feedback overlay */}
          {feedback && (
            <div className={`absolute top-3 left-3 right-3 p-3 rounded-lg border text-sm font-body animate-fade-in ${
              feedback.kind === "improved"
                ? "bg-primary/10 border-primary/40 text-primary"
                : "bg-destructive/10 border-destructive/40 text-destructive"
            }`}>
              <div className="flex items-start gap-2">
                {feedback.kind === "improved" ? (
                  <TrendingUp className="w-4 h-4 mt-0.5 shrink-0" />
                ) : (
                  <TrendingDown className="w-4 h-4 mt-0.5 shrink-0" />
                )}
                <div className="flex-1">
                  {feedback.kind === "improved" ? (
                    <p>Drevo se je izboljšalo: <strong>{stateLabels[feedback.fromState]} → {stateLabels[feedback.toState]}</strong></p>
                  ) : (
                    <>
                      <p className="mb-1"><strong>{stateLabels[feedback.fromState]} → {stateLabels[feedback.toState]}</strong></p>
                      <p className="text-xs opacity-90">
                        Vzrok: {feedback.reason === "water" ? "premalo/preveč vode" : feedback.reason === "light" ? "premalo/preveč svetlobe" : "voda in svetloba"}.
                        Dodaj potrebne vire in nadaljuj.
                      </p>
                    </>
                  )}
                </div>
                <button onClick={dismissFeedback} className="text-xs opacity-60 hover:opacity-100">×</button>
              </div>
            </div>
          )}
        </div>
        <YearTimeline history={history} events={events} currentDay={day} />
      </div>

      {/* Kontrole */}
      <div className="lg:col-span-2 space-y-4">
        <SimulationControls
          isPlaying={isPlaying}
          speed={speed}
          onPlayPause={() => setIsPlaying((p) => !p)}
          onReset={reset}
          onSpeedChange={setSpeed}
        />

        {/* Današnje vreme & teden */}
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

          {/* Tedenski povzetek */}
          <div className="pt-2 border-t border-border space-y-2">
            <p className="text-[11px] text-muted-foreground font-body uppercase tracking-wide">Zadnji teden – potrebe drevesa</p>

            {/* Voda */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <Droplets className="w-4 h-4" style={{ color: "hsl(var(--weather-storm))" }} />
                  <span className="font-body font-medium">Voda</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  Narava: {naturalWaterWeek.toFixed(0)} L / Potreba: {wNeedWeek} L
                </span>
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

            {/* Svetloba */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4" style={{ color: "hsl(var(--accent))" }} />
                  <span className="font-body font-medium">Dodatna svetloba</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  Sonce: {naturalLightWeek.toFixed(0)} h / Potreba: {lNeedWeek} h
                </span>
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
              className="w-full mt-2"
              size="sm"
            >
              <Plus className="w-4 h-4" />
              Dodaj za naslednji teden
            </Button>
            {(pendingWater !== null || pendingLight !== null) && (
              <p className="text-[11px] text-primary font-body text-center">
                Pripravljeno: +{pendingWater ?? 0}L vode, +{pendingLight ?? 0} svetlobe
              </p>
            )}
          </div>

          <p className="text-[11px] text-muted-foreground font-body pt-2 border-t border-border leading-relaxed flex items-start gap-1.5">
            <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />
            Drevo se ocenjuje vsak teden. Stopnja se lahko spremeni največ enkrat na 7 dni. Ko se drevo poslabša, se simulacija ustavi.
          </p>
        </div>
      </div>
    </div>
  );
};

export default TreeMaintenanceView;

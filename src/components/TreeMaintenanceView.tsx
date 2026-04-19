import { useEffect, useMemo, useRef, useState } from "react";
import { Droplets, Zap, Sun, CloudRain, Thermometer } from "lucide-react";
import AmbientTree from "@/components/AmbientTree";
import SimulationControls from "@/components/SimulationControls";
import YearTimeline from "@/components/YearTimeline";
import { Button } from "@/components/ui/button";
import { generateYearWeather, DayWeather } from "@/lib/weather";
import { TreeState, getTreeState, dayToDate } from "@/lib/treeUtils";

// Drevesne potrebe – realistične vrednosti za mlado sadno drevo v SI:
// ~20-40 L vode/dan v vročini, ~5 L v hladnem; "elektrika" predstavlja energijo (svetloba)
// ki jo drevo potrebuje – uporabnik dopolni razliko, kar narava ne da.

// Dnevna potreba po vodi (L) glede na temperaturo
function waterNeed(w: DayWeather): number {
  if (w.temperature > 25) return 35;
  if (w.temperature > 18) return 22;
  if (w.temperature > 10) return 12;
  if (w.temperature > 2) return 6;
  return 3;
}
// Dnevna potreba po "svetlobi" (energija) – ekv. ur sonca
function lightNeed(w: DayWeather): number {
  // Drevo potrebuje vsaj ~6-8 ur svetlobe za optimalno rast
  if (w.temperature < 2) return 4; // mirovanje pozimi
  return 7;
}

interface DayLog {
  day: number;
  score: number;
  state: TreeState;
}

const TreeMaintenanceView = () => {
  const weather = useMemo(() => generateYearWeather(), []);
  const [day, setDay] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(3); // dni/sek
  const [health, setHealth] = useState(70); // 0-100
  const [waterToday, setWaterToday] = useState(0);
  const [lightToday, setLightToday] = useState(0);
  const [history, setHistory] = useState<DayLog[]>([]);
  const dayRef = useRef(0);
  const healthRef = useRef(70);
  const waterRef = useRef(0);
  const lightRef = useRef(0);

  dayRef.current = day;
  healthRef.current = health;
  waterRef.current = waterToday;
  lightRef.current = lightToday;

  // Loop simulacije
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      const d = dayRef.current;
      if (d >= 364) {
        setIsPlaying(false);
        return;
      }
      const w = weather[d];
      const wNeed = waterNeed(w);
      const lNeed = lightNeed(w);
      const wGot = w.rainMm * 1.5 + waterRef.current; // 1mm dežja ≈ 1.5 L pridobljeno
      const lGot = w.sunHours + lightRef.current * 0.4; // 1 enota dodane elektrike ≈ 0.4 ure svetlobe

      // Izračun dnevne spremembe zdravja
      const wRatio = Math.min(1.5, wGot / wNeed);
      const lRatio = Math.min(1.5, lGot / lNeed);

      // Optimalno: 0.9-1.2; premalo = upad, preveč vode = manjši upad
      let delta = 0;
      if (wRatio < 0.7) delta -= (0.7 - wRatio) * 8;
      else if (wRatio > 1.4) delta -= (wRatio - 1.4) * 4;
      else delta += 0.5;

      if (lRatio < 0.6) delta -= (0.6 - lRatio) * 6;
      else if (lRatio > 1.3) delta -= (lRatio - 1.3) * 2;
      else delta += 0.5;

      if (w.isDrought) delta -= 1.5;
      if (w.isHeatwave) delta -= 1;

      const newHealth = Math.max(0, Math.min(100, healthRef.current + delta));
      const state = getTreeState(newHealth);

      setHealth(newHealth);
      setHistory((h) => [...h, { day: d, score: newHealth, state }]);
      setWaterToday(0);
      setLightToday(0);
      setDay(d + 1);
    }, 1000 / speed);
    return () => clearInterval(interval);
  }, [isPlaying, speed, weather]);

  const reset = () => {
    setIsPlaying(false);
    setDay(0);
    setHealth(70);
    setHistory([]);
    setWaterToday(0);
    setLightToday(0);
  };

  const todayWeather = weather[Math.min(day, 364)];
  const date = dayToDate(Math.min(day, 364));
  const state = getTreeState(health);

  // Dogodki za timeline
  const events = useMemo(() => {
    return weather
      .map((w) => {
        if (w.isDrought) return { day: w.day, type: "drought" as const, label: "Suša" };
        if (w.isHeatwave) return { day: w.day, type: "heatwave" as const, label: "Vročinski val" };
        if (w.isStorm) return { day: w.day, type: "storm" as const, label: "Nevihta" };
        return null;
      })
      .filter((e): e is NonNullable<typeof e> => e !== null);
  }, [weather]);

  const wNeedToday = waterNeed(todayWeather);
  const lNeedToday = lightNeed(todayWeather);
  const naturalWater = todayWeather.rainMm * 1.5;
  const naturalLight = todayWeather.sunHours;

  return (
    <div className="grid lg:grid-cols-5 gap-6 items-start">
      {/* Drevo */}
      <div className="lg:col-span-3 flex flex-col items-center gap-4">
        <div className="w-full max-w-lg p-6 rounded-2xl bg-card border border-border shadow-sm">
          <AmbientTree state={state} score={health} transitionSpeed={3} />
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

        {/* Današnje vreme */}
        <div className="p-4 rounded-xl bg-card border border-border space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-base text-foreground">
              {date.dayOfMonth}. {date.monthName}
            </h3>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
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

          {/* Voda */}
          <div className="space-y-2 pt-2 border-t border-border">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <Droplets className="w-4 h-4" style={{ color: "hsl(var(--weather-storm))" }} />
                <span className="font-body font-medium">Voda</span>
              </div>
              <span className="text-xs text-muted-foreground">
                Narava: {naturalWater.toFixed(1)} L / Potreba: {wNeedToday} L
              </span>
            </div>
            <div className="flex gap-1">
              {[0, 5, 10, 20, 30].map((amt) => (
                <Button
                  key={amt}
                  size="sm"
                  variant={waterToday === amt ? "default" : "outline"}
                  onClick={() => setWaterToday(amt)}
                  className="h-8 px-2 text-xs flex-1"
                >
                  +{amt}L
                </Button>
              ))}
            </div>
          </div>

          {/* Elektrika / luč */}
          <div className="space-y-2 pt-2 border-t border-border">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-500" />
                <span className="font-body font-medium">Dodatna svetloba</span>
              </div>
              <span className="text-xs text-muted-foreground">
                Sonce: {naturalLight} h / Potreba: {lNeedToday} h
              </span>
            </div>
            <div className="flex gap-1">
              {[0, 1, 3, 6, 10].map((amt) => (
                <Button
                  key={amt}
                  size="sm"
                  variant={lightToday === amt ? "default" : "outline"}
                  onClick={() => setLightToday(amt)}
                  className="h-8 px-2 text-xs flex-1"
                >
                  +{amt}
                </Button>
              ))}
            </div>
          </div>

          <p className="text-[11px] text-muted-foreground font-body pt-2 border-t border-border leading-relaxed">
            Vsako sekundo = 1 dan. Ko narava ne zadosti potreb drevesa, mu pomagaj z dodatno vodo ali svetlobo. Premalo ali preveč obojega škoduje.
          </p>
        </div>
      </div>
    </div>
  );
};

export default TreeMaintenanceView;

import { useEffect, useMemo, useRef, useState } from "react";
import { Droplets, Zap, Plus, Minus, Users } from "lucide-react";
import AmbientTree from "@/components/AmbientTree";
import SimulationControls from "@/components/SimulationControls";
import YearTimeline from "@/components/YearTimeline";
import TimelineLegend from "@/components/TimelineLegend";
import { Button } from "@/components/ui/button";
import {
  FamilyMember,
  MemberRole,
  generateYearHousehold,
  calcDailyConsumption,
  consumptionToScore,
  consumptionByRole,
} from "@/lib/household";
import { TreeState, getTreeState, dayToDate } from "@/lib/treeUtils";

const roleLabels: Record<MemberRole, string> = {
  adult: "Odrasel",
  teen: "Najstnik",
  child: "Otrok",
};

const eventTypeMap: Record<string, "vacation" | "guests" | "weekend" | "holiday"> = {
  vacation: "vacation",
  guests: "guests",
  weekend: "weekend",
  holiday: "holiday",
};

interface DayLog {
  day: number;
  score: number;
  state: TreeState;
  water: number;
  electricity: number;
}

const HouseholdView = () => {
  const [family, setFamily] = useState<FamilyMember[]>([
    { id: "1", role: "adult", name: "Oseba 1" },
    { id: "2", role: "adult", name: "Oseba 2" },
    { id: "3", role: "child", name: "Otrok" },
  ]);

  const householdYear = useMemo(() => generateYearHousehold(7, family.length), [family.length]);

  const [day, setDay] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(3);
  const [history, setHistory] = useState<DayLog[]>([]);
  const [totals, setTotals] = useState({ water: 0, electricity: 0 });
  const dayRef = useRef(0);
  dayRef.current = day;

  // Smooth the score across the past N days so the curve has clearer trends
  // (raw daily score is too jittery and looks "flat / same shape" everywhere).
  const SMOOTH_WINDOW = 7;
  const smoothedRef = useRef<number[]>([]);

  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      const d = dayRef.current;
      if (d >= 364) {
        setIsPlaying(false);
        return;
      }
      const hd = householdYear[d];
      const { water, electricity } = calcDailyConsumption(family, hd);
      const rawScore = consumptionToScore(family, water, electricity);

      // Moving average + blend with raw -> clearer trends, fewer "same" oscillations
      smoothedRef.current = [...smoothedRef.current.slice(-(SMOOTH_WINDOW - 1)), rawScore];
      const avg = smoothedRef.current.reduce((s, v) => s + v, 0) / smoothedRef.current.length;
      const score = Math.round(avg * 0.75 + rawScore * 0.25);
      const state = getTreeState(score);

      setHistory((h) => [...h, { day: d, score, state, water, electricity }]);
      setTotals((t) => ({
        water: t.water + water,
        electricity: t.electricity + electricity,
      }));
      setDay(d + 1);
    }, 1000 / speed);
    return () => clearInterval(interval);
  }, [isPlaying, speed, householdYear, family]);

  const reset = () => {
    setIsPlaying(false);
    setDay(0);
    setHistory([]);
    setTotals({ water: 0, electricity: 0 });
  };

  const addMember = (role: MemberRole) => {
    if (family.length >= 6) return;
    setFamily((f) => [
      ...f,
      { id: `${Date.now()}`, role, name: `${roleLabels[role]} ${f.length + 1}` },
    ]);
    reset();
  };

  const removeMember = (id: string) => {
    setFamily((f) => f.filter((m) => m.id !== id));
    reset();
  };

  const today = householdYear[Math.min(day, 364)];
  const date = dayToDate(Math.min(day, 364));
  const todayConsumption = calcDailyConsumption(family, today);
  const currentScore = history.length > 0 ? history[history.length - 1].score : consumptionToScore(family, todayConsumption.water, todayConsumption.electricity);
  const state = getTreeState(currentScore);

  // Skupna ocena (povprečje zgodovine)
  const avgScore =
    history.length > 0
      ? Math.round(history.reduce((a, b) => a + b.score, 0) / history.length)
      : currentScore;

  // Dogodki za timeline – max 15, prioriteta po pomembnosti
  const events = useMemo(() => {
    const all: { day: number; type: "vacation" | "guests" | "weekend" | "holiday"; label?: string }[] = [];
    let lastVacation = -10;
    for (const hd of householdYear) {
      if (hd.type === "vacation" && hd.day - lastVacation > 5) {
        all.push({ day: hd.day, type: "vacation", label: "Počitnice" });
        lastVacation = hd.day;
      } else if (hd.type === "holiday") {
        all.push({ day: hd.day, type: "holiday", label: "Praznik" });
      } else if (hd.type === "guests") {
        all.push({ day: hd.day, type: "guests", label: `${hd.guestCount} gostov` });
      }
    }
    const priority: Record<string, number> = { vacation: 0, holiday: 1, guests: 2, weekend: 3 };
    all.sort((a, b) => priority[a.type] - priority[b.type]);
    const top = all.slice(0, 15);
    top.sort((a, b) => a.day - b.day);
    return top;
  }, [householdYear]);

  return (
    <div className="grid lg:grid-cols-5 gap-6 items-start">
      {/* Drevo */}
      <div className="lg:col-span-3 flex flex-col items-center gap-4">
        <div className="w-full max-w-lg p-6 rounded-2xl bg-card border border-border shadow-sm">
          <AmbientTree state={state} score={currentScore} transitionSpeed={speed} />
        </div>
        <YearTimeline
          history={history}
          events={events}
          currentDay={day}
        />
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

        {/* Družina */}
        <div className="p-4 rounded-xl bg-card border border-border space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              <h3 className="font-display text-base text-foreground">Družina ({family.length})</h3>
            </div>
          </div>
          <div className="space-y-1.5">
            {family.map((m) => (
              <div key={m.id} className="flex items-center justify-between p-2 rounded-lg bg-secondary/40 text-xs">
                <span className="font-body">
                  {roleLabels[m.role]} · {consumptionByRole[m.role].water} L · {consumptionByRole[m.role].electricity} kWh
                </span>
                <Button size="sm" variant="ghost" onClick={() => removeMember(m.id)} className="h-6 w-6 p-0">
                  <Minus className="w-3 h-3" />
                </Button>
              </div>
            ))}
          </div>
          <div className="flex gap-1">
            {(["adult", "teen", "child"] as MemberRole[]).map((r) => (
              <Button
                key={r}
                size="sm"
                variant="outline"
                onClick={() => addMember(r)}
                disabled={family.length >= 6}
                className="flex-1 h-8 text-xs"
              >
                <Plus className="w-3 h-3" />
                {roleLabels[r]}
              </Button>
            ))}
          </div>
        </div>

        {/* Današnji dan */}
        <div className="p-4 rounded-xl bg-card border border-border space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-base text-foreground">
              {date.dayOfMonth}. {date.monthName}
            </h3>
            <span
              className="text-xs px-2 py-0.5 rounded font-body"
              style={{
                backgroundColor: `hsl(var(--event-${today.type === "normal" ? "weekend" : today.type}) / 0.18)`,
                color: `hsl(var(--event-${today.type === "normal" ? "weekend" : today.type})-foreground)`,
              }}
            >
              {today.type === "normal" ? "Delovni dan" :
                today.type === "weekend" ? "Vikend" :
                today.type === "holiday" ? "Praznik" :
                today.type === "vacation" ? "Počitnice" :
                `${today.guestCount} gostov`}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="p-2 rounded-lg bg-secondary/40">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Droplets className="w-3 h-3" style={{ color: "hsl(var(--weather-storm))" }} />
                Voda
              </div>
              <div className="font-body font-semibold tabular-nums text-foreground">
                {todayConsumption.water} L
              </div>
            </div>
            <div className="p-2 rounded-lg bg-secondary/40">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Zap className="w-3 h-3" style={{ color: "hsl(var(--accent))" }} />
                Elektrika
              </div>
              <div className="font-body font-semibold tabular-nums text-foreground">
                {todayConsumption.electricity} kWh
              </div>
            </div>
          </div>

          {history.length > 0 && (
            <div className="pt-2 border-t border-border space-y-1 text-xs text-muted-foreground font-body">
              <div className="flex justify-between">
                <span>Skupaj voda:</span>
                <span className="tabular-nums text-foreground">{totals.water.toLocaleString("sl-SI")} L</span>
              </div>
              <div className="flex justify-between">
                <span>Skupaj elektrika:</span>
                <span className="tabular-nums text-foreground">{totals.electricity.toFixed(1)} kWh</span>
              </div>
              <div className="flex justify-between font-medium">
                <span>Povprečna ocena:</span>
                <span className="tabular-nums text-foreground">{avgScore}/100</span>
              </div>
            </div>
          )}

          <p className="text-[11px] text-muted-foreground font-body pt-2 border-t border-border leading-relaxed">
            Drevo raste glede na trajnostno porabo družine. Počitnice → poraba pade, gostje in prazniki → poraba naraste.
          </p>
        </div>

        <TimelineLegend variant="household" />
      </div>
    </div>
  );
};

export default HouseholdView;

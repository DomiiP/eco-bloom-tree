import { useState, useMemo } from "react";
import { Zap, Droplets, Car, TreeDeciduous } from "lucide-react";
import AmbientTree from "@/components/AmbientTree";
import ConsumptionSlider from "@/components/ConsumptionSlider";
import InfoPanel from "@/components/InfoPanel";

type TreeState = "dead" | "weak" | "healthy" | "thriving";

function calculateScore(electricity: number, water: number, mobility: number): number {
  // Lower consumption = higher score
  const elecScore = Math.max(0, 100 - (electricity / 50) * 100);
  const waterScore = Math.max(0, 100 - (water / 300) * 100);
  const mobilityScore = Math.max(0, 100 - (mobility / 200) * 100);
  return Math.round(elecScore * 0.4 + waterScore * 0.3 + mobilityScore * 0.3);
}

function getTreeState(score: number): TreeState {
  if (score <= 20) return "dead";
  if (score <= 45) return "weak";
  if (score <= 75) return "healthy";
  return "thriving";
}

const Index = () => {
  const [electricity, setElectricity] = useState(15); // kWh/day
  const [water, setWater] = useState(120); // L/day
  const [mobility, setMobility] = useState(30); // km/day by car

  const score = useMemo(() => calculateScore(electricity, water, mobility), [electricity, water, mobility]);
  const treeState = getTreeState(score);

  return (
    <div className="min-h-screen bg-background font-body">
      {/* Header */}
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <TreeDeciduous className="w-6 h-6 text-primary" />
            <h1 className="font-display text-xl text-foreground">EcoTree</h1>
          </div>
          <a
            href="https://fe.uni-lj.si/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-fe text-fe-foreground text-xs font-body font-medium hover:opacity-90 transition-opacity"
          >
            FE UNI-LJ
          </a>
        </div>
      </header>

      <main className="container max-w-6xl mx-auto px-4 py-8">
        {/* Hero */}
        <div className="text-center mb-10">
          <h2 className="font-display text-3xl md:text-4xl text-foreground mb-3">
            Ambientni prikaz ogljičnega odtisa
          </h2>
          <p className="text-muted-foreground font-body max-w-lg mx-auto text-sm leading-relaxed">
            Spreminjajte porabo elektrike, vode in mobilnosti ter opazujte, kako vaše vedenje vpliva na digitalno drevo. Koncept za HCI raziskavo na FE UNI-LJ.
          </p>
        </div>

        <div className="grid lg:grid-cols-5 gap-8 items-start">
          {/* Tree visualization - ambient display */}
          <div className="lg:col-span-3 flex flex-col items-center">
            <div className="w-full max-w-lg p-8 rounded-2xl bg-card border border-border shadow-sm">
              <AmbientTree state={treeState} score={score} />
            </div>
            
            {/* Score bar */}
            <div className="w-full max-w-lg mt-4">
              <div className="h-2 rounded-full bg-secondary overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-[2000ms] ease-out"
                  style={{
                    width: `${score}%`,
                    backgroundColor: treeState === "dead" ? "hsl(var(--tree-dead))"
                      : treeState === "weak" ? "hsl(var(--tree-weak))"
                      : treeState === "healthy" ? "hsl(var(--tree-healthy))"
                      : "hsl(var(--tree-thriving))",
                  }}
                />
              </div>
              <div className="flex justify-between mt-1 text-xs text-muted-foreground font-body">
                <span>Mrtvo</span>
                <span>Šibko</span>
                <span>Zdravo</span>
                <span>Cvetoče</span>
              </div>
            </div>
          </div>

          {/* Controls - reflective UI (phone-like) */}
          <div className="lg:col-span-2 space-y-4">
            <div className="p-1 rounded-2xl border border-border bg-card/50">
              <div className="p-3 border-b border-border">
                <h3 className="font-display text-lg text-foreground">Poraba</h3>
                <p className="text-xs text-muted-foreground font-body">Prilagodite vrednosti in opazujte spremembe</p>
              </div>
              <div className="p-3 space-y-3">
                <ConsumptionSlider
                  label="Elektrika"
                  value={electricity}
                  min={0}
                  max={50}
                  step={1}
                  unit="kWh/dan"
                  icon={Zap}
                  onChange={setElectricity}
                  color="hsl(38, 80%, 55%)"
                />
                <ConsumptionSlider
                  label="Voda"
                  value={water}
                  min={0}
                  max={300}
                  step={5}
                  unit="L/dan"
                  icon={Droplets}
                  onChange={setWater}
                  color="hsl(210, 85%, 50%)"
                />
                <ConsumptionSlider
                  label="Mobilnost (avto)"
                  value={mobility}
                  min={0}
                  max={200}
                  step={5}
                  unit="km/dan"
                  icon={Car}
                  onChange={setMobility}
                  color="hsl(0, 50%, 50%)"
                />
              </div>
            </div>

            <InfoPanel state={treeState} />
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-16 pt-6 border-t border-border text-center">
          <p className="text-xs text-muted-foreground font-body">
            Prototip za HCI raziskavo • Fakulteta za elektrotehniko, Univerza v Ljubljani •{" "}
            <a href="https://fe.uni-lj.si/" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground transition-colors">
              fe.uni-lj.si
            </a>
          </p>
          <p className="text-xs text-muted-foreground font-body mt-1 opacity-60">
            Data physicalization · Emotional design · Sustainable HCI
          </p>
        </footer>
      </main>
    </div>
  );
};

export default Index;

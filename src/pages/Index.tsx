import { useState } from "react";
import { TreeDeciduous, Sprout, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import TreeMaintenanceView from "@/components/TreeMaintenanceView";
import HouseholdView from "@/components/HouseholdView";

type View = "maintenance" | "household";

const Index = () => {
  const [view, setView] = useState<View>("maintenance");

  return (
    <div className="min-h-screen bg-background font-body">
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <TreeDeciduous className="w-6 h-6 text-primary" />
            <h1 className="font-display text-xl text-foreground">EcoTree</h1>
          </div>

          <div className="flex items-center gap-1 p-1 rounded-lg bg-secondary">
            <Button
              size="sm"
              variant={view === "maintenance" ? "default" : "ghost"}
              onClick={() => setView("maintenance")}
              className="h-8 text-xs"
            >
              <Sprout className="w-4 h-4" />
              Vzdrževanje drevesa
            </Button>
            <Button
              size="sm"
              variant={view === "household" ? "default" : "ghost"}
              onClick={() => setView("household")}
              className="h-8 text-xs"
            >
              <Home className="w-4 h-4" />
              Poraba virov
            </Button>
          </div>

          <a
            href="https://fe.uni-lj.si/"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-fe text-fe-foreground text-xs font-body font-medium hover:opacity-90 transition-opacity"
          >
            FE UNI-LJ
          </a>
        </div>
      </header>

      <main className="container max-w-6xl mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h2 className="font-display text-2xl md:text-3xl text-foreground mb-2">
            {view === "maintenance" ? "Vzdrževanje drevesa skozi leto" : "Poraba virov v gospodinjstvu"}
          </h2>
          <p className="text-muted-foreground font-body max-w-2xl mx-auto text-sm leading-relaxed">
            {view === "maintenance"
              ? "Pomagaj drevesu skozi leto. Ko narava ne da dovolj vode ali sonca, ga moraš dopolniti – a pazi, da ne pretiravaš. Vsaka sekunda predstavlja en dan."
              : "Poraba družine se spreminja: vikendi, prazniki, gostje in počitnice vplivajo na zdravje drevesa. Sestavi družino in opazuj leto trajnosti."}
          </p>
        </div>

        {view === "maintenance" ? <TreeMaintenanceView /> : <HouseholdView />}

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

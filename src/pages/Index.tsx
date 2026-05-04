import { TreeDeciduous } from "lucide-react";
import TreeMaintenanceView from "@/components/TreeMaintenanceView";

const Index = () => {
  return (
    <div className="min-h-screen bg-background font-body">
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <TreeDeciduous className="w-6 h-6 text-primary" />
            <h1 className="font-display text-xl text-foreground">EcoTree</h1>
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

      <main className="container max-w-[1440px] mx-auto px-4 py-8">
        <div className="text-center mb-8 space-y-3">
          <h2 className="font-display text-2xl md:text-3xl text-foreground">
            Vzdrževanje drevesa skozi leto
          </h2>
          <p className="text-muted-foreground font-body max-w-2xl mx-auto text-sm leading-relaxed">
            Glavna ideja je spremljati, kako varčevanje z vodo in elektriko doma vpliva na drevo. Manjša poraba pomeni več zaloge za liste, barvo in gostoto krošnje.
          </p>
        </div>

        <TreeMaintenanceView />

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

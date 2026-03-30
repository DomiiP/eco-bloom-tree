import { TreeDeciduous, Lightbulb, Info } from "lucide-react";

type TreeState = "dead" | "weak" | "healthy" | "thriving";

const tips: Record<TreeState, string[]> = {
  dead: [
    "Vaša poraba znatno presega trajnostne meje.",
    "Premislite o zmanjšanju vožnje z avtomobilom.",
    "Preverite energetsko učinkovitost naprav.",
  ],
  weak: [
    "Drevo okrevava – manjše spremembe pomagajo!",
    "Krajše prhe prihranijo veliko vode.",
    "Ugasnite luči, ko zapustite prostor.",
  ],
  healthy: [
    "Dobro vam gre! Drevo je zdravo.",
    "Razmislite o javnem prevozu enkrat na teden.",
    "LED žarnice zmanjšajo porabo do 75%.",
  ],
  thriving: [
    "Odlično! Vaš odtis je vzoren.",
    "Nadaljujte s trajnostnimi navadami.",
    "Delite svoje znanje z drugimi!",
  ],
};

const InfoPanel = ({ state }: { state: TreeState }) => {
  return (
    <div className="space-y-4 p-5 rounded-xl bg-card border border-border">
      <div className="flex items-center gap-2">
        <Lightbulb className="w-5 h-5 text-accent" />
        <h3 className="font-display text-lg text-foreground">Refleksija</h3>
      </div>
      <ul className="space-y-2">
        {tips[state].map((tip, i) => (
          <li key={i} className="flex gap-2 text-sm font-body text-muted-foreground">
            <span className="text-primary mt-0.5">•</span>
            {tip}
          </li>
        ))}
      </ul>
      
      <div className="mt-4 pt-4 border-t border-border">
        <div className="flex items-start gap-2">
          <Info className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
          <p className="text-xs text-muted-foreground font-body leading-relaxed">
            Koncept temelji na <strong>data physicalization</strong> in <strong>emotional design</strong> pristopih.
            Ambientni prikaz spodbuja počasno razmišljanje (<em>slow thinking</em>) o vašem ekološkem vplivu.
          </p>
        </div>
      </div>
    </div>
  );
};

export default InfoPanel;

interface LegendItem {
  icon: string;
  label: string;
}

const weatherLegend: LegendItem[] = [
  { icon: "🌵", label: "Suša" },
  { icon: "🔥", label: "Vročinski val" },
  { icon: "⛈️", label: "Nevihta" },
];

const householdLegend: LegendItem[] = [
  { icon: "✈️", label: "Počitnice" },
  { icon: "👥", label: "Gostje" },
  { icon: "🎉", label: "Praznik" },
  { icon: "🏠", label: "Vikend" },
];

interface Props {
  variant: "weather" | "household";
}

const TimelineLegend = ({ variant }: Props) => {
  const items = variant === "weather" ? weatherLegend : householdLegend;
  const stateItems = [
    { color: "hsl(var(--tree-thriving))", label: "Cvetoče" },
    { color: "hsl(var(--tree-healthy))", label: "Zdravo" },
    { color: "hsl(var(--tree-weak))", label: "Šibko / Umirajoče" },
    { color: "hsl(var(--tree-dead))", label: "Mrtvo" },
  ];

  return (
    <div className="p-4 rounded-xl bg-card border border-border space-y-3">
      <h4 className="font-display text-sm text-foreground">Legenda</h4>

      <div className="space-y-1.5">
        <p className="text-[11px] text-muted-foreground font-body uppercase tracking-wide">Dogodki</p>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs font-body text-foreground">
          {items.map((it) => (
            <div key={it.label} className="flex items-center gap-2">
              <span className="text-base leading-none">{it.icon}</span>
              <span>{it.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-1.5 pt-2 border-t border-border">
        <p className="text-[11px] text-muted-foreground font-body uppercase tracking-wide">Pasovi zdravja</p>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs font-body text-foreground">
          {stateItems.map((s) => (
            <div key={s.label} className="flex items-center gap-2">
              <span
                className="w-3 h-3 rounded-sm shrink-0"
                style={{ backgroundColor: s.color, opacity: 0.7 }}
              />
              <span>{s.label}</span>
            </div>
          ))}
          <div className="flex items-center gap-2 col-span-2">
            <span className="w-3 h-0.5 bg-primary shrink-0" />
            <span>Krivulja zdravja drevesa</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TimelineLegend;

import { TreeState, MONTHS_SI } from "@/lib/treeUtils";

interface YearTimelineProps {
  history: { day: number; score: number; state: TreeState }[];
  events: { day: number; type: "drought" | "heatwave" | "storm" | "vacation" | "guests" | "weekend" | "holiday"; label?: string }[];
  currentDay: number;
}

const stateToColor = (s: TreeState) => {
  switch (s) {
    case "dead": return "hsl(var(--tree-dead))";
    case "dying": return "hsl(var(--tree-dying))";
    case "weak": return "hsl(var(--tree-weak))";
    case "healthy": return "hsl(var(--tree-healthy))";
    case "thriving": return "hsl(var(--tree-thriving))";
  }
};

const eventIcon = (t: string) => {
  switch (t) {
    case "drought": return "🌵";
    case "heatwave": return "🔥";
    case "storm": return "⛈️";
    case "vacation": return "✈️";
    case "guests": return "👥";
    case "weekend": return "🏠";
    case "holiday": return "🎉";
    default: return "•";
  }
};

const YearTimeline = ({ history, events, currentDay }: YearTimelineProps) => {
  const width = 100; // %
  const totalDays = 365;

  // Polyline za graf zdravja
  const points = history
    .map((h) => {
      const x = (h.day / totalDays) * 100;
      const y = 100 - h.score; // invert
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <div className="w-full p-4 rounded-xl bg-card border border-border">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-display text-sm text-foreground">Leto v drevesu</h4>
        <span className="text-xs text-muted-foreground font-body">
          Dan {currentDay + 1} / 365
        </span>
      </div>

      {/* Graf zdravja */}
      <div className="relative w-full h-24 bg-secondary/40 rounded-lg overflow-hidden mb-2">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full">
          {/* Pas zdravja */}
          <rect x="0" y="0" width="100" height="25" fill="hsl(var(--tree-thriving) / 0.08)" />
          <rect x="0" y="25" width="100" height="30" fill="hsl(var(--tree-healthy) / 0.08)" />
          <rect x="0" y="55" width="100" height="25" fill="hsl(var(--tree-weak) / 0.08)" />
          <rect x="0" y="80" width="100" height="20" fill="hsl(var(--tree-dead) / 0.08)" />
          {points && (
            <polyline
              points={points}
              fill="none"
              stroke="hsl(var(--primary))"
              strokeWidth="0.8"
              vectorEffect="non-scaling-stroke"
            />
          )}
          {/* Trenutni dan */}
          <line
            x1={(currentDay / totalDays) * 100}
            y1="0"
            x2={(currentDay / totalDays) * 100}
            y2="100"
            stroke="hsl(var(--foreground))"
            strokeWidth="0.5"
            vectorEffect="non-scaling-stroke"
            opacity="0.6"
          />
        </svg>
      </div>

      {/* Mesečni pasovi z dogodki */}
      <div className="relative w-full h-7">
        <div className="absolute inset-0 flex">
          {MONTHS_SI.map((m, i) => (
            <div
              key={m}
              className="flex-1 border-r border-border/40 last:border-r-0 text-[10px] text-muted-foreground font-body flex items-center justify-center"
            >
              {m}
            </div>
          ))}
        </div>
        {/* Dogodki kot ikonice */}
        {events.map((e, idx) => (
          <div
            key={idx}
            className="absolute top-0 -translate-x-1/2 text-[10px]"
            style={{ left: `${(e.day / totalDays) * 100}%` }}
            title={e.label || e.type}
          >
            {eventIcon(e.type)}
          </div>
        ))}
        {/* Trenutni dan kazalec */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-foreground/60"
          style={{ left: `${(currentDay / totalDays) * 100}%` }}
        />
      </div>
    </div>
  );
};

export default YearTimeline;

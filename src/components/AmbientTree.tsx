import { useMemo } from "react";

type TreeState = "dead" | "weak" | "healthy" | "thriving";

interface AmbientTreeProps {
  state: TreeState;
  score: number;
  transitionSpeed: number; // 1-5, controls animation duration
}

const stateConfig = {
  dead: { leaves: 0, trunkColor: "#5a3a2a", leafColor: "#8B4513", bgGlow: "rgba(139,69,19,0.08)", label: "Mrtvo" },
  weak: { leaves: 8, trunkColor: "#6b4c3b", leafColor: "#c9a84c", bgGlow: "rgba(201,168,76,0.1)", label: "Šibko" },
  healthy: { leaves: 18, trunkColor: "#5a3a2a", leafColor: "#4a9e5c", bgGlow: "rgba(74,158,92,0.12)", label: "Zdravo" },
  thriving: { leaves: 28, trunkColor: "#4a3020", leafColor: "#2d7a3e", bgGlow: "rgba(45,122,62,0.15)", label: "Cvetoče" },
};

// Leaf shape path centered at origin, ~20x16 size
const leafPath = (cx: number, cy: number, size: number, rotation: number) => {
  const s = size / 10;
  return `M ${cx} ${cy - 8 * s} C ${cx + 5 * s} ${cy - 8 * s} ${cx + 9 * s} ${cy - 3 * s} ${cx + 9 * s} ${cy + 2 * s} C ${cx + 9 * s} ${cy + 6 * s} ${cx + 5 * s} ${cy + 8 * s} ${cx} ${cy + 10 * s} C ${cx - 5 * s} ${cy + 8 * s} ${cx - 9 * s} ${cy + 6 * s} ${cx - 9 * s} ${cy + 2 * s} C ${cx - 9 * s} ${cy - 3 * s} ${cx - 5 * s} ${cy - 8 * s} ${cx} ${cy - 8 * s} Z`;
};

const AmbientTree = ({ state, score, transitionSpeed }: AmbientTreeProps) => {
  const config = stateConfig[state];
  // Speed: 1=slow (6s), 5=fast (0.5s)
  const baseDuration = Math.max(0.5, 6 - (transitionSpeed - 1) * 1.375); // 6s to 0.5s
  const durationMs = baseDuration * 1000;

  const leaves = useMemo(() => {
    const result = [];
    for (let i = 0; i < 28; i++) {
      const angle = (i / 28) * Math.PI * 2;
      const radius = 30 + (((i * 7 + 13) % 17) / 17) * 50;
      const cx = 150 + Math.cos(angle) * radius;
      const cy = 100 + Math.sin(angle) * radius * 0.7;
      const size = 8 + (((i * 11 + 3) % 13) / 13) * 12;
      const rotation = ((i * 37) % 360);
      result.push({ cx, cy, size, rotation, key: i });
    }
    return result;
  }, []);

  const visibleCount = config.leaves;

  return (
    <div className="relative flex flex-col items-center">
      {/* Ambient glow */}
      <div
        className="absolute inset-0 rounded-3xl"
        style={{
          background: `radial-gradient(ellipse at center 60%, ${config.bgGlow}, transparent 70%)`,
          transition: `all ${durationMs}ms ease-out`,
        }}
      />

      <svg
        viewBox="0 0 300 280"
        className="w-full max-w-md"
        style={{
          animation: state !== "dead" ? "gentle-sway 6s ease-in-out infinite" : "none",
          transition: `all ${durationMs}ms ease-out`,
        }}
      >
        {/* Ground */}
        <ellipse cx="150" cy="260" rx="100" ry="12" fill="hsl(142,20%,85%)" opacity="0.5" />

        {/* Trunk */}
        <path
          d="M140 260 Q138 200 130 170 Q125 150 135 130 L145 130 Q142 150 145 170 Q148 200 150 260 Z"
          fill={config.trunkColor}
          style={{ transition: `all ${durationMs}ms ease-out` }}
        />
        <path
          d="M150 260 Q152 200 160 170 Q165 150 155 130 L145 130 Q148 150 145 170 Q142 200 140 260 Z"
          fill={config.trunkColor}
          opacity="0.85"
          style={{ transition: `all ${durationMs}ms ease-out` }}
        />

        {/* Branches */}
        {state !== "dead" && (
          <>
            <path d="M135 150 Q110 130 95 120" stroke={config.trunkColor} strokeWidth="4" fill="none" style={{ transition: `all ${durationMs}ms ease-out` }} />
            <path d="M155 150 Q180 125 195 115" stroke={config.trunkColor} strokeWidth="3.5" fill="none" style={{ transition: `all ${durationMs}ms ease-out` }} />
            <path d="M140 170 Q115 160 100 155" stroke={config.trunkColor} strokeWidth="3" fill="none" style={{ transition: `all ${durationMs}ms ease-out` }} />
            <path d="M155 165 Q175 155 190 150" stroke={config.trunkColor} strokeWidth="2.5" fill="none" style={{ transition: `all ${durationMs}ms ease-out` }} />
          </>
        )}

        {/* Leaves - actual leaf shapes */}
        {leaves.map((leaf) => {
          const visible = leaf.key < visibleCount;
          return (
            <g key={leaf.key}>
              <path
                d={leafPath(leaf.cx, leaf.cy, leaf.size, leaf.rotation)}
                fill={config.leafColor}
                transform={`rotate(${leaf.rotation}, ${leaf.cx}, ${leaf.cy})`}
                style={{
                  opacity: visible ? 0.75 : 0,
                  transform: `rotate(${leaf.rotation}deg)`,
                  transformOrigin: `${leaf.cx}px ${leaf.cy}px`,
                  transition: `opacity ${durationMs}ms ease-out, fill ${durationMs}ms ease-out`,
                }}
              />
              {/* Leaf vein */}
              {visible && (
                <line
                  x1={leaf.cx}
                  y1={leaf.cy - leaf.size * 0.6}
                  x2={leaf.cx}
                  y2={leaf.cy + leaf.size * 0.8}
                  stroke={config.trunkColor}
                  strokeWidth="0.5"
                  opacity="0.3"
                  transform={`rotate(${leaf.rotation}, ${leaf.cx}, ${leaf.cy})`}
                  style={{ transition: `opacity ${durationMs}ms ease-out` }}
                />
              )}
            </g>
          );
        })}

        {/* Dead state: fallen leaves on ground */}
        {state === "dead" && (
          <>
            <path d={leafPath(120, 255, 6, 0)} fill="#8B4513" opacity="0.4" transform="rotate(30, 120, 255)" />
            <path d={leafPath(170, 258, 5, 0)} fill="#a0522d" opacity="0.35" transform="rotate(-20, 170, 258)" />
            <path d={leafPath(145, 256, 4, 0)} fill="#8B4513" opacity="0.3" transform="rotate(60, 145, 256)" />
          </>
        )}
      </svg>

      {/* State label */}
      <div className="mt-2 text-center">
        <span
          className="font-display text-2xl"
          style={{ color: config.leafColor, transition: `color ${durationMs}ms ease-out` }}
        >
          {config.label}
        </span>
        <p className="text-sm text-muted-foreground font-body mt-1">
          Eco rezultat: {Math.round(score)}/100
        </p>
      </div>
    </div>
  );
};

export default AmbientTree;
